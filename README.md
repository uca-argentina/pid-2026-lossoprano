# BulkMarket

Marketplace B2B mayorista del PID 2026 (UCA). Las cuentas representan negocios: los **vendedores** publican productos y los **compradores** arman pedidos que pueden combinar varios vendedores.

| Parte | Carpeta | Tecnología | Dirección local |
| --- | --- | --- | --- |
| API | `backend/` | NestJS + TypeORM | http://localhost:3000/api |
| Base de datos | `backend/docker-compose.yml` | PostgreSQL 16 en Docker | localhost:5432 |
| Web | `frontend/` | React + Vite | http://localhost:5173 |

Backend y frontend son proyectos separados: cada uno tiene su `package.json`, sus dependencias y su terminal.

## Requisitos

- **Node.js 22** (`node -v` tiene que mostrar `v22.x`).
- **Docker Desktop** abierto, para la base de datos. Sin Docker, ver [PostgreSQL sin Docker](#postgresql-sin-docker).
- **Git**.

## Primera vez

Los comandos están pensados para la terminal de VS Code (PowerShell en Windows). Necesitan internet, porque descargan dependencias y la imagen de PostgreSQL.

### 1. Variables de entorno

Cada integrante tiene sus propios `.env`; no se suben a Git. Si ya existen, no los pises.

```sh
cd backend
Copy-Item .env.example .env      # en Mac/Linux: cp .env.example .env
```

Abrí `backend/.env` y reemplazá `JWT_SECRET` por cualquier texto largo. `DATABASE_URL` ya apunta a la base del Docker y no hace falta tocarlo.

El frontend funciona sin `.env`: usa `http://localhost:3000/api` por defecto.

### 2. Base de datos

Desde `backend/`:

```sh
docker compose up -d
```

Crea un contenedor de PostgreSQL con usuario, contraseña y base `bulkmarket`. Los datos quedan guardados en un volumen de Docker, así que no se pierden al apagar la compu.

### 3. Dependencias

```sh
cd backend
npm ci
cd ../frontend
npm ci
```

`npm ci` instala exactamente las versiones del `package-lock.json` en la carpeta `node_modules`. Solo hace falta repetirlo cuando un `git pull` cambia algún `package.json` o `package-lock.json`.

### 4. Levantar la API

Terminal 1, desde `backend/`:

```sh
npm run start:dev
```

Está lista cuando aparece `Nest application successfully started`. Al arrancar crea o actualiza las tablas solas (en desarrollo, TypeORM sincroniza las entidades). El modo `start:dev` se reinicia cada vez que guardás un archivo.

### 5. Levantar la web

Terminal 2, desde `frontend/` (en VS Code, el **+** del panel de terminal abre otra):

```sh
npm run dev
```

Abrí http://localhost:5173.

### 6. Cargar las cuentas de prueba

Terminal 3, desde `backend/`, con la API corriendo:

```sh
npm run seed:demo
```

Se puede correr más de una vez: si las cuentas ya existen, no las duplica.

## Cuentas de prueba

Las crea `npm run seed:demo`. Todas usan la contraseña **`Demo1234`**.

| Email | Rol | Negocio | Qué tiene cargado |
| --- | --- | --- | --- |
| `vendedor@bulkmarket.com` | Vendedor | Bodega Los Andes | 3 productos (vinos y aceite), pedido mínimo de $50.000, precios escalonados y cantidad mínima en el Malbec |
| `vendedor2@bulkmarket.com` | Vendedor | Distribuidora Norte | 2 productos (limpieza e higiene), sin pedido mínimo |
| `comprador@bulkmarket.com` | Comprador | Almacén La Esquina | Nada: sirve para comprar a los dos vendedores |

Para probar un pedido completo:

1. Entrá como `comprador@bulkmarket.com`, agregá productos de los dos vendedores al carrito y confirmá. Se genera una orden general con una suborden por vendedor.
2. Entrá como `vendedor@bulkmarket.com` → **Pedidos** y avanzá la suborden: Confirmar → Preparada → Enviada → Entregada.
3. Volvé al comprador → **Mis Compras** para ver el seguimiento y el historial.

Las cuentas de prueba existen solo en tu base local. Si borrás la base, volvé a correr `npm run seed:demo`.

## Uso diario

Con todo instalado, alcanza con:

```sh
# Terminal 1 (backend/)
docker compose up -d
npm run start:dev

# Terminal 2 (frontend/)
npm run dev
```

Para cortar, `Ctrl + C` en cada terminal. La base puede quedar corriendo; si querés apagarla, `docker compose stop` desde `backend/`.

Después de un `git pull`:

1. Si cambió algún `package.json` o `package-lock.json`, corré `npm ci` en esa carpeta.
2. Si hay una migración nueva en `backend/migrations/` y tu base tiene datos, mirá [Base de datos y migraciones](#base-de-datos-y-migraciones).
3. Reiniciá la API.

## Trabajar sin internet

Con todo instalado, el proyecto funciona offline: API, web y base corren en tu compu. Lo que sí necesita internet es `npm ci`, `npm install` (para agregar librerías) y el primer `docker compose up -d`, que descarga la imagen de PostgreSQL. Hacé esos pasos antes de quedarte sin conexión y no borres `node_modules` ni la imagen de Docker.

## Comandos útiles

Desde `backend/`:

| Comando | Para qué |
| --- | --- |
| `npm run start:dev` | Levanta la API y la reinicia al guardar |
| `npm run seed:demo` | Crea las cuentas y productos de prueba |
| `npm test` | Corre los tests (algunos necesitan la base del Docker levantada) |
| `npm run lint` | Revisa el código con ESLint |
| `docker compose up -d` | Prende la base |
| `docker compose stop` | Apaga la base sin borrar datos |
| `docker compose down -v` | **Borra la base entera** (usuarios, productos y pedidos) |

Desde `frontend/`:

| Comando | Para qué |
| --- | --- |
| `npm run dev` | Levanta la web |
| `npm test` | Corre los tests del frontend |
| `npm run build` | Compila y detecta errores de TypeScript |

Desde la raíz: `npm run format` aplica el formato común (Prettier) a todo el repo.

## Base de datos y migraciones

En desarrollo no hace falta crear tablas a mano: al arrancar, la API sincroniza el esquema con las entidades (`*.entity.ts`).

Las migraciones de `backend/migrations/` se usan en producción y, en desarrollo, **solo cuando tu base ya tiene datos** de una versión anterior que la sincronización no puede convertir sola. Se corren desde `backend/`, con la API apagada y en orden:

| Si tu base tiene... | Correr antes de levantar la API |
| --- | --- |
| productos con la categoría como texto (versión de septiembre) | `npm run migrar:categorias` |
| pedidos de antes del carrito multi-vendedor | `npm run migrar:subordenes` |

Si no te importan los datos viejos, es más simple empezar de cero: `docker compose down -v`, `docker compose up -d`, levantar la API y `npm run seed:demo`.

Para ver la base con una herramienta gráfica (DBeaver, pgAdmin, la extensión de PostgreSQL de VS Code), conectate a `localhost:5432`, base `bulkmarket`, usuario `bulkmarket`, contraseña `bulkmarket`.

## Problemas comunes

| Síntoma | Solución |
| --- | --- |
| La API repite `Unable to connect to the database` | La base no está corriendo. Abrí Docker Desktop y corré `docker compose up -d` en `backend/`. |
| `docker compose up` dice que el puerto 5432 está ocupado | Hay otro PostgreSQL usando el puerto (otro contenedor o uno instalado en Windows). Mirá con `docker ps`, frenalo con `docker stop <id>` o apagá el servicio de PostgreSQL de Windows. |
| `npm run dev` o `start:dev` dice que falta un módulo | Faltan dependencias: `npm ci` en esa carpeta. |
| La web muestra "Failed to fetch" o no inicia sesión | La API no está levantada o se cayó. Mirá la terminal del backend. |
| `npm run seed:demo` dice que no se pudo conectar | Levantá primero la API con `npm run start:dev`. |
| Error al arrancar la API por columnas o categorías | La base tiene datos de una versión vieja: ver [Base de datos y migraciones](#base-de-datos-y-migraciones). |
| El login dice que el token expiró | Los tokens duran 8 horas. Cerrá sesión y volvé a entrar. |

### PostgreSQL sin Docker

Si tenés PostgreSQL 16 instalado en Windows, creá el usuario y la base `bulkmarket` con contraseña `bulkmarket` (o ajustá `DATABASE_URL` en `backend/.env` con tus datos) y salteá el paso de `docker compose`.

## Más documentación

- [CONTINUIDAD.md](CONTINUIDAD.md): reglas de negocio, decisiones tomadas y mapa de archivos.
- [backend/README.md](backend/README.md): endpoints de la API y detalles de sorteos, carrito y pedidos.
- [frontend/README.md](frontend/README.md): pantallas y comportamiento de la web.
- [DEPLOYMENT.md](DEPLOYMENT.md): publicación en Vercel.
- [TODO.md](TODO.md): pendientes.
