CREATE DATABASE IF NOT EXISTS bidvault CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bidvault;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS mensajes;
DROP TABLE IF EXISTS facturas_compra;
DROP TABLE IF EXISTS envios;
DROP TABLE IF EXISTS solicitudes_fotos;
DROP TABLE IF EXISTS solicitudes_productos;
DROP TABLE IF EXISTS documentos_verificacion;
DROP TABLE IF EXISTS favoritos;
DROP TABLE IF EXISTS sesiones_subasta;
DROP TABLE IF EXISTS medios_pago;
DROP TABLE IF EXISTS usuarios_app;
DROP TABLE IF EXISTS registroDeSubasta;
DROP TABLE IF EXISTS pujos;
DROP TABLE IF EXISTS asistentes;
DROP TABLE IF EXISTS itemsCatalogo;
DROP TABLE IF EXISTS catalogos;
DROP TABLE IF EXISTS fotos;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS subastas;
DROP TABLE IF EXISTS subastadores;
DROP TABLE IF EXISTS duenios;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS seguros;
DROP TABLE IF EXISTS sectores;
DROP TABLE IF EXISTS empleados;
DROP TABLE IF EXISTS personas;
DROP TABLE IF EXISTS paises;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE paises (
  numero INT NOT NULL,
  nombre VARCHAR(250) NOT NULL,
  nombreCorto VARCHAR(250) NULL,
  capital VARCHAR(250) NOT NULL,
  nacionalidad VARCHAR(250) NOT NULL,
  idiomas VARCHAR(150) NOT NULL,
  CONSTRAINT pk_paises PRIMARY KEY (numero)
);

CREATE TABLE personas (
  identificador INT NOT NULL AUTO_INCREMENT,
  documento VARCHAR(20) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  direccion VARCHAR(250),
  estado VARCHAR(15),
  foto LONGBLOB,
  CONSTRAINT chkEstado CHECK (estado IN ('activo', 'incativo')),
  CONSTRAINT pk_personas PRIMARY KEY (identificador)
);

CREATE TABLE empleados (
  identificador INT NOT NULL,
  cargo VARCHAR(100),
  sector INT NULL,
  CONSTRAINT pk_empleados PRIMARY KEY (identificador)
);

CREATE TABLE sectores (
  identificador INT NOT NULL AUTO_INCREMENT,
  nombreSector VARCHAR(150) NOT NULL,
  codigoSector VARCHAR(10) NULL,
  responsableSector INT NULL,
  CONSTRAINT pk_sectores PRIMARY KEY (identificador),
  CONSTRAINT fk_sectores_empleados FOREIGN KEY (responsableSector) REFERENCES empleados(identificador)
);

ALTER TABLE empleados
  ADD CONSTRAINT fk_empleados_sectores FOREIGN KEY (sector) REFERENCES sectores(identificador);

CREATE TABLE seguros (
  nroPoliza VARCHAR(30) NOT NULL,
  compania VARCHAR(150) NOT NULL,
  polizaCombinada VARCHAR(2),
  importe DECIMAL(18,2) NOT NULL,
  CONSTRAINT chkpolizaCombinada CHECK (polizaCombinada IN ('si','no')),
  CONSTRAINT chkImporte CHECK (importe > 0),
  CONSTRAINT pk_seguro PRIMARY KEY (nroPoliza)
);

CREATE TABLE clientes (
  identificador INT NOT NULL,
  numeroPais INT,
  admitido VARCHAR(2),
  categoria VARCHAR(10),
  verificador INT NOT NULL,
  CONSTRAINT chkAdmitido CHECK (admitido IN ('si','no')),
  CONSTRAINT chkCategoria CHECK (categoria IN ('comun', 'especial', 'plata', 'oro', 'platino')),
  CONSTRAINT pk_clientes PRIMARY KEY (identificador),
  CONSTRAINT fk_clientes_personas FOREIGN KEY (identificador) REFERENCES personas(identificador),
  CONSTRAINT fk_clientes_empleados FOREIGN KEY (verificador) REFERENCES empleados(identificador),
  CONSTRAINT fk_clientes_paises FOREIGN KEY (numeroPais) REFERENCES paises(numero)
);

CREATE TABLE documentos_verificacion (
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

CREATE TABLE duenios (
  identificador INT NOT NULL,
  numeroPais INT,
  `verificaciónFinanciera` VARCHAR(2),
  `verificaciónJudicial` VARCHAR(2),
  calificacionRiesgo INT,
  verificador INT NOT NULL,
  CONSTRAINT chkVF CHECK (`verificaciónFinanciera` IN ('si','no')),
  CONSTRAINT chkVJ CHECK (`verificaciónJudicial` IN ('si','no')),
  CONSTRAINT chkCR CHECK (calificacionRiesgo IN (1,2,3,4,5,6)),
  CONSTRAINT pk_duenios PRIMARY KEY (identificador),
  CONSTRAINT fk_duenios_personas FOREIGN KEY (identificador) REFERENCES personas(identificador),
  CONSTRAINT fk_duenios_empleados FOREIGN KEY (verificador) REFERENCES empleados(identificador)
);

CREATE TABLE subastadores (
  identificador INT NOT NULL,
  matricula VARCHAR(15),
  region VARCHAR(50),
  CONSTRAINT pk_subastadores PRIMARY KEY (identificador),
  CONSTRAINT fk_subastadores_personas FOREIGN KEY (identificador) REFERENCES personas(identificador)
);

CREATE TABLE subastas (
  identificador INT NOT NULL AUTO_INCREMENT,
  fecha DATE,
  hora TIME NOT NULL,
  estado VARCHAR(10),
  subastador INT NULL,
  ubicacion VARCHAR(350) NULL,
  capacidadAsistentes INT NULL,
  tieneDeposito VARCHAR(2),
  seguridadPropia VARCHAR(2),
  categoria VARCHAR(10),
  CONSTRAINT chkES CHECK (estado IN ('abierta','carrada')),
  CONSTRAINT chkTD CHECK (tieneDeposito IN ('si','no')),
  CONSTRAINT chkSP CHECK (seguridadPropia IN ('si','no')),
  CONSTRAINT chkCS CHECK (categoria IN ('comun', 'especial', 'plata', 'oro', 'platino')),
  CONSTRAINT pk_subastas PRIMARY KEY (identificador),
  CONSTRAINT fk_subastas_subastadores FOREIGN KEY (subastador) REFERENCES subastadores(identificador)
);

CREATE TABLE subastas_portadas (
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

CREATE TABLE subastas_estados_app (
  subasta INT NOT NULL,
  estado_app VARCHAR(15) NOT NULL,
  CONSTRAINT pk_subastas_estados_app PRIMARY KEY (subasta),
  CONSTRAINT chk_subastas_estados_app CHECK (estado_app IN ('abierta','carrada','programada')),
  CONSTRAINT fk_subastas_estados_app_subastas FOREIGN KEY (subasta) REFERENCES subastas(identificador)
);

CREATE TABLE subastas_config (
  subasta INT NOT NULL,
  moneda VARCHAR(3) NOT NULL DEFAULT 'ARS',
  CONSTRAINT pk_subastas_config PRIMARY KEY (subasta),
  CONSTRAINT chk_subastas_config_moneda CHECK (moneda IN ('ARS','USD')),
  CONSTRAINT fk_subastas_config_subastas FOREIGN KEY (subasta) REFERENCES subastas(identificador)
);

CREATE TABLE productos (
  identificador INT NOT NULL AUTO_INCREMENT,
  fecha DATE,
  disponible VARCHAR(2),
  descripcionCatalogo VARCHAR(500) NULL DEFAULT 'No Posee',
  descripcionCompleta VARCHAR(300) NOT NULL,
  revisor INT NOT NULL,
  duenio INT NOT NULL,
  seguro VARCHAR(30) NULL,
  CONSTRAINT chkD CHECK (disponible IN ('si','no')),
  CONSTRAINT pk_productos PRIMARY KEY (identificador),
  CONSTRAINT fk_productos_empleados FOREIGN KEY (revisor) REFERENCES empleados(identificador),
  CONSTRAINT fk_productos_duenios FOREIGN KEY (duenio) REFERENCES duenios(identificador),
  CONSTRAINT fk_productos_seguros FOREIGN KEY (seguro) REFERENCES seguros(nroPoliza)
);

CREATE TABLE fotos (
  identificador INT NOT NULL AUTO_INCREMENT,
  producto INT NOT NULL,
  foto LONGBLOB NOT NULL,
  CONSTRAINT pk_fotos PRIMARY KEY (identificador),
  CONSTRAINT fk_fotos_productos FOREIGN KEY (producto) REFERENCES productos(identificador)
);

CREATE TABLE catalogos (
  identificador INT NOT NULL AUTO_INCREMENT,
  descripcion VARCHAR(250) NOT NULL,
  subasta INT NULL,
  responsable INT NOT NULL,
  CONSTRAINT pk_catalogos PRIMARY KEY (identificador),
  CONSTRAINT fk_catalogos_empleados FOREIGN KEY (responsable) REFERENCES empleados(identificador),
  CONSTRAINT fk_catalogos_subastas FOREIGN KEY (subasta) REFERENCES subastas(identificador)
);

CREATE TABLE itemsCatalogo (
  identificador INT NOT NULL AUTO_INCREMENT,
  catalogo INT NOT NULL,
  producto INT NOT NULL,
  precioBase DECIMAL(18,2) NOT NULL,
  comision DECIMAL(18,2) NOT NULL,
  subastado VARCHAR(2),
  CONSTRAINT chkPB CHECK (precioBase > 0.01),
  CONSTRAINT chkC CHECK (comision > 0.01),
  CONSTRAINT chkS CHECK (subastado IN ('si','no')),
  CONSTRAINT pk_itemsCatalogo PRIMARY KEY (identificador),
  CONSTRAINT fk_itemsCatalogo_catalogos FOREIGN KEY (catalogo) REFERENCES catalogos(identificador),
  CONSTRAINT fk_itemsCatalogo_productos FOREIGN KEY (producto) REFERENCES productos(identificador)
);

CREATE TABLE asistentes (
  identificador INT NOT NULL AUTO_INCREMENT,
  numeroPostor INT NOT NULL,
  cliente INT NOT NULL,
  subasta INT NOT NULL,
  CONSTRAINT pk_asistentes PRIMARY KEY (identificador),
  CONSTRAINT fk_asistentes_clientes FOREIGN KEY (cliente) REFERENCES clientes(identificador),
  CONSTRAINT fk_asistentes_subasta FOREIGN KEY (subasta) REFERENCES subastas(identificador),
  CONSTRAINT uq_asistente UNIQUE (cliente, subasta)
);

CREATE TABLE pujos (
  identificador INT NOT NULL AUTO_INCREMENT,
  asistente INT NOT NULL,
  item INT NOT NULL,
  importe DECIMAL(18,2) NOT NULL,
  ganador VARCHAR(2) DEFAULT 'no',
  CONSTRAINT chkI CHECK (importe > 0.01),
  CONSTRAINT chkG CHECK (ganador IN ('si','no')),
  CONSTRAINT pk_pujos PRIMARY KEY (identificador),
  CONSTRAINT fk_pujos_asistentes FOREIGN KEY (asistente) REFERENCES asistentes(identificador),
  CONSTRAINT fk_pujos_itemsCatalogo FOREIGN KEY (item) REFERENCES itemsCatalogo(identificador)
);

CREATE TABLE registroDeSubasta (
  identificador INT NOT NULL AUTO_INCREMENT,
  subasta INT NOT NULL,
  duenio INT NOT NULL,
  producto INT NOT NULL,
  cliente INT NOT NULL,
  importe DECIMAL(18,2) NOT NULL,
  comision DECIMAL(18,2) NOT NULL,
  CONSTRAINT chkImportePagado CHECK (importe > 0.01),
  CONSTRAINT chkComisionPagada CHECK (comision > 0.01),
  CONSTRAINT pk_registroDeSubasta PRIMARY KEY (identificador),
  CONSTRAINT fk_registroDeSubasta_subastas FOREIGN KEY (subasta) REFERENCES subastas(identificador),
  CONSTRAINT fk_registroDeSubasta_duenios FOREIGN KEY (duenio) REFERENCES duenios(identificador),
  CONSTRAINT fk_registroDeSubasta_producto FOREIGN KEY (producto) REFERENCES productos(identificador),
  CONSTRAINT fk_registroDeSubasta_cliente FOREIGN KEY (cliente) REFERENCES clientes(identificador)
);

CREATE TABLE usuarios_app (
  identificador INT NOT NULL AUTO_INCREMENT,
  persona INT NOT NULL,
  email VARCHAR(180) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  password_temporal VARCHAR(2) NOT NULL DEFAULT 'no',
  rol VARCHAR(20) NOT NULL DEFAULT 'cliente',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_usuarios_app PRIMARY KEY (identificador),
  CONSTRAINT uq_usuarios_email UNIQUE (email),
  CONSTRAINT fk_usuarios_personas FOREIGN KEY (persona) REFERENCES personas(identificador)
);

CREATE TABLE medios_pago (
  identificador INT NOT NULL AUTO_INCREMENT,
  cliente INT NOT NULL,
  tipo VARCHAR(25) NOT NULL,
  moneda VARCHAR(3) NOT NULL,
  entidad VARCHAR(120) NOT NULL,
  referencia VARCHAR(120) NOT NULL,
  monto_reservado DECIMAL(18,2) NULL,
  verificado VARCHAR(2) NOT NULL DEFAULT 'no',
  activo VARCHAR(2) NOT NULL DEFAULT 'si',
  CONSTRAINT pk_medios_pago PRIMARY KEY (identificador),
  CONSTRAINT chk_mp_tipo CHECK (tipo IN ('cuenta','tarjeta','cheque')),
  CONSTRAINT chk_mp_moneda CHECK (moneda IN ('ARS','USD')),
  CONSTRAINT chk_mp_verificado CHECK (verificado IN ('si','no')),
  CONSTRAINT chk_mp_activo CHECK (activo IN ('si','no')),
  CONSTRAINT fk_medios_pago_clientes FOREIGN KEY (cliente) REFERENCES clientes(identificador)
);

CREATE TABLE sesiones_subasta (
  identificador INT NOT NULL AUTO_INCREMENT,
  cliente INT NOT NULL,
  subasta INT NOT NULL,
  activa VARCHAR(2) NOT NULL DEFAULT 'si',
  conectado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_sesiones_subasta PRIMARY KEY (identificador),
  CONSTRAINT chk_sesion_activa CHECK (activa IN ('si','no')),
  CONSTRAINT fk_sesiones_cliente FOREIGN KEY (cliente) REFERENCES clientes(identificador),
  CONSTRAINT fk_sesiones_subasta FOREIGN KEY (subasta) REFERENCES subastas(identificador)
);

CREATE TABLE garantias_subasta (
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

CREATE TABLE favoritos (
  identificador INT NOT NULL AUTO_INCREMENT,
  cliente INT NOT NULL,
  subasta INT NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_favoritos PRIMARY KEY (identificador),
  CONSTRAINT uq_favorito UNIQUE (cliente, subasta),
  CONSTRAINT fk_favoritos_cliente FOREIGN KEY (cliente) REFERENCES clientes(identificador),
  CONSTRAINT fk_favoritos_subasta FOREIGN KEY (subasta) REFERENCES subastas(identificador)
);

CREATE TABLE solicitudes_productos (
  identificador INT NOT NULL AUTO_INCREMENT,
  duenio INT NOT NULL,
  titulo VARCHAR(160) NOT NULL,
  descripcion TEXT NOT NULL,
  origen_licito VARCHAR(2) NOT NULL,
  declaracion_propiedad VARCHAR(2) NOT NULL,
  acepta_devolucion_cargo VARCHAR(2) NOT NULL,
  estado VARCHAR(25) NOT NULL DEFAULT 'pendiente',
  motivo_rechazo VARCHAR(500) NULL,
  deposito VARCHAR(180) NULL,
  seguro VARCHAR(30) NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_solicitudes_productos PRIMARY KEY (identificador),
  CONSTRAINT chk_sp_bool CHECK (origen_licito IN ('si','no') AND declaracion_propiedad IN ('si','no') AND acepta_devolucion_cargo IN ('si','no')),
  CONSTRAINT chk_sp_estado CHECK (estado IN ('pendiente','en_revision','aceptado','rechazado','devuelto')),
  CONSTRAINT fk_solicitudes_duenios FOREIGN KEY (duenio) REFERENCES duenios(identificador),
  CONSTRAINT fk_solicitudes_seguro FOREIGN KEY (seguro) REFERENCES seguros(nroPoliza)
);

CREATE TABLE solicitudes_fotos (
  identificador INT NOT NULL AUTO_INCREMENT,
  solicitud INT NOT NULL,
  url LONGTEXT NOT NULL,
  CONSTRAINT pk_solicitudes_fotos PRIMARY KEY (identificador),
  CONSTRAINT fk_solicitudes_fotos FOREIGN KEY (solicitud) REFERENCES solicitudes_productos(identificador)
);

CREATE TABLE envios (
  identificador INT NOT NULL AUTO_INCREMENT,
  registro INT NOT NULL,
  direccion VARCHAR(250) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  costo DECIMAL(18,2) NOT NULL DEFAULT 0,
  codigo_seguimiento VARCHAR(80) NULL,
  CONSTRAINT pk_envios PRIMARY KEY (identificador),
  CONSTRAINT chk_envio_estado CHECK (estado IN ('pendiente','despachado','entregado','retiro_personal')),
  CONSTRAINT fk_envios_registro FOREIGN KEY (registro) REFERENCES registroDeSubasta(identificador)
);

CREATE TABLE facturas_compra (
  identificador INT NOT NULL AUTO_INCREMENT,
  registro INT NOT NULL,
  envio INT,
  medio_pago INT,
  numero VARCHAR(30) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  comision DECIMAL(12,2) NOT NULL,
  costo_envio DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente_pago',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pagado_en TIMESTAMP NULL,
  CONSTRAINT pk_facturas_compra PRIMARY KEY (identificador),
  CONSTRAINT uq_facturas_compra_registro UNIQUE (registro),
  CONSTRAINT uq_facturas_compra_numero UNIQUE (numero),
  CONSTRAINT fk_facturas_registro FOREIGN KEY (registro) REFERENCES registroDeSubasta(identificador),
  CONSTRAINT fk_facturas_envio FOREIGN KEY (envio) REFERENCES envios(identificador),
  CONSTRAINT fk_facturas_medio_pago FOREIGN KEY (medio_pago) REFERENCES medios_pago(identificador)
);

CREATE TABLE mensajes (
  identificador INT NOT NULL AUTO_INCREMENT,
  cliente INT NOT NULL,
  titulo VARCHAR(160) NOT NULL,
  cuerpo VARCHAR(800) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'otra',
  leido VARCHAR(2) NOT NULL DEFAULT 'no',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_mensajes PRIMARY KEY (identificador),
  CONSTRAINT chk_mensaje_tipo CHECK (tipo IN ('importante','otra')),
  CONSTRAINT chk_mensaje_leido CHECK (leido IN ('si','no')),
  CONSTRAINT fk_mensajes_cliente FOREIGN KEY (cliente) REFERENCES clientes(identificador)
);
