ALTER TABLE items_subasta_estado
  MODIFY extension_segundos INT NOT NULL DEFAULT 60;

UPDATE items_subasta_estado
SET extension_segundos = 60
WHERE extension_segundos = 30;
