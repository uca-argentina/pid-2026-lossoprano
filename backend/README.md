# BulkMarket API

API de BulkMarket para autenticación JWT y administración del negocio asociado a cada cuenta.

## Inicio

1. Crea `.env` y definí `JWT_SECRET`.
2. Iniciá PostgreSQL con `docker compose up -d`.
3. Ejecutá `npm install` y `npm run start:dev`.

La API queda disponible en `http://localhost:3000/api`.

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/auth/registro` | Registra cliente y negocio. Roles: `COMPRADOR`, `VENDEDOR`. |
| POST | `/auth/iniciar-sesion` | Inicia sesión y entrega token JWT. |
| GET | `/negocios/mi-negocio` | Lee el negocio autenticado. |
| PATCH | `/negocios/mi-negocio` | Actualiza el negocio autenticado. |
| DELETE | `/negocios/mi-negocio` | Elimina negocio y clientes asociados. |
