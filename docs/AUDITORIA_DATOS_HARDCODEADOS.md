# Auditoria de datos hardcodeados

Objetivo: verificar que la app no dependa de datos de negocio escritos directo en el front.

## Resultado

No se encontraron subastas, productos, usuarios, precios, imagenes de portada ni metricas hardcodeadas en `mobile/App.tsx` ni en `mobile/src`.

Los datos que ve el usuario salen de endpoints del backend:

| Pantalla | Endpoint / origen |
|---|---|
| Home / subastas | `GET /api/auctions` |
| Detalle de subasta | `GET /api/auctions/{id}` |
| Productos de catalogo | `itemsCatalogo`, `productos`, `fotos` |
| Favoritos | `favoritos` |
| Mis piezas | `solicitudes_productos`, `solicitudes_fotos`, `solicitudes_propuestas_empresa` |
| Perfil | `personas`, `clientes`, `usuarios_app` |
| Metricas | `asistentes`, `pujos`, `registroDeSubasta`, `facturas_compra` |
| Metodos de pago | `medios_pago` |
| Envios y facturas | `envios`, `facturas_compra` |

## Que cosas si son constantes de UI

Estas constantes no son datos de negocio:

- Categorias posibles: `COMUN`, `ESPECIAL`, `PLATA`, `ORO`, `PLATINO`.
- Estados visuales: `EN_VIVO`, `PROGRAMADA`, `FINALIZADA`.
- Textos de botones, titulos y mensajes.
- Valores iniciales vacios de formularios.
- Fallbacks como `Sin dato`, `Factura pendiente` o `Compra ganada`.

## Datos demo

Los datos como `demo@bidvault.com`, `Joyería Ruiz` o productos iniciales estan en:

- `database/02_seed.sql`
- `backend/src/main/resources/db/migration/V2__seed.sql`
- otras migraciones de demo en `backend/src/main/resources/db/migration`

Eso no es hardcode de front. Son datos iniciales para poder probar o presentar la aplicacion. Si se cambian en la BD, la app muestra los nuevos datos.

## Criterio para futuras correcciones

Si se necesita agregar una subasta, producto, portada, factura, usuario o precio, debe hacerse en la BD o con un endpoint. No se debe escribir directamente en componentes React Native.
