USE bidvault;

-- PROGRAMAR PARA SUBASTA
-- Primero ejecutar 01_aceptar_solicitud_producto.sql y aceptar la propuesta desde la app.
-- Cambiar estos valores antes de ejecutar.
SET @solicitud_id = 3;
SET @fecha_subasta = '2026-07-30';
SET @hora_subasta = '18:00:00';
SET @categoria = 'plata';
SET @ubicacion = 'Galeria Central';
SET @subastador_id = 2;
SET @responsable_catalogo = 1;
SET @precio_base = 120000.00;
SET @comision = 12.00;

START TRANSACTION;

SET @producto_id = (
  SELECT producto
  FROM solicitudes_productos_revision
  WHERE solicitud = @solicitud_id
  LIMIT 1
);

SET @subasta_id = (
  SELECT subasta
  FROM solicitudes_productos_revision
  WHERE solicitud = @solicitud_id
  LIMIT 1
);

INSERT INTO subastas (fecha, hora, estado, subastador, ubicacion, capacidadAsistentes, tieneDeposito, seguridadPropia, categoria)
SELECT @fecha_subasta, @hora_subasta, 'abierta', @subastador_id, @ubicacion, 100, 'si', 'si', @categoria
WHERE @producto_id IS NOT NULL
  AND @subasta_id IS NULL;

SET @subasta_insertada = ROW_COUNT();
SET @subasta_id = IF(@subasta_id IS NULL AND @subasta_insertada = 1, LAST_INSERT_ID(), @subasta_id);

SET @catalogo_id = (
  SELECT catalogo
  FROM solicitudes_productos_revision
  WHERE solicitud = @solicitud_id
  LIMIT 1
);

INSERT INTO catalogos (descripcion, subasta, responsable)
SELECT CONCAT('Coleccion ', pe.nombre), @subasta_id, @responsable_catalogo
FROM solicitudes_productos sp
JOIN personas pe ON pe.identificador = sp.duenio
WHERE sp.identificador = @solicitud_id
  AND @producto_id IS NOT NULL
  AND @catalogo_id IS NULL
  AND EXISTS (SELECT 1 FROM subastas s WHERE s.identificador = @subasta_id);

SET @catalogo_insertado = ROW_COUNT();
SET @catalogo_id = IF(@catalogo_id IS NULL AND @catalogo_insertado = 1, LAST_INSERT_ID(), @catalogo_id);

SET @item_id = (
  SELECT item
  FROM solicitudes_productos_revision
  WHERE solicitud = @solicitud_id
  LIMIT 1
);

INSERT INTO itemsCatalogo (catalogo, producto, precioBase, comision, subastado)
SELECT @catalogo_id, @producto_id, @precio_base, @comision, 'no'
WHERE @producto_id IS NOT NULL
  AND @catalogo_id IS NOT NULL
  AND @item_id IS NULL
  AND EXISTS (SELECT 1 FROM catalogos c WHERE c.identificador = @catalogo_id);

SET @item_insertado = ROW_COUNT();
SET @item_id = IF(@item_id IS NULL AND @item_insertado = 1, LAST_INSERT_ID(), @item_id);

UPDATE solicitudes_productos_revision
SET subasta = COALESCE(subasta, @subasta_id),
    catalogo = COALESCE(catalogo, @catalogo_id),
    item = COALESCE(item, @item_id),
    precio_base = @precio_base,
    comision = @comision,
    estado = 'programado',
    observacion = 'Producto incluido en subasta futura'
WHERE solicitud = @solicitud_id
  AND @producto_id IS NOT NULL
  AND @subasta_id IS NOT NULL
  AND @catalogo_id IS NOT NULL
  AND @item_id IS NOT NULL;

UPDATE solicitudes_productos
SET estado = 'aceptado'
WHERE identificador = @solicitud_id
  AND @producto_id IS NOT NULL
  AND @subasta_id IS NOT NULL
  AND @catalogo_id IS NOT NULL
  AND @item_id IS NOT NULL;

INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
SELECT sp.duenio,
       'Producto programado en subasta',
       CONCAT('Tu pieza "', sp.titulo, '" fue programada para el ', DATE_FORMAT(@fecha_subasta, '%d/%m/%Y'), ' a las ', TIME_FORMAT(@hora_subasta, '%H:%i'), '. Precio base: ', @precio_base, '. Comision: ', @comision),
       'importante'
FROM solicitudes_productos sp
WHERE sp.identificador = @solicitud_id
  AND @producto_id IS NOT NULL
  AND @subasta_id IS NOT NULL
  AND @catalogo_id IS NOT NULL
  AND @item_id IS NOT NULL;

COMMIT;

SELECT
  spr.solicitud,
  spr.producto,
  spr.subasta,
  spr.catalogo,
  spr.item,
  spr.precio_base,
  spr.comision,
  spr.estado
FROM solicitudes_productos_revision spr
WHERE spr.solicitud = @solicitud_id;
