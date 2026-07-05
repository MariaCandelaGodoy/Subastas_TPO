CREATE TABLE IF NOT EXISTS items_subasta_estado (
  item INT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'en_espera',
  iniciado_en DATETIME NULL,
  cierra_en DATETIME NULL,
  cerrado_en DATETIME NULL,
  extension_segundos INT NOT NULL DEFAULT 60,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT pk_items_subasta_estado PRIMARY KEY (item),
  CONSTRAINT chk_items_subasta_estado CHECK (estado IN ('en_espera','en_vivo','cerrado')),
  CONSTRAINT chk_items_subasta_extension CHECK (extension_segundos > 0),
  CONSTRAINT fk_items_subasta_estado_item FOREIGN KEY (item) REFERENCES itemsCatalogo(identificador)
);

INSERT INTO items_subasta_estado (item, estado, extension_segundos)
SELECT identificador,
       CASE WHEN subastado='si' THEN 'cerrado' ELSE 'en_espera' END,
       60
FROM itemsCatalogo
ON DUPLICATE KEY UPDATE
  estado = CASE
    WHEN estado <> 'cerrado' AND VALUES(estado) = 'cerrado' THEN 'cerrado'
    ELSE estado
  END;
