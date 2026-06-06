CREATE TABLE IF NOT EXISTS productos_imagenes_app (
  identificador INT NOT NULL AUTO_INCREMENT,
  producto INT NOT NULL,
  url LONGTEXT NOT NULL,
  orden INT NOT NULL DEFAULT 1,
  CONSTRAINT pk_productos_imagenes_app PRIMARY KEY (identificador),
  CONSTRAINT fk_productos_imagenes_app_productos FOREIGN KEY (producto) REFERENCES productos(identificador)
);

UPDATE productos
SET descripcionCatalogo='Anillo Oval Cut',
    descripcionCompleta='Anillo confeccionado en platino con diamante central talla oval y halo de diamantes, elaborado entre 2010 y 2020, destacando por su diseño sofisticado y brillo excepcional de alta joyería.'
WHERE identificador=5;

INSERT INTO productos (identificador, fecha, disponible, descripcionCatalogo, descripcionCompleta, revisor, duenio, seguro)
SELECT 7, CURDATE(), 'si', 'Collar de Esmeraldas',
       'Collar confeccionado en oro blanco con esmeraldas ovales y halo de diamantes, pieza destacada por su equilibrio ornamental y terminación de alta joyería.',
       1, 4, 'POL-AR-1001'
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE identificador=7);

INSERT INTO itemsCatalogo (identificador, catalogo, producto, precioBase, comision, subastado)
SELECT 7, 4, 7, 6500.00, 0.14, 'no'
WHERE NOT EXISTS (SELECT 1 FROM itemsCatalogo WHERE identificador=7);

DELETE FROM productos_imagenes_app WHERE producto IN (5, 7);

INSERT INTO productos_imagenes_app (producto, url, orden) VALUES
(5, 'Anillo-1.png', 1),
(5, 'Anillo-2.png', 2),
(5, 'Anillo-3.png', 3),
(7, 'Collar-1.png', 1),
(7, 'Collar-2.png', 2),
(7, 'Collar-3.png', 3);
