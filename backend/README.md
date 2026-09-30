# BulkMarket API

API de BulkMarket para autenticación JWT y administración del negocio asociado a cada cuenta.

## Inicio

1. Crea `.env` y definí `JWT_SECRET`.
2. Iniciá PostgreSQL con `docker compose up -d`.
3. Ejecutá `npm install` y `npm run start:dev`.

La API queda disponible en `http://localhost:3000/api`.

En desarrollo, TypeORM agrega automáticamente la columna `producto.version` al iniciar la API. Para una base de producción, aplicar `migrations/001-product-version.sql` antes de desplegar esta versión.

Los vendedores pueden editar sus productos con `PATCH /productos/:id` (multipart, mismos campos que al crear; imágenes opcionales que reemplazan todas las actuales) y eliminarlos con `DELETE /productos/:id`. Cada actualización incrementa la versión del producto. `POST /productos/carrito/validar` recibe `{ items: [{ idProducto, version }] }` y devuelve los IDs que siguen vigentes. El frontend valida los carritos locales al cargarlos, al recuperar el foco y cada 10 segundos; si no hay conexión, reintenta cuando la API vuelve a estar disponible. Los carritos antiguos sin versión se descartan.

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/auth/registro` | Registra cliente y negocio. Roles: `COMPRADOR`, `VENDEDOR`. |
| POST | `/auth/iniciar-sesion` | Inicia sesión y entrega token JWT. |
| GET | `/negocios/mi-negocio` | Lee el negocio autenticado. |
| PATCH | `/negocios/mi-negocio` | Actualiza el negocio autenticado. |
| DELETE | `/negocios/mi-negocio` | Elimina negocio y clientes asociados. |
