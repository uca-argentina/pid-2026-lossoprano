/**
 * Lectura y validación de la configuración de nube usada por los scripts de
 * despliegue.
 * Distingue un destino remoto de localhost y valida el origen público de Blob antes de
 * transferir datos.
 */

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parseEnv } = require('node:util');

function cloudConfig() {
  const config = parseEnv(readFileSync(resolve(__dirname, '../.env.cloud'), 'utf8'));
  if (!config.DATABASE_URL) throw new Error('Definí DATABASE_URL en backend/.env.cloud.');
  const url = new URL(config.DATABASE_URL);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw new Error('La URL de destino debe apuntar a PostgreSQL en la nube.');
  }
  return config;
}

function publicBlobOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      'BLOB_PUBLIC_URL debe contener solo https://<store>.public.blob.vercel-storage.com; no repitas BLOB_PUBLIC_URL= dentro del valor.',
    );
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.public.blob.vercel-storage.com') ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'BLOB_PUBLIC_URL debe ser el origen HTTPS del store público, sin nombre de archivo ni parámetros.',
    );
  }
  return url.origin;
}

module.exports = { cloudConfig, publicBlobOrigin };
