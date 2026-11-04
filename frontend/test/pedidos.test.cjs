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

function cargar(archivo, modulos, globals = {}) {
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
    isNaN,
    parseFloat,
    ...globals,
  });
  return exports;
}

async function pantalla(tipo = 'compras') {
  const suborden = {
    idSuborden: 1,
    idPedido: 1,
    nombreComprador: 'Comercio',
    nombreVendedor: 'Marca A',
    estado: 'ENVIADA',
    total: '10.00',
    items: [{ idProducto: 1, nombre: 'Producto activo', cantidad: 1, subtotal: '10.00' }],
    direccionEntrega: 'Calle 123',
    condicionPago: 'CONTADO',
    creadoEn: '2026-10-12T12:00:00Z',
    actualizadoEn: '2026-10-14T12:00:00Z',
  };
  const datos = [
    {
      idPedido: 1,
      estado: 'EN_CURSO',
      total: '10.00',
      creadoEn: suborden.creadoEn,
      subordenes: [suborden],
    },
    {
      idPedido: 2,
      estado: 'COMPLETADA',
      total: '20.00',
      creadoEn: suborden.creadoEn,
      subordenes: [
        {
          ...suborden,
          idSuborden: 2,
          idPedido: 2,
          nombreVendedor: 'Marca B',
          estado: 'CANCELADA',
          total: '20.00',
        },
      ],
    },
  ];
  const estadosVenta = [
    'PENDIENTE',
    'CONFIRMADA',
    'PREPARADA',
    'ENVIADA',
    'ENTREGADA',
    'RECHAZADA',
    'CANCELADA',
  ];
  const ventas = estadosVenta.map((estado, i) => ({
    ...suborden,
    idSuborden: 101 + i,
    estado,
    nombreComprador: `Cliente venta ${estado}`,
    items: [{ ...suborden.items[0], nombre: 'Producto vendido' }],
  }));
  const estados = [];
  let indice = 0;
  let efecto;
  let consultasCompras = 0;
  let consultasVentas = 0;
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
      efecto ??= callback;
    },
  };
  const componente = cargar(
    'Pedidos.tsx',
    {
      react,
      'react/jsx-runtime': jsx,
      './utils': cargar('utils.ts', {}),
      './api': {
        api: {
          misCompras: async () => {
            consultasCompras++;
            return datos;
          },
          misVentas: async () => {
            consultasVentas++;
            return ventas;
          },
          cambiarEstadoSuborden: async (id, estado) => {
            const venta = ventas.find((s) => s.idSuborden === id);
            venta.estado = estado;
            return venta;
          },
        },
      },
    },
    { window: { confirm: () => true, dispatchEvent() {} }, Event },
  ).default;
  function render() {
    indice = 0;
    return componente({ token: 'token', tipo });
  }
  function boton(nodo, texto) {
    if (!nodo || typeof nodo !== 'object') return;
    if (nodo.type === 'button' && nodo.props.children === texto) return nodo;
    for (const hijo of [nodo.props?.children].flat(Infinity)) {
      const encontrado = boton(hijo, texto);
      if (encontrado) return encontrado;
    }
  }
  render();
  efecto();
  await new Promise((resolve) => setImmediate(resolve));
  return {
    datos,
    ventas,
    html: () => renderToStaticMarkup(render()),
    consultasCompras: () => consultasCompras,
    consultasVentas: () => consultasVentas,
    click: (texto) => {
      const accion = boton(render(), texto);
      assert.ok(accion, texto);
      return accion.props.onClick();
    },
  };
}

test('Mis Compras consulta solo compras y conserva seguimiento e historial con sus detalles', async () => {
  const p = await pantalla();
  assert.match(p.html(), /Pedido #1/);
  assert.match(p.html(), /En curso/);
  assert.doesNotMatch(p.html(), /Pedido #2|Pedidos recibidos|Marcar entregada/);
  assert.equal(p.consultasVentas(), 0);
  assert.equal(p.consultasCompras(), 1);
  assert.match(p.html(), /MIS COMPRAS/);
  p.click('Historial');
  assert.match(p.html(), /Pedido #2/);
  assert.match(p.html(), /Completada/);
  assert.match(p.html(), /Cancelada/);
  assert.match(p.html(), /Calle 123/);
  assert.doesNotMatch(p.html(), /Pedido #1/);
});

test('al actualizar, la orden completada deja seguimiento y aparece en historial', async () => {
  const p = await pantalla();
  p.datos[0].estado = 'COMPLETADA';
  p.datos[0].subordenes[0].estado = 'ENTREGADA';
  p.click('Actualizar pedidos');
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(p.html(), /No tenés compras en curso/);
  assert.doesNotMatch(p.html(), /Pedido #1/);
  p.click('Historial');
  assert.match(p.html(), /Pedido #1/);
  assert.match(p.html(), /Entregada/);
});

test('Pedidos muestra solo ventas activas y su historial reúne entregadas, rechazadas y canceladas', async () => {
  const p = await pantalla('ventas');
  assert.match(p.html(), /Pedidos recibidos/);
  for (const estado of ['PENDIENTE', 'CONFIRMADA', 'PREPARADA', 'ENVIADA'])
    assert.match(p.html(), new RegExp(`Cliente venta ${estado}`));
  for (const estado of ['ENTREGADA', 'RECHAZADA', 'CANCELADA'])
    assert.doesNotMatch(p.html(), new RegExp(`Cliente venta ${estado}`));
  assert.match(p.html(), /Marcar entregada/);
  assert.equal(p.consultasCompras(), 0);
  assert.equal(p.consultasVentas(), 1);
  assert.doesNotMatch(p.html(), /Producto activo|Seguimiento/);
  p.click('Historial');
  for (const estado of ['ENTREGADA', 'RECHAZADA', 'CANCELADA'])
    assert.match(p.html(), new RegExp(`Cliente venta ${estado}`));
  for (const estado of ['PENDIENTE', 'CONFIRMADA', 'PREPARADA', 'ENVIADA'])
    assert.doesNotMatch(p.html(), new RegExp(`Cliente venta ${estado}`));
  assert.doesNotMatch(
    p.html(),
    /<button[^>]*>(Confirmar|Rechazar|Marcar entregada|Cancelar)<\/button>/,
  );
});

test('entregar una venta la mueve de recibidos a historial al recargar y no consulta compras', async () => {
  const p = await pantalla('ventas');
  await p.click('Marcar entregada');
  assert.doesNotMatch(p.html(), /Orden #104/);
  p.click('Historial');
  assert.match(p.html(), /Orden #104/);
  assert.equal(p.ventas.find((s) => s.idSuborden === 104).estado, 'ENTREGADA');
  assert.equal(p.consultasCompras(), 0);
  assert.equal(p.consultasVentas(), 2);
});

test('rechazar una venta la mueve a su historial y conserva las otras ventas activas', async () => {
  const p = await pantalla('ventas');
  await p.click('Rechazar');
  assert.doesNotMatch(p.html(), /Orden #101/);
  assert.match(p.html(), /Orden #102/);
  p.click('Historial');
  assert.match(p.html(), /Orden #101/);
  assert.equal(p.ventas.find((s) => s.idSuborden === 101).estado, 'RECHAZADA');
});

for (const rol of ['COMPRADOR', 'VENDEDOR']) {
  test(`la navegación de ${rol} muestra Mis Compras y reserva Pedidos para vendedores`, () => {
    const react = require('react');
    const App = cargar(
      'App.tsx',
      {
        react,
        'react/jsx-runtime': jsx,
        './api': { api: {} },
        './Comprador': { default: () => null },
        './CrearProducto': { default: () => null },
        './useCarrito': { default: () => ({ carrito: null }) },
        './PanelCarrito': { default: () => null },
        './Pedidos': { default: () => null },
        './Dashboard': { default: () => null },
      },
      {
        localStorage: {
          getItem: () =>
            JSON.stringify({
              accessToken: 'token',
              cliente: { idCliente: 1, rol },
              negocio: {
                idNegocio: 1,
                nombreComercial: 'Negocio',
                razonSocial: 'Negocio',
                identificacionFiscal: '12345678901',
                telefono: '1234567890',
                direccion: 'Calle 123',
              },
            }),
        },
      },
    ).default;
    const html = renderToStaticMarkup(react.createElement(App));
    assert.match(html, /<button[^>]*>Mis Compras<\/button>/);
    if (rol === 'VENDEDOR') assert.match(html, /<button[^>]*>Pedidos<\/button>/);
    else assert.doesNotMatch(html, /<button[^>]*>Pedidos<\/button>/);
    assert.match(html, /<button[^>]*>Sorteos<\/button>/);
    if (rol === 'VENDEDOR') assert.match(html, /<button[^>]*>Dashboard<\/button>/);
    else assert.doesNotMatch(html, /<button[^>]*>Dashboard<\/button>/);
  });
}
