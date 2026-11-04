/**
 * Migración manual de fotos locales a Blob y actualización de sus rutas en
 * PostgreSQL.
 * Verifica archivos y configuración antes de subir; reutiliza subidas durante la
 * ejecución para no repetir una misma imagen.
 */

const { Client } = require('pg');
const { put } = require('@vercel/blob');
const { readFile } = require('node:fs/promises');
const { resolve, sep, extname } = require('node:path');
const { randomUUID } = require('node:crypto');
const { cloudConfig, publicBlobOrigin } = require('./cloud-config.cjs');

async function main() {
  const config = cloudConfig();
  if (!config.BLOB_READ_WRITE_TOKEN || !config.BLOB_PUBLIC_URL)
    throw new Error('Configurá Blob en backend/.env.cloud.');
  const origen = publicBlobOrigin(config.BLOB_PUBLIC_URL);
  const raiz = resolve(__dirname, '../uploads');
  const tipos = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  const cliente = new Client({ connectionString: config.DATABASE_URL });
  try {
    await cliente.connect();
    const { rows: productos } = await cliente.query(
      'SELECT id_producto, id_negocio, imagenes FROM producto ORDER BY id_producto',
    );
    // Verificá todos los archivos antes de modificar la base o subir fotos.
    const archivos = new Map();
    for (const producto of productos) {
      for (const ruta of producto.imagenes) {
        if (ruta.startsWith('https://')) continue;
        if (!ruta.startsWith('/uploads/productos/'))
          throw new Error(`Ruta de imagen inválida en producto ${producto.id_producto}.`);
        const archivo = resolve(raiz, ruta.slice('/uploads/'.length));
        if (!archivo.startsWith(raiz + sep) || !tipos[extname(archivo).toLowerCase()])
          throw new Error('Ruta o formato inválido.');
        if (!archivos.has(ruta))
          archivos.set(ruta, {
            buffer: await readFile(archivo),
            tipo: tipos[extname(archivo).toLowerCase()],
          });
      }
    }
    const subidas = new Map();
    let modificados = 0;
    for (const producto of productos) {
      const nuevas = [];
      for (const ruta of producto.imagenes) {
        if (ruta.startsWith('https://')) {
          nuevas.push(ruta);
          continue;
        }
        const clave = `${producto.id_negocio}:${ruta}`;
        if (!subidas.has(clave)) {
          const archivo = archivos.get(ruta);
          const extension =
            archivo.tipo === 'image/jpeg'
              ? '.jpg'
              : archivo.tipo === 'image/png'
                ? '.png'
                : '.webp';
          const blob = await put(
            `productos/${producto.id_negocio}/${randomUUID()}${extension}`,
            archivo.buffer,
            {
              access: 'public',
              contentType: archivo.tipo,
              token: config.BLOB_READ_WRITE_TOKEN,
            },
          );
          if (new URL(blob.url).origin !== origen)
            throw new Error('El token y BLOB_PUBLIC_URL apuntan a stores distintos.');
          subidas.set(clave, blob.url);
        }
        nuevas.push(subidas.get(clave));
      }
      if (JSON.stringify(nuevas) === JSON.stringify(producto.imagenes)) continue;
      const resultado = await cliente.query(
        'UPDATE producto SET imagenes = $1 WHERE id_producto = $2 AND imagenes = $3',
        [nuevas, producto.id_producto, producto.imagenes],
      );
      if (resultado.rowCount !== 1)
        throw new Error(
          `El producto ${producto.id_producto} cambió durante la migración. Reintentá sin editar productos.`,
        );
      modificados++;
    }
    console.log(
      `Imágenes migradas: ${subidas.size}; productos actualizados: ${modificados}.`,
    );
  } finally {
    await cliente.end();
  }
}

if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { main };
