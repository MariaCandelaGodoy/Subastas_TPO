-- Estado final de demo para que cualquier persona que clone el repo tenga
-- una base usable sin ejecutar queries manuales.

-- Usuario demo listo para probar subastas de mayor categoria.
UPDATE clientes c
JOIN usuarios_app u ON u.persona = c.identificador
SET c.categoria = 'oro',
    c.admitido = 'si'
WHERE u.email = 'demo@bidvault.com';

-- Evita que una sesion vieja bloquee el ingreso a una subasta al levantar una BD demo.
UPDATE sesiones_subasta
SET activa = 'no'
WHERE activa = 'si';

-- Joyería Ruiz queda en vivo desde el momento en que se crea la BD.
UPDATE subastas
SET fecha = CURDATE(),
    hora = DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 5 MINUTE), '%H:%i:00'),
    estado = 'abierta'
WHERE identificador = 4;

INSERT INTO subastas_estados_app (subasta, estado_app)
VALUES (4, 'abierta')
ON DUPLICATE KEY UPDATE estado_app = VALUES(estado_app);

INSERT INTO subastas_config (subasta, moneda, duracion_minutos)
VALUES (4, 'ARS', 120)
ON DUPLICATE KEY UPDATE
  moneda = VALUES(moneda),
  duracion_minutos = VALUES(duracion_minutos);

-- Algunas subastas futuras para que las solapas no queden vacias.
UPDATE subastas
SET fecha = DATE_ADD(CURDATE(), INTERVAL 1 DAY),
    estado = 'abierta'
WHERE identificador IN (1, 2, 3);

INSERT INTO subastas_estados_app (subasta, estado_app)
VALUES
  (1, 'programada'),
  (2, 'programada'),
  (3, 'programada')
ON DUPLICATE KEY UPDATE estado_app = VALUES(estado_app);

INSERT INTO subastas_config (subasta, moneda, duracion_minutos)
VALUES
  (1, 'ARS', 90),
  (2, 'ARS', 90),
  (3, 'ARS', 90)
ON DUPLICATE KEY UPDATE
  moneda = VALUES(moneda),
  duracion_minutos = VALUES(duracion_minutos);

-- Medios demo verificados. El cheque ARS tiene limite suficiente para validar
-- la regla de cheque certificado contra el precio base de la subasta.
UPDATE medios_pago
SET verificado = 'si',
    activo = 'si'
WHERE cliente = (SELECT persona FROM usuarios_app WHERE email = 'demo@bidvault.com')
  AND tipo IN ('tarjeta', 'cuenta');

INSERT INTO medios_pago (cliente, tipo, moneda, entidad, referencia, monto_reservado, verificado, activo)
SELECT u.persona, 'cheque', 'ARS', 'Banco Provincia', 'CHQ-DEMO-ARS-120000', 120000.00, 'si', 'si'
FROM usuarios_app u
WHERE u.email = 'demo@bidvault.com'
  AND NOT EXISTS (
    SELECT 1
    FROM medios_pago mp
    WHERE mp.cliente = u.persona
      AND mp.referencia = 'CHQ-DEMO-ARS-120000'
  );

UPDATE medios_pago mp
JOIN usuarios_app u ON u.persona = mp.cliente
SET mp.moneda = 'ARS',
    mp.monto_reservado = 120000.00,
    mp.verificado = 'si',
    mp.activo = 'si'
WHERE u.email = 'demo@bidvault.com'
  AND mp.referencia = 'CHQ-DEMO-ARS-120000';
