require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ProductosService } = require('../dist/products/products.service');
const { ProductosController } = require('../dist/products/products.controller');
const { ROLES_KEY } = require('../dist/auth/roles.decorator');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const { ValidarCarritoDto } = require('../dist/products/dto/validar-carrito.dto');
const { GuardarCarritoDto } = require('../dist/products/dto/guardar-carrito.dto');
const { CrearProductoDto } = require('../dist/products/dto/crear-producto.dto');
const { ActualizarNegocioDto } = require('../dist/business/dto/update-business.dto');
const { NegociosController } = require('../dist/business/business.controller');

const datos = { nombre: 'Producto', descripcion: 'Descripción', categoria: 'Categoría', stock: 3, precioBase: 12.5 };

function transaccional(repo) {
  repo.manager = { transaction: callback => callback({ getRepository: entidad =>
    entidad.name === 'Producto' ? repo : { delete: async () => ({ affected: 1 }) },
  }) };
  return repo;
}

test('explorar excluye el negocio autenticado incluso con filtros', async () => {
  const condiciones = [];
  const consulta = {
    leftJoinAndSelect() { return this; },
    where(sql, parametros) { condiciones.push({ sql, parametros }); return this; },
    andWhere(sql, parametros) { condiciones.push({ sql, parametros }); return this; },
    orderBy() { return this; }, take() { return this; }, skip() { return this; },
    getMany: async () => [],
  };
  const service = new ProductosService({ createQueryBuilder: () => consulta });
  await service.buscar({ q: 'Producto', categoria: 'Bebidas', idNegocio: 7 }, 7);
  assert.deepEqual(condiciones[0], {
    sql: 'producto.idNegocio <> :idNegocioActual', parametros: { idNegocioActual: 7 },
  });
  assert.equal(condiciones.length, 4);
});

test('editar se limita al negocio autenticado y conserva imágenes si no hay reemplazo', async () => {
  let cambio;
  const service = new ProductosService(transaccional({
    update: async (where, values) => { cambio = { where, values }; return { affected: 1 }; },
    findOneOrFail: async () => ({ idProducto: 4, version: 2 }),
  }));
  const resultado = await service.actualizar(4, 7, datos);
  assert.deepEqual(cambio.where, { idProducto: 4, idNegocio: 7 });
  assert.equal(cambio.values.precioBase, '12.50');
  assert.equal('imagenes' in cambio.values, false);
  assert.equal(resultado.version, 2);
  await service.actualizar(4, 7, datos, ['/uploads/productos/nueva.png']);
  assert.deepEqual(cambio.values.imagenes, ['/uploads/productos/nueva.png']);
});

test('editar y borrar rechazan productos de otro negocio o inexistentes', async () => {
  const service = new ProductosService(transaccional({ update: async () => ({ affected: 0 }), delete: async where => {
    assert.deepEqual(where, { idProducto: 4, idNegocio: 7 });
    return { affected: 0 };
  } }));
  await assert.rejects(service.actualizar(4, 7, datos), error => error.getStatus() === 404);
  await assert.rejects(service.eliminar(4, 7), error => error.getStatus() === 404);
});

test('el carrito conserva solamente productos existentes con la misma versión', async () => {
  const service = new ProductosService({ findBy: async () => [
    { idProducto: 1, idNegocio: 7, version: 2 }, { idProducto: 2, idNegocio: 7, version: 3 },
  ] });
  assert.deepEqual(await service.validarCarrito({ items: [
    { idProducto: 1, version: 2 }, { idProducto: 2, version: 2 }, { idProducto: 3, version: 1 },
  ] }, 9), [1]);
  assert.deepEqual(await service.validarCarrito({ items: [{ idProducto: 1, version: 2 }] }, 7), []);
  assert.deepEqual(await service.validarCarrito({ items: [] }, 9), []);
});

test('los endpoints de edición y borrado requieren rol vendedor', () => {
  for (const metodo of ['actualizar', 'eliminar']) {
    assert.deepEqual(Reflect.getMetadata(ROLES_KEY, ProductosController.prototype[metodo]), ['VENDEDOR']);
  }
});

test('validar carrito rechaza IDs y versiones inválidos', () => {
  for (const items of [[{ idProducto: 1, version: 0 }], [{ idProducto: 1.5, version: 1 }], [{ idProducto: 1 }]]) {
    assert(validateSync(plainToInstance(ValidarCarritoDto, { items })).length > 0);
  }
  assert.equal(validateSync(plainToInstance(ValidarCarritoDto, { items: [{ idProducto: 1, version: 1 }] })).length, 0);
});

test('guardar carrito exige cantidades enteras positivas y productos sin duplicados', () => {
  for (const items of [
    [{ idProducto: 1, version: 1, cantidad: 1.5 }],
    [{ idProducto: 1, version: 1, cantidad: 0 }],
    [{ idProducto: 1, version: 1, cantidad: 1 }, { idProducto: 1, version: 1, cantidad: 2 }],
  ]) assert(validateSync(plainToInstance(GuardarCarritoDto, { items })).length > 0);
  assert.equal(validateSync(plainToInstance(GuardarCarritoDto, { items: [] })).length, 0);
});

test('la cantidad mínima es opcional y solo acepta enteros positivos', () => {
  for (const minimo of ['', null, undefined, '3']) {
    const dto = plainToInstance(CrearProductoDto, { ...datos, cantidadMinimaCompra: minimo });
    assert.equal(validateSync(dto).length, 0);
  }
  for (const minimo of [0, -1, 1.5, 'abc']) {
    assert(validateSync(plainToInstance(CrearProductoDto, { ...datos, cantidadMinimaCompra: minimo })).length > 0);
  }
});

test('monto mínimo acepta cero y dos decimales, rechaza valores inválidos', () => {
  for (const monto of [0, 50, '123.45']) assert.equal(validateSync(plainToInstance(ActualizarNegocioDto, { montoMinimoOrden: monto })).length, 0);
  for (const monto of [-1, 0.001, null, 'abc']) assert(validateSync(plainToInstance(ActualizarNegocioDto, { montoMinimoOrden: monto })).length > 0);
});

test('solo vendedores pueden configurar el monto mínimo', () => {
  const controller = new NegociosController({ actualizar: (id, dto) => ({ id, ...dto }) });
  assert.throws(() => controller.actualizarElMio({ user: { idNegocio: 1, rol: 'COMPRADOR' } }, { montoMinimoOrden: 50 }), e => e.getStatus() === 403);
  assert.equal(controller.actualizarElMio({ user: { idNegocio: 1, rol: 'VENDEDOR' } }, { montoMinimoOrden: 50 }).montoMinimoOrden, 50);
});
