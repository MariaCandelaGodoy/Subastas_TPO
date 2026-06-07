USE bidvault;

SELECT
  sp.identificador AS solicitud_id,
  sp.duenio,
  pe.nombre AS duenio_nombre,
  sp.titulo,
  sp.descripcion,
  sp.estado,
  sp.motivo_rechazo,
  sp.deposito,
  sp.seguro,
  COUNT(sf.identificador) AS fotos_cargadas,
  sp.creado_en
FROM solicitudes_productos sp
JOIN personas pe ON pe.identificador = sp.duenio
LEFT JOIN solicitudes_fotos sf ON sf.solicitud = sp.identificador
GROUP BY
  sp.identificador,
  sp.duenio,
  pe.nombre,
  sp.titulo,
  sp.descripcion,
  sp.estado,
  sp.motivo_rechazo,
  sp.deposito,
  sp.seguro,
  sp.creado_en
ORDER BY sp.creado_en DESC;
