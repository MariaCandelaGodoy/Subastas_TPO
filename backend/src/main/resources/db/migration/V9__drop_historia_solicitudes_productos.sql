SET @drop_historia_sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'solicitudes_productos'
        AND column_name = 'historia'
    ),
    'ALTER TABLE solicitudes_productos DROP COLUMN historia',
    'SELECT 1'
  )
);

PREPARE drop_historia_stmt FROM @drop_historia_sql;
EXECUTE drop_historia_stmt;
DEALLOCATE PREPARE drop_historia_stmt;
