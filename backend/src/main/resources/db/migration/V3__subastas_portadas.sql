CREATE TABLE IF NOT EXISTS subastas_portadas (
  identificador INT NOT NULL AUTO_INCREMENT,
  subasta INT NOT NULL,
  imagen LONGTEXT NOT NULL,
  mime_type VARCHAR(80) NOT NULL DEFAULT 'image/jpeg',
  descripcion VARCHAR(250) NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_subastas_portadas PRIMARY KEY (identificador),
  CONSTRAINT uq_subastas_portadas_subasta UNIQUE (subasta),
  CONSTRAINT fk_subastas_portadas_subastas FOREIGN KEY (subasta) REFERENCES subastas(identificador)
);
