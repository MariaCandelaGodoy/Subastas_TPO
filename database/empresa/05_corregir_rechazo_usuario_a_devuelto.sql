USE bidvault;

-- Corrige solicitudes que quedaron de una version anterior:
-- si el usuario rechazo la propuesta, deben figurar como devueltas con cargo.
UPDATE solicitudes_productos
SET estado = 'devuelto',
    motivo_rechazo = 'El usuario rechazo la propuesta de precio base y comision de la empresa. Devolucion con cargo pendiente de liquidacion por la empresa.'
WHERE estado = 'en_revision'
  AND motivo_rechazo LIKE '%usuario rechazo la propuesta%';

SELECT identificador AS solicitud_id, titulo, estado, motivo_rechazo
FROM solicitudes_productos
WHERE motivo_rechazo LIKE '%usuario rechazo la propuesta%';
