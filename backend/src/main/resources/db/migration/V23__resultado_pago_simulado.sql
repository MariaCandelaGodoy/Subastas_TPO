SET @add_resultado_pago_simulado = (
  SELECT IF(
    NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'medios_pago'
        AND column_name = 'resultado_pago_simulado'
    ),
    'ALTER TABLE medios_pago ADD COLUMN resultado_pago_simulado VARCHAR(30) NOT NULL DEFAULT ''aprobado''',
    'SELECT 1'
  )
);

PREPARE add_resultado_pago_simulado_stmt FROM @add_resultado_pago_simulado;
EXECUTE add_resultado_pago_simulado_stmt;
DEALLOCATE PREPARE add_resultado_pago_simulado_stmt;

UPDATE medios_pago
SET resultado_pago_simulado = 'aprobado'
WHERE resultado_pago_simulado IS NULL OR resultado_pago_simulado = '';
