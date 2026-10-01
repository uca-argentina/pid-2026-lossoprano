require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PedidosService } = require('../dist/products/orders.service');

function escenario() {
  let estado = { stock: 10, carrito: [{ idProducto: 1, version: 1, cantidad: 3 }], pedidos: [] };
  const producto = { idProducto: 1, version: 1, idNegocio: 2, nombre: 'Producto', precioBase: '10.00' };
  const manager = {
    getRepository: entidad => ({
      Cliente: { findOne: async () => ({ idCliente: 1, idNegocio: 1 }) },
      CarritoItem: { find: async () => estado.carrito, delete: async () => { estado.carrito = []; } },
      Producto: { findOne: async () => ({ ...producto, stock: estado.stock }) },
      PrecioEscalonado: { findBy: async () => [{ cantidadMinima: 3, precioUnitario: '8.00' }] },
      Negocio: { findOne: async () => ({ montoMinimoOrden: '0.00' }) },
      Pedido: {
        findOneBy: async ({ claveConfirmacion }) => estado.pedidos.find(p => p.claveConfirmacion === claveConfirmacion),
        create: datos => datos,
        save: async datos => { if (estado.fallarGuardado) throw new Error('Fallo de escritura'); const pedido = { ...datos, idPedido: 1 }; estado.pedidos.push(pedido); return pedido; },
      },
    }[entidad.name]),
    query: async (_, [cantidad]) => { estado.stock -= cantidad; },
  };
  const servicio = new PedidosService({ transaction: async callback => {
    const antes = structuredClone(estado);
    try { return await callback(manager); } catch (error) { estado = antes; throw error; }
  } });
  return { servicio, estado: () => estado, producto, dto: { items: [...estado.carrito], direccionEntrega: 'Calle 123', condicionPago: 'CONTADO', claveConfirmacion: 'clave', total: '24.00' } };
}

test('checkout guarda entrega, pago y precio escalonado; descuenta una sola vez ante reintentos', async () => {
  const e = escenario();
  const pedido = await e.servicio.confirmar(1, e.dto);
  assert.equal(pedido.direccionEntrega, 'Calle 123');
  assert.equal(pedido.condicionPago, 'CONTADO');
  assert.equal(pedido.items[0].precioUnitario, '8.00');
  assert.equal(e.estado().stock, 7);
  assert.equal(e.estado().carrito.length, 0);
  assert.equal((await e.servicio.confirmar(1, e.dto)).idPedido, pedido.idPedido);
  assert.equal(e.estado().stock, 7);
  assert.equal(e.estado().pedidos.length, 1);
});

test('checkout rechaza stock insuficiente, versión vieja, precio distinto y productos propios', async () => {
  for (const alterar of [e => { e.estado().stock = 2; }, e => { e.producto.version = 2; }, e => { e.dto.total = '1.00'; }, e => { e.producto.idNegocio = 1; }, e => { e.dto.items = []; }]) {
    const e = escenario(); alterar(e);
    const antes = structuredClone(e.estado());
    await assert.rejects(e.servicio.confirmar(1, e.dto), error => error.getStatus() === 409);
    assert.deepEqual(e.estado(), antes);
  }
});

test('un fallo al guardar el pedido revierte el descuento y conserva el carrito', async () => {
  const e = escenario();
  e.estado().fallarGuardado = true;
  await assert.rejects(e.servicio.confirmar(1, e.dto), /Fallo de escritura/);
  assert.equal(e.estado().stock, 10);
  assert.equal(e.estado().carrito.length, 1);
  assert.equal(e.estado().pedidos.length, 0);
});
