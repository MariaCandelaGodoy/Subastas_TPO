# BidVault - Guia funcional y base de datos

Este documento resume como funciona la aplicacion, que estados maneja y que tablas intervienen. Sirve para explicar el proyecto sin depender de memoria ni de queries sueltas.

## Flujo de usuario

1. Registro
   - El usuario carga datos personales y fotos del DNI.
   - Se crea una fila en `personas`, `clientes`, `duenios`, `usuarios_app` y `documentos_verificacion`.
   - La cuenta queda con `clientes.admitido = 'no'`.
   - No se envia clave temporal hasta que la empresa valide la cuenta.

2. Validacion de cuenta
   - La empresa valida desde MySQL Workbench con `database/empresa/06_validar_usuario_registrado.sql`.
   - La query cambia `clientes.admitido` a `si`.
   - Luego el usuario usa "Olvide mi contraseña" y el backend envia una clave temporal.

3. Primer inicio de sesion
   - El usuario entra con la clave temporal.
   - Si `usuarios_app.password_temporal = 'si'`, la app lo manda a cambiar la contraseña.

4. Subastas
   - Invitado: puede navegar, pero no ve importes de objetos; solo moneda.
   - Cliente validado: puede ver precios, favoritos y entrar si cumple categoria y tiene medio de pago verificado.
   - `sesiones_subasta` impide que el usuario participe en mas de una subasta activa a la vez.

5. Subida de productos
   - El usuario carga un objeto con descripcion y al menos 6 fotos.
   - Se guarda en `solicitudes_productos` y `solicitudes_fotos`.
   - La empresa revisa con scripts de `database/empresa`.
   - Cuando la empresa recibe el bien, asigna deposito y seguro.
   - El dueño puede ver desde `Mis piezas` la ubicacion en deposito y la poliza asociada.

6. Compra ganada, envio y factura
   - La subasta ganada queda en `registroDeSubasta`.
   - El envio se guarda en `envios`.
   - La factura se guarda en `facturas_compra`.
   - El pago final queda asociado al `medio_pago` elegido.
   - Si la subasta esta en USD, la factura solo puede pagarse en USD con transferencia/cuenta o tarjeta internacional.

## Estados principales

### `clientes.admitido`

| Estado | Significado | Efecto en app |
|---|---|---|
| `no` | Cuenta registrada pero no validada por empresa | No puede iniciar sesion normalmente ni recibir clave temporal |
| `si` | Cuenta validada | Puede recuperar clave temporal, iniciar sesion y operar |

### `usuarios_app.password_temporal`

| Estado | Significado | Efecto en app |
|---|---|---|
| `si` | El usuario esta usando clave temporal | Se redirige a cambiar contraseña |
| `no` | Contraseña definitiva | Entra normalmente |

### `solicitudes_productos.estado`

| Estado | Quien lo cambia | Significado | Solapa en app |
|---|---|---|---|
| `pendiente` | Usuario al subir objeto | La empresa todavia no reviso la pieza | En revision |
| `en_revision` | Empresa | La empresa envio una propuesta o esta evaluando la pieza | En revision |
| `aceptado` | Usuario al aceptar propuesta | La pieza puede avanzar a subasta | Activas |
| `rechazado` | Empresa | La pieza no fue aceptada; se muestra motivo | En revision |
| `devuelto` | Empresa o rechazo del usuario | Hay devolucion; si el usuario rechazo propuesta, se muestra cargo de devolucion | Activas si hay cargo, En revision si es devolucion interna |

### `solicitudes_propuestas_empresa.estado`

| Estado | Significado |
|---|---|
| `pendiente_usuario` | La empresa envio precio, comision, fecha tentativa y poliza. El usuario debe aceptar o rechazar |
| `aceptada` | El usuario acepto la propuesta |
| `rechazada` | El usuario rechazo la propuesta |

### `subastas.estado` y `subastas_estados_app.estado_app`

| Estado | Significado |
|---|---|
| `abierta` | Subasta existente en el modelo original |
| `programada` | Se muestra como futura en app |
| `carrada` | Cerrada/finalizada segun el modelo original |

La app considera "En vivo" solo a las subastas abiertas cuya fecha es el dia actual.

### `medios_pago.verificado`

| Estado | Significado | Efecto en app |
|---|---|---|
| `no` | Pendiente de verificacion | No sirve para entrar a subastas ni pagar facturas |
| `si` | Verificado por empresa | Puede usarse como garantia o pago |

### `envios.estado`

| Estado | Significado |
|---|---|
| `pendiente` | Envio creado, todavia sin despacho |
| `despachado` | Tiene seguimiento y esta en camino |
| `entregado` | Compra entregada |
| `retiro_personal` | El comprador retira personalmente |

### `facturas_compra.estado`

| Estado | Significado |
|---|---|
| `pendiente_pago` | Factura generada, falta seleccionar medio y pagar |
| `pagada` | Pago registrado |

## Tablas del modelo original mas usadas

| Tabla | Funcion |
|---|---|
| `personas` | Datos base de personas, empresas, duenios, empleados y usuarios |
| `clientes` | Categoria, pais y estado de admision del usuario |
| `duenios` | Datos del propietario que puede subir o vender piezas |
| `empleados` / `sectores` | Personal interno que revisa o administra catalogos |
| `subastadores` | Rematadores asociados a subastas |
| `seguros` | Polizas usadas por productos o propuestas |
| `subastas` | Fecha, hora, estado, categoria, ubicacion y subastador |
| `productos` | Piezas aceptadas para catalogo o subasta |
| `fotos` | Imagenes reales de productos aceptados |
| `catalogos` | Agrupa productos dentro de una subasta |
| `itemsCatalogo` | Producto subastable con precio base y comision |
| `asistentes` | Clientes registrados en una subasta |
| `pujos` | Ofertas hechas por asistentes |
| `registroDeSubasta` | Resultado de compras/subastas ganadas |

## Tablas agregadas para la app

| Tabla | Por que se agrego | Funcion |
|---|---|---|
| `usuarios_app` | El modelo original no tenia login mobile | Email, password hash, rol y clave temporal |
| `documentos_verificacion` | El registro pide fotos de DNI | Guarda frente/dorso y estado de verificacion |
| `subastas_portadas` | `subastas` no tenia imagen de portada | Guarda portada en BD |
| `subastas_estados_app` | Permite estado visual sin romper la tabla original | Marca programada/en vivo/cerrada para app |
| `medios_pago` | La app necesita tarjetas, cuentas y cheques | Guarda medios con estado de verificacion |
| `sesiones_subasta` | Regla: un usuario no puede estar en dos subastas a la vez | Controla sesiones activas |
| `garantias_subasta` | Entrar a subasta requiere medio verificado | Guarda constancia de capacidad de pago |
| `favoritos` | La app permite marcar subastas favoritas | Relacion cliente-subasta |
| `solicitudes_productos` | El usuario puede proponer piezas | Formulario de nuevo objeto y estado |
| `solicitudes_fotos` | Fotos antes de que la pieza sea producto aceptado | Guarda imagenes cargadas por usuario |
| `solicitudes_propuestas_empresa` | La empresa envia propuesta al usuario | Precio base, comision, fecha, seguro y estado |
| `envios` | Flujo posterior a ganar subasta | Direccion, seguimiento y estado |
| `facturas_compra` | Compra ganada necesita factura | Totales, comision, envio, medio y estado de pago |

## Datos demo vs hardcodeo

Los nombres como "Joyeria Ruiz", "Automotores" o el usuario `demo@bidvault.com` no estan hardcodeados en pantallas. Estan en scripts de seed/migracion para poder mostrar la app con datos de prueba.

La diferencia es:

- Hardcode en front: dato escrito directo en `App.tsx` o componentes. Esto se debe evitar.
- Seed en BD: dato inicial de prueba. Es valido para demo y se puede cambiar desde MySQL.

## Tablas que pueden verse vacias

Algunas tablas pueden quedar vacias hasta que se use un flujo:

| Tabla | Por que puede estar vacia |
|---|---|
| `fotos` | Solo se llena cuando una solicitud aceptada pasa a producto |
| `sesiones_subasta` | Se llena al entrar a una sala de puja |
| `garantias_subasta` | Se llena cuando un usuario deja medio de garantia |
| `envios` | Se llena cuando una compra ganada coordina direccion |
| `facturas_compra` | Se llena cuando se genera factura de compra |
| `solicitudes_propuestas_empresa` | Se llena cuando la empresa envia propuesta sobre una pieza |

## Scripts de empresa

Los scripts de `database/empresa` reemplazan un panel administrativo. Para explicar en la presentacion:

- La app mobile es para clientes.
- La empresa opera validaciones, inspecciones y programacion desde Workbench.
- Cada script modifica la BD y la app refleja esos cambios.

## Moneda de subastas

La moneda de una subasta no depende de la categoria. Se lee desde `subastas_config.moneda`.

Si una subasta no tiene configuracion, el backend la toma como `ARS` por defecto. Para marcar una subasta como dolarizada se actualiza solo esa fila a `USD`.

## Subastas en tiempo real

Las salas de puja usan WebSocket nativo de Spring Boot.

- El front se conecta a `/ws/auctions/{subastaId}` al entrar a la sala.
- La puja se guarda siempre primero en MySQL, en `pujos`.
- Despues de guardar, el backend publica el evento `NUEVA_PUJA` a todos los usuarios conectados a esa subasta.
- Cuando el front recibe el evento, vuelve a pedir el detalle de la subasta y actualiza la ultima oferta, el minimo y el maximo permitido.

Esto evita hardcodear valores en pantalla: la BD sigue siendo la verdad, y el WebSocket solo sirve para avisar cambios en vivo sin tener que refrescar manualmente.
