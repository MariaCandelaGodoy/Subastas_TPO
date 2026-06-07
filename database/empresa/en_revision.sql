USE bidvault;

SET @solicitud_id = 3;

INSERT INTO solicitudes_propuestas_empresa
(
  solicitud,
  fecha_subasta,
  hora_subasta,
  ubicacion,
  precio_base,
  moneda,
  comision,
  poliza_compania,
  poliza_numero,
  poliza_cobertura,
  estado
)
VALUES
(
  @solicitud_id,
  '2026-06-08',
  '09:30:00',
  'Galeria Central',
  4200.00,
  'USD',
  5.00,
  'Sancor Seguros',
  'AXA-7729-LX',
  'Cobertura total',
  'pendiente_usuario'
)
ON DUPLICATE KEY UPDATE
  fecha_subasta = VALUES(fecha_subasta),
  hora_subasta = VALUES(hora_subasta),
  ubicacion = VALUES(ubicacion),
  precio_base = VALUES(precio_base),
  moneda = VALUES(moneda),
  comision = VALUES(comision),
  poliza_compania = VALUES(poliza_compania),
  poliza_numero = VALUES(poliza_numero),
  poliza_cobertura = VALUES(poliza_cobertura),
  estado = 'pendiente_usuario',
  respondido_en = NULL;

UPDATE solicitudes_productos
SET estado = 'en_revision'
WHERE identificador = @solicitud_id;

SELECT sp.identificador, sp.titulo, sp.estado, spe.estado AS propuesta_estado,
       spe.precio_base, spe.moneda, spe.comision
FROM solicitudes_productos sp
LEFT JOIN solicitudes_propuestas_empresa spe ON spe.solicitud = sp.identificador
WHERE sp.identificador = @solicitud_id;