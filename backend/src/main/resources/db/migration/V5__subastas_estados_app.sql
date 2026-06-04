CREATE TABLE IF NOT EXISTS subastas_estados_app (
  subasta INT NOT NULL,
  estado_app VARCHAR(15) NOT NULL,
  CONSTRAINT pk_subastas_estados_app PRIMARY KEY (subasta),
  CONSTRAINT chk_subastas_estados_app CHECK (estado_app IN ('abierta','carrada','programada')),
  CONSTRAINT fk_subastas_estados_app_subastas FOREIGN KEY (subasta) REFERENCES subastas(identificador)
);

INSERT INTO subastas_estados_app (subasta, estado_app)
VALUES (2, 'programada')
ON DUPLICATE KEY UPDATE estado_app = VALUES(estado_app);
