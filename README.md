# BidVault

Trabajo práctico de subastas con backend Spring Boot, frontend React Native + Expo y base MySQL.

## Base de datos

1. Abrir MySQL Workbench.
2. Crear la base `bidvault` si todavía no existe.
3. Conectarse con usuario `root` y clave `5090`.
4. Levantar el backend. Flyway ejecuta automáticamente las migraciones de `backend/src/main/resources/db/migration`.

También se pueden ejecutar manualmente, en orden:

- `database/01_schema_mysql.sql`
- `database/02_seed.sql`

Las tablas originales de `EstructuraActual.sql` se mantienen con sus nombres y columnas. Las necesidades de la app que no existían en esa estructura se resolvieron con tablas nuevas: `usuarios_app`, `medios_pago`, `favoritos`, `sesiones_subasta`, `solicitudes_productos`, `solicitudes_fotos`, `mensajes` y `envios`.

## Backend

```powershell
cd backend
mvn spring-boot:run
```

Al iniciar, el backend crea/actualiza la estructura y carga datos demo si la migración todavía no fue aplicada.

Swagger queda disponible en:

```text
http://localhost:8080/swagger-ui.html
```

Usuario demo:

```text
email: demo@bidvault.com
password: demo123
```

Endpoints principales:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auctions`
- `GET /api/auctions/{id}`
- `POST /api/auctions/{id}/join`
- `POST /api/bids`
- `POST /api/auctions/{id}/close-item/{itemId}`
- `GET /api/payments/{clienteId}`
- `POST /api/payments`
- `POST /api/favorites`
- `DELETE /api/favorites`
- `POST /api/sell-requests`
- `GET /api/profile/{clienteId}/metrics`
- `GET /api/notifications/{clienteId}`

## Frontend Expo

```powershell
cd mobile
npm install
npm run start
```

Si se prueba desde un celular físico, configurar la URL del backend con la IP de la PC:

```powershell
$env:EXPO_PUBLIC_API_URL="http://TU_IP_LOCAL:8080/api"
npm run start
```

## Funcionalidad integrada

- Registro de postor con estado pendiente y mensaje privado.
- Login contra MySQL con BCrypt.
- Listado, búsqueda, favoritas y detalle de subastas.
- Validación de categoría para participar.
- Validación de medio de pago verificado para pujar.
- Puja transaccional con bloqueo del ítem y reglas de incremento mínimo/máximo.
- Cierre de ítem con alta en `registroDeSubasta`, actualización de producto/item y notificación.
- Alta de medios de pago.
- Solicitud de venta de un bien con al menos 6 fotos.
- Métricas de perfil e historial de pujas.
- Notificaciones importantes y otras.
