package com.bidvault.api.controller;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;
import com.bidvault.api.exception.ApiException;
import com.bidvault.api.service.EmailService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ApiController {
  private final JdbcTemplate jdbc;
  private final PasswordEncoder encoder;
  private final EmailService emailService;
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final Pattern NAME_PATTERN = Pattern.compile("^[\\p{L}]+(?:[ '\\-][\\p{L}]+)*$");
  private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$", Pattern.CASE_INSENSITIVE);

  public ApiController(JdbcTemplate jdbc, PasswordEncoder encoder, EmailService emailService) {
    this.jdbc = jdbc;
    this.encoder = encoder;
    this.emailService = emailService;
  }

  @GetMapping("/health")
  Map<String, Object> health() {
    return Map.of("status", "ok", "database", "bidvault");
  }

  @PostMapping("/auth/login")
  Map<String, Object> login(@RequestBody LoginRequest request) {
    var users = jdbc.queryForList("""
        SELECT u.identificador usuario_id, u.email, u.password_hash, u.password_temporal, u.rol,
               p.identificador persona_id, p.nombre, p.direccion, pa.nombre pais,
               CASE WHEN p.foto IS NULL THEN NULL ELSE CONCAT('data:image/jpeg;base64,', TO_BASE64(p.foto)) END foto_uri,
               c.categoria, c.admitido
        FROM usuarios_app u
        JOIN personas p ON p.identificador = u.persona
        LEFT JOIN clientes c ON c.identificador = p.identificador
        LEFT JOIN paises pa ON pa.numero = c.numeroPais
        WHERE u.email = ?
        """, request.email());
    if (users.isEmpty()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "El mail o la clave son incorrectos o no te encuentras registrado");
    }
    if (!encoder.matches(request.password(), Objects.toString(users.get(0).get("password_hash")))) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "El mail o la clave son incorrectos o no te encuentras registrado");
    }
    var user = users.get(0);
    if (!"si".equals(user.get("admitido"))) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Tu cuenta todavia esta pendiente de validacion.");
    }
    user.remove("password_hash");
    return Map.of("token", "demo-token-" + user.get("usuario_id"), "user", user);
  }

  @PostMapping("/auth/forgot-password")
  @Transactional
  Map<String, Object> forgotPassword(@RequestBody Map<String, String> request) {
    String rawEmail = request.get("email");
    require(rawEmail, "El email es obligatorio");
    String email = rawEmail.trim().toLowerCase();
    var users = jdbc.queryForList("""
        SELECT u.identificador usuario_id, p.nombre, c.admitido
        FROM usuarios_app u
        JOIN personas p ON p.identificador = u.persona
        LEFT JOIN clientes c ON c.identificador = p.identificador
        WHERE u.email = ?
        """, email);
    if (users.isEmpty()) {
      return Map.of("enviado", true);
    }
    var user = users.get(0);
    if (!"si".equals(user.get("admitido"))) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Tu cuenta todavia esta pendiente de validacion.");
    }
    String temporaryPassword = temporaryPassword();
    jdbc.update("""
        UPDATE usuarios_app
        SET password_hash=?, password_temporal='si'
        WHERE identificador=?
        """, encoder.encode(temporaryPassword), user.get("usuario_id"));
    emailService.sendTemporaryPassword(email, Objects.toString(user.get("nombre"), "Usuario"), temporaryPassword);
    return Map.of("enviado", true);
  }

  @PostMapping("/auth/register")
  @Transactional
  Map<String, Object> register(@RequestBody RegisterRequest request) {
    require(request.nombre(), "El nombre es obligatorio");
    require(request.apellido(), "El apellido es obligatorio");
    require(request.email(), "El email es obligatorio");
    require(request.documento(), "El documento es obligatorio");
    require(request.direccion(), "El domicilio es obligatorio");
    require(request.dniFrenteBase64(), "La foto del frente del DNI es obligatoria");
    require(request.dniDorsoBase64(), "La foto del dorso del DNI es obligatoria");
    validateName(request.nombre(), "El nombre no puede contener números ni caracteres inválidos");
    validateName(request.apellido(), "El apellido no puede contener números ni caracteres inválidos");
    validateEmail(request.email());
    if (!request.documento().trim().matches("\\d+")) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "El DNI debe contener solo números");
    }
    String email = request.email().trim().toLowerCase();
    if (!jdbc.queryForList("SELECT identificador FROM usuarios_app WHERE email=?", email).isEmpty()) {
      throw new ApiException(HttpStatus.CONFLICT, "Ya existe una cuenta registrada con ese correo electrónico.");
    }
    int numeroPais = resolveCountry(request.pais(), request.numeroPais());

    int personaId = insertAndReturnKey(
        "INSERT INTO personas (documento, nombre, direccion, estado) VALUES (?, ?, ?, 'activo')",
        request.documento(), request.nombre() + " " + request.apellido(), request.direccion());
    jdbc.update("""
        INSERT INTO clientes (identificador, numeroPais, admitido, categoria, verificador)
        VALUES (?, ?, 'no', 'comun', 1)
        """, personaId, numeroPais);
    jdbc.update("""
        INSERT INTO duenios (identificador, numeroPais, `verificaciónFinanciera`, `verificaciónJudicial`, calificacionRiesgo, verificador)
        VALUES (?, ?, 'no', 'no', 6, 1)
        """, personaId, numeroPais);
    String temporaryPassword = temporaryPassword();
    jdbc.update("""
        INSERT INTO usuarios_app (persona, email, password_hash, password_temporal, rol)
        VALUES (?, ?, ?, 'si', 'cliente')
        """, personaId, email, encoder.encode(temporaryPassword));
    jdbc.update("""
        INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
        VALUES (?, 'Registrado', 'Su registro fue recibido. Le enviaremos un correo cuando la validación se complete.', 'importante')
        """, personaId);
    jdbc.update("""
        INSERT INTO documentos_verificacion (persona, tipo_documento, frente, dorso, estado, observacion)
        VALUES (?, 'DNI', ?, ?, 'aprobada_simulada', 'Validacion simulada desde el registro')
        """, personaId, decodeBase64Image(request.dniFrenteBase64()), decodeBase64Image(request.dniDorsoBase64()));
    return Map.of("persona_id", personaId, "estado", "pendiente_validacion");
  }

  @GetMapping("/countries")
  List<Map<String, Object>> countries() {
    return jdbc.queryForList("SELECT numero, nombre, nombreCorto FROM paises ORDER BY nombre");
  }

  @GetMapping("/auctions")
  List<Map<String, Object>> auctions(@RequestParam(required = false) Integer clienteId,
                                      @RequestParam(required = false) String tab,
                                      @RequestParam(required = false) String q) {
    String sql = """
        SELECT s.identificador id, c.descripcion titulo, s.fecha, s.hora, s.categoria,
               s.ubicacion,
               CASE
                 WHEN COALESCE(se.estado_app, s.estado)='abierta' AND s.fecha=CURDATE() THEN 'abierta'
                 WHEN COALESCE(se.estado_app, s.estado)='carrada' THEN 'carrada'
                 ELSE 'programada'
               END estado,
               MIN(i.precioBase) precio_desde, sp.imagen imagen_portada,
               CASE WHEN s.categoria IN ('oro','platino') THEN 'USD' ELSE 'ARS' END moneda,
               COUNT(i.identificador) piezas,
               EXISTS(SELECT 1 FROM favoritos f WHERE f.subasta = s.identificador AND f.cliente = COALESCE(?, -1)) favorito
        FROM subastas s
        JOIN catalogos c ON c.subasta = s.identificador
        JOIN itemsCatalogo i ON i.catalogo = c.identificador
        LEFT JOIN subastas_portadas sp ON sp.subasta = s.identificador
        LEFT JOIN subastas_estados_app se ON se.subasta = s.identificador
        WHERE (? IS NULL OR c.descripcion LIKE CONCAT('%', ?, '%'))
        GROUP BY s.identificador, c.descripcion, s.fecha, s.hora,
                 CASE
                   WHEN COALESCE(se.estado_app, s.estado)='abierta' AND s.fecha=CURDATE() THEN 'abierta'
                   WHEN COALESCE(se.estado_app, s.estado)='carrada' THEN 'carrada'
                   ELSE 'programada'
                 END,
                 s.categoria, s.ubicacion, sp.imagen
        ORDER BY s.fecha, s.hora
        """;
    return jdbc.queryForList(sql, clienteId, q, q);
  }

  @GetMapping("/auctions/{id}")
  Map<String, Object> auction(@PathVariable int id, @RequestParam(required = false) Integer clienteId) {
    var rows = jdbc.queryForList("""
        SELECT s.identificador id, c.identificador catalogo_id, c.descripcion titulo, s.fecha, s.hora,
               CASE
                 WHEN COALESCE(se.estado_app, s.estado)='abierta' AND s.fecha=CURDATE() THEN 'abierta'
                 WHEN COALESCE(se.estado_app, s.estado)='carrada' THEN 'carrada'
                 ELSE 'programada'
               END estado,
               s.categoria, s.ubicacion, s.capacidadAsistentes, s.tieneDeposito, s.seguridadPropia,
               sp.imagen imagen_portada,
               p.nombre subastador, EXISTS(SELECT 1 FROM favoritos f WHERE f.subasta=s.identificador AND f.cliente=COALESCE(?, -1)) favorito
        FROM subastas s
        JOIN catalogos c ON c.subasta = s.identificador
        LEFT JOIN subastas_portadas sp ON sp.subasta = s.identificador
        LEFT JOIN subastas_estados_app se ON se.subasta = s.identificador
        LEFT JOIN personas p ON p.identificador = s.subastador
        WHERE s.identificador = ?
        """, clienteId, id);
    if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "Subasta no encontrada");
    var items = jdbc.queryForList("""
        SELECT i.identificador item_id, pr.identificador producto_id, pr.descripcionCatalogo descripcion,
               pr.descripcionCompleta pdf, pr.disponible, i.precioBase, i.comision, i.subastado,
               pe.nombre duenio_nombre,
               COALESCE(MAX(pu.importe), i.precioBase) mejor_oferta,
               (SELECT pe.nombre FROM pujos p2 JOIN asistentes a2 ON a2.identificador=p2.asistente JOIN personas pe ON pe.identificador=a2.cliente
                WHERE p2.item=i.identificador ORDER BY p2.importe DESC, p2.identificador DESC LIMIT 1) mejor_postor
        FROM itemsCatalogo i
        JOIN productos pr ON pr.identificador = i.producto
        JOIN personas pe ON pe.identificador = pr.duenio
        LEFT JOIN pujos pu ON pu.item = i.identificador
        WHERE i.catalogo = ?
        GROUP BY i.identificador, pr.identificador, pr.descripcionCatalogo, pr.descripcionCompleta, pr.disponible, i.precioBase, i.comision, i.subastado, pe.nombre
        """, rows.get(0).get("catalogo_id"));
    for (var item : items) {
      var productId = ((Number) item.get("producto_id")).intValue();
      var images = jdbc.queryForList("""
          SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(foto)) url
          FROM fotos
          WHERE producto=?
          ORDER BY identificador
          """, String.class, productId);
      item.put("imagenes", images);
      if (!images.isEmpty()) item.put("imagen", images.get(0));
    }
    return Map.of("auction", rows.get(0), "items", items);
  }

  @PutMapping("/auctions/{id}/cover")
  @Transactional
  Map<String, Object> updateAuctionCover(@PathVariable int id, @RequestBody AuctionCoverRequest request) {
    require(request.imagen(), "La imagen de portada es obligatoria");
    one("SELECT identificador FROM subastas WHERE identificador=?", "Subasta no encontrada", id);
    jdbc.update("""
        INSERT INTO subastas_portadas (subasta, imagen, mime_type, descripcion)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE imagen=VALUES(imagen), mime_type=VALUES(mime_type), descripcion=VALUES(descripcion)
        """, id, request.imagen(), blankDefault(request.mimeType(), "image/jpeg"), request.descripcion());
    return one("""
        SELECT subasta, imagen imagen_portada, mime_type, descripcion
        FROM subastas_portadas
        WHERE subasta=?
        """, "Portada no encontrada", id);
  }

  @PostMapping("/auctions/{id}/join")
  @Transactional
  Map<String, Object> joinAuction(@PathVariable int id, @RequestBody JoinAuctionRequest request) {
    ensureCanParticipate(request.clienteId(), id, false);
    var activeSessions = jdbc.queryForList("""
        SELECT ss.identificador sesion_id, ss.subasta, c.descripcion titulo
        FROM sesiones_subasta ss
        JOIN subastas s ON s.identificador = ss.subasta
        JOIN catalogos c ON c.subasta = s.identificador
        WHERE ss.cliente=? AND ss.activa='si'
        ORDER BY ss.conectado_en DESC, ss.identificador DESC
        LIMIT 1
        """, request.clienteId());
    if (!activeSessions.isEmpty() && ((Number) activeSessions.get(0).get("subasta")).intValue() != id) {
      throw new ApiException(HttpStatus.CONFLICT, "Ya estás conectado a otra subasta. Salí de esa sala antes de ingresar a una nueva.");
    }
    var payment = one("""
        SELECT identificador, verificado
        FROM medios_pago
        WHERE identificador=? AND cliente=? AND activo='si' AND verificado='si'
        """, "El medio de pago debe estar verificado para ingresar a la subasta", request.medioPagoId(), request.clienteId());
    ensureAuctionGuaranteeTable();
    jdbc.update("""
        INSERT INTO garantias_subasta (cliente, subasta, medio_pago, estado_verificacion)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE medio_pago=VALUES(medio_pago), estado_verificacion=VALUES(estado_verificacion), creado_en=CURRENT_TIMESTAMP
        """, request.clienteId(), id, request.medioPagoId(), payment.get("verificado"));
    int postor = 100 + request.clienteId();
    jdbc.update("INSERT IGNORE INTO asistentes (numeroPostor, cliente, subasta) VALUES (?, ?, ?)", postor, request.clienteId(), id);
    int sessionId = activeSessions.isEmpty()
        ? insertAndReturnKey("INSERT INTO sesiones_subasta (cliente, subasta, activa) VALUES (?, ?, 'si')", request.clienteId(), id)
        : ((Number) activeSessions.get(0).get("sesion_id")).intValue();
    return Map.of("sesion_id", sessionId, "numero_postor", postor, "medio_pago_id", request.medioPagoId(), "garantia", true);
  }

  @PostMapping("/auctions/{id}/leave")
  @Transactional
  Map<String, Object> leaveAuction(@PathVariable int id, @RequestBody ClientRequest request) {
    int updated = jdbc.update("UPDATE sesiones_subasta SET activa='no' WHERE cliente=? AND subasta=? AND activa='si'", request.clienteId(), id);
    return Map.of("closed", updated);
  }

  @PostMapping("/bids")
  @Transactional
  Map<String, Object> bid(@RequestBody BidRequest request) {
    requirePositive(request.importe(), "El importe debe ser mayor a cero");
    var data = one("""
        SELECT i.identificador item_id, i.precioBase, i.comision, c.subasta, s.categoria subasta_categoria,
               COALESCE(MAX(pu.importe), i.precioBase) mejor_oferta
        FROM itemsCatalogo i
        JOIN catalogos c ON c.identificador = i.catalogo
        JOIN subastas s ON s.identificador = c.subasta
        LEFT JOIN pujos pu ON pu.item = i.identificador
        WHERE i.identificador = ?
        GROUP BY i.identificador, i.precioBase, i.comision, c.subasta, s.categoria
        FOR UPDATE
        """, "Ítem no encontrado", request.itemId());
    int subastaId = ((Number) data.get("subasta")).intValue();
    ensureCanParticipate(request.clienteId(), subastaId, false);
    ensureAuctionGuarantee(request.clienteId(), subastaId);
    BigDecimal base = (BigDecimal) data.get("precioBase");
    BigDecimal current = (BigDecimal) data.get("mejor_oferta");
    BigDecimal amount = request.importe().setScale(2, RoundingMode.HALF_UP);
    String category = data.get("subasta_categoria").toString();
    BigDecimal min = current.add(base.multiply(new BigDecimal("0.01"))).setScale(2, RoundingMode.HALF_UP);
    BigDecimal max = current.add(base.multiply(new BigDecimal("0.20"))).setScale(2, RoundingMode.HALF_UP);
    if (amount.compareTo(min) < 0) throw new ApiException(HttpStatus.BAD_REQUEST, "La puja mínima es " + min);
    if (!category.equals("oro") && !category.equals("platino") && amount.compareTo(max) > 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "La puja máxima para esta categoría es " + max);
    }
    int asistenteId = ensureAssistant(request.clienteId(), subastaId);
    jdbc.update("UPDATE pujos SET ganador='no' WHERE item=?", request.itemId());
    int bidId = insertAndReturnKey("INSERT INTO pujos (asistente, item, importe, ganador) VALUES (?, ?, ?, 'si')",
        asistenteId, request.itemId(), amount);
    return Map.of("puja_id", bidId, "item_id", request.itemId(), "importe", amount, "ganador", "si");
  }

  @PostMapping("/auctions/{id}/close-item/{itemId}")
  @Transactional
  Map<String, Object> closeItem(@PathVariable int id, @PathVariable int itemId) {
    var winner = jdbc.queryForList("""
        SELECT p.identificador puja_id, a.cliente, p.importe, pr.duenio, pr.identificador producto, i.comision
        FROM pujos p
        JOIN asistentes a ON a.identificador=p.asistente
        JOIN itemsCatalogo i ON i.identificador=p.item
        JOIN productos pr ON pr.identificador=i.producto
        WHERE p.item=? ORDER BY p.importe DESC, p.identificador DESC LIMIT 1
        """, itemId);
    if (winner.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "No hay pujas para cerrar");
    var w = winner.get(0);
    BigDecimal importe = (BigDecimal) w.get("importe");
    BigDecimal comisionPct = (BigDecimal) w.get("comision");
    BigDecimal comision = importe.multiply(comisionPct).setScale(2, RoundingMode.HALF_UP);
    int registro = insertAndReturnKey("""
        INSERT INTO registroDeSubasta (subasta, duenio, producto, cliente, importe, comision)
        VALUES (?, ?, ?, ?, ?, ?)
        """, id, w.get("duenio"), w.get("producto"), w.get("cliente"), importe, comision);
    jdbc.update("UPDATE itemsCatalogo SET subastado='si' WHERE identificador=?", itemId);
    jdbc.update("UPDATE productos SET disponible='no' WHERE identificador=?", w.get("producto"));
    jdbc.update("""
        INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
        VALUES (?, 'Ganaste la subasta', ?, 'importante')
        """, w.get("cliente"), "Importe: " + importe + ". Comisión: " + comision + ". Coordiná envío o retiro.");
    return Map.of("registro_id", registro, "importe", importe, "comision", comision);
  }

  @GetMapping("/payments/{clienteId}")
  List<Map<String, Object>> payments(@PathVariable int clienteId) {
    return jdbc.queryForList("SELECT * FROM medios_pago WHERE cliente=? ORDER BY activo DESC, identificador DESC", clienteId);
  }

  @PostMapping("/payments")
  Map<String, Object> addPayment(@RequestBody PaymentRequest request) {
    int id = insertAndReturnKey("""
        INSERT INTO medios_pago (cliente, tipo, moneda, entidad, referencia, monto_reservado, verificado, activo)
        VALUES (?, ?, ?, ?, ?, ?, 'no', 'si')
        """, request.clienteId(), request.tipo(), request.moneda(), request.entidad(), request.referencia(), request.montoReservado());
    return Map.of("medio_pago_id", id, "verificado", "no");
  }

  @PostMapping("/favorites")
  Map<String, Object> favorite(@RequestBody FavoriteRequest request) {
    jdbc.update("INSERT IGNORE INTO favoritos (cliente, subasta) VALUES (?, ?)", request.clienteId(), request.subastaId());
    return Map.of("favorito", true);
  }

  @DeleteMapping("/favorites")
  Map<String, Object> unfavorite(@RequestBody FavoriteRequest request) {
    jdbc.update("DELETE FROM favoritos WHERE cliente=? AND subasta=?", request.clienteId(), request.subastaId());
    return Map.of("favorito", false);
  }

  @PostMapping("/sell-requests")
  @Transactional
  Map<String, Object> sellRequest(@RequestBody SellRequest request) {
    if (request.fotos() == null || request.fotos().size() < 6) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Debe cargar al menos 6 fotos");
    }
    int id = insertAndReturnKey("""
        INSERT INTO solicitudes_productos
        (duenio, titulo, descripcion, origen_licito, declaracion_propiedad, acepta_devolucion_cargo, estado)
        VALUES (?, ?, ?, 'si', 'si', 'si', 'pendiente')
        """, request.duenioId(), request.titulo(), request.descripcion());
    for (String url : request.fotos()) {
      jdbc.update("INSERT INTO solicitudes_fotos (solicitud, url) VALUES (?, ?)", id, url);
    }
    jdbc.update("""
        INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
        VALUES (?, 'Producto enviado a revisión', 'Recibimos tu solicitud y la empresa revisará el bien.', 'importante')
        """, request.duenioId());
    return Map.of("solicitud_id", id, "estado", "pendiente");
  }

  @GetMapping("/profile/{clienteId}")
  Map<String, Object> profile(@PathVariable int clienteId) {
    return one("""
        SELECT p.identificador persona_id, p.nombre, p.direccion, pa.nombre pais, u.email, u.password_temporal,
               c.categoria, c.admitido,
               CASE WHEN p.foto IS NULL THEN NULL ELSE CONCAT('data:image/jpeg;base64,', TO_BASE64(p.foto)) END foto_uri
        FROM personas p
        JOIN usuarios_app u ON u.persona = p.identificador
        LEFT JOIN clientes c ON c.identificador = p.identificador
        LEFT JOIN paises pa ON pa.numero = c.numeroPais
        WHERE p.identificador=?
        """, "Cliente no encontrado", clienteId);
  }

  @GetMapping("/profile/{clienteId}/metrics")
  Map<String, Object> metrics(@PathVariable int clienteId) {
    var base = one("""
        SELECT p.nombre, c.categoria, c.admitido,
               (SELECT COUNT(*) FROM asistentes a WHERE a.cliente=c.identificador) subastas_asistidas,
               (SELECT COUNT(*) FROM pujos pu JOIN asistentes a ON a.identificador=pu.asistente WHERE a.cliente=c.identificador AND pu.ganador='si') subastas_ganadas,
               (SELECT COUNT(*) FROM pujos pu JOIN asistentes a ON a.identificador=pu.asistente WHERE a.cliente=c.identificador) pujas_realizadas,
               (SELECT COALESCE(SUM(r.importe + r.comision), 0) FROM registroDeSubasta r WHERE r.cliente=c.identificador) total_pagado
        FROM clientes c JOIN personas p ON p.identificador=c.identificador
        WHERE c.identificador=?
        """, "Cliente no encontrado", clienteId);
    var history = jdbc.queryForList("""
        SELECT s.identificador subasta_id, ca.descripcion subasta, i.identificador item_id, pu.importe, pu.ganador
        FROM pujos pu
        JOIN asistentes a ON a.identificador=pu.asistente
        JOIN itemsCatalogo i ON i.identificador=pu.item
        JOIN catalogos ca ON ca.identificador=i.catalogo
        JOIN subastas s ON s.identificador=ca.subasta
        WHERE a.cliente=? ORDER BY pu.identificador DESC
        """, clienteId);
    var categoryRows = jdbc.queryForList("""
        SELECT s.categoria,
               COUNT(*) participaciones,
               SUM(CASE WHEN pu.ganador='si' THEN 1 ELSE 0 END) ganadas
        FROM pujos pu
        JOIN asistentes a ON a.identificador=pu.asistente
        JOIN itemsCatalogo i ON i.identificador=pu.item
        JOIN catalogos ca ON ca.identificador=i.catalogo
        JOIN subastas s ON s.identificador=ca.subasta
        WHERE a.cliente=?
        GROUP BY s.categoria
        """, clienteId);
    var metrics = new java.util.HashMap<String, Object>(base);
    for (Map<String, Object> row : categoryRows) {
      String category = String.valueOf(row.get("categoria")).toLowerCase();
      int participaciones = ((Number) row.get("participaciones")).intValue();
      int ganadas = ((Number) row.get("ganadas")).intValue();
      int percent = participaciones == 0 ? 0 : Math.round((ganadas * 100f) / participaciones);
      metrics.put("exito_" + category, percent);
    }
    return Map.of("profile", metrics, "history", history);
  }

  @PutMapping("/profile/{clienteId}")
  @Transactional
  Map<String, Object> updateProfile(@PathVariable int clienteId, @RequestBody UpdateProfileRequest request) {
    require(request.nombre(), "El nombre es obligatorio");
    require(request.apellido(), "El apellido es obligatorio");
    require(request.email(), "El email es obligatorio");
    require(request.direccion(), "El domicilio es obligatorio");
    require(request.pais(), "El país es obligatorio");
    validateName(request.nombre(), "El nombre no puede contener números ni caracteres inválidos");
    validateName(request.apellido(), "El apellido no puede contener números ni caracteres inválidos");
    validateEmail(request.email());
    int numeroPais = resolveCountry(request.pais(), null);
    String email = request.email().trim().toLowerCase();
    if (!jdbc.queryForList("SELECT identificador FROM usuarios_app WHERE email=? AND persona<>?", email, clienteId).isEmpty()) {
      throw new ApiException(HttpStatus.CONFLICT, "Ya existe una cuenta registrada con ese correo electrónico.");
    }

    String fullName = request.nombre().trim() + " " + request.apellido().trim();
    jdbc.update("UPDATE personas SET nombre=?, direccion=? WHERE identificador=?", fullName, request.direccion().trim(), clienteId);
    jdbc.update("UPDATE usuarios_app SET email=? WHERE persona=?", email, clienteId);
    jdbc.update("UPDATE clientes SET numeroPais=? WHERE identificador=?", numeroPais, clienteId);
    jdbc.update("UPDATE duenios SET numeroPais=? WHERE identificador=?", numeroPais, clienteId);
    if (request.password() != null && !request.password().isBlank()) {
      jdbc.update("UPDATE usuarios_app SET password_hash=?, password_temporal='no' WHERE persona=?",
          encoder.encode(request.password()), clienteId);
    }
    if (request.fotoBase64() != null && !request.fotoBase64().isBlank()) {
      String clean = request.fotoBase64().contains(",")
          ? request.fotoBase64().substring(request.fotoBase64().indexOf(',') + 1)
          : request.fotoBase64();
      jdbc.update("UPDATE personas SET foto=? WHERE identificador=?", Base64.getDecoder().decode(clean), clienteId);
    }
    var updated = one("""
        SELECT p.identificador persona_id, p.nombre, p.direccion, pa.nombre pais, u.email, u.password_temporal,
               c.categoria, c.admitido,
               CASE WHEN p.foto IS NULL THEN NULL ELSE CONCAT('data:image/jpeg;base64,', TO_BASE64(p.foto)) END foto_uri
        FROM personas p
        JOIN usuarios_app u ON u.persona = p.identificador
        LEFT JOIN clientes c ON c.identificador = p.identificador
        LEFT JOIN paises pa ON pa.numero = c.numeroPais
        WHERE p.identificador=?
        """, "Cliente no encontrado", clienteId);
    return updated;
  }

  @PutMapping("/profile/{clienteId}/password")
  @Transactional
  Map<String, Object> updatePassword(@PathVariable int clienteId, @RequestBody UpdatePasswordRequest request) {
    require(request.password(), "La nueva contraseña es obligatoria");
    jdbc.update("UPDATE usuarios_app SET password_hash=?, password_temporal='no' WHERE persona=?",
        encoder.encode(request.password()), clienteId);
    return one("""
        SELECT p.identificador persona_id, p.nombre, p.direccion, pa.nombre pais, u.email, u.password_temporal,
               c.categoria, c.admitido,
               CASE WHEN p.foto IS NULL THEN NULL ELSE CONCAT('data:image/jpeg;base64,', TO_BASE64(p.foto)) END foto_uri
        FROM personas p
        JOIN usuarios_app u ON u.persona = p.identificador
        LEFT JOIN clientes c ON c.identificador = p.identificador
        LEFT JOIN paises pa ON pa.numero = c.numeroPais
        WHERE p.identificador=?
        """, "Cliente no encontrado", clienteId);
  }

  @GetMapping("/notifications/{clienteId}")
  List<Map<String, Object>> notifications(@PathVariable int clienteId) {
    return jdbc.queryForList("SELECT * FROM mensajes WHERE cliente=? ORDER BY creado_en DESC", clienteId);
  }

  @GetMapping("/shipping/addresses")
  List<Map<String, Object>> addresses(@RequestParam int userId) {
    ensureAddressTable();
    return jdbc.queryForList("""
        SELECT identificador id, titulo, direccion, ciudad, pais, predeterminada, creado_en
        FROM direcciones_entrega
        WHERE cliente=?
        ORDER BY predeterminada DESC, identificador DESC
        """, userId);
  }

  @GetMapping("/shipping/shipments")
  List<Map<String, Object>> shipments(@RequestParam int userId) {
    return jdbc.queryForList("""
        SELECT e.identificador id, e.estado, e.costo, e.codigo_seguimiento tracking,
               e.direccion, r.identificador registro_id, r.importe, r.comision,
               p.identificador producto_id, p.descripcionCatalogo producto, p.descripcionCompleta descripcion,
               fc.identificador factura_id, fc.numero factura_numero, fc.total factura_total, fc.estado factura_estado,
               (SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(f.foto)) FROM fotos f WHERE f.producto=p.identificador LIMIT 1) imagen
        FROM envios e
        JOIN registroDeSubasta r ON r.identificador = e.registro
        JOIN productos p ON p.identificador = r.producto
        LEFT JOIN facturas_compra fc ON fc.registro = r.identificador
        WHERE r.cliente=?
        ORDER BY e.identificador DESC
        """, userId);
  }

  @GetMapping("/purchases/pending-shipping")
  List<Map<String, Object>> pendingShippingPurchases(@RequestParam int userId) {
    return jdbc.queryForList("""
        SELECT r.identificador registro_id, r.importe, r.comision,
               (r.importe + r.comision) total,
               s.identificador subasta_id, ca.descripcion subasta,
               p.identificador producto_id, p.descripcionCatalogo producto, p.descripcionCompleta descripcion,
               (SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(f.foto)) FROM fotos f WHERE f.producto=p.identificador LIMIT 1) imagen
        FROM registroDeSubasta r
        JOIN productos p ON p.identificador = r.producto
        JOIN subastas s ON s.identificador = r.subasta
        JOIN catalogos ca ON ca.subasta = s.identificador
        WHERE r.cliente=?
          AND NOT EXISTS (SELECT 1 FROM envios e WHERE e.registro=r.identificador)
        ORDER BY r.identificador DESC
        """, userId);
  }

  @GetMapping("/invoices")
  List<Map<String, Object>> invoices(@RequestParam int userId) {
    return jdbc.queryForList("""
        SELECT fc.identificador id, fc.numero, fc.subtotal, fc.comision, fc.costo_envio, fc.total, fc.estado,
               fc.creado_en, fc.pagado_en, fc.registro registro_id, fc.envio envio_id, fc.medio_pago medio_pago_id,
               p.descripcionCatalogo producto, p.descripcionCompleta descripcion, e.direccion,
               (SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(f.foto)) FROM fotos f WHERE f.producto=p.identificador LIMIT 1) imagen
        FROM facturas_compra fc
        JOIN registroDeSubasta r ON r.identificador = fc.registro
        JOIN productos p ON p.identificador = r.producto
        LEFT JOIN envios e ON e.identificador = fc.envio
        WHERE r.cliente=?
        ORDER BY fc.identificador DESC
        """, userId);
  }

  @PostMapping("/shipping/shipments")
  @Transactional
  Map<String, Object> createShipment(@RequestBody ShipmentRequest request) {
    ensureAddressTable();
    var address = one("""
        SELECT direccion, ciudad, pais
        FROM direcciones_entrega
        WHERE identificador=? AND cliente=?
        """, "Dirección no encontrada", request.addressId(), request.userId());
    var pending = jdbc.queryForList("""
        SELECT r.identificador
        FROM registroDeSubasta r
        WHERE r.cliente=?
          AND NOT EXISTS (SELECT 1 FROM envios e WHERE e.registro=r.identificador)
        ORDER BY r.identificador DESC
        LIMIT 1
        """, request.userId());
    if (pending.isEmpty()) {
      throw new ApiException(HttpStatus.NOT_FOUND, "No hay compras pendientes de envío");
    }
    String fullAddress = address.get("direccion") + ", " + address.get("ciudad") + ", " + address.get("pais");
    String tracking = "BV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    int id = insertAndReturnKey("""
        INSERT INTO envios (registro, direccion, estado, costo, codigo_seguimiento)
        VALUES (?, ?, 'pendiente', 0, ?)
        """, pending.get(0).get("identificador"), fullAddress, tracking);
    int registroId = ((Number) pending.get(0).get("identificador")).intValue();
    ensureInvoiceForShipment(registroId, id);
    return one("""
        SELECT e.identificador id, e.estado, e.costo, e.codigo_seguimiento tracking,
               e.direccion, r.identificador registro_id, r.importe, r.comision,
               p.descripcionCatalogo producto, p.descripcionCompleta descripcion,
               fc.identificador factura_id, fc.numero factura_numero, fc.subtotal factura_subtotal,
               fc.comision factura_comision, fc.costo_envio factura_envio, fc.total factura_total,
               fc.estado factura_estado,
               (SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(f.foto)) FROM fotos f WHERE f.producto=p.identificador LIMIT 1) imagen
        FROM envios e
        JOIN registroDeSubasta r ON r.identificador=e.registro
        JOIN productos p ON p.identificador=r.producto
        LEFT JOIN facturas_compra fc ON fc.registro=r.identificador
        WHERE e.identificador=?
        """, "Envío no encontrado", id);
  }

  @PutMapping("/invoices/{invoiceId}/pay")
  @Transactional
  Map<String, Object> payInvoice(@PathVariable int invoiceId, @RequestBody PayInvoiceRequest request) {
    var invoice = one("""
        SELECT fc.identificador, r.cliente
        FROM facturas_compra fc
        JOIN registroDeSubasta r ON r.identificador=fc.registro
        WHERE fc.identificador=?
        """, "Factura no encontrada", invoiceId);
    if (((Number) invoice.get("cliente")).intValue() != request.userId()) {
      throw new ApiException(HttpStatus.FORBIDDEN, "La factura no pertenece al usuario");
    }
    var payment = one("""
        SELECT identificador, verificado
        FROM medios_pago
        WHERE identificador=? AND cliente=? AND activo='si'
        """, "Medio de pago no encontrado", request.paymentMethodId(), request.userId());
    if (!"si".equals(payment.get("verificado"))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "El medio de pago está pendiente de verificación");
    }
    jdbc.update("""
        UPDATE facturas_compra
        SET medio_pago=?, estado='pagada', pagado_en=CURRENT_TIMESTAMP
        WHERE identificador=?
        """, request.paymentMethodId(), invoiceId);
    return one("""
        SELECT fc.identificador id, fc.numero, fc.subtotal, fc.comision, fc.costo_envio, fc.total, fc.estado,
               fc.creado_en, fc.pagado_en, fc.registro registro_id, fc.envio envio_id, fc.medio_pago medio_pago_id,
               p.descripcionCatalogo producto, p.descripcionCompleta descripcion, e.direccion
        FROM facturas_compra fc
        JOIN registroDeSubasta r ON r.identificador=fc.registro
        JOIN productos p ON p.identificador=r.producto
        LEFT JOIN envios e ON e.identificador=fc.envio
        WHERE fc.identificador=?
        """, "Factura no encontrada", invoiceId);
  }

  @PostMapping("/shipping/addresses")
  @Transactional
  Map<String, Object> addAddress(@RequestBody AddressRequest request) {
    ensureAddressTable();
    require(request.titulo(), "El título de la dirección es obligatorio");
    require(request.direccion(), "La dirección es obligatoria");
    if ("si".equals(request.predeterminada())) {
      jdbc.update("UPDATE direcciones_entrega SET predeterminada='no' WHERE cliente=?", request.userId());
    }
    int id = insertAndReturnKey("""
        INSERT INTO direcciones_entrega (cliente, titulo, direccion, ciudad, pais, predeterminada)
        VALUES (?, ?, ?, ?, ?, ?)
        """, request.userId(), request.titulo(), request.direccion(),
        blankDefault(request.ciudad(), "Buenos Aires"), blankDefault(request.pais(), "Argentina"),
        blankDefault(request.predeterminada(), "si"));
    return one("SELECT identificador id, titulo, direccion, ciudad, pais, predeterminada FROM direcciones_entrega WHERE identificador=?",
        "Dirección no encontrada", id);
  }

  @PutMapping("/shipping/addresses/{id}")
  @Transactional
  Map<String, Object> updateAddress(@PathVariable int id, @RequestBody AddressRequest request) {
    ensureAddressTable();
    require(request.titulo(), "El título de la dirección es obligatorio");
    require(request.direccion(), "La dirección es obligatoria");
    if ("si".equals(request.predeterminada())) {
      jdbc.update("UPDATE direcciones_entrega SET predeterminada='no' WHERE cliente=?", request.userId());
    }
    jdbc.update("""
        UPDATE direcciones_entrega
        SET titulo=?, direccion=?, ciudad=?, pais=?, predeterminada=?
        WHERE identificador=? AND cliente=?
        """, request.titulo(), request.direccion(), blankDefault(request.ciudad(), "Buenos Aires"),
        blankDefault(request.pais(), "Argentina"), blankDefault(request.predeterminada(), "no"), id, request.userId());
    return one("SELECT identificador id, titulo, direccion, ciudad, pais, predeterminada FROM direcciones_entrega WHERE identificador=?",
        "Dirección no encontrada", id);
  }

  @GetMapping("/my-pieces/{duenioId}")
  List<Map<String, Object>> myPieces(@PathVariable int duenioId) {
    return jdbc.queryForList("""
        SELECT sp.identificador id, sp.titulo, sp.descripcion, sp.estado, sp.motivo_rechazo,
               sp.deposito, sp.seguro, sp.creado_en,
               spe.identificador propuesta_id, spe.fecha_subasta, spe.hora_subasta, spe.ubicacion propuesta_ubicacion,
               spe.precio_base propuesta_precio_base, spe.moneda propuesta_moneda, spe.comision propuesta_comision,
               spe.poliza_compania, spe.poliza_numero, spe.poliza_cobertura, spe.estado propuesta_estado,
               (SELECT sf.url
                FROM solicitudes_fotos sf
                WHERE sf.solicitud=sp.identificador
                  AND (sf.url LIKE 'data:image/%' OR sf.url LIKE 'http://%' OR sf.url LIKE 'https://%')
                ORDER BY sf.identificador
                LIMIT 1) foto
        FROM solicitudes_productos sp
        LEFT JOIN solicitudes_propuestas_empresa spe ON spe.solicitud=sp.identificador AND spe.estado='pendiente_usuario'
        WHERE sp.duenio=?
        ORDER BY sp.creado_en DESC
        """, duenioId);
  }

  @PutMapping("/my-pieces/{solicitudId}/proposal/accept")
  @Transactional
  Map<String, Object> acceptPieceProposal(@PathVariable int solicitudId, @RequestBody ClientRequest request) {
    var proposal = one("""
        SELECT spe.identificador propuesta_id
        FROM solicitudes_propuestas_empresa spe
        JOIN solicitudes_productos sp ON sp.identificador=spe.solicitud
        WHERE spe.solicitud=? AND sp.duenio=? AND spe.estado='pendiente_usuario'
        """, "Propuesta no encontrada", solicitudId, request.clienteId());
    jdbc.update("UPDATE solicitudes_propuestas_empresa SET estado='aceptada', respondido_en=CURRENT_TIMESTAMP WHERE identificador=?",
        proposal.get("propuesta_id"));
    jdbc.update("UPDATE solicitudes_productos SET estado='aceptado', motivo_rechazo=NULL WHERE identificador=? AND duenio=?",
        solicitudId, request.clienteId());
    return one("SELECT identificador id, titulo, estado FROM solicitudes_productos WHERE identificador=?",
        "Solicitud no encontrada", solicitudId);
  }

  @PutMapping("/my-pieces/{solicitudId}/proposal/reject")
  @Transactional
  Map<String, Object> rejectPieceProposal(@PathVariable int solicitudId, @RequestBody ClientRequest request) {
    var proposal = one("""
        SELECT spe.identificador propuesta_id
        FROM solicitudes_propuestas_empresa spe
        JOIN solicitudes_productos sp ON sp.identificador=spe.solicitud
        WHERE spe.solicitud=? AND sp.duenio=? AND spe.estado='pendiente_usuario'
        """, "Propuesta no encontrada", solicitudId, request.clienteId());
    jdbc.update("UPDATE solicitudes_propuestas_empresa SET estado='rechazada', respondido_en=CURRENT_TIMESTAMP WHERE identificador=?",
        proposal.get("propuesta_id"));
    jdbc.update("""
        UPDATE solicitudes_productos
        SET estado='devuelto',
            motivo_rechazo='El usuario rechazo la propuesta de precio base y comision de la empresa. Devolucion con cargo pendiente de liquidacion por la empresa.'
        WHERE identificador=? AND duenio=?
        """, solicitudId, request.clienteId());
    return one("SELECT identificador id, titulo, estado, motivo_rechazo FROM solicitudes_productos WHERE identificador=?",
        "Solicitud no encontrada", solicitudId);
  }

  private void ensureCanParticipate(int clienteId, int subastaId, boolean requirePayment) {
    var rows = jdbc.queryForList("""
        SELECT c.admitido, c.categoria cliente_categoria, s.categoria subasta_categoria,
               EXISTS(SELECT 1 FROM medios_pago m WHERE m.cliente=c.identificador AND m.verificado='si' AND m.activo='si') pago_ok
        FROM clientes c CROSS JOIN subastas s
        WHERE c.identificador=? AND s.identificador=?
        """, clienteId, subastaId);
    if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "Cliente o subasta inexistente");
    var row = rows.get(0);
    if (!"si".equals(row.get("admitido"))) throw new ApiException(HttpStatus.FORBIDDEN, "Cliente no admitido");
    if (rank(row.get("cliente_categoria").toString()) < rank(row.get("subasta_categoria").toString())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Tu categoria no tiene permiso para ingresar a esta subasta");
    }
    if (requirePayment && ((Number) row.get("pago_ok")).intValue() == 0) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Se requiere al menos un medio de pago verificado");
    }
  }

  private int ensureAssistant(int clienteId, int subastaId) {
    jdbc.update("INSERT IGNORE INTO asistentes (numeroPostor, cliente, subasta) VALUES (?, ?, ?)", 100 + clienteId, clienteId, subastaId);
    return jdbc.queryForObject("SELECT identificador FROM asistentes WHERE cliente=? AND subasta=?", Integer.class, clienteId, subastaId);
  }

  private void ensureAuctionGuarantee(int clienteId, int subastaId) {
    ensureAuctionGuaranteeTable();
    var rows = jdbc.queryForList("""
        SELECT identificador
        FROM garantias_subasta
        WHERE cliente=? AND subasta=?
        """, clienteId, subastaId);
    if (rows.isEmpty()) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Debe seleccionar un medio de garantia para participar");
    }
  }

  private void ensureInvoiceForShipment(int registroId, int envioId) {
    var existing = jdbc.queryForList("SELECT identificador FROM facturas_compra WHERE registro=?", registroId);
    if (!existing.isEmpty()) {
      jdbc.update("UPDATE facturas_compra SET envio=? WHERE registro=?", envioId, registroId);
      return;
    }
    var row = one("""
        SELECT importe, comision
        FROM registroDeSubasta
        WHERE identificador=?
        """, "Compra no encontrada", registroId);
    BigDecimal subtotal = (BigDecimal) row.get("importe");
    BigDecimal comision = (BigDecimal) row.get("comision");
    BigDecimal costoEnvio = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    BigDecimal total = subtotal.add(comision).add(costoEnvio).setScale(2, RoundingMode.HALF_UP);
    String numero = "BV-F-" + registroId + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    jdbc.update("""
        INSERT INTO facturas_compra (registro, envio, numero, subtotal, comision, costo_envio, total, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente_pago')
        """, registroId, envioId, numero, subtotal, comision, costoEnvio, total);
  }

  private Map<String, Object> one(String sql, String notFoundMessage, Object... args) {
    var rows = jdbc.queryForList(sql, args);
    if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, notFoundMessage);
    return rows.get(0);
  }

  private int insertAndReturnKey(String sql, Object... args) {
    KeyHolder key = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
      for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
      return ps;
    }, key);
    return Objects.requireNonNull(key.getKey()).intValue();
  }

  private void require(String value, String message) {
    if (value == null || value.isBlank()) throw new ApiException(HttpStatus.BAD_REQUEST, message);
  }

  private void requirePositive(BigDecimal value, String message) {
    if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, message);
  }

  private byte[] decodeBase64Image(String value) {
    String clean = value.contains(",") ? value.substring(value.indexOf(',') + 1) : value;
    try {
      return Base64.getDecoder().decode(clean);
    } catch (IllegalArgumentException ex) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "La imagen del DNI no tiene un formato valido");
    }
  }

  private void validateName(String value, String message) {
    if (!NAME_PATTERN.matcher(value.trim()).matches()) throw new ApiException(HttpStatus.BAD_REQUEST, message);
  }

  private void validateEmail(String value) {
    if (!EMAIL_PATTERN.matcher(value.trim()).matches()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "El correo electrónico no tiene un formato válido");
    }
  }

  private int resolveCountry(String pais, Integer numeroPais) {
    if (numeroPais != null) {
      var byNumber = jdbc.queryForList("SELECT numero FROM paises WHERE numero=?", numeroPais);
      if (!byNumber.isEmpty()) return numeroPais;
    }
    require(pais, "El país es obligatorio");
    var rows = jdbc.queryForList("""
        SELECT numero
        FROM paises
        WHERE LOWER(nombre)=LOWER(?) OR LOWER(nombreCorto)=LOWER(?)
        """, pais.trim(), pais.trim());
    if (rows.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "El país ingresado no es válido");
    return ((Number) rows.get(0).get("numero")).intValue();
  }

  private int rank(String category) {
    return switch (category) {
      case "comun" -> 1;
      case "especial" -> 2;
      case "plata" -> 3;
      case "oro" -> 4;
      case "platino" -> 5;
      default -> 0;
    };
  }

  private String temporaryPassword() {
    String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    StringBuilder value = new StringBuilder("BV-");
    for (int i = 0; i < 8; i++) {
      value.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
    }
    return value.toString();
  }

  private void ensureAddressTable() {
    jdbc.execute("""
        CREATE TABLE IF NOT EXISTS direcciones_entrega (
          identificador INT NOT NULL AUTO_INCREMENT,
          cliente INT NOT NULL,
          titulo VARCHAR(120) NOT NULL,
          direccion VARCHAR(250) NOT NULL,
          ciudad VARCHAR(120) NOT NULL,
          pais VARCHAR(120) NOT NULL,
          predeterminada VARCHAR(2) NOT NULL DEFAULT 'no',
          creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT pk_direcciones_entrega PRIMARY KEY (identificador),
          CONSTRAINT chk_dir_pred CHECK (predeterminada IN ('si','no')),
          CONSTRAINT fk_direcciones_cliente FOREIGN KEY (cliente) REFERENCES clientes(identificador)
        )
        """);
  }

  private void ensureAuctionGuaranteeTable() {
    jdbc.execute("""
        CREATE TABLE IF NOT EXISTS garantias_subasta (
          identificador INT NOT NULL AUTO_INCREMENT,
          cliente INT NOT NULL,
          subasta INT NOT NULL,
          medio_pago INT NOT NULL,
          estado_verificacion VARCHAR(2) NOT NULL DEFAULT 'no',
          creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT pk_garantias_subasta PRIMARY KEY (identificador),
          CONSTRAINT uq_garantia_cliente_subasta UNIQUE (cliente, subasta),
          CONSTRAINT chk_garantia_verificacion CHECK (estado_verificacion IN ('si','no')),
          CONSTRAINT fk_garantias_cliente FOREIGN KEY (cliente) REFERENCES clientes(identificador),
          CONSTRAINT fk_garantias_subasta FOREIGN KEY (subasta) REFERENCES subastas(identificador),
          CONSTRAINT fk_garantias_medio_pago FOREIGN KEY (medio_pago) REFERENCES medios_pago(identificador)
        )
        """);
  }

  private String blankDefault(String value, String defaultValue) {
    return value == null || value.isBlank() ? defaultValue : value;
  }

  public record LoginRequest(String email, String password) {}
  public record RegisterRequest(String nombre, String apellido, String email, String password, String documento, String direccion, String pais, Integer numeroPais, String dniFrenteBase64, String dniDorsoBase64) {}
  public record ClientRequest(int clienteId) {}
  public record JoinAuctionRequest(int clienteId, int medioPagoId) {}
  public record BidRequest(int clienteId, int itemId, BigDecimal importe) {}
  public record PaymentRequest(int clienteId, String tipo, String moneda, String entidad, String referencia, BigDecimal montoReservado) {}
  public record FavoriteRequest(int clienteId, int subastaId) {}
  public record SellRequest(int duenioId, String titulo, String descripcion, List<String> fotos) {}
  public record UpdateProfileRequest(String nombre, String apellido, String email, String password, String direccion, String pais, String fotoBase64, String fotoUri) {}
  public record UpdatePasswordRequest(String password) {}
  public record AddressRequest(int userId, String titulo, String direccion, String ciudad, String pais, String predeterminada) {}
  public record ShipmentRequest(int userId, int addressId) {}
  public record PayInvoiceRequest(int userId, int paymentMethodId) {}
  public record AuctionCoverRequest(String imagen, String mimeType, String descripcion) {}
}



