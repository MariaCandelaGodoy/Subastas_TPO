INSERT INTO productos (identificador, fecha, disponible, descripcionCatalogo, descripcionCompleta, revisor, duenio, seguro)
SELECT 6, CURDATE(), 'no',
       'Plato de porcelana rococó con dorado',
       'Plato confeccionado en porcelana fina con detalles pintados a mano y terminaciones en dorado, elaborado entre 1930 y 1960, inspirado en el estilo rococó europeo y destacado por su diseño ornamental y artístico.',
       1, 4, 'POL-AR-1001'
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE identificador=6);

INSERT INTO itemsCatalogo (identificador, catalogo, producto, precioBase, comision, subastado)
SELECT 6, 1, 6, 78000.00, 0.12, 'si'
WHERE NOT EXISTS (SELECT 1 FROM itemsCatalogo WHERE identificador=6);

INSERT INTO pujos (identificador, asistente, item, importe, ganador)
SELECT 6, 1, 6, 84500.00, 'si'
WHERE NOT EXISTS (SELECT 1 FROM pujos WHERE identificador=6);

INSERT INTO registroDeSubasta (subasta, duenio, producto, cliente, importe, comision)
SELECT 1, 4, 6, 3, 84500.00, 10140.00
WHERE NOT EXISTS (SELECT 1 FROM registroDeSubasta WHERE producto=6 AND cliente=3);

INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
SELECT 3, 'Ganaste la subasta', 'Ganaste el Plato de porcelana rococó con dorado. Elegí una dirección de envío para continuar con la factura y el pago.', 'importante'
WHERE NOT EXISTS (
  SELECT 1 FROM mensajes
  WHERE cliente=3 AND titulo='Ganaste la subasta' AND cuerpo LIKE '%Plato de porcelana%'
);
