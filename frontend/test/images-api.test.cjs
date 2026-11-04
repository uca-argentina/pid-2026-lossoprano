/**
 * Pruebas de regresión del frontend con node:test.
 * Los helpers transpilan TypeScript y sustituyen módulos/efectos para ejercitar lógica
 * sin un navegador real.
 * Estas pruebas no reemplazan una revisión visual: para estilos, foco o desplazamiento
 * también hay que abrir la interfaz.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function cargar(fetch) {
  const source = fs
    .readFileSync(path.join(__dirname, '../src/api.ts'), 'utf8')
    .replace('import.meta.env.VITE_API_URL', "'https://api.example.com/api'");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, URLSearchParams, FormData, fetch });
  return exports;
}

test('cinco fotos de 2 MB viajan en solicitudes individuales y el producto recibe las URLs', async () => {
  const llamadas = [];
  const { api } = cargar(async (url, opciones) => {
    llamadas.push({ url, opciones });
    return Response.json(
      url.endsWith('/imagenes')
        ? { url: `https://store/foto-${llamadas.length}.png` }
        : {},
    );
  });
  const datos = new FormData();
  datos.set('nombre', 'Producto');
  for (let i = 0; i < 5; i++)
    datos.append(
      'imagenes',
      new Blob([new Uint8Array(2 * 1024 * 1024)], { type: 'image/png' }),
      `foto-${i}.png`,
    );
  await api.crearProducto(datos, 'token');
  assert.equal(llamadas.length, 6);
  for (const llamada of llamadas.slice(0, 5)) {
    assert.equal(llamada.url, 'https://api.example.com/api/productos/imagenes');
    assert.equal(llamada.opciones.headers.Authorization, 'Bearer token');
    assert.equal(llamada.opciones.body.get('imagen').size, 2 * 1024 * 1024);
  }
  const producto = llamadas[5].opciones.body;
  assert.equal(producto.getAll('imagenes').length, 0);
  assert.equal(JSON.parse(producto.get('imagenesSubidas')).length, 5);
  assert.equal(producto.get('nombre'), 'Producto');
  assert.equal(datos.getAll('imagenes').length, 5);
});

test('una subida fallida impide guardar el producto y permite reintentar el formulario', async () => {
  let llamadas = 0;
  const { api } = cargar(async () => {
    llamadas++;
    return Response.json({ message: 'No se pudo subir' }, { status: 503 });
  });
  const datos = new FormData();
  datos.append('imagenes', new Blob(['foto']), 'foto.png');
  await assert.rejects(api.crearProducto(datos, 'token'), /No se pudo subir/);
  assert.equal(llamadas, 1);
  assert.equal(datos.getAll('imagenes').length, 1);
});

test('editar sin fotos conserva el formulario y resuelve imágenes locales y de Blob', async () => {
  const { api, imagenUrl } = cargar(async (url, opciones) => {
    assert.equal(url, 'https://api.example.com/api/productos/4');
    assert.equal(opciones.method, 'PATCH');
    assert.equal(opciones.body.get('nombre'), 'Nuevo nombre');
    assert.equal(opciones.body.has('imagenesSubidas'), false);
    return Response.json({ idProducto: 4 });
  });
  const datos = new FormData();
  datos.set('nombre', 'Nuevo nombre');
  await api.actualizarProducto(4, datos, 'token');
  assert.equal(
    imagenUrl('/uploads/productos/foto.jpg'),
    'https://api.example.com/uploads/productos/foto.jpg',
  );
  assert.equal(imagenUrl('https://store/foto.jpg'), 'https://store/foto.jpg');
});
