CREATE TABLE IF NOT EXISTS documentos_verificacion (
  identificador INT NOT NULL AUTO_INCREMENT,
  persona INT NOT NULL,
  tipo_documento VARCHAR(30) NOT NULL DEFAULT 'DNI',
  frente LONGBLOB NOT NULL,
  dorso LONGBLOB NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'aprobada_simulada',
  observacion VARCHAR(250),
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verificado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_documentos_verificacion PRIMARY KEY (identificador),
  CONSTRAINT fk_documentos_verificacion_personas FOREIGN KEY (persona) REFERENCES personas(identificador)
);
