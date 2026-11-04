/**
 * Restauración manual de un backup en una base remota vacía mediante pg_restore del
 * contenedor.
 * Comprueba que el destino no tenga tablas y pasa credenciales por el entorno, no por
 * argumentos visibles del proceso.
 */

const { Client } = require('pg');
const { createReadStream, statSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawn } = require('node:child_process');
const { cloudConfig } = require('./cloud-config.cjs');

async function main() {
  const config = cloudConfig();
  const archivo = resolve(process.argv[2] ?? '../backups/bulkmarket-before-vercel.dump');
  if (!statSync(archivo).size) throw new Error('El backup está vacío.');
  const cliente = new Client({ connectionString: config.DATABASE_URL });
  try {
    await cliente.connect();
    const { rows } = await cliente.query(
      "SELECT count(*)::int AS cantidad FROM pg_tables WHERE schemaname = 'public'",
    );
    if (rows[0].cantidad !== 0)
      throw new Error(
        'El destino ya tiene tablas. Usá una base vacía; no se sobrescriben datos.',
      );
  } finally {
    await cliente.end();
  }

  // Las credenciales viajan por el entorno, no por los argumentos del comando.
  const url = new URL(config.DATABASE_URL);
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.get('sslmode') || 'require',
  };
  const args = ['compose', 'exec', '-T'];
  for (const clave of [
    'PGHOST',
    'PGPORT',
    'PGUSER',
    'PGPASSWORD',
    'PGDATABASE',
    'PGSSLMODE',
  ])
    args.push('-e', clave);
  args.push(
    'postgres',
    'pg_restore',
    '--no-owner',
    '--no-acl',
    '--exit-on-error',
    '--single-transaction',
  );
  // Sin -d, pg_restore genera SQL; --dbname fuerza la restauración en PostgreSQL.
  args.push('--dbname', env.PGDATABASE);
  const proceso = spawn('docker', args, {
    cwd: resolve(__dirname, '..'),
    env,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const resultado = new Promise((res, rej) => {
    proceso.on('error', rej);
    proceso.on('close', (codigo) =>
      codigo === 0 ? res() : rej(new Error('Falló la restauración.')),
    );
  });
  const entrada = createReadStream(archivo);
  entrada.on('error', (error) => proceso.stdin.destroy(error));
  proceso.stdin.on('error', () => entrada.destroy());
  entrada.pipe(proceso.stdin);
  await resultado;

  const verificacion = new Client({ connectionString: config.DATABASE_URL });
  try {
    await verificacion.connect();
    for (const tabla of [
      'negocio',
      'cliente',
      'producto',
      'categoria',
      'precio_escalonado',
      'carrito_item',
      'pedido',
      'suborden',
    ]) {
      const { rows } = await verificacion.query(
        `SELECT count(*)::int AS cantidad FROM ${tabla}`,
      );
      console.log(`${tabla}: ${rows[0].cantidad} filas`);
    }
  } finally {
    await verificacion.end();
  }
  console.log('Base restaurada. Migrá las imágenes antes de publicar.');
}

if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { main };
