USE bidvault;

-- Cambiar estos valores antes de ejecutar.
SET @solicitud_id = 1;
SET @costo_devolucion = 25000.00;
SET @direccion_devolucion = 'Domicilio legal declarado por el usuario';

START TRANSACTION;

UPDATE solicitudes_productos
SET estado = 'devuelto',
    motivo_rechazo = CONCAT(COALESCE(motivo_rechazo, 'Producto no aceptado.'), ' Devolucion con cargo: ', @costo_devolucion, '. Direccion: ', @direccion_devolucion)
WHERE identificador = @solicitud_id
  AND estado IN ('en_revision', 'rechazado', 'devuelto');

INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
SELECT duenio,
       'Devolucion con cargo',
       CONCAT('La pieza "', titulo, '" fue marcada como devuelta. Costo de devolucion a cargo del usuario: ', @costo_devolucion, '.'),
       'importante'
FROM solicitudes_productos
WHERE identificador = @solicitud_id;

COMMIT;

SELECT identificador AS solicitud_id, titulo, estado, motivo_rechazo
FROM solicitudes_productos
WHERE identificador = @solicitud_id;
