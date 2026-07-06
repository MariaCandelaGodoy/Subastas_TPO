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
import com.bidvault.api.service.AuctionRealtimeHub;
import com.bidvault.api.service.EmailService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ApiController {
  private final JdbcTemplate jdbc;
  private final PasswordEncoder encoder;
  private final EmailService emailService;
  private final AuctionRealtimeHub realtimeHub;
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final Pattern NAME_PATTERN = Pattern.compile("^[\\p{L}]+(?:[ '\\-][\\p{L}]+)*$");
  private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$", Pattern.CASE_INSENSITIVE);
  private volatile boolean itemStateTableReady = false;

  public ApiController(JdbcTemplate jdbc, PasswordEncoder encoder, EmailService emailService, AuctionRealtimeHub realtimeHub) {
    this.jdbc = jdbc;
    this.encoder = encoder;
    this.emailService = emailService;
    this.realtimeHub = realtimeHub;
  }

  @GetMapping("/health")
  Map<String, Object> health() {
    return Map.of("status", "200: ok", "database", "bidvault");
  }

  @PostMapping("/auth/login")
  Map<String, Object> login(@RequestBody LoginRequest request) {
    refreshOverduePenalties();
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
    ensureUserNotBlocked(((Number) user.get("persona_id")).intValue());
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
    sendTemporaryPasswordOrFail(email, Objects.toString(user.get("nombre"), "Usuario"), temporaryPassword);
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
        INSERT INTO duenios (identificador, numeroPais, `verificacionFinanciera`, `verificacionJudicial`, calificacionRiesgo, verificador)
        VALUES (?, ?, 'no', 'no', 6, 1)
        """, personaId, numeroPais);
    jdbc.update("""
        INSERT INTO usuarios_app (persona, email, password_hash, password_temporal, rol)
        VALUES (?, ?, ?, 'no', 'cliente')
        """, personaId, email, encoder.encode(UUID.randomUUID().toString()));
    jdbc.update("""
        INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
        VALUES (?, 'Registrado', 'Su registro fue recibido y quedó pendiente de revisión por la empresa.', 'importante')
        """, personaId);
    jdbc.update("""
        INSERT INTO documentos_verificacion (persona, tipo_documento, frente, dorso, estado, observacion)
        VALUES (?, 'DNI', ?, ?, 'aprobada_simulada', 'Validacion simulada desde el registro')
        """, personaId, decodeBase64Image(request.dniFrenteBase64()), decodeBase64Image(request.dniDorsoBase64()));

    return Map.of("persona_id", personaId, "estado", "pendiente_validacion");
  }

  @PostMapping("/admin/users/approve")
  @Transactional
  Map<String, Object> approveUser(@RequestBody ApproveUserRequest request) {
    require(request.email(), "El email es obligatorio");
    String email = request.email().trim().toLowerCase();
    var users = jdbc.queryForList("""
        SELECT u.identificador usuario_id, u.persona, p.nombre, c.admitido
        FROM usuarios_app u
        JOIN personas p ON p.identificador = u.persona
        JOIN clientes c ON c.identificador = p.identificador
        WHERE u.email = ?
        """, email);
    if (users.isEmpty()) {
      throw new ApiException(HttpStatus.NOT_FOUND, "Usuario no encontrado");
    }
    var user = users.get(0);
    String temporaryPassword = temporaryPassword();
    jdbc.update("UPDATE clientes SET admitido='si' WHERE identificador=?", user.get("persona"));
    jdbc.update("""
        UPDATE usuarios_app
        SET password_hash=?, password_temporal='si'
        WHERE identificador=?
        """, encoder.encode(temporaryPassword), user.get("usuario_id"));
    jdbc.update("""
        INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
        VALUES (?, 'Cuenta validada', 'Tu cuenta fue validada. Te enviamos una clave temporal por correo.', 'importante')
        """, user.get("persona"));
    sendTemporaryPasswordOrFail(email, Objects.toString(user.get("nombre"), "Usuario"), temporaryPassword);
    return Map.of("email", email, "persona_id", user.get("persona"), "admitido", "si", "password_temporal", "si");
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
               MIN(i.precioBase) precio_desde,
               COALESCE(
               CASE
                 WHEN sp.imagen IS NULL THEN NULL
                 WHEN sp.imagen LIKE 'data:image/%' OR sp.imagen LIKE 'http://%' OR sp.imagen LIKE 'https://%' THEN sp.imagen
                 ELSE CONCAT('data:', COALESCE(sp.mime_type, 'image/jpeg'), ';base64,', sp.imagen)
               END, (
                 SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(f.foto))
                 FROM catalogos c2
                 JOIN itemsCatalogo i2 ON i2.catalogo = c2.identificador
                 JOIN fotos f ON f.producto = i2.producto
                 WHERE c2.subasta = s.identificador
                 ORDER BY i2.identificador, f.identificador
                 LIMIT 1
               )) imagen_portada,
               COALESCE(sc.moneda, 'ARS') moneda,
               COALESCE(sc.duracion_minutos, 90) duracion_minutos,
               GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(TIMESTAMP(s.fecha, s.hora), INTERVAL COALESCE(sc.duracion_minutos, 90) MINUTE))) tiempo_restante_segundos,
               (SELECT COUNT(*) FROM sesiones_subasta ss WHERE ss.subasta=s.identificador AND ss.activa='si') espectadores,
               COUNT(i.identificador) piezas,
               EXISTS(SELECT 1 FROM favoritos f WHERE f.subasta = s.identificador AND f.cliente = COALESCE(?, -1)) favorito
        FROM subastas s
        JOIN catalogos c ON c.subasta = s.identificador
        JOIN itemsCatalogo i ON i.catalogo = c.identificador
        LEFT JOIN subastas_portadas sp ON sp.subasta = s.identificador
        LEFT JOIN subastas_estados_app se ON se.subasta = s.identificador
        LEFT JOIN subastas_config sc ON sc.subasta = s.identificador
        WHERE (? IS NULL OR c.descripcion LIKE CONCAT('%', ?, '%'))
        GROUP BY s.identificador, c.descripcion, s.fecha, s.hora,
                 CASE
                   WHEN COALESCE(se.estado_app, s.estado)='abierta' AND s.fecha=CURDATE() THEN 'abierta'
                   WHEN COALESCE(se.estado_app, s.estado)='carrada' THEN 'carrada'
                   ELSE 'programada'
                 END,
                 s.categoria, s.ubicacion, sp.imagen, sp.mime_type, sc.moneda, sc.duracion_minutos
        ORDER BY s.fecha, s.hora
        """;
    return jdbc.queryForList(sql, clienteId, q, q);
  }

  @GetMapping("/auctions/{id}")
  @Transactional
  Map<String, Object> auction(@PathVariable int id, @RequestParam(required = false) Integer clienteId) {
    var rows = jdbc.queryForList("""
        SELECT s.identificador id, c.identificador catalogo_id, c.descripcion titulo, s.fecha, s.hora,
               COALESCE(se.estado_app, s.estado) estado_config,
               CASE
                 WHEN COALESCE(se.estado_app, s.estado)='abierta' AND s.fecha=CURDATE() THEN 'abierta'
                 WHEN COALESCE(se.estado_app, s.estado)='carrada' THEN 'carrada'
                 ELSE 'programada'
               END estado,
               s.categoria, s.ubicacion, s.capacidadAsistentes, s.tieneDeposito, s.seguridadPropia,
               COALESCE(
               CASE
                 WHEN sp.imagen IS NULL THEN NULL
                 WHEN sp.imagen LIKE 'data:image/%' OR sp.imagen LIKE 'http://%' OR sp.imagen LIKE 'https://%' THEN sp.imagen
                 ELSE CONCAT('data:', COALESCE(sp.mime_type, 'image/jpeg'), ';base64,', sp.imagen)
               END, (
                 SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(f.foto))
                 FROM catalogos c2
                 JOIN itemsCatalogo i2 ON i2.catalogo = c2.identificador
                 JOIN fotos f ON f.producto = i2.producto
                 WHERE c2.subasta = s.identificador
                 ORDER BY i2.identificador, f.identificador
                 LIMIT 1
               )) imagen_portada,
               COALESCE(sc.moneda, 'ARS') moneda,
               COALESCE(sc.duracion_minutos, 90) duracion_minutos,
               GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), DATE_ADD(TIMESTAMP(s.fecha, s.hora), INTERVAL COALESCE(sc.duracion_minutos, 90) MINUTE))) tiempo_restante_segundos,
               (SELECT COUNT(*) FROM sesiones_subasta ss WHERE ss.subasta=s.identificador AND ss.activa='si') espectadores,
               p.nombre subastador, EXISTS(SELECT 1 FROM favoritos f WHERE f.subasta=s.identificador AND f.cliente=COALESCE(?, -1)) favorito
        FROM subastas s
        JOIN catalogos c ON c.subasta = s.identificador
        LEFT JOIN subastas_portadas sp ON sp.subasta = s.identificador
        LEFT JOIN subastas_estados_app se ON se.subasta = s.identificador
        LEFT JOIN personas p ON p.identificador = s.subastador
        LEFT JOIN subastas_config sc ON sc.subasta = s.identificador
        WHERE s.identificador = ?
        """, clienteId, id);
    if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "Subasta no encontrada");
    if ("abierta".equals(rows.get(0).get("estado_config"))) {
      ensureLiveItem(id);
      if (finishAuctionIfAllItemsClosed(id)) {
        rows.get(0).put("estado", "carrada");
      }
    }
    var items = jdbc.queryForList("""
        SELECT i.identificador item_id, pr.identificador producto_id, pr.descripcionCatalogo descripcion,
               pr.descripcionCompleta pdf, pr.disponible, i.precioBase, i.comision, i.subastado,
               COALESCE(ise.estado, CASE WHEN i.subastado='si' THEN 'cerrado' ELSE 'en_espera' END) item_estado,
               CASE WHEN ise.cierra_en IS NULL THEN NULL ELSE GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), ise.cierra_en)) END item_tiempo_restante_segundos,
               ise.cierra_en,
               pe.nombre duenio_nombre,
               COALESCE(MAX(pu.importe), i.precioBase) mejor_oferta,
               (SELECT pe.nombre FROM pujos p2 JOIN asistentes a2 ON a2.identificador=p2.asistente JOIN personas pe ON pe.identificador=a2.cliente
                WHERE p2.item=i.identificador ORDER BY p2.importe DESC, p2.identificador DESC LIMIT 1) mejor_postor
        FROM itemsCatalogo i
        JOIN productos pr ON pr.identificador = i.producto
        JOIN personas pe ON pe.identificador = pr.duenio
        LEFT JOIN items_subasta_estado ise ON ise.item = i.identificador
        LEFT JOIN pujos pu ON pu.item = i.identificador
        WHERE i.catalogo = ?
        GROUP BY i.identificador, pr.identificador, pr.descripcionCatalogo, pr.descripcionCompleta, pr.disponible,
                 i.precioBase, i.comision, i.subastado, ise.estado, ise.cierra_en, pe.nombre
        """, rows.get(0).get("catalogo_id"));
    for (var item : items) {
      var productId = ((Number) item.get("producto_id")).intValue();
      var images = productImages(productId);
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
    ensureLiveItem(id);
    jdbc.update("""
        UPDATE sesiones_subasta ss
        JOIN subastas s ON s.identificador=ss.subasta
        LEFT JOIN subastas_estados_app se ON se.subasta=s.identificador
        SET ss.activa='no'
        WHERE ss.cliente=? AND ss.activa='si'
          AND (s.fecha<>CURDATE() OR COALESCE(se.estado_app, s.estado)<>'abierta')
        """, request.clienteId());
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
        SELECT m.identificador, m.verificado, m.moneda, m.tipo, m.monto_reservado,
               COALESCE(sc.moneda, 'ARS') subasta_moneda,
               (SELECT MAX(i.precioBase)
                FROM catalogos ca
                JOIN itemsCatalogo i ON i.catalogo=ca.identificador
                WHERE ca.subasta=s.identificador AND i.subastado='no') precio_garantia
        FROM medios_pago
        m JOIN subastas s ON s.identificador=?
        LEFT JOIN subastas_config sc ON sc.subasta = s.identificador
        WHERE m.identificador=? AND m.cliente=? AND m.activo='si' AND m.verificado='si'
        """, "El medio de pago debe estar verificado para ingresar a la subasta", id, request.medioPagoId(), request.clienteId());
    if (!Objects.equals(payment.get("moneda"), payment.get("subasta_moneda"))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "El medio de pago debe estar en " + payment.get("subasta_moneda") + " para ingresar a esta subasta.");
    }
    ensurePaymentLimit(payment, (BigDecimal) payment.get("precio_garantia"), "entrar a esta subasta");
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
    startLiveItemTimerIfNeeded(id);
    realtimeHub.publish(id, Map.of("tipo", "ESPECTADORES", "subastaId", id, "espectadores", countActiveSpectators(id)));
    return Map.of("sesion_id", sessionId, "numero_postor", postor, "medio_pago_id", request.medioPagoId(), "garantia", true);
  }

  @PostMapping("/auctions/{id}/leave")
  @Transactional
  Map<String, Object> leaveAuction(@PathVariable int id, @RequestBody ClientRequest request) {
    int updated = jdbc.update("UPDATE sesiones_subasta SET activa='no' WHERE cliente=? AND subasta=? AND activa='si'", request.clienteId(), id);
    realtimeHub.publish(id, Map.of("tipo", "ESPECTADORES", "subastaId", id, "espectadores", countActiveSpectators(id)));
    return Map.of("closed", updated);
  }

  @PostMapping("/bids")
  @Transactional
  Map<String, Object> bid(@RequestBody BidRequest request) {
    requirePositive(request.importe(), "El importe debe ser mayor a cero");
    var data = one("""
        SELECT i.identificador item_id, i.precioBase, i.comision, c.subasta, s.categoria subasta_categoria,
               COALESCE(ise.estado, CASE WHEN i.subastado='si' THEN 'cerrado' ELSE 'en_espera' END) item_estado,
               CASE WHEN ise.cierra_en IS NULL THEN NULL ELSE GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), ise.cierra_en)) END item_tiempo_restante_segundos,
               COALESCE(MAX(pu.importe), i.precioBase) mejor_oferta
        FROM itemsCatalogo i
        JOIN catalogos c ON c.identificador = i.catalogo
        JOIN subastas s ON s.identificador = c.subasta
        LEFT JOIN items_subasta_estado ise ON ise.item = i.identificador
        LEFT JOIN pujos pu ON pu.item = i.identificador
        WHERE i.identificador = ?
        GROUP BY i.identificador, i.precioBase, i.comision, c.subasta, s.categoria, ise.estado, ise.cierra_en
        FOR UPDATE
        """, "Ítem no encontrado", request.itemId());
    int subastaId = ((Number) data.get("subasta")).intValue();
    ensureLiveItem(subastaId);
    ensureCanParticipate(request.clienteId(), subastaId, false);
    var guarantee = ensureAuctionGuarantee(request.clienteId(), subastaId);
    if (!"en_vivo".equals(data.get("item_estado")) || data.get("item_tiempo_restante_segundos") == null ||
        ((Number) data.get("item_tiempo_restante_segundos")).intValue() <= 0) {
      throw new ApiException(HttpStatus.CONFLICT, "Este item no esta en vivo para recibir pujas.");
    }
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
    ensurePaymentLimit(guarantee, amount, "realizar esta puja");
    int asistenteId = ensureAssistant(request.clienteId(), subastaId);
    jdbc.update("UPDATE pujos SET ganador='no' WHERE item=?", request.itemId());
    int bidId = insertAndReturnKey("INSERT INTO pujos (asistente, item, importe, ganador) VALUES (?, ?, ?, 'si')",
        asistenteId, request.itemId(), amount);
    jdbc.update("""
        UPDATE items_subasta_estado
        SET cierra_en=DATE_ADD(NOW(), INTERVAL extension_segundos SECOND), actualizado_en=CURRENT_TIMESTAMP
        WHERE item=? AND estado='en_vivo'
        """, request.itemId());
    int remainingSeconds = itemRemainingSeconds(request.itemId());
    Map<String, Object> event = Map.of(
        "tipo", "NUEVA_PUJA",
        "subastaId", subastaId,
        "itemId", request.itemId(),
        "pujaId", bidId,
        "clienteId", request.clienteId(),
        "importe", amount,
        "itemTiempoRestanteSegundos", remainingSeconds,
        "ganador", "si");
    realtimeHub.publish(subastaId, event);
    return Map.of("puja_id", bidId, "item_id", request.itemId(), "importe", amount, "ganador", "si",
        "item_tiempo_restante_segundos", remainingSeconds);
  }

  @PostMapping("/auctions/{id}/close-item/{itemId}")
  @Transactional
  Map<String, Object> closeItem(@PathVariable int id, @PathVariable int itemId) {
    Map<String, Object> result = closeItemSale(id, itemId);
    publishItemClosed(id, itemId, result);
    ensureLiveItem(id);
    boolean finished = finishAuctionIfAllItemsClosed(id);
    var response = new java.util.LinkedHashMap<>(result);
    response.put("subasta_finalizada", finished);
    return response;
  }

  private Map<String, Object> closeItemSale(int id, int itemId) {
    var item = one("""
        SELECT i.identificador item_id, i.precioBase, i.comision, i.subastado, pr.duenio, pr.identificador producto
        FROM itemsCatalogo i
        JOIN catalogos c ON c.identificador=i.catalogo
        JOIN productos pr ON pr.identificador=i.producto
        WHERE i.identificador=? AND c.subasta=?
        FOR UPDATE
        """, "Item no encontrado", itemId, id);
    if ("si".equals(item.get("subastado"))) {
      return Map.of("item_id", itemId, "cerrado", true);
    }
    var winner = jdbc.queryForList("""
        SELECT p.identificador puja_id, a.cliente, p.importe, pr.duenio, pr.identificador producto, i.comision
        FROM pujos p
        JOIN asistentes a ON a.identificador=p.asistente
        JOIN itemsCatalogo i ON i.identificador=p.item
        JOIN productos pr ON pr.identificador=i.producto
        WHERE p.item=? ORDER BY p.importe DESC, p.identificador DESC LIMIT 1
        """, itemId);
    if (winner.isEmpty()) {
      int companyId = ensureCompanyBuyerClient();
      BigDecimal importe = (BigDecimal) item.get("precioBase");
      BigDecimal comisionPct = (BigDecimal) item.get("comision");
      BigDecimal comision = importe.multiply(comisionPct).setScale(2, RoundingMode.HALF_UP);
      jdbc.update("UPDATE itemsCatalogo SET subastado='si' WHERE identificador=?", itemId);
      jdbc.update("""
          UPDATE items_subasta_estado
          SET estado='cerrado', cerrado_en=NOW(), cierra_en=NULL, actualizado_en=CURRENT_TIMESTAMP
          WHERE item=?
          """, itemId);
      jdbc.update("UPDATE productos SET disponible='no', duenio=? WHERE identificador=?", companyId, item.get("producto"));
      notifyOwnerIfClient(((Number) item.get("duenio")).intValue(),
          "La empresa tomo tu pieza",
          "No hubo pujas. BidVault tomo el bien por el precio base: " + importe + ".");
      var result = new java.util.LinkedHashMap<String, Object>();
      result.put("registro_id", 0);
      result.put("item_id", itemId);
      result.put("cliente_id", companyId);
      result.put("importe", importe);
      result.put("comision", comision);
      result.put("empresa_compra", true);
      return result;
    }
    var w = winner.get(0);
    BigDecimal importe = (BigDecimal) w.get("importe");
    BigDecimal comisionPct = (BigDecimal) w.get("comision");
    BigDecimal comision = importe.multiply(comisionPct).setScale(2, RoundingMode.HALF_UP);
    int registro = insertAndReturnKey("""
        INSERT INTO registroDeSubasta (subasta, duenio, producto, cliente, importe, comision)
        VALUES (?, ?, ?, ?, ?, ?)
        """, id, w.get("duenio"), w.get("producto"), w.get("cliente"), importe, comision);
    jdbc.update("UPDATE itemsCatalogo SET subastado='si' WHERE identificador=?", itemId);
    jdbc.update("""
        UPDATE items_subasta_estado
        SET estado='cerrado', cerrado_en=NOW(), cierra_en=NULL, actualizado_en=CURRENT_TIMESTAMP
        WHERE item=?
        """, itemId);
    jdbc.update("UPDATE productos SET disponible='no' WHERE identificador=?", w.get("producto"));
    boolean empresaCompra = Boolean.TRUE.equals(w.get("empresa_compra"));
    if (empresaCompra) {
      notifyOwnerIfClient(((Number) w.get("duenio")).intValue(),
          "La empresa compro tu pieza",
          "No hubo pujas. BidVault compro el bien por el precio base: " + importe + ".");
    }
    jdbc.update("""
        INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
        VALUES (?, 'Ganaste la subasta', ?, 'importante')
        """, w.get("cliente"), "Importe: " + importe + ". Comisión: " + comision + ". Coordiná envío o retiro.");
    jdbc.update("""
        INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
        SELECT DISTINCT a.cliente,
               'No ganaste la subasta',
               CONCAT('El lote finalizo y tu oferta no resulto ganadora. Oferta ganadora: ', ?, '.'),
               'otra'
        FROM pujos p
        JOIN asistentes a ON a.identificador=p.asistente
        WHERE p.item=? AND a.cliente<>?
        """, importe, itemId, w.get("cliente"));
    return Map.of("registro_id", registro, "cliente_id", w.get("cliente"), "importe", importe, "comision", comision, "empresa_compra", empresaCompra);
  }

  @GetMapping("/payments/{clienteId}")
  List<Map<String, Object>> payments(@PathVariable int clienteId) {
    ensureUserNotBlocked(clienteId);
    return jdbc.queryForList("SELECT * FROM medios_pago WHERE cliente=? ORDER BY activo DESC, identificador DESC", clienteId);
  }

  @PostMapping("/payments")
  Map<String, Object> addPayment(@RequestBody PaymentRequest request) {
    ensureUserNotBlocked(request.clienteId());
    int id = insertAndReturnKey("""
        INSERT INTO medios_pago (cliente, tipo, moneda, entidad, referencia, monto_reservado, verificado, activo)
        VALUES (?, ?, ?, ?, ?, ?, 'no', 'si')
        """, request.clienteId(), request.tipo(), request.moneda(), request.entidad(), request.referencia(), request.montoReservado());
    return Map.of("medio_pago_id", id, "verificado", "no");
  }

  @PostMapping("/favorites")
  Map<String, Object> favorite(@RequestBody FavoriteRequest request) {
    ensureUserNotBlocked(request.clienteId());
    jdbc.update("INSERT IGNORE INTO favoritos (cliente, subasta) VALUES (?, ?)", request.clienteId(), request.subastaId());
    return Map.of("favorito", true);
  }

  @DeleteMapping("/favorites")
  Map<String, Object> unfavorite(@RequestBody FavoriteRequest request) {
    ensureUserNotBlocked(request.clienteId());
    jdbc.update("DELETE FROM favoritos WHERE cliente=? AND subasta=?", request.clienteId(), request.subastaId());
    return Map.of("favorito", false);
  }

  @PostMapping("/sell-requests")
  @Transactional
  Map<String, Object> sellRequest(@RequestBody SellRequest request) {
    ensureUserNotBlocked(request.duenioId());
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
    ensureUserNotBlocked(clienteId);
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
    ensureUserNotBlocked(clienteId);
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
    ensureUserNotBlocked(clienteId);
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
    ensureUserNotBlocked(clienteId);
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
    ensureUserNotBlocked(clienteId);
    return jdbc.queryForList("SELECT * FROM mensajes WHERE cliente=? ORDER BY creado_en DESC", clienteId);
  }

  @DeleteMapping("/notifications/{clienteId}")
  Map<String, Object> clearNotifications(@PathVariable int clienteId) {
    ensureUserNotBlocked(clienteId);
    int deleted = jdbc.update("DELETE FROM mensajes WHERE cliente=?", clienteId);
    return Map.of("deleted", deleted);
  }

  @GetMapping("/shipping/addresses")
  List<Map<String, Object>> addresses(@RequestParam int userId) {
    ensureUserNotBlocked(userId);
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
    ensureUserNotBlocked(userId);
    return jdbc.queryForList("""
        SELECT e.identificador id, e.estado, e.costo, e.codigo_seguimiento tracking,
               e.direccion, r.identificador registro_id, r.importe, r.comision,
               COALESCE(sc.moneda, 'ARS') moneda,
               p.identificador producto_id, p.descripcionCatalogo producto, p.descripcionCompleta descripcion,
               fc.identificador factura_id, fc.numero factura_numero, fc.total factura_total, fc.estado factura_estado,
               (SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(f.foto)) FROM fotos f WHERE f.producto=p.identificador LIMIT 1) imagen
        FROM envios e
        JOIN registroDeSubasta r ON r.identificador = e.registro
        JOIN subastas s ON s.identificador = r.subasta
        LEFT JOIN subastas_config sc ON sc.subasta = s.identificador
        JOIN productos p ON p.identificador = r.producto
        LEFT JOIN facturas_compra fc ON fc.registro = r.identificador
        WHERE r.cliente=?
        ORDER BY e.identificador DESC
        """, userId);
  }

  @GetMapping("/purchases/pending-shipping")
  List<Map<String, Object>> pendingShippingPurchases(@RequestParam int userId) {
    ensureUserNotBlocked(userId);
    return jdbc.queryForList("""
        SELECT r.identificador registro_id, r.importe, r.comision,
               (r.importe + r.comision) total,
               s.identificador subasta_id, ca.descripcion subasta,
               COALESCE(sc.moneda, 'ARS') moneda,
               p.identificador producto_id, p.descripcionCatalogo producto, p.descripcionCompleta descripcion,
               (SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(f.foto)) FROM fotos f WHERE f.producto=p.identificador LIMIT 1) imagen
        FROM registroDeSubasta r
        JOIN productos p ON p.identificador = r.producto
        JOIN subastas s ON s.identificador = r.subasta
        LEFT JOIN subastas_config sc ON sc.subasta = s.identificador
        JOIN catalogos ca ON ca.subasta = s.identificador
        WHERE r.cliente=?
          AND NOT EXISTS (SELECT 1 FROM envios e WHERE e.registro=r.identificador)
        ORDER BY r.identificador DESC
        """, userId);
  }

  @GetMapping("/invoices")
  List<Map<String, Object>> invoices(@RequestParam int userId) {
    ensureUserNotBlocked(userId);
    return jdbc.queryForList("""
        SELECT fc.identificador id, fc.numero, fc.subtotal, fc.comision, fc.costo_envio, fc.total, fc.estado,
               fc.creado_en, fc.pagado_en, fc.registro registro_id, fc.envio envio_id, fc.medio_pago medio_pago_id,
               COALESCE(sc.moneda, 'ARS') moneda,
               p.descripcionCatalogo producto, p.descripcionCompleta descripcion, e.direccion,
               (SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(f.foto)) FROM fotos f WHERE f.producto=p.identificador LIMIT 1) imagen
        FROM facturas_compra fc
        JOIN registroDeSubasta r ON r.identificador = fc.registro
        JOIN subastas s ON s.identificador = r.subasta
        LEFT JOIN subastas_config sc ON sc.subasta = s.identificador
        JOIN productos p ON p.identificador = r.producto
        LEFT JOIN envios e ON e.identificador = fc.envio
        WHERE r.cliente=?
        ORDER BY fc.identificador DESC
        """, userId);
  }

  @GetMapping("/penalties")
  List<Map<String, Object>> penalties(@RequestParam int userId) {
    return jdbc.queryForList("""
        SELECT m.identificador id, m.factura factura_id, m.registro registro_id, m.importe_base,
               m.importe_multa, m.vencimiento, m.estado, m.motivo, m.creado_en, m.pagado_en,
               'ARS' moneda,
               CONCAT('Factura #', m.factura) producto
        FROM multas_incumplimiento m
        WHERE m.cliente=?
        ORDER BY m.creado_en DESC
        """, userId);
  }

  @PostMapping("/shipping/shipments")
  @Transactional
  Map<String, Object> createShipment(@RequestBody ShipmentRequest request) {
    ensureUserNotBlocked(request.userId());
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
               COALESCE(sc.moneda, 'ARS') moneda,
               p.descripcionCatalogo producto, p.descripcionCompleta descripcion,
               fc.identificador factura_id, fc.numero factura_numero, fc.subtotal factura_subtotal,
               fc.comision factura_comision, fc.costo_envio factura_envio, fc.total factura_total,
               fc.estado factura_estado,
               (SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(f.foto)) FROM fotos f WHERE f.producto=p.identificador LIMIT 1) imagen
        FROM envios e
        JOIN registroDeSubasta r ON r.identificador=e.registro
        JOIN subastas s ON s.identificador=r.subasta
        LEFT JOIN subastas_config sc ON sc.subasta = s.identificador
        JOIN productos p ON p.identificador=r.producto
        LEFT JOIN facturas_compra fc ON fc.registro=r.identificador
        WHERE e.identificador=?
        """, "Envio no encontrado", id);
  }

  @PutMapping("/invoices/{invoiceId}/pay")
  @Transactional(noRollbackFor = ApiException.class)
  Map<String, Object> payInvoice(@PathVariable int invoiceId, @RequestBody PayInvoiceRequest request) {
    ensureUserNotBlocked(request.userId());
    var invoice = one("""
        SELECT fc.identificador, fc.total, r.cliente, r.identificador registro,
               COALESCE(sc.moneda, 'ARS') moneda
        FROM facturas_compra fc
        JOIN registroDeSubasta r ON r.identificador=fc.registro
        JOIN subastas s ON s.identificador=r.subasta
        LEFT JOIN subastas_config sc ON sc.subasta = s.identificador
        WHERE fc.identificador=?
        """, "Factura no encontrada", invoiceId);
    if (((Number) invoice.get("cliente")).intValue() != request.userId()) {
      throw new ApiException(HttpStatus.FORBIDDEN, "La factura no pertenece al usuario");
    }
    var payment = one("""
        SELECT identificador, verificado, tipo, moneda, monto_reservado,
               COALESCE(resultado_pago_simulado, 'aprobado') resultado_pago_simulado
        FROM medios_pago
        WHERE identificador=? AND cliente=? AND activo='si'
        """, "Medio de pago no encontrado", request.paymentMethodId(), request.userId());
    if (!"si".equals(payment.get("verificado"))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "El medio de pago esta pendiente de verificacion");
    }
    String invoiceCurrency = Objects.toString(invoice.get("moneda"), "");
    String paymentCurrency = Objects.toString(payment.get("moneda"), "");
    String paymentType = Objects.toString(payment.get("tipo"), "").toLowerCase();
    if (!invoiceCurrency.equals(paymentCurrency)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "La factura esta en " + invoiceCurrency + ". Selecciona un medio de pago en esa moneda.");
    }
    if ("USD".equals(invoiceCurrency) && !("cuenta".equals(paymentType) || "tarjeta".equals(paymentType))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Las subastas en dolares solo pueden pagarse con transferencia o tarjeta internacional.");
    }
    BigDecimal invoiceTotal = (BigDecimal) invoice.get("total");
    boolean simulatedInsufficientFunds = "fondos_insuficientes".equals(Objects.toString(payment.get("resultado_pago_simulado"), ""));
    boolean checkInsufficientFunds = "cheque".equals(paymentType) &&
        payment.get("monto_reservado") != null &&
        ((BigDecimal) payment.get("monto_reservado")).compareTo(invoiceTotal) < 0;
    if (simulatedInsufficientFunds || checkInsufficientFunds) {
      createPaymentFailurePenalty(invoice, "Pago rechazado por fondos insuficientes en la pasarela simulada");
      throw new ApiException(HttpStatus.PAYMENT_REQUIRED,
          "Pago rechazado por fondos insuficientes. Se generó una multa del 10% que debes pagar antes de participar en otra subasta.");
    }
    if ("rechazado".equals(Objects.toString(payment.get("resultado_pago_simulado"), ""))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "La pasarela simulada rechazo el pago con este medio.");
    }
    jdbc.update("""
        UPDATE facturas_compra
        SET medio_pago=?, estado='pagada', pagado_en=CURRENT_TIMESTAMP
        WHERE identificador=?
        """, request.paymentMethodId(), invoiceId);
    return one("""
        SELECT fc.identificador id, fc.numero, fc.subtotal, fc.comision, fc.costo_envio, fc.total, fc.estado,
               fc.creado_en, fc.pagado_en, fc.registro registro_id, fc.envio envio_id, fc.medio_pago medio_pago_id,
               COALESCE(sc.moneda, 'ARS') moneda,
               p.descripcionCatalogo producto, p.descripcionCompleta descripcion, e.direccion
        FROM facturas_compra fc
        JOIN registroDeSubasta r ON r.identificador=fc.registro
        JOIN subastas s ON s.identificador=r.subasta
        LEFT JOIN subastas_config sc ON sc.subasta = s.identificador
        JOIN productos p ON p.identificador=r.producto
        LEFT JOIN envios e ON e.identificador=fc.envio
        WHERE fc.identificador=?
        """, "Factura no encontrada", invoiceId);
  }

  @PutMapping("/penalties/{penaltyId}/pay")
  @Transactional
  Map<String, Object> payPenalty(@PathVariable int penaltyId, @RequestBody PayInvoiceRequest request) {
    var penalty = one("""
        SELECT m.identificador, m.cliente, m.importe_multa, m.estado,
               'ARS' moneda
        FROM multas_incumplimiento m
        WHERE m.identificador=?
        """, "Multa no encontrada", penaltyId);
    if (((Number) penalty.get("cliente")).intValue() != request.userId()) {
      throw new ApiException(HttpStatus.FORBIDDEN, "La multa no pertenece al usuario");
    }
    if ("pagada".equals(penalty.get("estado"))) {
      return penalty;
    }
    var payment = one("""
        SELECT identificador, verificado, tipo, moneda,
               COALESCE(resultado_pago_simulado, 'aprobado') resultado_pago_simulado
        FROM medios_pago
        WHERE identificador=? AND cliente=? AND activo='si'
        """, "Medio de pago no encontrado", request.paymentMethodId(), request.userId());
    if (!"si".equals(payment.get("verificado"))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "El medio de pago esta pendiente de verificacion");
    }
    String penaltyCurrency = Objects.toString(penalty.get("moneda"), "");
    String paymentCurrency = Objects.toString(payment.get("moneda"), "");
    String paymentType = Objects.toString(payment.get("tipo"), "").toLowerCase();
    if (!penaltyCurrency.equals(paymentCurrency)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "La multa esta en " + penaltyCurrency + ". Selecciona un medio de pago en esa moneda.");
    }
    if ("USD".equals(penaltyCurrency) && !("cuenta".equals(paymentType) || "tarjeta".equals(paymentType))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Las multas en dolares solo pueden pagarse con transferencia o tarjeta internacional.");
    }
    String simulated = Objects.toString(payment.get("resultado_pago_simulado"), "");
    if ("fondos_insuficientes".equals(simulated)) {
      throw new ApiException(HttpStatus.PAYMENT_REQUIRED, "Pago rechazado por fondos insuficientes.");
    }
    if ("rechazado".equals(simulated)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "La pasarela simulada rechazo el pago con este medio.");
    }
    jdbc.update("""
        UPDATE multas_incumplimiento
        SET estado='pagada', pagado_en=CURRENT_TIMESTAMP
        WHERE identificador=?
        """, penaltyId);
    jdbc.update("""
        INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
        VALUES (?, 'Multa pagada', 'Registramos el pago de tu multa. Ya podes volver a participar en subastas.', 'importante')
        """, request.userId());
    return one("""
        SELECT m.identificador id, m.factura factura_id, m.registro registro_id, m.importe_base,
               m.importe_multa, m.vencimiento, m.estado, m.motivo, m.creado_en, m.pagado_en,
               'ARS' moneda
        FROM multas_incumplimiento m
        WHERE m.identificador=?
        """, "Multa no encontrada", penaltyId);
  }


  @PostMapping("/shipping/addresses")
  @Transactional
  Map<String, Object> addAddress(@RequestBody AddressRequest request) {
    ensureUserNotBlocked(request.userId());
    ensureAddressTable();
    require(request.titulo(), "El titulo de la direccion es obligatorio");
    require(request.direccion(), "La direccion es obligatoria");
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
    ensureUserNotBlocked(request.userId());
    ensureAddressTable();
    require(request.titulo(), "El titulo de la direccion es obligatorio");
    require(request.direccion(), "La direccion es obligatoria");
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
    ensureUserNotBlocked(duenioId);
    ensureProductReviewTable();
    return jdbc.queryForList("""
        SELECT sp.identificador id, sp.titulo, sp.descripcion, sp.estado, sp.motivo_rechazo,
               sp.deposito, sp.seguro, sp.creado_en,
               spe.identificador propuesta_id, spe.fecha_subasta, spe.hora_subasta, spe.ubicacion propuesta_ubicacion,
               spe.precio_base propuesta_precio_base, spe.moneda propuesta_moneda, spe.comision propuesta_comision,
               spe.poliza_compania, spe.poliza_numero, spe.poliza_cobertura, spe.estado propuesta_estado,
               COALESCE(
                 (SELECT CASE
                    WHEN sf.url LIKE 'data:image/%' OR sf.url LIKE 'http://%' OR sf.url LIKE 'https://%' THEN sf.url
                    ELSE CONCAT('data:image/jpeg;base64,', sf.url)
                  END
                  FROM solicitudes_fotos sf
                  WHERE sf.solicitud=sp.identificador
                    AND sf.url IS NOT NULL
                    AND sf.url <> ''
                  ORDER BY sf.identificador
                  LIMIT 1),
                 (SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(f.foto))
                  FROM solicitudes_productos_revision spr
                  JOIN fotos f ON f.producto = spr.producto
                  WHERE spr.solicitud = sp.identificador
                  ORDER BY f.identificador
                  LIMIT 1)
               ) foto
        FROM solicitudes_productos sp
        LEFT JOIN solicitudes_propuestas_empresa spe ON spe.solicitud=sp.identificador AND spe.estado='pendiente_usuario'
        WHERE sp.duenio=?
        ORDER BY sp.creado_en DESC
        """, duenioId);
  }

  @GetMapping("/my-pieces/{solicitudId}/custody")
  Map<String, Object> pieceCustody(@PathVariable int solicitudId, @RequestParam int duenioId) {
    ensureUserNotBlocked(duenioId);
    return one("""
        SELECT sp.identificador id, sp.titulo, sp.deposito, sp.seguro,
               spe.poliza_compania, spe.poliza_numero, spe.poliza_cobertura
        FROM solicitudes_productos sp
        LEFT JOIN solicitudes_propuestas_empresa spe ON spe.solicitud=sp.identificador
        WHERE sp.identificador=? AND sp.duenio=?
        ORDER BY spe.identificador DESC
        LIMIT 1
        """, "Custodia no encontrada", solicitudId, duenioId);
  }

  @PutMapping("/my-pieces/{solicitudId}/proposal/accept")
  @Transactional
  Map<String, Object> acceptPieceProposal(@PathVariable int solicitudId, @RequestBody ClientRequest request) {
    ensureUserNotBlocked(request.clienteId());
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
    ensureUserNotBlocked(request.clienteId());
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

  @Scheduled(fixedDelay = 1000)
  @Transactional
  public void closeExpiredDynamicItems() {
    ensureItemStateTable();
    var auctions = jdbc.queryForList("""
        SELECT DISTINCT ca.subasta
        FROM items_subasta_estado ise
        JOIN itemsCatalogo i ON i.identificador=ise.item
        JOIN catalogos ca ON ca.identificador=i.catalogo
        WHERE ise.estado='en_vivo'
          AND ise.cierra_en IS NOT NULL
          AND ise.cierra_en <= NOW()
          AND i.subastado='no'
        LIMIT 10
        """);
    for (var auction : auctions) {
      closeExpiredItemsForAuction(((Number) auction.get("subasta")).intValue());
    }
  }

  private void closeExpiredItemsForAuction(int subastaId) {
    ensureItemStateTable();
    var rows = jdbc.queryForList("""
        SELECT ise.item, ca.subasta
        FROM items_subasta_estado ise
        JOIN itemsCatalogo i ON i.identificador=ise.item
        JOIN catalogos ca ON ca.identificador=i.catalogo
        WHERE ise.estado='en_vivo'
          AND ise.cierra_en IS NOT NULL
          AND ise.cierra_en <= NOW()
          AND i.subastado='no'
          AND ca.subasta=?
        ORDER BY ise.cierra_en, ise.item
        LIMIT 10
        """, subastaId);
    for (var row : rows) {
      int itemId = ((Number) row.get("item")).intValue();
      int itemSubastaId = ((Number) row.get("subasta")).intValue();
      Map<String, Object> result = closeItemSale(itemSubastaId, itemId);
      publishItemClosed(itemSubastaId, itemId, result);
      ensureLiveItem(itemSubastaId);
      finishAuctionIfAllItemsClosed(itemSubastaId);
    }
  }

  private void publishItemClosed(int subastaId, int itemId, Map<String, Object> result) {
    var event = new java.util.LinkedHashMap<String, Object>();
    event.put("tipo", "ITEM_CERRADO");
    event.put("subastaId", subastaId);
    event.put("itemId", itemId);
    event.put("clienteId", result.get("cliente_id"));
    event.put("importe", result.get("importe"));
    event.put("empresaCompra", result.get("empresa_compra"));
    realtimeHub.publish(subastaId, event);
  }

  private void ensureCanParticipate(int clienteId, int subastaId, boolean requirePayment) {
    ensureUserCanParticipateWithoutPendingPenalty(clienteId);
    var rows = jdbc.queryForList("""
        SELECT c.admitido, c.categoria cliente_categoria, s.categoria subasta_categoria,
               COALESCE(se.estado_app, s.estado) subasta_estado,
               s.fecha,
               EXISTS(SELECT 1 FROM medios_pago m WHERE m.cliente=c.identificador AND m.verificado='si' AND m.activo='si') pago_ok
        FROM clientes c
        CROSS JOIN subastas s
        LEFT JOIN subastas_estados_app se ON se.subasta=s.identificador
        LEFT JOIN subastas_config sc ON sc.subasta=s.identificador
        WHERE c.identificador=? AND s.identificador=?
        """, clienteId, subastaId);
    if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "Cliente o subasta inexistente");
    var row = rows.get(0);
    if (!"si".equals(row.get("admitido"))) throw new ApiException(HttpStatus.FORBIDDEN, "Cliente no admitido");
    if (rank(row.get("cliente_categoria").toString()) < rank(row.get("subasta_categoria").toString())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Tu categoria no tiene permiso para ingresar a esta subasta");
    }
    if (!"abierta".equals(row.get("subasta_estado")) || !java.time.LocalDate.now().toString().equals(Objects.toString(row.get("fecha")))) {
      throw new ApiException(HttpStatus.FORBIDDEN, "La subasta no esta en vivo en este momento");
    }
    if (requirePayment && ((Number) row.get("pago_ok")).intValue() == 0) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Se requiere al menos un medio de pago verificado");
    }
  }

  private int ensureAssistant(int clienteId, int subastaId) {
    jdbc.update("INSERT IGNORE INTO asistentes (numeroPostor, cliente, subasta) VALUES (?, ?, ?)", 100 + clienteId, clienteId, subastaId);
    return jdbc.queryForObject("SELECT identificador FROM asistentes WHERE cliente=? AND subasta=?", Integer.class, clienteId, subastaId);
  }

  private Map<String, Object> ensureAuctionGuarantee(int clienteId, int subastaId) {
    ensureAuctionGuaranteeTable();
    var rows = jdbc.queryForList("""
        SELECT g.identificador garantia_id, m.identificador, m.tipo, m.moneda, m.monto_reservado, m.verificado, m.activo
        FROM garantias_subasta g
        JOIN medios_pago m ON m.identificador=g.medio_pago
        WHERE g.cliente=? AND g.subasta=? AND m.cliente=? AND m.activo='si' AND m.verificado='si'
        """, clienteId, subastaId, clienteId);
    if (rows.isEmpty()) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Debe seleccionar un medio de garantia para participar");
    }
    return rows.get(0);
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

  private void createPaymentFailurePenalty(Map<String, Object> invoice, String reason) {
    ensurePenaltyTable();
    BigDecimal total = (BigDecimal) invoice.get("total");
    BigDecimal penalty = total.multiply(new BigDecimal("0.10")).setScale(2, RoundingMode.HALF_UP);
    jdbc.update("""
        INSERT INTO multas_incumplimiento
        (cliente, registro, factura, importe_base, importe_multa, vencimiento, estado, motivo)
        VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 72 HOUR), 'pendiente', ?)
        ON DUPLICATE KEY UPDATE
          importe_base=VALUES(importe_base),
          importe_multa=VALUES(importe_multa),
          estado=IF(estado='pagada', estado, 'pendiente'),
          motivo=VALUES(motivo)
        """, invoice.get("cliente"), invoice.get("registro"), invoice.get("identificador"), total, penalty, reason);
    jdbc.update("""
        INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
        VALUES (?, 'Multa por pago rechazado', ?, 'importante')
        """, invoice.get("cliente"),
        "El pago fue rechazado por fondos insuficientes. Se generó una multa de " + penalty + " que debe abonarse antes de participar en otra subasta.");
  }

  private void ensureUserNotBlocked(int clienteId) {
    refreshOverduePenalties();
    var rows = jdbc.queryForList("""
        SELECT identificador, importe_multa, estado
        FROM multas_incumplimiento
        WHERE cliente=? AND estado='derivada_justicia'
        LIMIT 1
        """, clienteId);
    if (!rows.isEmpty()) {
      throw new ApiException(HttpStatus.FORBIDDEN,
          "Tu usuario esta bloqueado por incumplimiento de pago. Tenes una multa pendiente del 10% y el caso fue derivado a la justicia.");
    }
  }

  private void ensureUserCanParticipateWithoutPendingPenalty(int clienteId) {
    ensureUserNotBlocked(clienteId);
    var rows = jdbc.queryForList("""
        SELECT identificador, importe_multa
        FROM multas_incumplimiento
        WHERE cliente=? AND estado='pendiente'
        LIMIT 1
        """, clienteId);
    if (!rows.isEmpty()) {
      throw new ApiException(HttpStatus.FORBIDDEN,
          "Tenes una multa pendiente del 10% por incumplimiento de pago. Debes abonarla antes de participar en otra subasta.");
    }
  }

  private void refreshOverduePenalties() {
    ensurePenaltyTable();
    jdbc.update("""
        UPDATE multas_incumplimiento
        SET estado='derivada_justicia'
        WHERE estado='pendiente' AND vencimiento <= NOW()
        """);
    jdbc.update("""
        INSERT INTO multas_incumplimiento
        (cliente, registro, factura, importe_base, importe_multa, vencimiento, estado, motivo)
        SELECT r.cliente, r.identificador, fc.identificador, fc.total,
               ROUND(fc.total * 0.10, 2),
               DATE_ADD(fc.creado_en, INTERVAL 72 HOUR),
               'derivada_justicia',
               'Incumplimiento de pago de factura dentro del plazo de 72 horas'
        FROM facturas_compra fc
        JOIN registroDeSubasta r ON r.identificador=fc.registro
        WHERE fc.estado='pendiente_pago'
          AND fc.creado_en <= DATE_SUB(NOW(), INTERVAL 72 HOUR)
          AND NOT EXISTS (SELECT 1 FROM multas_incumplimiento m WHERE m.factura=fc.identificador)
        """);
  }

  private void ensurePenaltyTable() {
    jdbc.execute("""
        CREATE TABLE IF NOT EXISTS multas_incumplimiento (
          identificador INT NOT NULL AUTO_INCREMENT,
          cliente INT NOT NULL,
          registro INT NOT NULL,
          factura INT NOT NULL,
          importe_base DECIMAL(18,2) NOT NULL,
          importe_multa DECIMAL(18,2) NOT NULL,
          vencimiento DATETIME NOT NULL,
          estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
          motivo VARCHAR(300) NOT NULL,
          creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          pagado_en TIMESTAMP NULL,
          CONSTRAINT pk_multas_incumplimiento PRIMARY KEY (identificador),
          CONSTRAINT uq_multas_factura UNIQUE (factura),
          CONSTRAINT chk_multa_importe CHECK (importe_base > 0 AND importe_multa > 0),
          CONSTRAINT chk_multa_estado CHECK (estado IN ('pendiente','derivada_justicia','pagada')),
          CONSTRAINT fk_multas_cliente FOREIGN KEY (cliente) REFERENCES clientes(identificador),
          CONSTRAINT fk_multas_registro FOREIGN KEY (registro) REFERENCES registroDeSubasta(identificador),
          CONSTRAINT fk_multas_factura FOREIGN KEY (factura) REFERENCES facturas_compra(identificador)
        )
        """);
  }

  private void ensureItemStateTable() {
    if (itemStateTableReady) return;
    jdbc.execute("""
        CREATE TABLE IF NOT EXISTS items_subasta_estado (
          item INT NOT NULL,
          estado VARCHAR(20) NOT NULL DEFAULT 'en_espera',
          iniciado_en DATETIME NULL,
          cierra_en DATETIME NULL,
          cerrado_en DATETIME NULL,
          extension_segundos INT NOT NULL DEFAULT 60,
          creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT pk_items_subasta_estado PRIMARY KEY (item),
          CONSTRAINT chk_items_subasta_estado CHECK (estado IN ('en_espera','en_vivo','cerrado')),
          CONSTRAINT chk_items_subasta_extension CHECK (extension_segundos > 0),
          CONSTRAINT fk_items_subasta_estado_item FOREIGN KEY (item) REFERENCES itemsCatalogo(identificador)
        )
        """);
    itemStateTableReady = true;
  }

  private int ensureCompanyBuyerClient() {
    var rows = jdbc.queryForList("""
        SELECT c.identificador
        FROM clientes c
        JOIN personas p ON p.identificador=c.identificador
        WHERE p.documento='EMPRESA-BIDVAULT'
        """);
    if (!rows.isEmpty()) {
      int companyId = ((Number) rows.get(0).get("identificador")).intValue();
      ensureCompanyOwner(companyId);
      return companyId;
    }
    int personaId = insertAndReturnKey("""
        INSERT INTO personas (documento, nombre, direccion, estado)
        VALUES ('EMPRESA-BIDVAULT', 'BidVault Empresa', 'Galeria Central', 'activo')
        """);
    jdbc.update("""
        INSERT INTO clientes (identificador, numeroPais, admitido, categoria, verificador)
        VALUES (?, 1, 'si', 'platino', 1)
        """, personaId);
    ensureCompanyOwner(personaId);
    return personaId;
  }

  private void ensureCompanyOwner(int companyId) {
    jdbc.update("""
        INSERT INTO duenios (identificador, numeroPais, verificacionFinanciera, verificacionJudicial, calificacionRiesgo, verificador)
        SELECT ?, 1, 'si', 'si', 1, 1
        WHERE NOT EXISTS (SELECT 1 FROM duenios WHERE identificador=?)
        """, companyId, companyId);
  }

  private void notifyOwnerIfClient(int ownerId, String title, String body) {
    var rows = jdbc.queryForList("SELECT identificador FROM clientes WHERE identificador=?", ownerId);
    if (rows.isEmpty()) return;
    jdbc.update("""
        INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
        VALUES (?, ?, ?, 'importante')
        """, ownerId, title, body);
  }

  private void ensureLiveItem(int subastaId) {
    ensureItemStateTable();
    jdbc.update("""
        INSERT INTO items_subasta_estado (item, estado, extension_segundos)
        SELECT i.identificador,
               CASE WHEN i.subastado='si' THEN 'cerrado' ELSE 'en_espera' END,
               60
        FROM itemsCatalogo i
        JOIN catalogos c ON c.identificador=i.catalogo
        WHERE c.subasta=?
        ON DUPLICATE KEY UPDATE item=VALUES(item)
        """, subastaId);
    Integer live = jdbc.queryForObject("""
        SELECT COUNT(*)
        FROM items_subasta_estado ise
        JOIN itemsCatalogo i ON i.identificador=ise.item
        JOIN catalogos c ON c.identificador=i.catalogo
        WHERE c.subasta=? AND ise.estado='en_vivo' AND ise.cierra_en > NOW() AND i.subastado='no'
        """, Integer.class, subastaId);
    if (live != null && live > 0) return;
    Integer expiredLive = jdbc.queryForObject("""
        SELECT COUNT(*)
        FROM items_subasta_estado ise
        JOIN itemsCatalogo i ON i.identificador=ise.item
        JOIN catalogos c ON c.identificador=i.catalogo
        WHERE c.subasta=? AND ise.estado='en_vivo' AND i.subastado='no'
        """, Integer.class, subastaId);
    if (expiredLive != null && expiredLive > 0) return;
    var next = jdbc.queryForList("""
        SELECT i.identificador item
        FROM itemsCatalogo i
        JOIN catalogos c ON c.identificador=i.catalogo
        JOIN items_subasta_estado ise ON ise.item=i.identificador
        WHERE c.subasta=? AND i.subastado='no' AND ise.estado='en_espera'
        ORDER BY i.identificador
        LIMIT 1
        """, subastaId);
    if (next.isEmpty()) return;
    int itemId = ((Number) next.get(0).get("item")).intValue();
    jdbc.update("""
        UPDATE items_subasta_estado
        SET estado='en_vivo', iniciado_en=COALESCE(iniciado_en, NOW()),
            cierra_en=NULL,
            actualizado_en=CURRENT_TIMESTAMP
        WHERE item=?
        """, itemId);
    realtimeHub.publish(subastaId, Map.of("tipo", "ITEM_EN_VIVO", "subastaId", subastaId, "itemId", itemId,
        "itemTiempoRestanteSegundos", itemRemainingSeconds(itemId)));
  }

  private void startLiveItemTimerIfNeeded(int subastaId) {
    ensureItemStateTable();
    var liveItems = jdbc.queryForList("""
        SELECT ise.item
        FROM items_subasta_estado ise
        JOIN itemsCatalogo i ON i.identificador=ise.item
        JOIN catalogos c ON c.identificador=i.catalogo
        WHERE c.subasta=? AND ise.estado='en_vivo' AND ise.cierra_en IS NULL AND i.subastado='no'
        ORDER BY ise.iniciado_en, ise.item
        LIMIT 1
        """, subastaId);
    if (liveItems.isEmpty()) return;
    int itemId = ((Number) liveItems.get(0).get("item")).intValue();
    jdbc.update("""
        UPDATE items_subasta_estado
        SET cierra_en=DATE_ADD(NOW(), INTERVAL extension_segundos SECOND),
            actualizado_en=CURRENT_TIMESTAMP
        WHERE item=? AND estado='en_vivo' AND cierra_en IS NULL
        """, itemId);
    realtimeHub.publish(subastaId, Map.of("tipo", "ITEM_EN_VIVO", "subastaId", subastaId, "itemId", itemId,
        "itemTiempoRestanteSegundos", itemRemainingSeconds(itemId)));
  }

  private boolean finishAuctionIfAllItemsClosed(int subastaId) {
    Integer remaining = jdbc.queryForObject("""
        SELECT COUNT(*)
        FROM itemsCatalogo i
        JOIN catalogos c ON c.identificador=i.catalogo
        WHERE c.subasta=? AND i.subastado='no'
        """, Integer.class, subastaId);
    if (remaining != null && remaining > 0) return false;
    String current = jdbc.queryForObject("""
        SELECT COALESCE(se.estado_app, s.estado)
        FROM subastas s
        LEFT JOIN subastas_estados_app se ON se.subasta=s.identificador
        WHERE s.identificador=?
        """, String.class, subastaId);
    if (!"carrada".equals(current)) {
      jdbc.update("UPDATE subastas SET estado='carrada' WHERE identificador=?", subastaId);
      jdbc.update("""
          INSERT INTO subastas_estados_app (subasta, estado_app)
          VALUES (?, 'carrada')
          ON DUPLICATE KEY UPDATE estado_app=VALUES(estado_app)
          """, subastaId);
      jdbc.update("UPDATE sesiones_subasta SET activa='no' WHERE subasta=?", subastaId);
      realtimeHub.publish(subastaId, Map.of("tipo", "SUBASTA_FINALIZADA", "subastaId", subastaId));
    }
    return true;
  }

  private int itemRemainingSeconds(int itemId) {
    Integer seconds = jdbc.queryForObject("""
        SELECT COALESCE(GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), cierra_en)), 0)
        FROM items_subasta_estado
        WHERE item=?
        """, Integer.class, itemId);
    return seconds == null ? 0 : seconds;
  }

  private int countActiveSpectators(int subastaId) {
    Integer count = jdbc.queryForObject("""
        SELECT COUNT(*)
        FROM sesiones_subasta
        WHERE subasta=? AND activa='si'
        """, Integer.class, subastaId);
    return count == null ? 0 : count;
  }

  private void ensurePaymentLimit(Map<String, Object> payment, BigDecimal requiredAmount, String operation) {
    if (!"cheque".equals(Objects.toString(payment.get("tipo"), "").toLowerCase())) return;
    if (requiredAmount == null) return;
    Object rawLimit = payment.get("monto_reservado");
    if (!(rawLimit instanceof BigDecimal limit) || limit.compareTo(requiredAmount) < 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST,
          "El cheque certificado no alcanza para " + operation + ". Limite disponible: " +
              Objects.toString(rawLimit, "0") + ". Monto requerido: " + requiredAmount + ".");
    }
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

  private List<String> productImages(int productId) {
    var images = jdbc.queryForList("""
        SELECT CONCAT('data:image/jpeg;base64,', TO_BASE64(foto)) url
        FROM fotos
        WHERE producto=?
        ORDER BY identificador
        """, String.class, productId);
    if (!images.isEmpty() || !tableExists("solicitudes_productos_revision")) {
      return images;
    }
    return jdbc.queryForList("""
        SELECT sf.url
        FROM solicitudes_productos_revision spr
        JOIN solicitudes_fotos sf ON sf.solicitud = spr.solicitud
        WHERE spr.producto=?
          AND (sf.url LIKE 'data:image/%' OR sf.url LIKE 'http://%' OR sf.url LIKE 'https://%')
        ORDER BY sf.identificador
        """, String.class, productId);
  }

  private boolean tableExists(String tableName) {
    Integer count = jdbc.queryForObject("""
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
        """, Integer.class, tableName);
    return count != null && count > 0;
  }

  private String temporaryPassword() {
    String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    StringBuilder value = new StringBuilder("BV-");
    for (int i = 0; i < 8; i++) {
      value.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
    }
    return value.toString();
  }

  private void sendTemporaryPasswordOrFail(String email, String fullName, String temporaryPassword) {
    try {
      emailService.sendTemporaryPassword(email, fullName, temporaryPassword);
    } catch (RuntimeException ex) {
      throw new ApiException(HttpStatus.BAD_GATEWAY, "No se pudo enviar el mail. Revisá la configuración SMTP del backend.");
    }
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

  private void ensureProductReviewTable() {
    jdbc.execute("""
        CREATE TABLE IF NOT EXISTS solicitudes_productos_revision (
          identificador INT NOT NULL AUTO_INCREMENT,
          solicitud INT NOT NULL,
          producto INT NULL,
          subasta INT NULL,
          catalogo INT NULL,
          item INT NULL,
          precio_base DECIMAL(18,2) NULL,
          comision DECIMAL(18,2) NULL,
          estado VARCHAR(30) NOT NULL DEFAULT 'propuesta_enviada',
          observacion VARCHAR(500) NULL,
          creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT pk_solicitudes_productos_revision PRIMARY KEY (identificador),
          CONSTRAINT uq_solicitudes_productos_revision UNIQUE (solicitud),
          CONSTRAINT fk_spr_solicitud FOREIGN KEY (solicitud) REFERENCES solicitudes_productos(identificador),
          CONSTRAINT fk_spr_producto FOREIGN KEY (producto) REFERENCES productos(identificador),
          CONSTRAINT fk_spr_subasta FOREIGN KEY (subasta) REFERENCES subastas(identificador),
          CONSTRAINT fk_spr_catalogo FOREIGN KEY (catalogo) REFERENCES catalogos(identificador),
          CONSTRAINT fk_spr_item FOREIGN KEY (item) REFERENCES itemsCatalogo(identificador)
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
  public record ApproveUserRequest(String email) {}
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



