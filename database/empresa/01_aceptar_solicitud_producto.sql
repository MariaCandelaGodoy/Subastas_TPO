USE bidvault;

-- Cambiar estos valores antes de ejecutar.
SET @solicitud_id = 3;
SET @revisor_id = 3;
SET @seguro = 'POL-AR-1001';
SET @deposito = 'Deposito Central - Boveda 2';
SET @fecha_subasta = '2026-06-08';
SET @hora_subasta = '09:30:00';
SET @ubicacion = 'Galeria Central';
SET @precio_base = 4200.00;
SET @moneda = 'USD';
SET @comision = 5.00;
SET @poliza_compania = 'Sancor Seguros';
SET @poliza_numero = 'AXA-7729-LX';
SET @poliza_cobertura = 'Cobertura total';

START TRANSACTION;

CREATE TABLE IF NOT EXISTS solicitudes_productos_revision (
  identificador INT NOT NULL AUTO_INCREMENT,
  solicitud INT NOT NULL,
  producto INT NULL,
  subasta INT NULL,
  catalogo INT NULL,
  item INT NULL,
  precio_base DECIMAL(18,2) NULL,
  comision DECIMAL(18,2) NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'aceptado',
  observacion VARCHAR(500) NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT pk_solicitudes_productos_revision PRIMARY KEY (identificador),
  CONSTRAINT uq_solicitudes_productos_revision UNIQUE (solicitud),
  CONSTRAINT fk_spr_solicitud FOREIGN KEY (solicitud) REFERENCES solicitudes_productos(identificador),
  CONSTRAINT fk_spr_producto FOREIGN KEY (producto) REFERENCES productos(identificador),
  CONSTRAINT fk_spr_subasta FOREIGN KEY (subasta) REFERENCES subastas(identificador),
  CONSTRAINT fk_spr_catalogo FOREIGN KEY (catalogo) REFERENCES catalogos(identificador),
  CONSTRAINT fk_spr_item FOREIGN KEY (item) REFERENCES itemsCatalogo(identificador)
);

UPDATE solicitudes_productos
SET estado = 'en_revision',
    motivo_rechazo = NULL,
    deposito = @deposito,
    seguro = @seguro
WHERE identificador = @solicitud_id
  AND estado IN ('pendiente', 'en_revision', 'rechazado', 'devuelto');

INSERT INTO productos (fecha, disponible, descripcionCatalogo, descripcionCompleta, revisor, duenio, seguro)
SELECT CURDATE(), 'si', sp.titulo, sp.descripcion, @revisor_id, sp.duenio, @seguro
FROM solicitudes_productos sp
LEFT JOIN solicitudes_productos_revision spr ON spr.solicitud = sp.identificador
WHERE sp.identificador = @solicitud_id
  AND spr.producto IS NULL;

SET @producto_id = LAST_INSERT_ID();

INSERT INTO solicitudes_productos_revision (solicitud, producto, estado, observacion)
SELECT @solicitud_id, @producto_id, 'propuesta_enviada', 'Propuesta enviada al usuario para aceptar precio base y comision'
WHERE @producto_id <> 0
ON DUPLICATE KEY UPDATE
  producto = COALESCE(producto, VALUES(producto)),
  estado = 'propuesta_enviada',
  observacion = VALUES(observacion);

SET @producto_id = (
  SELECT producto
  FROM solicitudes_productos_revision
  WHERE solicitud = @solicitud_id
);

DELETE FROM fotos WHERE producto = @producto_id;

INSERT INTO fotos (producto, foto)
SELECT @producto_id, FROM_BASE64(SUBSTRING_INDEX(sf.url, ',', -1))
FROM solicitudes_fotos sf
WHERE sf.solicitud = @solicitud_id
  AND sf.url LIKE 'data:image/%;base64,%';

CREATE TABLE IF NOT EXISTS solicitudes_propuestas_empresa (
  identificador INT NOT NULL AUTO_INCREMENT,
  solicitud INT NOT NULL,
  fecha_subasta DATE NOT NULL,
  hora_subasta TIME NOT NULL,
  ubicacion VARCHAR(350) NOT NULL,
  precio_base DECIMAL(18,2) NOT NULL,
  moneda VARCHAR(3) NOT NULL DEFAULT 'USD',
  comision DECIMAL(18,2) NOT NULL,
  poliza_compania VARCHAR(120) NULL,
  poliza_numero VARCHAR(80) NULL,
  poliza_cobertura VARCHAR(120) NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente_usuario',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  respondido_en TIMESTAMP NULL,
  CONSTRAINT pk_solicitudes_propuestas_empresa PRIMARY KEY (identificador),
  CONSTRAINT uq_solicitudes_propuestas_empresa UNIQUE (solicitud),
  CONSTRAINT fk_spe_solicitud FOREIGN KEY (solicitud) REFERENCES solicitudes_productos(identificador),
  CONSTRAINT chk_spe_estado CHECK (estado IN ('pendiente_usuario','aceptada','rechazada'))
);

INSERT INTO solicitudes_propuestas_empresa
(solicitud, fecha_subasta, hora_subasta, ubicacion, precio_base, moneda, comision, poliza_compania, poliza_numero, poliza_cobertura, estado)
VALUES
(@solicitud_id, @fecha_subasta, @hora_subasta, @ubicacion, @precio_base, @moneda, @comision, @poliza_compania, @poliza_numero, @poliza_cobertura, 'pendiente_usuario')
ON DUPLICATE KEY UPDATE
  fecha_subasta=VALUES(fecha_subasta),
  hora_subasta=VALUES(hora_subasta),
  ubicacion=VALUES(ubicacion),
  precio_base=VALUES(precio_base),
  moneda=VALUES(moneda),
  comision=VALUES(comision),
  poliza_compania=VALUES(poliza_compania),
  poliza_numero=VALUES(poliza_numero),
  poliza_cobertura=VALUES(poliza_cobertura),
  estado='pendiente_usuario',
  respondido_en=NULL;

INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
SELECT sp.duenio,
       'Propuesta recibida',
       CONCAT('La empresa envio una propuesta para tu pieza "', sp.titulo, '". Revisala en Mis piezas para aceptar o rechazar.'),
       'importante'
FROM solicitudes_productos sp
WHERE sp.identificador = @solicitud_id;

COMMIT;

SELECT
  sp.identificador AS solicitud_id,
  sp.estado,
  spr.producto AS producto_id,
  sp.deposito,
  sp.seguro,
  COUNT(f.identificador) AS fotos_producto
FROM solicitudes_productos sp
JOIN solicitudes_productos_revision spr ON spr.solicitud = sp.identificador
LEFT JOIN fotos f ON f.producto = spr.producto
WHERE sp.identificador = @solicitud_id
GROUP BY sp.identificador, sp.estado, spr.producto, sp.deposito, sp.seguro;
