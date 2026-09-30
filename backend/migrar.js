const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Uso: node migrar.js migrations/004-categorias-precios-escalonados.sql
const archivoEnv = path.resolve(__dirname, '.env');
if (fs.existsSync(archivoEnv)) {
  for (const linea of fs.readFileSync(archivoEnv, 'utf8').split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#') || !limpia.includes('=')) continue;
    const [clave, ...valor] = limpia.split('=');
    process.env[clave.trim()] ??= valor.join('=').trim();
  }
}

const archivo = process.argv[2];
if (!archivo || !process.env.DATABASE_URL) {
  console.error('Indicá el archivo SQL y definí DATABASE_URL.');
  process.exit(1);
}

(async () => {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await cliente.connect();
    await cliente.query(fs.readFileSync(path.resolve(archivo), 'utf8'));
    console.log(`Migración aplicada: ${archivo}`);
  } catch (error) {
    console.error('No se pudo aplicar la migración:', error.message);
    process.exitCode = 1;
  } finally {
    await cliente.end();
  }
})();
