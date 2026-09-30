require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const { Producto } = require('../dist/products/products.entity');
const { Negocio } = require('../dist/business/business.entity');
const { Cliente } = require('../dist/users/user.entity');
const { CarritoItem } = require('../dist/products/cart-item.entity');
const { CarritoService } = require('../dist/products/cart.service');
const { ProductosService } = require('../dist/products/products.service');

test('persistencia y reglas del carrito en PostgreSQL, con tablas temporales', async () => {
  const db = new DataSource({ type: 'postgres',
    url: process.env.TEST_DATABASE_URL ?? 'postgres://bulkmarket:bulkmarket@localhost:5432/bulkmarket',
    entities: [Producto, Negocio, Cliente, CarritoItem], synchronize: false });
  await db.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query('CREATE TEMP TABLE negocio (id_negocio serial PRIMARY KEY, razon_social varchar(150), nombre_comercial varchar(150), identificacion_fiscal varchar(50), telefono varchar(40), direccion varchar(255), monto_minimo_orden decimal(12,2) NOT NULL DEFAULT 0)');
    await runner.query('CREATE TEMP TABLE cliente (id_cliente serial PRIMARY KEY, id_negocio integer REFERENCES negocio(id_negocio) ON DELETE CASCADE, email varchar(180), password_hash varchar, rol varchar(20))');
    await runner.query('CREATE TEMP TABLE producto (id_producto serial PRIMARY KEY, id_negocio integer REFERENCES negocio(id_negocio) ON DELETE CASCADE, nombre varchar(150), descripcion text, categoria varchar(100), precio_base decimal(12,2), stock integer, cantidad_minima_compra integer, imagenes text[], version integer NOT NULL DEFAULT 1)');
    await runner.query('CREATE TEMP TABLE carrito_item (id_cliente integer REFERENCES cliente(id_cliente) ON DELETE CASCADE, id_producto integer REFERENCES producto(id_producto) ON DELETE CASCADE, cantidad integer CHECK (cantidad > 0), version integer, PRIMARY KEY(id_cliente, id_producto))');
    await runner.query("INSERT INTO negocio(id_negocio, nombre_comercial) VALUES (1, 'Comprador'), (2, 'Vendedor'), (3, 'Otro negocio')");
    await runner.query("INSERT INTO cliente(id_cliente,id_negocio,rol) VALUES (1,1,'COMPRADOR'),(2,3,'COMPRADOR'),(3,2,'VENDEDOR')");
    const carrito = new CarritoService({ manager: runner.manager, transaction: callback => runner.manager.transaction(callback) });
    const productos = new ProductosService(runner.manager.getRepository(Producto));
    const dto = { nombre: 'Prueba', descripcion: 'Descripción', categoria: 'Prueba', precioBase: 10, stock: 5 };
    const producto = await productos.crear(2, dto, ['/prueba.png']);
    const otro = await productos.crear(3, dto, ['/otra.png']);
    const item = { idProducto: producto.idProducto, version: producto.version, cantidad: 9 };
    const guardado = await carrito.guardar(1, { items: [item] });
    assert.equal(guardado.items[0].cantidad, 5);
    assert.equal(guardado.items[0].precioBase, '10.00');
    const otraSesion = new CarritoService({ manager: runner.manager });
    assert.equal((await otraSesion.obtener(1)).items[0].cantidad, 5);
    assert.equal(await carrito.obtener(2), null);
    const importado = await carrito.guardar(1, { items: [{ ...item, cantidad: 1 }], importar: true });
    assert.equal(importado.items[0].cantidad, 5);
    await assert.rejects(carrito.guardar(3, { items: [item] }), e => e.getStatus() === 400);
    await assert.rejects(carrito.guardar(1, { items: [item, { idProducto: otro.idProducto, version: otro.version, cantidad: 1 }] }), e => e.getStatus() === 400);
    assert.equal((await carrito.obtener(1)).items.length, 1);
    await carrito.guardar(2, { items: [item] });
    await productos.actualizar(producto.idProducto, 2, { ...dto, precioBase: 12 });
    assert.equal(await carrito.obtener(1), null);
    assert.equal(await carrito.obtener(2), null);
    assert.equal(await runner.manager.getRepository(CarritoItem).count(), 0);
    await carrito.guardar(1, { items: [item] });
    assert.equal(await carrito.obtener(1), null); // La versión vieja no se restaura.
    await carrito.guardar(1, { items: [{ ...item, version: 2 }] });
    await productos.eliminar(producto.idProducto, 2);
    assert.equal(await runner.manager.getRepository(CarritoItem).count(), 0);
    await carrito.guardar(1, { items: [{ idProducto: otro.idProducto, version: otro.version, cantidad: 1 }] });
    await carrito.guardar(1, { items: [] });
    assert.equal(await carrito.obtener(1), null);

    const minimoProducto = await productos.crear(2, { ...dto, cantidadMinimaCompra: 3 }, ['/minimo.png']);
    const linea = { idProducto: minimoProducto.idProducto, version: 1, cantidad: 3 };
    await assert.rejects(carrito.guardar(1, { items: [{ ...linea, cantidad: 2 }] }), e => e.getStatus() === 400);
    await runner.query('UPDATE negocio SET monto_minimo_orden = 50 WHERE id_negocio = 2');
    const incompleto = await carrito.guardar(1, { items: [linea] });
    assert.equal(incompleto.subtotal, '30.00');
    assert.equal(incompleto.faltanteMinimo, '20.00');
    assert.equal(incompleto.cumpleMinimos, false);
    const completo = await carrito.guardar(1, { items: [{ ...linea, cantidad: 5 }] });
    assert.equal(completo.faltanteMinimo, '0.00');
    assert.equal(completo.cumpleMinimos, true);
    await runner.query('UPDATE negocio SET monto_minimo_orden = 60 WHERE id_negocio = 2');
    assert.equal((await carrito.obtener(1)).faltanteMinimo, '10.00');
    assert.equal((await carrito.obtener(1)).items.length, 1);
    await productos.actualizar(minimoProducto.idProducto, 2, { ...dto, cantidadMinimaCompra: 4 });
    assert.equal(await carrito.obtener(1), null);
    const sinStock = await productos.crear(2, { ...dto, stock: 2, cantidadMinimaCompra: 3 }, ['/sin-stock.png']);
    assert.equal(await carrito.guardar(1, { items: [{ idProducto: sinStock.idProducto, version: 1, cantidad: 3 }] }), null);
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
    await db.destroy();
  }
});
