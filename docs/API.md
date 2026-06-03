# API Rest

La documentación interactiva está en Swagger: `http://localhost:8080/swagger-ui.html`.

## Códigos de respuesta

- `200`: operación correcta.
- `400`: campos obligatorios, importes inválidos o reglas de puja incumplidas.
- `401`: credenciales incorrectas.
- `403`: cliente no admitido, categoría insuficiente o medio de pago no verificado.
- `404`: recurso inexistente.
- `409`: registro duplicado.
- `500`: error interno o problema de conexión con MySQL.

## Circuito completo recomendado

1. `POST /api/auth/login` con `demo@bidvault.com` y `demo123`.
2. `GET /api/auctions?clienteId=3`.
3. `GET /api/auctions/1?clienteId=3`.
4. `POST /api/auctions/1/join` con `{ "cliente_id": 3 }`.
5. `POST /api/bids` con `{ "cliente_id": 3, "item_id": 1, "importe": 92500 }`.
6. `GET /api/profile/3/metrics` para verificar impacto.

La puja se registra en `pujos`; el ganador anterior queda con `ganador='no'` y la nueva puja queda con `ganador='si'`.
