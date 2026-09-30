const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('consultar y vaciar el carrito acepta JSON null y respuestas vacías', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/api.ts'), 'utf8')
    .replace('import.meta.env.VITE_API_URL', 'undefined');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const cuerpo of ['', 'null']) {
    const exports = {};
    vm.runInNewContext(compiled, { exports, URLSearchParams, fetch: async () => new Response(cuerpo, { status: 200 }) });
    assert.equal(await exports.api.obtenerCarrito('token'), null);
    assert.equal(await exports.api.guardarCarrito([], 'token'), null);
  }
});

test('editar cantidad permite pasar de 10 a 30 sin guardar el 3 intermedio', async () => {
  const estados = [];
  let indice = 0;
  const react = {
    useState(inicial) {
      const i = indice++;
      if (!(i in estados)) estados[i] = inicial;
      return [estados[i], valor => { estados[i] = valor; }];
    },
    useRef(inicial) {
      const i = indice++;
      if (!(i in estados)) estados[i] = { current: inicial };
      return estados[i];
    },
    useEffect() {},
  };
  function cargar(archivo, modulos) {
    const exports = {};
    const source = fs.readFileSync(path.join(__dirname, '../src', archivo), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    vm.runInNewContext(compiled, { exports, require: nombre => modulos[nombre] ?? {} });
    return exports;
  }
  const carrito = cargar('useCarrito.ts', { react });
  const componente = cargar('CantidadCarrito.tsx', {
    react, './useCarrito': carrito, 'react/jsx-runtime': { jsx: (tipo, props) => ({ tipo, props }), jsxs: (tipo, props) => ({ tipo, props }) },
  }).default;
  const guardados = [];
  const item = { idProducto: 1, nombre: 'Producto', cantidad: 10, stock: 100, cantidadMinimaCompra: 10 };
  function render(flecha = false) {
    indice = 0;
    const nodo = componente({ item, alGuardar: async cantidad => { guardados.push(cantidad); return true; } });
    return flecha ? nodo.props.children[1].props.children[0].props : nodo.props.children[0].props;
  }
  render().onFocus();
  render().onChange({ target: { value: '3' } });
  assert.equal(render().value, '3');
  assert.equal(guardados.length, 0);
  render().onChange({ target: { value: '30' } });
  render().onBlur();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(guardados, [30]);
  render().onKeyDown({ key: 'ArrowUp', preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(guardados, [30, 31]);
  render(true).onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(guardados, [30, 31, 32]);
});
