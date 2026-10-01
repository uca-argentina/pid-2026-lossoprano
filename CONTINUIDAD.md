# BulkMarket — guía de continuidad

Última revisión: 1 de octubre de 2026. Este documento describe el código actual y las decisiones tomadas; no sustituye su revisión antes de hacer cambios. Está pensado para otra persona o agente que continúe el proyecto.

## Propósito y alcance actual

Marketplace B2B mayorista: las cuentas representan negocios, no consumidores finales. Interfaz en español y responsive.

Implementado:

- Registro e inicio de sesión, con roles COMPRADOR y VENDEDOR. Confirmación de contraseña en el formulario de registro.
- Alta, edición y baja de negocios; identificación fiscal y correo únicos.
- Creación, edición en modal y eliminación de productos propios, con imágenes, categoría, precio y stock.
- Exploración y detalle de productos de otros negocios; filtros por texto, categoría y negocio vendedor.
- Categorías como tabla propia: generales (se crean solas al iniciar la API) y propias de cada vendedor. Cada producto pertenece a una sola categoría. No se puede eliminar una categoría que tenga productos asociados.
- Precios escalonados por producto: el precio unitario baja al alcanzar determinadas cantidades.
- Carrito persistido en PostgreSQL, de un único vendedor por cuenta.
- Monto mínimo de orden por vendedor y cantidad mínima opcional por producto.
- Checkout dentro del carrito: dirección de entrega editable, condición de pago simulada (contado, transferencia o cuenta corriente) y confirmación que persiste el pedido, descuenta stock y vacía el carrito en una transacción.

No implementado: cobros reales, rechazo/cancelación y restitución de stock, panel de pedidos, checkout multi-vendedor y reseñas. Los pedidos se crean como CONFIRMADO; no hay otras transiciones ni vistas de pedidos.

## Decisiones de negocio que deben conservarse

- Un vendedor también puede comprar a otros vendedores. Tiene Perfil, Mis productos, Explorar y carrito.
- Una cuenta compradora no debe vender; no está prevista la conversión a vendedor.
- No se permite comprar productos del propio negocio. Se ocultan en Explorar y se bloquean en el backend al guardar el carrito; no basta con ocultarlos en la UI.
- El registro siempre crea un negocio nuevo y una cuenta asociada, en una transacción. No hay invitaciones ni flujo para sumar cuentas a negocios existentes.
- El modelo permite varias cuentas por negocio, pero la identificación fiscal única impide registrar otro negocio con la misma identificación. Se decidió dejar abierta esa posibilidad futura sin implementar el flujo.
- El mínimo de orden es un monto monetario del subtotal de ese vendedor, no una cantidad total de unidades. Cero significa sin mínimo monetario.
- La cantidad mínima de un producto es opcional: null/vacío equivale a comprar desde una unidad. Stock y cantidades son enteros; precios y mínimos monetarios admiten dos decimales.
- Se puede construir un carrito por debajo del mínimo monetario; se impide finalizar, no guardarlo. Las cantidades de cada producto sí deben cumplir su mínimo.
- Editar **cualquier campo** de un producto (incluidos sus precios escalonados) lo retira de todos los carritos que lo contienen. No actualizar silenciosamente el precio de un artículo ya agregado.
- Categorías: las generales no las borra nadie; las de un vendedor solo las ve y usa ese vendedor. Los nombres se comparan sin mayúsculas, acentos ni espacios repetidos, y no se puede repetir el nombre de una general ni de una propia. El filtro de Explorar agrupa por nombre, así que «Vinos» de dos vendedores aparece como una sola opción. La FK producto → categoría es `NO ACTION`: la base también impide borrar una categoría con productos, además del chequeo del servicio, que devuelve 409 con un mensaje claro.
- Precios escalonados: hasta 10 tramos por producto (`cantidadMinima`, `precioUnitario`). Cada tramo empieza por encima de la cantidad mínima de compra y su precio es menor que el precio base y que el tramo anterior. Se aplica el tramo más alto alcanzado; el subtotal y el monto mínimo del vendedor se calculan con ese precio.

## Organización y tecnologías

No hay un package.json de monorepo: instalar y ejecutar cada carpeta por separado.

| Área | Tecnología / archivos principales |
| --- | --- |
| API | NestJS 11, TypeScript, TypeORM, PostgreSQL 16 |
| Autenticación | JWT (8 horas) y bcrypt; `backend/src/auth/` |
| Negocios | `backend/src/business/` |
| Productos, precios escalonados y carritos | `backend/src/products/` |
| Categorías | `backend/src/categories/` |
| Web | React 19, TypeScript, Vite 6; CSS propio, no Tailwind |
| Aplicación y perfil | `frontend/src/App.tsx` |
| Catálogo comprador | `frontend/src/Comprador.tsx` |
| Formularios de productos | `CrearProducto.tsx`, `EditarProducto.tsx`, `CampoCategoria.tsx` (también Mis categorías), `CampoPreciosEscalonados.tsx` |
| Estado del carrito | `frontend/src/useCarrito.ts` |
| Panel y cantidades | `PanelCarrito.tsx`, `CantidadCarrito.tsx` |
| Tipos y acceso HTTP | `frontend/src/api.ts` |
| Estilos responsive | `frontend/src/styles.css` |

La web es una SPA con navegación por estado: las pestañas no tienen rutas/URLs propias. Agregar rutas en el futuro requerirá introducir enrutamiento y configurar el servidor para servir la SPA en rutas profundas.

## Ejecutar en desarrollo

Requisitos: Node/npm compatibles con las dependencias del lockfile, Docker con Compose o PostgreSQL accesible. Usar los package-lock.json para instalar de forma reproducible.

Desde `backend/`:

```sh
cp .env.example .env
# Editar .env y definir un JWT_SECRET largo y aleatorio.
npm ci
docker compose up -d
# Solo si la base conserva productos con categorías de texto:
# npm run migrar:categorias
npm run start:dev
```

Desde `frontend/`, en otra terminal:

```sh
# Opcional: copiar .env.example a .env para cambiar VITE_API_URL.
npm ci
npm run dev
```

No sobrescribir archivos .env existentes al seguir estos ejemplos.

En PowerShell se puede usar `Copy-Item .env.example .env`. Cada integrante configura su propio `.env`, excluido de Git; la configuración compartida está en `.env.example` y `docker-compose.yml`. El frontend funciona sin `.env` usando la API local por defecto. Mantener backend y frontend corriendo en terminales separadas.

- Web habitual: `http://localhost:5173`.
- API: `http://localhost:3000/api`.
- Imágenes: `http://localhost:3000/uploads/...` (fuera del prefijo `/api`).
- Backend: `DATABASE_URL`, `JWT_SECRET`, `PORT` (3000 por defecto), `FRONTEND_URL` (origen CORS, por defecto `http://localhost:5173`), `NODE_ENV`.
- Frontend: `VITE_API_URL`, por defecto `http://localhost:3000/api`. Cambios de entorno requieren reiniciar Vite; en producción se incorporan durante la compilación.
- Ejecutar el backend desde su carpeta: las rutas de uploads dependen del directorio de trabajo.

Reiniciar la API significa detener el proceso del backend y volver a ejecutar `npm run start:dev`, no borrar la base ni reiniciar necesariamente PostgreSQL.

Los ejemplos son comandos normales de terminal. En un entorno Codex con instrucciones RTK, respetar el prefijo requerido por esas instrucciones.

## Base de datos y archivos

| Tabla | Datos y relaciones relevantes |
| --- | --- |
| `negocio` | Datos fiscales/contacto y `monto_minimo_orden`; identificación fiscal única |
| `cliente` | Email único, hash de contraseña, rol y FK al negocio |
| `categoria` | Nombre, clave normalizada y FK opcional al negocio (null = general) |
| `producto` | FK al negocio y a la categoría, descripción, precio decimal, stock entero, rutas de imágenes, versión y cantidad mínima |
| `precio_escalonado` | FK al producto (cascade), cantidad desde la que aplica y precio unitario |
| `carrito_item` | PK compuesta cuenta/producto; cantidad y versión del producto agregado |

Los borrados de negocio, cuenta y producto tienen relaciones con eliminación en cascada según las entidades. Eliminar un negocio elimina sus cuentas y productos, y las entradas de carrito relacionadas.

Los valores decimales de PostgreSQL se exponen habitualmente como strings. No cambiar esos tipos sin revisar API, formularios y cálculos. El servicio de carrito calcula los importes en centavos antes de devolver strings con dos decimales.

En desarrollo, TypeORM usa `synchronize: true` siempre que `NODE_ENV` no sea `production`. Al iniciar la API sincroniza el esquema. No usar esta estrategia con datos de producción sin una revisión y un respaldo.

En producción, `synchronize` está deshabilitado. Hay scripts SQL incrementales en `backend/migrations/`, para aplicar manualmente y en orden:

1. `001-product-version.sql`.
2. `002-cart.sql`.
3. `003-order-minimums.sql`.
4. `004-categorias-precios-escalonados.sql`.

**La 004 también hay que aplicarla en desarrollo si la base ya tiene productos**, antes de levantar la API: `npm run migrar:categorias` desde `backend/` (usa `DATABASE_URL` del `.env`). Pasa la categoría de texto de cada producto a la tabla `categoria` (si coincide con una general la usa; si no, crea una del vendedor) y borra la columna vieja. Sin este paso, `synchronize` intentaría borrar la columna de texto y crear `id_categoria` NOT NULL, y fallaría. Se puede correr más de una vez. En una base vacía no hace falta.
Estos scripts no constituyen un esquema inicial completo ni hay un ejecutor de migraciones configurado. Para una base de producción vacía se necesita preparar también el esquema base.

Las imágenes se guardan en `backend/uploads/productos/`; PostgreSQL guarda solo las rutas. Se aceptan JPG, PNG y WebP, hasta cinco imágenes de 2 MiB cada una. Editar sin enviar imágenes conserva las existentes; enviar nuevas reemplaza toda la lista.

La implementación actual no elimina físicamente los archivos antiguos al reemplazar/borrar productos, ni asegura limpieza de archivos subidos si falla la operación. Considerar limpieza de huérfanos y almacenamiento persistente antes de desplegar. El respaldo debe incluir tanto PostgreSQL como uploads.

El compose persiste PostgreSQL en el volumen `postgres_data`. Detener los contenedores no vacía la base. Borrar ese volumen es destructivo y no borra las imágenes; cualquier reset debe hacerse conscientemente y con respaldo si hay datos importantes.

## API principal

Todas las rutas siguientes son relativas a `/api`. Salvo registro/login, requieren Bearer JWT.

| Método | Ruta | Función |
| --- | --- | --- |
| POST | `/auth/registro`, `/auth/iniciar-sesion` | Alta e inicio de sesión |
| GET / PATCH / DELETE | `/negocios/mi-negocio` | Perfil del negocio autenticado |
| GET | `/productos` | Catálogo; `q`, `categoria`, `idNegocio`, `limit`, `offset` |
| GET | `/productos/:id` | Detalle |
| GET | `/productos/mi-negocio` | Productos propios |
| GET | `/productos/categorias`, `/productos/vendedores` | Opciones para filtros (nombres de categorías con productos) |
| GET / POST | `/categorias` | Generales y propias con cantidad de productos / crear propia (vendedor) |
| DELETE | `/categorias/:id` | Borrar una propia sin productos (vendedor); 409 si tiene productos |
| POST | `/productos` | Crear producto (vendedor, multipart; `idCategoria` y `preciosEscalonados` como JSON) |
| PATCH / DELETE | `/productos/:id` | Modificar/borrar producto propio (vendedor) |
| GET / PUT | `/carrito` | Leer/reemplazar carrito de la cuenta autenticada |
| POST | `/pedidos` | Confirmar el carrito con dirección, condición de pago simulada, total revisado, items y clave UUID de confirmación |
| POST | `/productos/carrito/validar` | Validación de IDs/versiones; no reemplaza el guardado completo |

`q` busca nombre y descripción del producto, no nombre del negocio. El filtro de vendedor resuelve esa búsqueda. El catálogo devuelve 24 productos por defecto; la API admite limit/offset, pero la UI no expone paginación actualmente.

## Carrito: contrato y concurrencia

`PUT /carrito` recibe una foto completa del carrito:

```json
{ "items": [{ "idProducto": 1, "version": 2, "cantidad": 10 }] }
```

Una lista vacía lo vacía. No aceptar precio, vendedor ni identidad de cuenta suministrados por el cliente como fuente de verdad: la cuenta procede del JWT y el resto se consulta en la base.

- El guardado corre en una transacción, bloquea la cuenta y consulta productos con bloqueo de lectura en orden de ID.
- Rechaza productos propios, mezclas de vendedores y cantidades inferiores al mínimo (salvo ajuste de importación).
- Omite productos eliminados, con versión antigua, sin stock o cuyo stock no alcanza su mínimo. Ajusta cantidades excesivas al stock disponible.
- Actualizar un producto incrementa su `version` mediante TypeORM y elimina sus entradas de carrito en la misma transacción. La versión impide restaurarlas desde una pestaña con estado antiguo.
- El mínimo monetario del vendedor se consulta al leer: cambiarlo no vacía carritos y recalcula su cumplimiento.
- El carrito devuelve `subtotal`, `montoMinimoOrden`, `faltanteMinimo`, `cumpleMinimos` e items con datos actuales, incluidos `precioUnitario` (según el tramo alcanzado) y `preciosEscalonados`. Sin items devuelve JSON `null`.
- `useCarrito` consulta al iniciar, al recuperar el foco y cada 10 segundos. No hay WebSockets; los cambios ajenos no se reflejan instantáneamente.
- Hay protección contra respuestas de consulta obsoletas y operaciones simultáneas dentro de la misma instancia del hook. Entre sesiones, PUT sigue siendo reemplazo completo; no hay fusión de cambios ni control de versión global del carrito.

El carrito ya no tiene como almacenamiento principal el navegador. Se importa una copia antigua de `bulkmarket-carrito-${idCliente}` solo si el servidor no tiene carrito. `importar: true` evita sobrescribir uno existente. Tras una carga/importación exitosa se retira esa copia local; ante error se conserva para reintentar.

La sesión JWT sí está en localStorage. No confundir eso con persistencia de carrito; revisar seguridad de sesión antes de producción.

## Detalles de interfaz y compatibilidad

- Navbar: Perfil → Mis productos (solo vendedor) → Explorar; carrito accesible desde cualquier pestaña.
- Al agregar productos se abre el carrito y se aplica el filtro de ese vendedor. Al vaciarlo se libera el filtro asociado.
- Mobile: logo solo «B», controles compactos, catálogo de dos columnas en el rango móvil configurado; en pantallas muy angostas vuelve a una columna.
- En login/registro móvil, el bloque del lema está debajo del formulario.
- Los modales bloquean el scroll del fondo. El carrito usa bordes rectos en móvil intencionalmente.
- `CantidadCarrito` permite escribir un valor intermedio inválido sin guardarlo: confirma al salir del campo o con Enter. Flechas propias y ArrowUp/ArrowDown guardan inmediatamente; no volver a validar cada dígito mientras se escribe.
- Precio unitario del carrito usa nowrap para que «c/u» no se parta; en móvil las cantidades y Quitar van en una segunda fila.
- Barra de progreso monetario debajo del subtotal; texto «Te faltan…» antes de Vaciar carrito.
- Safari mostró un artefacto al pasar Finalizar compra de habilitado a deshabilitado con opacidad animada. Se corrigió con colores sólidos, `opacity: 1`, apariencia nativa desactivada y transición **solo de background-color durante 0,2 s**. El usuario confirmó que esa variante funciona. No restaurar `transition: all`/opacidad en ese botón sin probar Safari.
- Los botones deshabilitados usan cursor not-allowed, no wait.
- Se corrigió una respuesta vacía del carrito que causaba JSON.parse: el controlador responde JSON explícito y el cliente tolera cuerpo vacío para `/carrito`.

## Verificación

Desde `backend/`:

```sh
npm run build
npm run test:products
npm run test:cart:integration
```

La integración requiere PostgreSQL del compose o `TEST_DATABASE_URL`. Usa tablas temporales en una transacción que revierte; no está diseñada para modificar datos existentes. Preferir siempre una base de desarrollo/pruebas.

Desde `frontend/`:

```sh
npm run build
npm run test:cart
```

Las pruebas del frontend ejercitan API/hook y edición de cantidades mediante mocks, no son pruebas visuales en navegadores. Para los resultados posteriores a los ajustes de interfaz, consultar las verificaciones del checkout y de las correcciones de arranque documentadas abajo.

Checklist manual útil antes de entregar cambios:

1. Registrar comprador/vendedor, probar duplicados y confirmación de contraseña.
2. Editar/borrar solo productos propios; verificar otra cuenta con ese producto en carrito.
3. Comprobar carrito de un vendedor, bloqueo de productos propios y persistencia tras recargar.
4. Probar stock insuficiente, mínimo por producto y subir/bajar del mínimo monetario.
5. Reescribir cantidades (por ejemplo, 10 → 30), flechas y Enter.
6. Probar móvil de aproximadamente 400 × 870 y Safari además de Firefox: navbar, modales, scroll, precio unitario y transición del botón.

## Checkout incorporado el 1 de octubre de 2026

El checkout está integrado en `PanelCarrito.tsx`. Precarga la dirección del negocio y permite editarla. El backend conserva dirección, condición de pago, cantidades, nombres y precios históricos en `pedido`; sus líneas se guardan como JSONB. La tabla no tiene borrados en cascada desde cuentas, negocios o productos.

`PedidosService.confirmar` bloquea la cuenta y los productos ordenados por ID, valida que el carrito coincida con la revisión del comprador y vuelve a comprobar versiones, stock, precios y mínimos. Descuenta stock sin cambiar la versión comercial del producto, guarda el pedido y vacía el carrito en una transacción. Los reintentos con la misma clave UUID y cuenta devuelven el pedido existente sin descontar nuevamente. El frontend conserva esa solicitud mientras se reintenta desde el checkout.

En producción aplicar `backend/migrations/005-checkout.sql` después de las anteriores. En desarrollo TypeORM crea la tabla al iniciar. No se aplicó la migración contra una base existente durante este cambio.

Verificación de este cambio: compilaciones de ambas aplicaciones; 21 pruebas unitarias de backend y 15 de frontend aprobadas. La integración PostgreSQL incluye confirmación, precio escalonado, reintento y stock insuficiente, pero no pudo ejecutarse porque PostgreSQL local y Docker estaban detenidos. Ejecutar `npm run test:checkout` para la lógica y `npm run test:cart:integration` con PostgreSQL disponible. No se verificó visualmente en navegador.

## Correcciones de arranque del 1 de octubre de 2026

- **Credenciales ausentes:** el error `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` se debía a que faltaban `backend/.env` y `DATABASE_URL` en el entorno. Se creó el archivo local a partir del ejemplo, con las credenciales del Compose y un `JWT_SECRET` aleatorio. Ese archivo no se versiona ni se comparte. En `backend/src/app.module.ts` se usa ahora `config.getOrThrow<string>('DATABASE_URL')` para detectar explícitamente la variable ausente.
- **Productos existentes sin versión:** TypeORM intentaba ejecutar `ALTER TABLE "producto" ADD "version" integer NOT NULL`, que falla con filas existentes. Se cambió la entidad `backend/src/products/products.entity.ts` a `@VersionColumn({ default: 1 })`. Así la sincronización de desarrollo asigna 1 a los productos existentes al crear la columna. Es una corrección compartida para todos los integrantes, sin credenciales ni rutas particulares. En producción sigue correspondiendo aplicar `001-product-version.sql`.
- **Categorías antiguas:** la base local conservaba la columna de texto `categoria`. Se ejecutó correctamente `npm run migrar:categorias` antes del arranque, usando la migración existente para conservar las categorías. Los demás integrantes con ese esquema anterior deben ejecutar el mismo comando desde `backend/`; no deben borrar la base. El procedimiento también quedó documentado en `backend/README.md`.
- **Verificación realizada:** conexión a PostgreSQL y `npm run build` correctos; inicialización completa de Nest mediante `createApplicationContext(AppModule)`, incluida la sincronización de TypeORM, correcta. Pasaron las 19 pruebas de `node --test test/products.test.cjs test/cart.integration.cjs`, incluida la integración PostgreSQL que había quedado pendiente durante el checkout. En esta revisión no se repitieron las pruebas del frontend ni una verificación visual en navegador.

Tras estos cambios, reiniciar el backend con `npm run start:dev`. Para el frontend, ejecutar `npm ci` si faltan dependencias y `npm run dev` desde `frontend/`, y abrir la dirección indicada por Vite (habitualmente `http://localhost:5173`).

No se hicieron commits ni pushes durante estas correcciones. Antes de subir la rama, revisar `git status` y `git diff`: hay cambios de otras funcionalidades en el árbol de trabajo y `git add .` también los incluiría.

## Próximos pasos y precauciones

El guardado del carrito no reserva stock; solo la confirmación del checkout lo descuenta. La cancelación, rechazo y restitución quedan fuera del alcance actual. Antes de incorporarlos, definir permisos, transiciones y el tratamiento de productos eliminados. La edición manual actual envía un stock absoluto y debe revisarse si se requiere detectar formularios abiertos antes de una venta.

Para producción también falta revisar autenticación/expiración y manejo de errores, límites de peticiones, validación real del contenido de imágenes (actualmente se filtra por MIME declarado), almacenamiento persistente y migraciones completas. Son puntos a evaluar, no funcionalidades ya implementadas.

Hay `.gitignore` en raíz, frontend y backend; es válido y sus reglas se complementan. `.DS_Store`, .env, dependencias, dist y uploads están ignorados donde corresponde. `project_guidelines.md` está ignorado en raíz y puede no existir en otro clon; esta guía sí está pensada para versionarse. La guía local contiene objetivos futuros y un stack tentativo: el código usa CSS propio y el checkout actual es de un vendedor.

Antes de empezar, revisar `git status` y preservar los cambios locales. Al redactar este documento había cambios pendientes en `PanelCarrito.tsx`, `styles.css`, `test/cart-api.test.cjs` y un archivo nuevo `CantidadCarrito.tsx`; incluyen los últimos ajustes de UI y cantidades. No asumir que todo está ya en un commit. No se hicieron commits ni pushes al crear esta guía.
