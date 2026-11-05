/**
 * Pruebas de reclamos con un manager simulado: quién puede reclamar, estado, plazo,
 * productos y cantidades, nota de crédito, rechazo con motivo y devolución de stock.
 * Se importan archivos compilados de dist: ejecutar mediante npm test o compilar antes.
 */

require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PedidosService } = require('../dist/products/orders.service');

const DIA = 86400000;
const items = [
  {
    idProducto: 1,
    nombre: 'Malbec',
    cantidad: 10,
    precioUnitario: '12.50',
    subtotal: '125.00',
  },
  {
    idProducto: 2,
    nombre: 'Queso',
    cantidad: 3,
    precioUnitario: '7.00',
    subtotal: '21.00',
  },
];

// Comprador = negocio 1, vendedor = negocio 2, suborden 5.
function escenario({
  estado = 'ENTREGADA',
  entregadaEn = new Date(),
  diasReclamo = 7,
} = {}) {
  const datos = {
    suborden: {
      idSuborden: 5,
      idNegocioComprador: 1,
      idNegocioVendedor: 2,
      estado,
      entregadaEn,
      items,
    },
    reclamos: [],
    stock: [],
  };
  const manager = {
    getRepository: (entidad) =>
      ({
        RelojSorteos: { findOneBy: async () => null },
        Suborden: {
          findOne: async ({ where }) =>
            where.idSuborden === datos.suborden.idSuborden ? datos.suborden : null,
        },
        Negocio: { findOne: async () => ({ idNegocio: 2, diasReclamo }) },
        Reclamo: {
          findBy: async ({ idSuborden }) =>
            datos.reclamos.filter((r) => r.idSuborden === idSuborden),
          findOne: async ({ where }) =>
            datos.reclamos.find((r) => r.idReclamo === where.idReclamo) ?? null,
          create: (valor) => ({ estado: 'PENDIENTE', ...valor }),
          save: async (reclamo) => {
            if (!reclamo.idReclamo) {
              reclamo.idReclamo = datos.reclamos.length + 1;
              datos.reclamos.push(reclamo);
            }
            return reclamo;
          },
        },
      })[entidad.name],
    query: async (_sql, [cantidad, idProducto]) =>
      datos.stock.push({ idProducto, cantidad }),
  };
  const servicio = new PedidosService({ transaction: (fn) => fn(manager) });
  return { datos, servicio };
}

const reclamo = { items: [{ idProducto: 1, cantidad: 3 }], motivo: 'Llegaron rotas' };

test('el comprador reclama una suborden entregada y la nota usa el precio pagado', async () => {
  const { servicio } = escenario();
  const creado = await servicio.crearReclamo(5, 1, {
    items: [
      { idProducto: 1, cantidad: 4 },
      { idProducto: 2, cantidad: 1 },
    ],
    motivo: 'Llegaron rotas',
  });
  assert.equal(creado.estado, 'PENDIENTE');
  assert.equal(creado.importe, '57.00');
  assert.deepEqual(
    creado.items.map((i) => [i.nombre, i.cantidad, i.subtotal]),
    [
      ['Malbec', 4, '50.00'],
      ['Queso', 1, '7.00'],
    ],
  );
  assert.equal(creado.idNegocioVendedor, 2);
});

test('solo el comprador de una suborden entregada puede reclamar', async () => {
  await assert.rejects(escenario().servicio.crearReclamo(5, 2, reclamo), /no encontrado/);
  await assert.rejects(escenario().servicio.crearReclamo(9, 1, reclamo), /no encontrado/);
  await assert.rejects(
    escenario({ estado: 'ENVIADA' }).servicio.crearReclamo(5, 1, reclamo),
    /entregadas/,
  );
});

test('el plazo depende de los días que configuró el vendedor', async () => {
  const haceOcho = new Date(Date.now() - 8 * DIA);
  await assert.rejects(
    escenario({ entregadaEn: haceOcho }).servicio.crearReclamo(5, 1, reclamo),
    /Venció el plazo/,
  );
  const conTreinta = escenario({ entregadaEn: haceOcho, diasReclamo: 30 });
  await conTreinta.servicio.crearReclamo(5, 1, reclamo);
  await assert.rejects(
    escenario({ entregadaEn: null }).servicio.crearReclamo(5, 1, reclamo),
    /fecha de entrega/,
  );
});

test('no se reclaman productos ajenos ni más unidades de las compradas', async () => {
  const { servicio } = escenario();
  await assert.rejects(
    servicio.crearReclamo(5, 1, { items: [{ idProducto: 9, cantidad: 1 }], motivo: 'x' }),
    /no es de esta compra/,
  );
  await assert.rejects(
    servicio.crearReclamo(5, 1, {
      items: [{ idProducto: 1, cantidad: 11 }],
      motivo: 'x',
    }),
    /como máximo 10/,
  );
  await servicio.crearReclamo(5, 1, {
    items: [{ idProducto: 1, cantidad: 8 }],
    motivo: 'x',
  });
  await assert.rejects(
    servicio.crearReclamo(5, 1, { items: [{ idProducto: 1, cantidad: 3 }], motivo: 'x' }),
    /como máximo 2/,
  );
});

test('aprobar genera la nota de crédito y el stock vuelve recién al recibir', async () => {
  const { datos, servicio } = escenario();
  await servicio.crearReclamo(5, 1, reclamo);
  await assert.rejects(servicio.confirmarRecepcionReclamo(1, 2), /aprobado/);
  const aprobado = await servicio.aprobarReclamo(1, 2);
  assert.equal(aprobado.estado, 'APROBADO');
  assert.equal(aprobado.notaCredito, 'NC-0001-00000001');
  assert.deepEqual(datos.stock, []);
  const recibido = await servicio.confirmarRecepcionReclamo(1, 2);
  assert.equal(recibido.estado, 'RECIBIDO');
  assert.deepEqual(datos.stock, [{ idProducto: 1, cantidad: 3 }]);
  assert.equal(datos.suborden.estado, 'ENTREGADA');
  await assert.rejects(servicio.confirmarRecepcionReclamo(1, 2), /aprobado/);
});

test('rechazar guarda el motivo, no toca stock y libera las unidades', async () => {
  const { datos, servicio } = escenario();
  await servicio.crearReclamo(5, 1, {
    items: [{ idProducto: 1, cantidad: 10 }],
    motivo: 'x',
  });
  const rechazado = await servicio.rechazarReclamo(1, 2, 'Llegaron en buen estado');
  assert.equal(rechazado.estado, 'RECHAZADO');
  assert.equal(rechazado.motivoRechazo, 'Llegaron en buen estado');
  assert.equal(rechazado.notaCredito, undefined);
  assert.deepEqual(datos.stock, []);
  assert.equal(datos.suborden.estado, 'ENTREGADA');
  await assert.rejects(servicio.aprobarReclamo(1, 2), /ya fue respondido/);
  // Un reclamo rechazado no consume unidades: se pueden volver a reclamar.
  await servicio.crearReclamo(5, 1, {
    items: [{ idProducto: 1, cantidad: 10 }],
    motivo: 'y',
  });
});

test('solo el vendedor de la suborden resuelve el reclamo', async () => {
  const { servicio } = escenario();
  await servicio.crearReclamo(5, 1, reclamo);
  await assert.rejects(servicio.aprobarReclamo(1, 1), /Reclamo no encontrado/);
  await assert.rejects(servicio.rechazarReclamo(1, 3, 'no'), /Reclamo no encontrado/);
});
