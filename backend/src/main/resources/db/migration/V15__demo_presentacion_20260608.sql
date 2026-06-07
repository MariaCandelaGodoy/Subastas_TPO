UPDATE subastas
SET fecha = '2026-06-08'
WHERE identificador IN (2, 4);

INSERT INTO subastas_estados_app (subasta, estado_app)
VALUES (2, 'programada'), (4, 'programada')
ON DUPLICATE KEY UPDATE estado_app = VALUES(estado_app);

UPDATE clientes c
JOIN usuarios_app u ON u.persona = c.identificador
SET c.categoria = 'oro'
WHERE u.email = 'demo@bidvault.com';
