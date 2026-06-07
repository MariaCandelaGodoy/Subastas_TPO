USE bidvault;

-- Cambiar estos valores antes de ejecutar.
SET @solicitud_id = 1;
SET @motivo_rechazo = 'La inspeccion detecto inconsistencias en la documentacion de origen licito.';

START TRANSACTION;

UPDATE solicitudes_productos
SET estado = 'rechazado',
    motivo_rechazo = @motivo_rechazo,
    deposito = NULL,
    seguro = NULL
WHERE identificador = @solicitud_id
  AND estado IN ('pendiente', 'en_revision', 'aceptado');

INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
SELECT duenio,
       'Producto rechazado',
       CONCAT('Tu pieza "', titulo, '" fue rechazada. Motivo: ', @motivo_rechazo, ' La devolucion queda a cargo del usuario segun los terminos aceptados.'),
       'importante'
FROM solicitudes_productos
WHERE identificador = @solicitud_id;

COMMIT;

SELECT identificador AS solicitud_id, titulo, estado, motivo_rechazo
FROM solicitudes_productos
WHERE identificador = @solicitud_id;
