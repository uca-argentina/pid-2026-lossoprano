const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Ejecuta el hook real con almacenamiento, reloj y respuestas de API controlados.
function carritoPrueba(guardado, versiones, idNegocio = 1, servidor = { items: [] }) {
  const estados = [], efectos = [], pendientes = [], intervalos = new Set();
  const almacenamiento = new Map(guardado ? [['bulkmarket-carrito-1', JSON.stringify(guardado)]] : []);
  let indice = 0;
  const react = {
    useRef(inicial) {
      const posicion = indice++;
      if (!(posicion in estados)) estados[posicion] = { current: inicial };
      return estados[posicion];
    },
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
  const source = fs.readFileSync(path.join(__dirname, '../src/useCarrito.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'react') return react;
      if (name === './api') {
        const obtener = async () => {
          servidor.items = servidor.items.filter(item => versiones.get(item.idProducto) === item.version);
          return servidor.items.length ? { idNegocio: 2, nombreNegocio: 'Marca', items: servidor.items.map(item => ({ ...producto, ...item, precioBase: item.version === 2 ? '20.00' : '10.00' })) } : null;
        };
        return { api: {
          confirmarPedido: async datos => {
            if (servidor.errorCheckout) throw new Error('Stock insuficiente');
            servidor.confirmaciones = (servidor.confirmaciones ?? 0) + 1;
            servidor.items = [];
            return { idPedido: 42, total: datos.total };
          },
          obtenerCarrito: obtener,
          guardarCarrito: async (items, token, importar) => {
            if (!importar || !servidor.items.length) servidor.items = items;
            return obtener();
          },
        } };
      }
      return {};
    },
    localStorage: { getItem: clave => almacenamiento.get(clave), setItem: (clave, valor) => almacenamiento.set(clave, valor), removeItem: clave => almacenamiento.delete(clave) },
    Event: class Event {},
    window: { dispatchEvent() {}, confirm: () => true, setInterval: callback => { intervalos.add(callback); return callback; },
      clearInterval: callback => intervalos.delete(callback), addEventListener() {}, removeEventListener() {} },
  });
  function render() {
    indice = 0;
    const hook = exports.default(1, 'token', idNegocio);
    pendientes.splice(0).forEach(callback => callback());
    return hook;
  }
  return { render, intervalos, almacenamiento };
}

const producto = { idProducto: 3, idNegocio: 2, version: 1, nombre: 'Producto', precioBase: '10.00', stock: 5, imagenes: [] };
const esperar = () => new Promise(resolve => setImmediate(resolve));

test('confirmar vacía el carrito solo al tener éxito y bloquea un segundo envío simultáneo', async () => {
  const servidor = { items: [{ idProducto: 3, version: 1, cantidad: 1 }] };
  const prueba = carritoPrueba(null, new Map([[3, 1]]), 1, servidor);
  prueba.render();
  await esperar();
  const estado = prueba.render();
  const promesa = estado.confirmar({ total: '10.00' });
  await assert.rejects(estado.confirmar({ total: '10.00' }), /actualizarse/);
  assert.equal((await promesa).idPedido, 42);
  assert.equal(servidor.confirmaciones, 1);
  assert.equal(prueba.render().carrito, null);
  assert.equal(prueba.render().procesando, false);
});

test('si falla el checkout conserva el carrito y permite reintentar', async () => {
  const servidor = { items: [{ idProducto: 3, version: 1, cantidad: 1 }], errorCheckout: true };
  const prueba = carritoPrueba(null, new Map([[3, 1]]), 1, servidor);
  prueba.render();
  await esperar();
  await assert.rejects(prueba.render().confirmar({ total: '10.00' }), /Stock insuficiente/);
  assert.equal(prueba.render().carrito.items.length, 1);
  assert.equal(prueba.render().procesando, false);
  servidor.errorCheckout = false;
  assert.equal((await prueba.render().confirmar({ total: '10.00' })).idPedido, 42);
});

test('no permite agregar productos del negocio propio', () => {
  const prueba = carritoPrueba(null, new Map([[3, 1]]), 2);
  prueba.render().agregar(producto, 1);
  const hook = prueba.render();
  assert.equal(hook.carrito, null);
  assert.match(hook.avisoCarrito, /propio negocio/);
});

test('descarta carritos guardados del negocio propio', async () => {
  const prueba = carritoPrueba({ idNegocio: 2, nombreNegocio: 'Propio', items: [{ ...producto, cantidad: 1 }] }, new Map([[3, 1]]), 2);
  prueba.render();
  await esperar();
  assert.equal(prueba.render().carrito, null);
  assert.equal(prueba.almacenamiento.has('bulkmarket-carrito-1'), false);
});

test('agregar y editar cantidades respeta stock y cantidades enteras', async () => {
  const prueba = carritoPrueba(null, new Map([[3, 1]]));
  prueba.render();
  await esperar();
  await prueba.render().agregar(producto, 4);
  await prueba.render().agregar(producto, 4);
  let hook = prueba.render();
  assert.equal(hook.carrito.items[0].cantidad, 5);
  await hook.actualizarCantidad(3, 2.5);
  assert.equal(prueba.render().carrito.items[0].cantidad, 2);
});

test('editar un producto lo elimina del carrito conectado', async () => {
  const versiones = new Map([[3, 1]]);
  const prueba = carritoPrueba(null, versiones);
  prueba.render();
  await esperar();
  await prueba.render().agregar(producto, 2);
  versiones.set(3, 2);
  await Promise.all([...prueba.intervalos].map(callback => callback()));
  const hook = prueba.render();
  assert.equal(hook.carrito, null);
  assert.match(hook.avisoCarrito, /retirados o modificados/);
  assert.equal(prueba.almacenamiento.has('bulkmarket-carrito-1'), false);
});

test('volver a agregar una nueva versión no conserva cantidades ni precios de la anterior', async () => {
  const versiones = new Map([[3, 1]]);
  const prueba = carritoPrueba(null, versiones);
  prueba.render();
  await esperar();
  await prueba.render().agregar(producto, 4);
  versiones.set(3, 2);
  await prueba.render().agregar({ ...producto, version: 2, precioBase: '20.00' }, 1);
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

test('el carrito guardado se recupera en otro dispositivo', async () => {
  const servidor = { items: [] };
  const versiones = new Map([[3, 1]]);
  const primero = carritoPrueba(null, versiones, 1, servidor);
  primero.render(); await esperar();
  await primero.render().agregar(producto, 3);
  const segundo = carritoPrueba(null, versiones, 1, servidor);
  segundo.render(); await esperar();
  assert.equal(segundo.render().carrito.items[0].cantidad, 3);
});

test('un carrito local antiguo no reemplaza el carrito del servidor', async () => {
  const servidor = { items: [{ idProducto: 3, version: 1, cantidad: 4 }] };
  const local = { idNegocio: 2, items: [{ ...producto, cantidad: 1 }] };
  const prueba = carritoPrueba(local, new Map([[3, 1]]), 1, servidor);
  prueba.render(); await esperar();
  assert.equal(prueba.render().carrito.items[0].cantidad, 4);
  assert.equal(prueba.almacenamiento.size, 0);
});

test('agregar respeta el mínimo de unidades y bloquea stock insuficiente', async () => {
  const prueba = carritoPrueba(null, new Map([[3, 1]]));
  prueba.render(); await esperar();
  await prueba.render().agregar({ ...producto, cantidadMinimaCompra: 3 }, 1);
  assert.equal(prueba.render().carrito.items[0].cantidad, 3);
  await prueba.render().actualizarCantidad(3, 1);
  assert.equal(prueba.render().carrito.items[0].cantidad, 3);
  assert.equal(await prueba.render().agregar({ ...producto, cantidadMinimaCompra: 6 }, 6), false);
});
