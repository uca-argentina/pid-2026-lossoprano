# BulkMarket API

Para recorrer controladores, DTO, servicios, entidades y reglas comerciales, consultá la [guía de estudio](../GUIA_DE_ESTUDIO.md). Los archivos incluyen comentarios en español y el formato común se mantiene desde la raíz con `npm run format`.

API de BulkMarket para autenticación JWT y administración del negocio asociado a cada cuenta.

## Cuentas de prueba

Con la API corriendo (`npm run start:dev`), en otra terminal desde `backend/`:

```sh
npm run seed:demo
```

Crea estas cuentas, todas con la contraseña **`Demo1234`**:

| Email | Rol | Negocio |
| --- | --- | --- |
| `vendedor@bulkmarket.com` | Vendedor | Bodega Los Andes (3 productos, pedido mínimo $50.000) |
| `vendedor2@bulkmarket.com` | Vendedor | Distribuidora Norte (2 productos, sin mínimo) |
| `comprador@bulkmarket.com` | Comprador | Almacén La Esquina |

Se puede correr más de una vez sin duplicar datos. Los pasos completos para levantar el proyecto están en el [README de la raíz](../README.md).

## Sorteos simulados

Compradores y vendedores comparten un sorteo cada 14 días. Los períodos comienzan a las 00:00 de Argentina, anclados al lunes 5 de enero de 2026; no son quincenas calendario. La fecha de entrega de cada suborden determina el período. Cada centavo comprado o vendido suma el mismo peso, sin mínimo adicional. Un negocio que compra y vende acumula ambos importes. Solo participan los negocios registrados al realizar el sorteo; las operaciones históricas de negocios eliminados siguen financiando el fondo.

La configuración central está en `src/sweepstakes/sweepstakes.rules.ts`: comisión simulada de 15% y asignación de 2/15 de esa comisión al premio (equivalente a 2% de ventas antes del redondeo). El resto corresponde a la plataforma (13%). Una venta de $5.000 genera $750 de comisión, $100 de premio y $650 para la plataforma. Se redondea por suborden a centavos, primero comisión y luego aporte. Cada suborden financia una sola vez el premio, aunque ambas partes reciban peso. **No se cobran comisiones, no se alteran los importes del checkout ni se realizan pagos.**

`GET /sorteos` consulta el período actual y los últimos 12 resultados. `POST /sorteos/actualizar`, llamado al abrir o actualizar Sorteos, cierra los períodos vencidos con actividad y devuelve el resumen. Ambos requieren JWT y usan el negocio del token. No reciben importes, ganador, fechas ni probabilidades del cliente. En esta demo no hay un proceso programado: el cierre ocurre en la siguiente visita o actualización, usando las entregas del período correspondiente. No hay sorteos vacíos; un fondo redondeado a cero o sin participantes elegibles se registra sin ganador.

La selección ponderada usa aleatoriedad del servidor y aritmética entera. La tabla `sorteo` conserva participantes, reglas, fondo y ganador sin cascadas desde negocios. La clave primaria por inicio y un bloqueo transaccional evitan repetir el sorteo; las entregas comparten ese bloqueo para no quedar fuera del cierre. La API expone solo el monto y las chances del negocio autenticado, el número total de participantes y el nombre comercial del ganador.

**Probar el cierre completo sin esperar:** en desarrollo, `POST /sorteos/reloj` recibe `{ fecha: "2026-11-09T00:00:00-03:00" }` y adelanta el reloj compartido. Al atravesar un cierre, guarda el ganador en `sorteo`, lo muestra en historial y comienza un período con fondo y chances en cero. No fabrica pedidos ni participantes. La UI precarga el próximo cierre en el campo de fecha y hora de Argentina. Los períodos sin entregas no generan un ganador.

El reloj guarda un desfase respecto a la hora real en `sorteo_reloj`, sigue avanzando y sobrevive a recargas y reinicios. Las nuevas entregas usan ese mismo reloj, por lo que se asignan al período siguiente. Fecha, cierre y ganador se guardan en una única transacción con el mismo bloqueo de las entregas. Solo permite avanzar: no reabre períodos ni vuelve a sortear ganadores guardados. Se comparte entre todas las cuentas de esta base de desarrollo. `relojPrueba.habilitado` controla la UI; en producción o Vercel el endpoint responde 404 y siempre se usa la hora real. El antiguo endpoint de vista previa `simular-cierre` fue retirado.

La tabla del reloj corresponde a `migrations/008-sorteos-reloj.sql` (`npm run migrar:reloj-sorteos`), después de la 007. En desarrollo se crea al reiniciar la API.

En producción aplicar `npm run migrar:sorteos` después de las migraciones anteriores. En desarrollo TypeORM crea la tabla al reiniciar la API. `npm run test:sorteos` verifica las reglas sin base; `npm test` también incluye el cierre y la persistencia dentro de la integración con PostgreSQL y tablas temporales. No se aplicó la migración a una base compartida.

Para publicar frontend, API, base de datos e imágenes en la nube, seguí [la guía de despliegue](../DEPLOYMENT.md).

## Inicio

1. Desde `backend`, copiá `.env.example` a `.env` (`Copy-Item .env.example .env` en PowerShell). Definí `JWT_SECRET` y conservá `DATABASE_URL` si usás el PostgreSQL del compose; si usás otra base, ajustá sus credenciales.
2. Iniciá PostgreSQL con `docker compose up -d`.
3. Ejecutá `npm install` y `npm run start:dev`.

La API queda disponible en `http://localhost:3000/api`.

Cada integrante mantiene su propio `.env` (excluido de Git); `.env.example` y `docker-compose.yml` contienen la configuración compartida para desarrollo. Al actualizar una base que ya tiene productos con categorías de texto, ejecutá `npm run migrar:categorias` antes de iniciar el backend. No hace falta borrar la base ni sus productos. La columna `version` se crea con valor inicial 1 para los productos existentes.

En desarrollo, TypeORM agrega automáticamente la columna `producto.version` y la tabla `carrito_item` al iniciar la API. Para una base de producción, aplicar `migrations/001-product-version.sql` y `migrations/002-cart.sql`, en ese orden, antes de desplegar esta versión.

Los vendedores pueden editar sus productos con `PATCH /productos/:id` (multipart, mismos campos que al crear; imágenes opcionales que reemplazan todas las actuales) y eliminarlos con `DELETE /productos/:id`. Cada actualización incrementa la versión del producto y elimina sus entradas de todos los carritos en la misma transacción. El borrado elimina esas entradas mediante claves foráneas con `ON DELETE CASCADE`.

Los carritos se guardan en PostgreSQL por cuenta. `GET /carrito` obtiene el carrito autenticado y `PUT /carrito` recibe `{ items: [{ idProducto, version, cantidad }] }` para reemplazarlo; una lista vacía lo vacía. La API determina dueño, vendedor, precio y stock, y rechaza productos propios. Un carrito puede combinar productos de varios vendedores; la respuesta incluye `vendedores`, con el subtotal y los mínimos de cada uno. Los productos eliminados o con versiones antiguas no se restauran. El frontend consulta al iniciar, al recuperar el foco y cada 10 segundos para reflejar cambios de otras sesiones. Al primer acceso importa el carrito local con `importar: true` solamente si no hay entradas guardadas en el servidor; tras el éxito retira la copia local. Si hay un error, conserva esa copia para reintentar.

Verificación: `npm run lint` y `npm test` (requiere PostgreSQL del compose, o `TEST_DATABASE_URL`). La prueba de integración usa tablas temporales dentro de una transacción que revierte; no modifica datos existentes.

Mínimos mayoristas: `montoMinimoOrden` se configura con `PATCH /negocios/mi-negocio` solo para vendedores; 0 indica sin mínimo. `cantidadMinimaCompra` es opcional en los productos (vacío/null permite comprar desde 1 unidad). El carrito devuelve `subtotal`, `montoMinimoOrden`, `faltanteMinimo` y `cumpleMinimos`. Puede guardarse por debajo del monto requerido para armarlo progresivamente, pero la API rechaza cantidades por debajo del mínimo del producto. Cambiar el monto no vacía carritos; editar un producto sí lo retira. Para producción aplicar también `migrations/003-order-minimums.sql`; en desarrollo basta reiniciar la API para sincronizar las nuevas columnas.

Categorías y precios escalonados: cada producto tiene `idCategoria` (una general o una propia del vendedor) y, opcionalmente, `preciosEscalonados: [{ cantidadMinima, precioUnitario }]`, enviados como JSON en el formulario multipart. `GET/POST /categorias` y `DELETE /categorias/:id` son solo para vendedores; no se puede borrar una categoría con productos (409). **Si la base ya tiene productos, correr `npm run migrar:categorias` antes de iniciar la API**, también en desarrollo.

Pedidos: `POST /pedidos` confirma el carrito y genera una orden general con una suborden por vendedor. Recibe `items`, `total`, `claveConfirmacion` (UUID, permite reintentar sin duplicar) y `entregas: [{ idNegocio, direccionEntrega, condicionPago }]`, una por cada vendedor del carrito. Cada suborden valida su monto mínimo; si alguna falla no se confirma ninguna. `GET /pedidos/compras` lista las órdenes del negocio comprador y `GET /pedidos/ventas` las subórdenes recibidas por un vendedor. `PATCH /pedidos/subordenes/:id/estado` cambia el estado: el vendedor pasa de pendiente a confirmada o rechazada, y luego a preparada, enviada y entregada; el comprador puede cancelar una suborden pendiente o confirmada. Rechazar o cancelar devuelve el stock. Para producción aplicar `migrations/005-checkout.sql` y `migrations/006-subordenes.sql`; en desarrollo, si la base ya tiene pedidos, correr `npm run migrar:subordenes` antes de iniciar la API para conservarlos.

La orden general devuelve `estado: EN_CURSO | COMPLETADA`, calculado a partir de todas sus subórdenes al confirmar, reintentar o listar compras. Solo se muestra completada cuando tiene al menos una suborden y todas están entregadas o cerradas (rechazadas o canceladas). El estado no se guarda por separado, por lo que no requiere migración y refleja los cambios de cada vendedor. El vendedor administra los pedidos recibidos y repone stock con `PATCH /productos/:id/stock`; el comprador consulta seguimiento e historial conservando los datos de la compra.

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/auth/registro` | Registra cliente y negocio. Roles: `COMPRADOR`, `VENDEDOR`. |
| POST | `/auth/iniciar-sesion` | Inicia sesión y entrega token JWT. |
| GET | `/negocios/mi-negocio` | Lee el negocio autenticado. |
| PATCH | `/negocios/mi-negocio` | Actualiza el negocio autenticado. |
| DELETE | `/negocios/mi-negocio` | Elimina negocio y clientes asociados. |
