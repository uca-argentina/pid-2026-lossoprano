const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Ejecuta el hook real con almacenamiento, reloj y respuestas de API controlados.
function carritoPrueba(guardado, versiones) {
  const estados = [], efectos = [], pendientes = [], intervalos = new Set();
  const almacenamiento = new Map(guardado ? [['bulkmarket-carrito-1', JSON.stringify(guardado)]] : []);
  let indice = 0;
  const react = {
    useState(inicial) {
      const posicion = indice++;
      if (!(posicion in estados)) estados[posicion] = typeof inicial === 'function' ? inicial() : inicial;
      return [estados[posicion], valor => { estados[posicion] = typeof valor === 'function' ? valor(estados[posicion]) : valor; }];
    },
    useEffect(callback, deps) {
      const posicion = indice++;
      const previo = efectos[posicion];
      if (!previo || deps.some((valor, i) => !Object.is(valor, previo.deps[i]))) {
        previo?.cleanup?.();
        pendientes.push(() => { efectos[posicion] = { deps, cleanup: callback() }; });
      }
    },
  };
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/Comprador.tsx'), 'utf8') + '\nexport { useCarrito };';
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'react') return react;
      if (name === './api') return { api: { validarCarrito: async items => items
        .filter(item => versiones.get(item.idProducto) === item.version).map(item => item.idProducto) } };
      return {};
    },
    localStorage: { getItem: clave => almacenamiento.get(clave), setItem: (clave, valor) => almacenamiento.set(clave, valor), removeItem: clave => almacenamiento.delete(clave) },
    window: { confirm: () => true, setInterval: callback => { intervalos.add(callback); return callback; },
      clearInterval: callback => intervalos.delete(callback), addEventListener() {}, removeEventListener() {} },
  });
  function render() {
    indice = 0;
    const hook = exports.useCarrito(1, 'token');
    pendientes.splice(0).forEach(callback => callback());
    return hook;
  }
  return { render, intervalos, almacenamiento };
}

const producto = { idProducto: 3, idNegocio: 2, version: 1, nombre: 'Producto', precioBase: '10.00', stock: 5, imagenes: [] };
const esperar = () => new Promise(resolve => setImmediate(resolve));

test('agregar y editar cantidades respeta stock y cantidades enteras', async () => {
  const prueba = carritoPrueba(null, new Map([[3, 1]]));
  prueba.render().agregar(producto, 4);
  await esperar();
  prueba.render().agregar(producto, 4);
  let hook = prueba.render();
  assert.equal(hook.carrito.items[0].cantidad, 5);
  hook.actualizarCantidad(3, 2.5);
  assert.equal(prueba.render().carrito.items[0].cantidad, 2);
});

test('editar un producto lo elimina del carrito conectado y del almacenamiento', async () => {
  const versiones = new Map([[3, 1]]);
  const prueba = carritoPrueba(null, versiones);
  prueba.render().agregar(producto, 2);
  prueba.render();
  await esperar();
  versiones.set(3, 2);
  await Promise.all([...prueba.intervalos].map(callback => callback()));
  const hook = prueba.render();
  assert.equal(hook.carrito, null);
  assert.match(hook.avisoCarrito, /modificó o eliminó/);
  assert.equal(prueba.almacenamiento.has('bulkmarket-carrito-1'), false);
});

test('volver a agregar una nueva versión no conserva cantidades ni precios de la anterior', async () => {
  const versiones = new Map([[3, 1]]);
  const prueba = carritoPrueba(null, versiones);
  prueba.render().agregar(producto, 4);
  prueba.render();
  await esperar();
  versiones.set(3, 2);
  prueba.render().agregar({ ...producto, version: 2, precioBase: '20.00' }, 1);
  const item = prueba.render().carrito.items[0];
  assert.equal(item.cantidad, 1);
  assert.equal(item.precioBase, '20.00');
  assert.equal(item.version, 2);
});

test('al volver a abrir se quitan productos eliminados y se conserva el resto', async () => {
  const prueba = carritoPrueba({ idNegocio: 2, nombreNegocio: 'Marca', items: [
    { ...producto, cantidad: 2 }, { ...producto, idProducto: 4, cantidad: 1 },
  ] }, new Map([[4, 1]]));
  prueba.render();
  await esperar();
  assert.deepEqual(Array.from(prueba.render().carrito.items, item => item.idProducto), [4]);
});
