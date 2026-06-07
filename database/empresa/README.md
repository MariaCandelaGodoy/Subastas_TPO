# Operaciones de empresa para la demo

Estos scripts se ejecutan manualmente desde MySQL Workbench sobre la base `bidvault`.

Orden sugerido:

1. `00_ver_solicitudes_productos.sql`
   - Lista las solicitudes cargadas por usuarios.
   - Usalo para elegir el `solicitud_id`.

2. `01_aceptar_solicitud_producto.sql`
   - Cambiar `@solicitud_id`, `@seguro` y `@deposito`.
   - Marca la solicitud como `aceptado`.
   - Crea el producto relacionado.
   - Copia las fotos cargadas por el usuario a `fotos`.
   - Inserta una notificación para el usuario.

3. `02_programar_producto_aceptado_en_subasta.sql`
   - Cambiar `@solicitud_id`, fecha, hora, categoría, precio base y comisión.
   - Crea la subasta, catálogo e item de catálogo.
   - Guarda la relación en `solicitudes_productos_revision`.
   - Inserta una notificación para el usuario.

4. `03_rechazar_solicitud_producto.sql`
   - Cambiar `@solicitud_id` y `@motivo_rechazo`.
   - Marca la solicitud como `rechazado`.
   - El usuario ve el motivo en `Mis piezas`.
   - Inserta una notificación.

5. `04_marcar_devolucion_con_cargo.sql`
   - Se usa después de rechazar.
   - Cambiar `@solicitud_id`, costo y dirección.
   - Marca la solicitud como `devuelto`.
   - Deja asentado el cargo en `motivo_rechazo`.

Para la presentación:

- Decir que la empresa opera desde su sistema interno/Workbench.
- La app móvil del usuario no administra inspecciones internas, solo refleja estados, motivos, depósito, seguro y notificaciones desde la BD.
