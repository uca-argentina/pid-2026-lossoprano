# BulkMarket API

API de BulkMarket para autenticación JWT y administración del negocio asociado a cada cuenta.

## Inicio

1. Crea `.env` y definí `JWT_SECRET`.
2. Iniciá PostgreSQL con `docker compose up -d`.
3. Ejecutá `npm install` y `npm run start:dev`.

La API queda disponible en `http://localhost:3000/api`.

En desarrollo, TypeORM agrega automáticamente la columna `producto.version` y la tabla `carrito_item` al iniciar la API. Para una base de producción, aplicar `migrations/001-product-version.sql` y `migrations/002-cart.sql`, en ese orden, antes de desplegar esta versión.

Los vendedores pueden editar sus productos con `PATCH /productos/:id` (multipart, mismos campos que al crear; imágenes opcionales que reemplazan todas las actuales) y eliminarlos con `DELETE /productos/:id`. Cada actualización incrementa la versión del producto y elimina sus entradas de todos los carritos en la misma transacción. El borrado elimina esas entradas mediante claves foráneas con `ON DELETE CASCADE`.

Los carritos se guardan en PostgreSQL por cuenta. `GET /carrito` obtiene el carrito autenticado y `PUT /carrito` recibe `{ items: [{ idProducto, version, cantidad }] }` para reemplazarlo; una lista vacía lo vacía. La API determina dueño, vendedor, precio y stock, y rechaza productos propios y mezclas de vendedores. Los productos eliminados o con versiones antiguas no se restauran. El frontend consulta al iniciar, al recuperar el foco y cada 10 segundos para reflejar cambios de otras sesiones. Al primer acceso importa el carrito local con `importar: true` solamente si no hay entradas guardadas en el servidor; tras el éxito retira la copia local. Si hay un error, conserva esa copia para reintentar.

Verificación: `npm run test:products` y `npm run test:cart:integration` (requiere PostgreSQL del compose, o `TEST_DATABASE_URL`). La prueba de integración usa tablas temporales dentro de una transacción que revierte; no modifica datos existentes.

Mínimos mayoristas: `montoMinimoOrden` se configura con `PATCH /negocios/mi-negocio` solo para vendedores; 0 indica sin mínimo. `cantidadMinimaCompra` es opcional en los productos (vacío/null permite comprar desde 1 unidad). El carrito devuelve `subtotal`, `montoMinimoOrden`, `faltanteMinimo` y `cumpleMinimos`. Puede guardarse por debajo del monto requerido para armarlo progresivamente, pero la API rechaza cantidades por debajo del mínimo del producto. Cambiar el monto no vacía carritos; editar un producto sí lo retira. Para producción aplicar también `migrations/003-order-minimums.sql`; en desarrollo basta reiniciar la API para sincronizar las nuevas columnas.

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/auth/registro` | Registra cliente y negocio. Roles: `COMPRADOR`, `VENDEDOR`. |
| POST | `/auth/iniciar-sesion` | Inicia sesión y entrega token JWT. |
| GET | `/negocios/mi-negocio` | Lee el negocio autenticado. |
| PATCH | `/negocios/mi-negocio` | Actualiza el negocio autenticado. |
| DELETE | `/negocios/mi-negocio` | Elimina negocio y clientes asociados. |
