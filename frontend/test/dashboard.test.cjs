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
const { renderToStaticMarkup } = require('react-dom/server');
const jsx = require('react/jsx-runtime');

function cargar(archivo, modulos = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src', archivo), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require: (nombre) => modulos[nombre],
    Intl,
    Date,
    Math,
    Number,
    Map,
    Error,
    isNaN,
    parseFloat,
  });
  return exports;
}

const { resumirVentas } = cargar('resumenVentas.ts');
const hoy = new Date('2026-10-15T12:00:00Z');
const venta = (datos = {}) => ({
  estado: 'ENTREGADA',
  total: '12.50',
  actualizadoEn: '2026-10-10T12:00:00Z',
  creadoEn: '2026-09-25T12:00:00Z',
  items: [{ idProducto: 1, nombre: 'Arroz', cantidad: 5 }],
  ...datos,
});

test('sin ventas devuelve cero y doce meses consecutivos, incluso al cambiar de año', () => {
  const resumen = resumirVentas([], hoy);
  assert.equal(resumen.ventas, 0);
  assert.equal(resumen.montoTotal, '0.00');
  assert.equal(resumen.montoPromedio, '0.00');
  assert.equal(resumen.productos.length, 0);
  assert.equal(resumen.meses.length, 12);
  assert.equal(resumen.meses[0].mes, '2025-11');
  assert.equal(resumen.meses[11].mes, '2026-10');
  assert.ok(resumen.meses.every((mes) => mes.monto === '0.00' && mes.ventas === 0));
});

test('solo cuenta entregadas y calcula total y promedio por suborden', () => {
  const otras = [
    'PENDIENTE',
    'CONFIRMADA',
    'PREPARADA',
    'ENVIADA',
    'RECHAZADA',
    'CANCELADA',
  ];
  const resumen = resumirVentas(
    [
      venta(),
      venta({ total: '10.01' }),
      ...otras.map((estado) => venta({ estado, total: '999.00' })),
    ],
    hoy,
  );
  assert.equal(resumen.ventas, 2);
  assert.equal(resumen.montoTotal, '22.51');
  assert.equal(resumen.montoPromedio, '11.26');
  assert.equal(resumen.productos[0].unidades, 10);
});

test('el ranking agrupa por ID, conserva productos históricos y muestra solo cinco', () => {
  const items = Array.from({ length: 7 }, (_, i) => ({
    idProducto: i + 1,
    nombre: 'Producto',
    cantidad: i + 1,
  }));
  const resumen = resumirVentas(
    [
      venta({ items }),
      venta({ items: [{ idProducto: 1, nombre: 'Producto eliminado', cantidad: 10 }] }),
    ],
    hoy,
  );
  assert.equal(resumen.productos.length, 5);
  assert.equal(resumen.productos[0].idProducto, 1);
  assert.equal(resumen.productos[0].unidades, 11);
  assert.equal(resumen.productos[1].idProducto, 7);
});

test('los meses usan fecha de entrega en Argentina y el resumen conserva todo el historial', () => {
  const resumen = resumirVentas(
    [
      venta({ total: '10.00', actualizadoEn: '2026-10-01T01:00:00Z' }), // En Argentina todavía es septiembre.
      venta({ total: '20.00', actualizadoEn: '2026-10-01T04:00:00Z' }),
      venta({ total: '30.00', actualizadoEn: '2025-10-01T12:00:00Z' }),
    ],
    hoy,
  );
  assert.equal(resumen.meses[10].monto, '10.00');
  assert.equal(resumen.meses[11].monto, '20.00');
  assert.equal(resumen.meses[11].ventas, 1);
  assert.equal(resumen.montoTotal, '60.00');
  assert.equal(resumen.ventas, 3);
});

test('Dashboard carga solo ventas, muestra errores y permite reintentar', async () => {
  const estados = [];
  let indice = 0;
  let efecto;
  let falla = true;
  let consultas = 0;
  const react = {
    useState(inicial) {
      const i = indice++;
      if (!(i in estados)) estados[i] = inicial;
      return [
        estados[i],
        (valor) => {
          estados[i] = typeof valor === 'function' ? valor(estados[i]) : valor;
        },
      ];
    },
    useEffect(callback) {
      efecto = callback;
    },
  };
  const Dashboard = cargar('Dashboard.tsx', {
    react,
    'react/jsx-runtime': jsx,
    './resumenVentas': { resumirVentas },
    './utils': cargar('utils.ts'),
    './api': {
      api: {
        misVentas: async (token) => {
          consultas++;
          assert.equal(token, 'token-vendedor');
          if (falla) throw new Error('Sin conexión');
          return [];
        },
      },
    },
  }).default;
  function render() {
    indice = 0;
    return Dashboard({ token: 'token-vendedor' });
  }
  render();
  efecto();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(renderToStaticMarkup(render()), /Sin conexión/);
  falla = false;
  const pantalla = render();
  const contenido = pantalla.props.children[1];
  const botonActualizar = contenido.props.children[0].props.children[1];
  botonActualizar.props.onClick();
  assert.equal(estados[3], 1);
  render();
  efecto();
  await new Promise((resolve) => setImmediate(resolve));
  const html = renderToStaticMarkup(render());
  assert.doesNotMatch(html, /Sin conexión|NaN|Infinity/);
  assert.match(html, /Todavía no tenés ventas entregadas/);
  assert.match(html, /Monto promedio por venta|Evolución mensual|Productos más pedidos/);
  assert.equal(consultas, 2);
});
