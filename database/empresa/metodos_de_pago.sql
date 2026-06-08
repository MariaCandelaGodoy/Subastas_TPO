USE bidvault;

-- Ver metodos de pago

SELECT identificador, cliente, tipo, entidad, referencia, moneda, monto_reservado, verificado, activo
FROM medios_pago
ORDER BY cliente, identificador;


-- Cambiar estos valores
USE bidvault;

SET @medio_pago_id = 6;
SET @estado = 'si'; -- 'si' = verificado / 'no' = pendiente

UPDATE medios_pago
SET verificado = @estado
WHERE identificador = @medio_pago_id;

SELECT identificador, cliente, tipo, entidad, referencia, moneda, monto_reservado, verificado, activo
FROM medios_pago
WHERE identificador = @medio_pago_id;