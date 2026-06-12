# Operaciones de empresa

Estos scripts se ejecutan manualmente desde MySQL Workbench sobre la base `bidvault`.

La idea es simular el sistema interno de la empresa. La app mobile es para clientes; la empresa valida usuarios, revisa piezas y verifica medios de pago desde la base.

## Orden sugerido

1. `00_ver_solicitudes_productos.sql`
   - Lista las solicitudes cargadas por usuarios.
   - Sirve para elegir el `@solicitud_id`.

2. `01_aceptar_solicitud_producto.sql`
   - Cambiar `@solicitud_id`, fecha tentativa, precio base, comision, seguro y deposito.
   - Marca la solicitud como `en_revision`.
   - Crea, si hace falta, el producto relacionado.
   - Copia fotos desde `solicitudes_fotos` a `fotos`.
   - Crea o actualiza la propuesta en `solicitudes_propuestas_empresa`.
   - El usuario la ve en `Mis piezas` para aceptar o rechazar.

3. `02_programar_producto_aceptado_en_subasta.sql`
   - Usar solo despues de que el usuario acepte la propuesta.
   - Cambiar `@solicitud_id`, fecha, hora, categoria, precio base y comision.
   - Crea la subasta, catalogo e item de catalogo.
   - Guarda la relacion en `solicitudes_productos_revision`.

4. `03_rechazar_solicitud_producto.sql`
   - Cambiar `@solicitud_id` y `@motivo_rechazo`.
   - Marca la solicitud como `rechazado`.
   - El usuario ve el motivo en `Mis piezas`.

5. `04_marcar_devolucion_con_cargo.sql`
   - Se usa para dejar asentado un costo de devolucion.
   - Cambiar `@solicitud_id`, costo y direccion.
   - Marca la solicitud como `devuelto`.

6. `05_corregir_rechazo_usuario_a_devuelto.sql`
   - Corrige solicitudes antiguas donde el rechazo del usuario habia quedado como `en_revision`.
   - Las pasa a `devuelto` con cargo de devolucion.

7. `06_validar_usuario_registrado.sql`
   - Cambiar `@email`.
   - Pasa `clientes.admitido` a `si`.
   - Despues el usuario puede pedir clave temporal desde "Olvide mi contraseña".

8. `metodos_de_pago.sql`
   - Cambiar `@medio_pago_id` y `@estado`.
   - Permite verificar o dejar pendiente un medio de pago.

## Estados visibles en la app

- `pendiente`: el usuario recien subio el objeto.
- `en_revision`: la empresa esta revisando o envio propuesta.
- `aceptado`: el usuario acepto la propuesta.
- `rechazado`: la empresa rechazo la pieza.
- `devuelto`: existe devolucion; puede incluir cargo.

Para mas detalle ver `docs/GUIA_FUNCIONAL_BD.md`.
