/**
 * Pruebas de regresión del backend con node:test.
 * Se importan archivos compilados de dist: ejecutar mediante npm test o compilar
 * antes.
 * Las pruebas de integración PostgreSQL usan tablas temporales y una transacción que
 * se revierte, según el montaje de esta suite.
 */

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
const { Categoria } = require('../dist/categories/category.entity');
const { PrecioEscalonado } = require('../dist/products/price-tier.entity');
const { CategoriasService } = require('../dist/categories/categories.service');
const { Pedido, Suborden } = require('../dist/products/order.entity');
const { PedidosService } = require('../dist/products/orders.service');
const { randomUUID } = require('node:crypto');
const { Sorteo } = require('../dist/sweepstakes/sweepstakes.entity');
const { SorteosService } = require('../dist/sweepstakes/sweepstakes.service');
const { periodoDe } = require('../dist/sweepstakes/sweepstakes.rules');
const { RelojSorteos } = require('../dist/sweepstakes/sweepstakes-clock');

test('persistencia y reglas del carrito en PostgreSQL, con tablas temporales', async () => {
  const db = new DataSource({
    type: 'postgres',
    url:
      process.env.TEST_DATABASE_URL ??
      'postgres://bulkmarket:bulkmarket@localhost:5432/bulkmarket',
    entities: [
      Producto,
      Negocio,
      Cliente,
      CarritoItem,
      Categoria,
      PrecioEscalonado,
      Pedido,
      Suborden,
      Sorteo,
      RelojSorteos,
    ],
    synchronize: false,
  });
  await db.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(
      'CREATE TEMP TABLE sorteo_reloj (id integer PRIMARY KEY, desfase_ms bigint NOT NULL DEFAULT 0)',
    );
    await runner.query(
      'CREATE TEMP TABLE sorteo (inicio timestamptz PRIMARY KEY, fin timestamptz NOT NULL, volumen numeric(24,2) NOT NULL, comisiones numeric(24,2) NOT NULL, premio numeric(24,2) NOT NULL, ingreso_plataforma numeric(24,2) NOT NULL, participantes jsonb NOT NULL, peso_total text NOT NULL, ganador jsonb, reglas jsonb NOT NULL, sorteado_en timestamptz DEFAULT now())',
    );
    await runner.query(
      'CREATE TEMP TABLE pedido (id_pedido serial PRIMARY KEY, id_cliente integer NOT NULL, id_negocio_comprador integer NOT NULL, clave_confirmacion uuid NOT NULL, total numeric(20,2) NOT NULL, creado_en timestamptz DEFAULT now(), UNIQUE(id_cliente, clave_confirmacion))',
    );
    await runner.query(
      `CREATE TEMP TABLE suborden (id_suborden serial PRIMARY KEY, id_pedido integer NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE, id_negocio_vendedor integer NOT NULL, nombre_vendedor varchar(150) NOT NULL, id_negocio_comprador integer NOT NULL, nombre_comprador varchar(150) NOT NULL, direccion_entrega varchar(255) NOT NULL, condicion_pago varchar(20) NOT NULL, estado varchar(20) NOT NULL DEFAULT 'PENDIENTE', items jsonb NOT NULL, total numeric(20,2) NOT NULL, creado_en timestamptz DEFAULT now(), actualizado_en timestamptz DEFAULT now())`,
    );
    await runner.query(
      'CREATE TEMP TABLE negocio (id_negocio serial PRIMARY KEY, razon_social varchar(150), nombre_comercial varchar(150), identificacion_fiscal varchar(50), telefono varchar(40), direccion varchar(255), monto_minimo_orden decimal(12,2) NOT NULL DEFAULT 0)',
    );
    await runner.query(
      'CREATE TEMP TABLE cliente (id_cliente serial PRIMARY KEY, id_negocio integer REFERENCES negocio(id_negocio) ON DELETE CASCADE, email varchar(180), password_hash varchar, rol varchar(20))',
    );
    await runner.query(
      'CREATE TEMP TABLE categoria (id_categoria serial PRIMARY KEY, nombre varchar(100) NOT NULL, clave varchar(100) NOT NULL, id_negocio integer REFERENCES negocio(id_negocio) ON DELETE CASCADE, UNIQUE (id_negocio, clave))',
    );
    await runner.query(
      'CREATE TEMP TABLE producto (id_producto serial PRIMARY KEY, id_negocio integer REFERENCES negocio(id_negocio) ON DELETE CASCADE, nombre varchar(150), descripcion text, id_categoria integer NOT NULL REFERENCES categoria(id_categoria), precio_base decimal(12,2), stock integer, cantidad_minima_compra integer, imagenes text[], version integer NOT NULL DEFAULT 1)',
    );
    await runner.query(
      'CREATE TEMP TABLE precio_escalonado (id_precio_escalonado serial PRIMARY KEY, id_producto integer NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE, cantidad_minima integer NOT NULL, precio_unitario decimal(12,2) NOT NULL, UNIQUE (id_producto, cantidad_minima))',
    );
    await runner.query(
      'CREATE TEMP TABLE carrito_item (id_cliente integer REFERENCES cliente(id_cliente) ON DELETE CASCADE, id_producto integer REFERENCES producto(id_producto) ON DELETE CASCADE, cantidad integer CHECK (cantidad > 0), version integer, PRIMARY KEY(id_cliente, id_producto))',
    );
    await runner.query(
      "INSERT INTO negocio(id_negocio, nombre_comercial) VALUES (1, 'Comprador'), (2, 'Vendedor'), (3, 'Otro negocio')",
    );
    await runner.query(
      "INSERT INTO cliente(id_cliente,id_negocio,rol) VALUES (1,1,'COMPRADOR'),(2,3,'COMPRADOR'),(3,2,'VENDEDOR')",
    );
    const carrito = new CarritoService({
      manager: runner.manager,
      transaction: (callback) => runner.manager.transaction(callback),
    });
    const productos = new ProductosService(runner.manager.getRepository(Producto));
    const categorias = new CategoriasService(runner.manager.getRepository(Categoria));
    await categorias.crearGenerales();
    const general = (await categorias.listarDisponibles(2)).find(
      (categoria) => categoria.nombre === 'Bebidas',
    );
    const dto = {
      nombre: 'Prueba',
      descripcion: 'Descripción',
      idCategoria: general.idCategoria,
      precioBase: 10,
      stock: 5,
    };
    const producto = await productos.crear(2, dto, ['/prueba.png']);
    const otro = await productos.crear(3, dto, ['/otra.png']);
    const item = {
      idProducto: producto.idProducto,
      version: producto.version,
      cantidad: 9,
    };
    const guardado = await carrito.guardar(1, { items: [item] });
    assert.equal(guardado.items[0].cantidad, 5);
    assert.equal(guardado.items[0].precioBase, '10.00');
    const otraSesion = new CarritoService({ manager: runner.manager });
    assert.equal((await otraSesion.obtener(1)).items[0].cantidad, 5);
    assert.equal(await carrito.obtener(2), null);
    const importado = await carrito.guardar(1, {
      items: [{ ...item, cantidad: 1 }],
      importar: true,
    });
    assert.equal(importado.items[0].cantidad, 5);
    await assert.rejects(
      carrito.guardar(3, { items: [item] }),
      (e) => e.getStatus() === 400,
    );
    // Un carrito puede combinar vendedores: cada uno lleva su propio subtotal.
    const mixto = await carrito.guardar(1, {
      items: [item, { idProducto: otro.idProducto, version: otro.version, cantidad: 1 }],
    });
    assert.deepEqual(
      mixto.vendedores.map((v) => [v.idNegocio, v.nombreNegocio, v.subtotal]),
      [
        [2, 'Vendedor', '50.00'],
        [3, 'Otro negocio', '10.00'],
      ],
    );
    assert.equal(mixto.subtotal, '60.00');
    assert.deepEqual(
      mixto.items.map((i) => i.idNegocio),
      [2, 3],
    );
    await assert.rejects(
      carrito.guardar(2, {
        items: [{ idProducto: otro.idProducto, version: otro.version, cantidad: 1 }],
      }),
      (e) => e.getStatus() === 400,
    );
    await carrito.guardar(1, { items: [item] });
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
    await carrito.guardar(1, {
      items: [{ idProducto: otro.idProducto, version: otro.version, cantidad: 1 }],
    });
    await carrito.guardar(1, { items: [] });
    assert.equal(await carrito.obtener(1), null);

    const minimoProducto = await productos.crear(2, { ...dto, cantidadMinimaCompra: 3 }, [
      '/minimo.png',
    ]);
    const linea = { idProducto: minimoProducto.idProducto, version: 1, cantidad: 3 };
    await assert.rejects(
      carrito.guardar(1, { items: [{ ...linea, cantidad: 2 }] }),
      (e) => e.getStatus() === 400,
    );
    await runner.query('UPDATE negocio SET monto_minimo_orden = 50 WHERE id_negocio = 2');
    const incompleto = await carrito.guardar(1, { items: [linea] });
    assert.equal(incompleto.subtotal, '30.00');
    assert.equal(incompleto.vendedores[0].faltanteMinimo, '20.00');
    assert.equal(incompleto.cumpleMinimos, false);
    const completo = await carrito.guardar(1, { items: [{ ...linea, cantidad: 5 }] });
    assert.equal(completo.vendedores[0].faltanteMinimo, '0.00');
    assert.equal(completo.cumpleMinimos, true);
    await runner.query('UPDATE negocio SET monto_minimo_orden = 60 WHERE id_negocio = 2');
    assert.equal((await carrito.obtener(1)).vendedores[0].faltanteMinimo, '10.00');
    assert.equal((await carrito.obtener(1)).items.length, 1);
    await productos.actualizar(minimoProducto.idProducto, 2, {
      ...dto,
      cantidadMinimaCompra: 4,
    });
    assert.equal(await carrito.obtener(1), null);
    const sinStock = await productos.crear(
      2,
      { ...dto, stock: 2, cantidadMinimaCompra: 3 },
      ['/sin-stock.png'],
    );
    assert.equal(
      await carrito.guardar(1, {
        items: [{ idProducto: sinStock.idProducto, version: 1, cantidad: 3 }],
      }),
      null,
    );

    // Precios escalonados: el precio unitario baja al alcanzar cada tramo.
    await runner.query('UPDATE negocio SET monto_minimo_orden = 0 WHERE id_negocio = 2');
    const escalonado = await productos.crear(
      2,
      {
        ...dto,
        stock: 100,
        preciosEscalonados: [
          { cantidadMinima: 50, precioUnitario: 8 },
          { cantidadMinima: 10, precioUnitario: 9 },
        ],
      },
      ['/escalonado.png'],
    );
    assert.deepEqual(
      escalonado.preciosEscalonados.map((t) => [t.cantidadMinima, t.precioUnitario]),
      [
        [10, '9.00'],
        [50, '8.00'],
      ],
    );
    const lineaEscalonada = {
      idProducto: escalonado.idProducto,
      version: escalonado.version,
    };
    for (const [cantidad, unitario, subtotal] of [
      [9, '10.00', '90.00'],
      [10, '9.00', '90.00'],
      [60, '8.00', '480.00'],
    ]) {
      const resultado = await carrito.guardar(1, {
        items: [{ ...lineaEscalonada, cantidad }],
      });
      assert.equal(resultado.items[0].precioUnitario, unitario);
      assert.equal(resultado.subtotal, subtotal);
    }
    // Checkout con dos vendedores: una orden general y una suborden independiente por vendedor.
    const pedidos = new PedidosService({
      transaction: (callback) => runner.manager.transaction(callback),
      getRepository: (entidad) => runner.manager.getRepository(entidad),
    });
    const stock = async (producto) =>
      (await productos.buscarUno(producto.idProducto)).stock;
    const conflicto = (e) => e.getStatus() === 409;
    const compra = {
      items: [
        { ...lineaEscalonada, cantidad: 60 },
        { idProducto: otro.idProducto, version: otro.version, cantidad: 2 },
      ],
      total: '500.00',
      claveConfirmacion: randomUUID(),
      entregas: [
        {
          idNegocio: 2,
          direccionEntrega: 'San Martín 123',
          condicionPago: 'TRANSFERENCIA',
        },
        { idNegocio: 3, direccionEntrega: 'Belgrano 45', condicionPago: 'CONTADO' },
      ],
    };
    await carrito.guardar(1, { items: compra.items });
    await carrito.guardar(2, { items: [compra.items[0]] });
    await assert.rejects(pedidos.confirmar(1, { ...compra, total: '1.00' }), conflicto);
    await assert.rejects(
      pedidos.confirmar(1, { ...compra, entregas: [compra.entregas[0]] }),
      conflicto,
    );
    await runner.query(
      'UPDATE negocio SET monto_minimo_orden = 20.01 WHERE id_negocio = 3',
    );
    await assert.rejects(pedidos.confirmar(1, compra), conflicto);
    await runner.query('UPDATE negocio SET monto_minimo_orden = 20 WHERE id_negocio = 3');
    assert.equal(await stock(escalonado), 100);
    const confirmado = await pedidos.confirmar(1, compra);
    assert.equal(confirmado.estado, 'EN_CURSO');
    assert.equal(confirmado.total, '500.00');
    assert.deepEqual(
      confirmado.subordenes.map((s) => [
        s.idNegocioVendedor,
        s.nombreVendedor,
        s.nombreComprador,
        s.estado,
        s.total,
        s.direccionEntrega,
        s.condicionPago,
      ]),
      [
        [
          2,
          'Vendedor',
          'Comprador',
          'PENDIENTE',
          '480.00',
          'San Martín 123',
          'TRANSFERENCIA',
        ],
        [3, 'Otro negocio', 'Comprador', 'PENDIENTE', '20.00', 'Belgrano 45', 'CONTADO'],
      ],
    );
    assert.equal(confirmado.subordenes[0].items[0].precioUnitario, '8.00');
    assert.equal(await carrito.obtener(1), null);
    assert.equal(await stock(escalonado), 40);
    assert.equal(await stock(otro), 3);
    assert.equal(
      (await productos.buscarUno(escalonado.idProducto)).version,
      escalonado.version,
    );
    const reintento = await pedidos.confirmar(1, compra);
    assert.equal(reintento.idPedido, confirmado.idPedido);
    assert.equal(reintento.subordenes.length, 2);
    assert.equal(await stock(escalonado), 40);
    await assert.rejects(
      pedidos.confirmar(2, {
        ...compra,
        items: [compra.items[0]],
        entregas: [compra.entregas[0]],
        total: '480.00',
        claveConfirmacion: randomUUID(),
      }),
      conflicto,
    );
    assert.equal(await runner.manager.getRepository(Pedido).count(), 1);
    assert.equal(await runner.manager.getRepository(Suborden).count(), 2);
    assert.equal((await carrito.obtener(2)).items.length, 1);
    assert.deepEqual(
      (await pedidos.listarCompras(1)).map((p) => p.subordenes.length),
      [2],
    );
    assert.deepEqual(
      (await pedidos.listarVentas(2)).map((s) => s.total),
      ['480.00'],
    );
    assert.equal((await pedidos.listarVentas(1)).length, 0);

    // Estados: cada suborden avanza por separado; rechazar o cancelar devuelve su stock.
    const [subVendedor, subOtro] = confirmado.subordenes.map((s) => s.idSuborden);
    assert.equal(
      (await pedidos.cambiarEstado(subOtro, 3, 'RECHAZADA')).estado,
      'RECHAZADA',
    );
    assert.equal((await pedidos.listarCompras(1))[0].estado, 'EN_CURSO');
    assert.equal(await stock(otro), 5);
    assert.equal(await stock(escalonado), 40);
    await assert.rejects(
      pedidos.cambiarEstado(subVendedor, 3, 'CONFIRMADA'),
      (e) => e.getStatus() === 404,
    );
    await assert.rejects(pedidos.cambiarEstado(subVendedor, 2, 'ENVIADA'), conflicto);
    assert.equal(
      (await pedidos.cambiarEstado(subVendedor, 2, 'CONFIRMADA')).estado,
      'CONFIRMADA',
    );
    assert.equal(
      (await pedidos.cambiarEstado(subVendedor, 1, 'CANCELADA')).estado,
      'CANCELADA',
    );
    assert.equal(await stock(escalonado), 100);
    await assert.rejects(pedidos.cambiarEstado(subVendedor, 2, 'PREPARADA'), conflicto);
    assert.deepEqual(
      (await pedidos.listarCompras(1))[0].subordenes.map((s) => s.estado),
      ['CANCELADA', 'RECHAZADA'],
    );
    assert.equal((await pedidos.listarCompras(1))[0].estado, 'COMPLETADA');
    assert.equal((await pedidos.confirmar(1, compra)).estado, 'COMPLETADA');
    const sinTramos = await productos.actualizar(escalonado.idProducto, 2, {
      ...dto,
      stock: 100,
    });
    assert.deepEqual(sinTramos.preciosEscalonados, []);

    // Reponer stock suma a la disponibilidad actual y conserva la versión y el carrito.
    const reposicion = await productos.crear(2, dto, ['/reposicion.png']);
    const lineaReposicion = {
      idProducto: reposicion.idProducto,
      version: reposicion.version,
      cantidad: 2,
    };
    await carrito.guardar(1, { items: [lineaReposicion] });
    const repuesto = await productos.agregarStock(reposicion.idProducto, 2, 7);
    assert.equal(repuesto.stock, dto.stock + 7);
    assert.equal(repuesto.version, reposicion.version);
    assert.equal((await carrito.obtener(1)).items[0].cantidad, 2);
    assert.equal((await carrito.obtener(1)).items[0].stock, dto.stock + 7);
    await assert.rejects(
      productos.agregarStock(reposicion.idProducto, 3, 1),
      (e) => e.getStatus() === 404,
    );
    await assert.rejects(
      productos.agregarStock(2147483647, 2, 1),
      (e) => e.getStatus() === 404,
    );
    // Simula una compra previa: la reposición suma al stock restante, sin sobrescribirlo.
    await runner.query('UPDATE producto SET stock = stock - 2 WHERE id_producto = $1', [
      reposicion.idProducto,
    ]);
    assert.equal(
      (await productos.agregarStock(reposicion.idProducto, 2, 3)).stock,
      dto.stock + 8,
    );
    await runner.query('UPDATE producto SET stock = 2147483645 WHERE id_producto = $1', [
      reposicion.idProducto,
    ]);
    await assert.rejects(
      productos.agregarStock(reposicion.idProducto, 2, 3),
      (e) => e.getStatus() === 400,
    );
    assert.equal((await productos.buscarUno(reposicion.idProducto)).stock, 2147483645);
    assert.equal(
      (await productos.agregarStock(reposicion.idProducto, 2, 2)).stock,
      2147483647,
    );
    await productos.eliminar(reposicion.idProducto, 2);

    // Categorías: la del vendedor no se borra mientras tenga productos.
    const propia = await categorias.crear(2, 'Vinos');
    await assert.rejects(categorias.crear(2, 'vinos'), (e) => e.getStatus() === 409);
    await assert.rejects(
      productos.crear(3, { ...dto, idCategoria: propia.idCategoria }, ['/ajena.png']),
      (e) => e.getStatus() === 400,
    );
    const vino = await productos.crear(2, { ...dto, idCategoria: propia.idCategoria }, [
      '/vino.png',
    ]);
    assert.equal(vino.categoria.nombre, 'Vinos');
    assert.equal(
      (await categorias.listarDisponibles(2)).find(
        (c) => c.idCategoria === propia.idCategoria,
      ).cantidadProductos,
      1,
    );
    await assert.rejects(
      categorias.eliminar(propia.idCategoria, 2),
      (e) => e.getStatus() === 409,
    );
    await assert.rejects(
      categorias.eliminar(general.idCategoria, 2),
      (e) => e.getStatus() === 400,
    );
    assert.deepEqual(
      (await productos.buscar({ categoria: 'vinos' }, 1)).map((p) => p.idProducto),
      [vino.idProducto],
    );
    await productos.eliminar(vino.idProducto, 2);
    await categorias.eliminar(propia.idCategoria, 2);
    assert.equal(
      await runner.manager
        .getRepository(Categoria)
        .countBy({ idCategoria: propia.idCategoria }),
      0,
    );
    // Entrega real y cierre de un período anterior: resultado durable e idempotente.
    const entregable = await productos.crear(2, dto, ['/sorteo.png']);
    await carrito.guardar(1, {
      items: [{ idProducto: entregable.idProducto, version: 1, cantidad: 3 }],
    });
    const pedidoSorteo = await pedidos.confirmar(1, {
      items: [{ idProducto: entregable.idProducto, version: 1, cantidad: 3 }],
      claveConfirmacion: randomUUID(),
      total: '30.00',
      entregas: [{ idNegocio: 2, direccionEntrega: 'Prueba', condicionPago: 'CONTADO' }],
    });
    const id = pedidoSorteo.subordenes[0].idSuborden;
    for (const estado of ['CONFIRMADA', 'PREPARADA', 'ENVIADA', 'ENTREGADA'])
      await pedidos.cambiarEstado(id, 2, estado);
    const sorteos = new SorteosService({
      manager: runner.manager,
      transaction: (callback) => runner.manager.transaction(callback),
    });
    assert.equal((await sorteos.resumen(1)).actual.propia.monto, '30.00');
    const anterior = new Date(periodoDe(new Date()).inicio.getTime() - 1000);
    await runner.query('UPDATE suborden SET actualizado_en = $1 WHERE id_suborden = $2', [
      anterior,
      id,
    ]);
    const resultado = await sorteos.actualizar(1);
    assert.equal(resultado.historial[0].premio, '0.60');
    assert.equal(resultado.historial[0].propia.probabilidad, 50);
    assert.equal(resultado.historial[0].participantes, 2);
    assert.equal(resultado.actual.propia.peso, '0');
    assert.deepEqual(
      (await sorteos.actualizar(2)).historial[0].ganador,
      resultado.historial[0].ganador,
    );
    assert.equal(await runner.manager.getRepository(Sorteo).count(), 1);

    // Adelantar el reloj atraviesa el cierre real: persiste ganador y reinicia fondo/chances.
    async function entregarParaSorteo(cantidad) {
      const producto = await productos.crear(2, dto, ['/reloj.png']);
      const items = [{ idProducto: producto.idProducto, version: 1, cantidad }];
      await carrito.guardar(1, { items });
      const compra = await pedidos.confirmar(1, {
        items,
        claveConfirmacion: randomUUID(),
        total: (10 * cantidad).toFixed(2),
        entregas: [
          { idNegocio: 2, direccionEntrega: 'Prueba reloj', condicionPago: 'CONTADO' },
        ],
      });
      const id = compra.subordenes[0].idSuborden;
      let entrega;
      for (const estado of ['CONFIRMADA', 'PREPARADA', 'ENVIADA', 'ENTREGADA'])
        entrega = await pedidos.cambiarEstado(id, 2, estado);
      return entrega;
    }
    await entregarParaSorteo(3);
    const vigente = await sorteos.resumen(1);
    assert.equal(vigente.actual.premio, '0.60');
    const cierre = await sorteos.cambiarFecha(1, vigente.actual.fin.toISOString());
    assert.equal(cierre.historial.length, 2);
    assert.ok(cierre.historial[0].ganador);
    assert.equal(cierre.actual.premio, '0.00');
    assert.equal(cierre.actual.propia.peso, '0');
    const entregaFutura = await entregarParaSorteo(1);
    assert.ok(entregaFutura.actualizadoEn >= vigente.actual.fin);
    assert.equal((await sorteos.resumen(2)).actual.propia.ventas, '10.00');
    assert.deepEqual(
      (await sorteos.actualizar(2)).historial[0].ganador,
      cierre.historial[0].ganador,
    );
    assert.equal(await runner.manager.getRepository(Sorteo).count(), 2);
    await assert.rejects(
      sorteos.cambiarFecha(1, vigente.ahora.toISOString()),
      (error) => error.getStatus() === 409,
    );
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
    await db.destroy();
  }
});
