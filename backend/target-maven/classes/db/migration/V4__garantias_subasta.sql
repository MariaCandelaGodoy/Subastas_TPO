CREATE TABLE IF NOT EXISTS garantias_subasta (
  identificador INT NOT NULL AUTO_INCREMENT,
  cliente INT NOT NULL,
  subasta INT NOT NULL,
  medio_pago INT NOT NULL,
  estado_verificacion VARCHAR(2) NOT NULL DEFAULT 'no',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_garantias_subasta PRIMARY KEY (identificador),
  CONSTRAINT uq_garantia_cliente_subasta UNIQUE (cliente, subasta),
  CONSTRAINT chk_garantia_verificacion CHECK (estado_verificacion IN ('si','no')),
  CONSTRAINT fk_garantias_cliente FOREIGN KEY (cliente) REFERENCES clientes(identificador),
  CONSTRAINT fk_garantias_subasta FOREIGN KEY (subasta) REFERENCES subastas(identificador),
  CONSTRAINT fk_garantias_medio_pago FOREIGN KEY (medio_pago) REFERENCES medios_pago(identificador)
);
