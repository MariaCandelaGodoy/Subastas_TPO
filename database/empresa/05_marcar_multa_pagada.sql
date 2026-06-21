USE bidvault;

-- CAMBIAR ESTE VALOR ANTES DE EJECUTAR
SET @multa_id = 1;

UPDATE multas_incumplimiento
SET estado = 'pagada',
    pagado_en = CURRENT_TIMESTAMP
WHERE identificador = @multa_id;

SELECT m.identificador,
       m.cliente,
       p.nombre AS cliente_nombre,
       m.factura,
       m.importe_base,
       m.importe_multa,
       m.vencimiento,
       m.estado,
       m.pagado_en
FROM multas_incumplimiento m
JOIN personas p ON p.identificador = m.cliente
WHERE m.identificador = @multa_id;
