SET @add_duracion_column = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE subastas_config ADD COLUMN duracion_minutos INT NOT NULL DEFAULT 90',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'subastas_config'
    AND COLUMN_NAME = 'duracion_minutos'
);

PREPARE add_duracion_column_stmt FROM @add_duracion_column;
EXECUTE add_duracion_column_stmt;
DEALLOCATE PREPARE add_duracion_column_stmt;

SET @add_duracion_check = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE subastas_config ADD CONSTRAINT chk_subastas_config_duracion CHECK (duracion_minutos > 0)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'subastas_config'
    AND CONSTRAINT_NAME = 'chk_subastas_config_duracion'
);

PREPARE add_duracion_check_stmt FROM @add_duracion_check;
EXECUTE add_duracion_check_stmt;
DEALLOCATE PREPARE add_duracion_check_stmt;

INSERT INTO subastas_config (subasta, moneda, duracion_minutos)
SELECT identificador, 'ARS', 90
FROM subastas
ON DUPLICATE KEY UPDATE duracion_minutos = COALESCE(duracion_minutos, 90);
