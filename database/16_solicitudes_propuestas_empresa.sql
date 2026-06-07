USE bidvault;

CREATE TABLE IF NOT EXISTS solicitudes_propuestas_empresa (
  identificador INT NOT NULL AUTO_INCREMENT,
  solicitud INT NOT NULL,
  fecha_subasta DATE NOT NULL,
  hora_subasta TIME NOT NULL,
  ubicacion VARCHAR(350) NOT NULL,
  precio_base DECIMAL(18,2) NOT NULL,
  moneda VARCHAR(3) NOT NULL DEFAULT 'USD',
  comision DECIMAL(18,2) NOT NULL,
  poliza_compania VARCHAR(120) NULL,
  poliza_numero VARCHAR(80) NULL,
  poliza_cobertura VARCHAR(120) NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente_usuario',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  respondido_en TIMESTAMP NULL,
  CONSTRAINT pk_solicitudes_propuestas_empresa PRIMARY KEY (identificador),
  CONSTRAINT uq_solicitudes_propuestas_empresa UNIQUE (solicitud),
  CONSTRAINT fk_spe_solicitud FOREIGN KEY (solicitud) REFERENCES solicitudes_productos(identificador),
  CONSTRAINT chk_spe_estado CHECK (estado IN ('pendiente_usuario','aceptada','rechazada'))
);
