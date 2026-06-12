CREATE TABLE IF NOT EXISTS subastas_config (
  subasta INT NOT NULL,
  moneda VARCHAR(3) NOT NULL DEFAULT 'ARS',
  CONSTRAINT pk_subastas_config PRIMARY KEY (subasta),
  CONSTRAINT chk_subastas_config_moneda CHECK (moneda IN ('ARS','USD')),
  CONSTRAINT fk_subastas_config_subastas FOREIGN KEY (subasta) REFERENCES subastas(identificador)
);

INSERT INTO subastas_config (subasta, moneda)
SELECT identificador, 'ARS'
FROM subastas
ON DUPLICATE KEY UPDATE moneda = VALUES(moneda);
