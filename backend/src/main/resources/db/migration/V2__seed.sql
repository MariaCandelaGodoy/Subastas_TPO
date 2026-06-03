INSERT INTO paises (numero, nombre, nombreCorto, capital, nacionalidad, idiomas) VALUES
(32, 'Argentina', 'AR', 'Buenos Aires', 'argentina', 'español'),
(840, 'Estados Unidos', 'US', 'Washington D. C.', 'estadounidense', 'inglés'),
(858, 'Uruguay', 'UY', 'Montevideo', 'uruguaya', 'español');

INSERT INTO personas (identificador, documento, nombre, direccion, estado) VALUES
(1, 'EMP-001', 'Valeria Control', 'Av. Corrientes 1000', 'activo'),
(2, 'SUB-001', 'Martín Ledesma', 'Av. Santa Fe 1400', 'activo'),
(3, '30999888', 'Nombre Apellido', 'Calle Legal 123', 'activo'),
(4, '27888111', 'Joyería Ruiz', 'Talcahuano 450', 'activo'),
(5, '33999123', 'Vestidos Vivienne', 'Defensa 900', 'activo'),
(6, '40111222', 'Usuario Pendiente', 'Lavalle 300', 'activo');

INSERT INTO empleados (identificador, cargo, sector) VALUES
(1, 'Verificadora senior', NULL);

INSERT INTO sectores (identificador, nombreSector, codigoSector, responsableSector) VALUES
(1, 'Verificación y catálogo', 'VER', 1);

UPDATE empleados SET sector = 1 WHERE identificador = 1;

INSERT INTO clientes (identificador, numeroPais, admitido, categoria, verificador) VALUES
(3, 32, 'si', 'plata', 1),
(6, 32, 'no', 'comun', 1);

INSERT INTO duenios (identificador, numeroPais, verificaciónFinanciera, verificaciónJudicial, calificacionRiesgo, verificador) VALUES
(4, 32, 'si', 'si', 2, 1),
(5, 858, 'si', 'si', 3, 1),
(3, 32, 'si', 'si', 2, 1);

INSERT INTO subastadores (identificador, matricula, region) VALUES
(2, 'MAT-9981', 'AMBA');

INSERT INTO seguros (nroPoliza, compania, polizaCombinada, importe) VALUES
('POL-AR-1001', 'Río Seguros', 'si', 150000.00),
('POL-US-2001', 'Vault Insurance', 'no', 3000.00);

INSERT INTO subastas (identificador, fecha, hora, estado, subastador, ubicacion, capacidadAsistentes, tieneDeposito, seguridadPropia, categoria) VALUES
(1, DATE_ADD(CURDATE(), INTERVAL 20 DAY), '09:45:00', 'abierta', 2, 'Bóveda Norte, CABA', 120, 'si', 'si', 'plata'),
(2, DATE_ADD(CURDATE(), INTERVAL 43 DAY), '11:15:00', 'abierta', 2, 'Centro Automotor San Isidro', 80, 'si', 'si', 'platino'),
(3, DATE_ADD(CURDATE(), INTERVAL 35 DAY), '13:30:00', 'abierta', 2, 'Sala Auditorio Sur', 160, 'no', 'si', 'comun'),
(4, DATE_ADD(CURDATE(), INTERVAL 52 DAY), '16:00:00', 'abierta', 2, 'Salón Central', 100, 'si', 'si', 'oro');

INSERT INTO productos (identificador, fecha, disponible, descripcionCatalogo, descripcionCompleta, revisor, duenio, seguro) VALUES
(1, CURDATE(), 'si', 'Reloj de lujo acero y oro con documentación original.', 'https://bidvault.local/docs/reloj-lujo.pdf', 1, 4, 'POL-AR-1001'),
(2, CURDATE(), 'si', 'Obra de arte europea de fines del siglo XIX.', 'https://bidvault.local/docs/obra-europea.pdf', 1, 4, 'POL-AR-1001'),
(3, CURDATE(), 'si', 'Lote de instrumentos musicales de cuerda, viento y percusión.', 'https://bidvault.local/docs/instrumentos.pdf', 1, 5, 'POL-US-2001'),
(4, CURDATE(), 'si', 'Automóvil de colección en excelente estado.', 'https://bidvault.local/docs/automotor.pdf', 1, 5, 'POL-US-2001'),
(5, CURDATE(), 'si', 'Colección de anillos, relojes, pendientes y collares.', 'https://bidvault.local/docs/joyeria-ruiz.pdf', 1, 4, 'POL-AR-1001');

INSERT INTO catalogos (identificador, descripcion, subasta, responsable) VALUES
(1, 'Obras de arte', 1, 1),
(2, 'Automotores', 2, 1),
(3, 'Instrumentos musicales', 3, 1),
(4, 'Joyería Ruiz', 4, 1);

INSERT INTO itemsCatalogo (identificador, catalogo, producto, precioBase, comision, subastado) VALUES
(1, 1, 1, 90000.00, 0.12, 'no'),
(2, 1, 2, 120000.00, 0.15, 'no'),
(3, 3, 3, 50500.00, 0.10, 'no'),
(4, 2, 4, 20000.00, 0.18, 'no'),
(5, 4, 5, 5300.00, 0.14, 'no');

INSERT INTO asistentes (identificador, numeroPostor, cliente, subasta) VALUES
(1, 103, 3, 1),
(2, 104, 3, 3);

INSERT INTO pujos (identificador, asistente, item, importe, ganador) VALUES
(1, 1, 1, 90000.00, 'no'),
(2, 1, 1, 91500.00, 'si'),
(3, 2, 3, 50500.00, 'si');

INSERT INTO usuarios_app (persona, email, password_hash, password_temporal, rol) VALUES
(3, 'demo@bidvault.com', '$2a$10$6EsIyLYIcddozxHD93lYRe9q8/EgdpLrz0inGlOcwq1s.SAYZHuF.', 'no', 'cliente'),
(6, 'pendiente@bidvault.com', '$2a$10$6EsIyLYIcddozxHD93lYRe9q8/EgdpLrz0inGlOcwq1s.SAYZHuF.', 'si', 'cliente');

INSERT INTO medios_pago (cliente, tipo, moneda, entidad, referencia, monto_reservado, verificado, activo) VALUES
(3, 'tarjeta', 'ARS', 'Banco Nación', '**** 2044', NULL, 'si', 'si'),
(3, 'cuenta', 'USD', 'HSBC International', 'CBU EXT 8831', 50000.00, 'si', 'si'),
(6, 'cheque', 'ARS', 'Banco Provincia', 'CHQ-0001', 100000.00, 'no', 'si');

INSERT INTO favoritos (cliente, subasta) VALUES
(3, 1),
(3, 4);

INSERT INTO solicitudes_productos (duenio, titulo, descripcion, historia, origen_licito, declaracion_propiedad, acepta_devolucion_cargo, estado, deposito, seguro) VALUES
(3, 'Mueblería antigua', 'Juego de comedor restaurado con seis sillas.', 'Perteneció a una casa familiar de San Telmo.', 'si', 'si', 'si', 'en_revision', 'Depósito Palermo', 'POL-AR-1001');

INSERT INTO solicitudes_fotos (solicitud, url) VALUES
(1, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc'),
(1, 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4'),
(1, 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c'),
(1, 'https://images.unsplash.com/photo-1517705008128-361805f42e86'),
(1, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85'),
(1, 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e');

INSERT INTO mensajes (cliente, titulo, cuerpo, tipo) VALUES
(3, 'Subasta en vivo', 'La subasta "Joyería Ruiz" de tu lista de favoritos acaba de empezar.', 'importante'),
(3, 'Ganaste la subasta', 'Has ganado la puja de la pieza #55 de la subasta "Joyería Ruiz". Coordiná el envío.', 'importante'),
(3, 'Producto en camino', 'Tu mueblería antigua ya fue despachada. Podés hacer el seguimiento del envío.', 'otra');
