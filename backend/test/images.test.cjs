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
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const { ImagenesService } = require('../dist/products/images.service');
const { ProductosController } = require('../dist/products/products.controller');
const { CrearProductoDto } = require('../dist/products/dto/crear-producto.dto');
const { ROLES_KEY } = require('../dist/auth/roles.decorator');

test('la migración detecta un origen mal pegado antes de subir archivos', () => {
  const { publicBlobOrigin } = require('../scripts/cloud-config.cjs');
  const origen = 'https://example.public.blob.vercel-storage.com';
  assert.equal(publicBlobOrigin(origen), origen);
  assert.equal(publicBlobOrigin(origen + '/'), origen);
  assert.equal(publicBlobOrigin(origen.toUpperCase()), origen);
  for (const valor of [
    'BLOB_PUBLIC_URL=' + origen,
    origen + '/foto.png',
    origen + '?x=1',
    'https://vercel.com',
    origen.replace('https:', 'http:'),
  ]) {
    assert.throws(() => publicBlobOrigin(valor), /BLOB_PUBLIC_URL/);
  }
});

test('las imágenes de Blob deben pertenecer al store y al vendedor autenticado', () => {
  const previas = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.BLOB_PUBLIC_URL = 'https://example.public.blob.vercel-storage.com';
    const service = new ImagenesService();
    const correcta = `${process.env.BLOB_PUBLIC_URL}/productos/7/foto-123.jpg`;
    assert.deepEqual(service.validar([correcta], 7), [correcta]);
    for (const ruta of [
      correcta.replace('/7/', '/8/'),
      correcta.replace('example.', 'other.'),
      correcta + '?download=1',
      correcta + '#hash',
      '/uploads/productos/7/foto.jpg',
      correcta.replace('https:', 'http:'),
      correcta.replace('.jpg', '.html'),
    ]) {
      assert.throws(
        () => service.validar([ruta], 7),
        (error) => error.getStatus() === 400,
      );
    }
  } finally {
    process.env = previas;
  }
});

test('en Vercel no se intenta guardar en disco si falta Blob', async () => {
  const previas = { ...process.env };
  try {
    process.env.VERCEL = '1';
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    const service = new ImagenesService();
    await assert.rejects(
      service.guardar({ mimetype: 'image/png', size: 4, buffer: Buffer.from('test') }, 7),
      (e) => e.getStatus() === 503,
    );
    await assert.rejects(
      service.guardar({ mimetype: 'text/html', size: 4 }, 7),
      (e) => e.getStatus() === 400,
    );
    await assert.rejects(
      service.guardar({ mimetype: 'image/png', size: 2 * 1024 * 1024 + 1 }, 7),
      (e) => e.getStatus() === 400,
    );
  } finally {
    process.env = previas;
  }
});

test('crear y editar aceptan fotos previamente subidas sin alterar las fotos al editar solo texto', async () => {
  const llamadas = [];
  const controlador = new ProductosController(
    {
      crear: async (...args) => llamadas.push(['crear', ...args]),
      actualizar: async (...args) => llamadas.push(['actualizar', ...args]),
    },
    { validar: (rutas) => [...rutas] },
  );
  const request = { user: { idNegocio: 7 } };
  const dto = { imagenesSubidas: ['https://store/foto.jpg'] };
  await controlador.crear(request, dto, []);
  assert.deepEqual(llamadas[0], ['crear', 7, dto, dto.imagenesSubidas]);
  await controlador.actualizar(4, request, {}, []);
  assert.equal(llamadas[1][4], undefined);
  await assert.rejects(controlador.crear(request, {}, []), (e) => e.getStatus() === 400);
  await assert.rejects(
    controlador.crear(request, { imagenesSubidas: Array(6).fill('foto') }, []),
    (e) => e.getStatus() === 400,
  );
  assert.deepEqual(
    Reflect.getMetadata(ROLES_KEY, ProductosController.prototype.subirImagen),
    ['VENDEDOR'],
  );
});

test('el DTO valida listas de fotos multipart y rechaza JSON inválido o más de cinco', () => {
  const base = {
    nombre: 'Producto',
    descripcion: 'Descripción',
    idCategoria: 1,
    precioBase: 12,
    stock: 3,
  };
  const valido = plainToInstance(CrearProductoDto, {
    ...base,
    imagenesSubidas: '["https://store/foto.jpg"]',
  });
  assert.equal(validateSync(valido).length, 0);
  for (const imagenesSubidas of [
    'invalid',
    '[1]',
    JSON.stringify(Array(6).fill('foto')),
  ]) {
    assert.ok(
      validateSync(plainToInstance(CrearProductoDto, { ...base, imagenesSubidas }))
        .length,
    );
  }
});

test('el flujo HTTP multipart guarda la foto y crea el producto con su URL', async () => {
  const { Test } = require('@nestjs/testing');
  const { ValidationPipe } = require('@nestjs/common');
  const { ProductosService } = require('../dist/products/products.service');
  const { JwtAuthGuard } = require('../dist/auth/jwt-auth.guard');
  const { RolesGuard } = require('../dist/auth/roles.guard');
  const { mkdtemp, readFile, rm } = require('node:fs/promises');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const previas = { ...process.env };
  const directorioAnterior = process.cwd();
  const temporal = await mkdtemp(join(tmpdir(), 'bulkmarket-images-test-'));
  let app;
  try {
    delete process.env.VERCEL;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    process.env.NODE_ENV = 'test';
    process.chdir(temporal);
    const modulo = await Test.createTestingModule({
      controllers: [ProductosController],
      providers: [
        ImagenesService,
        {
          provide: ProductosService,
          useValue: {
            crear: async (idNegocio, dto, imagenes) => ({
              idNegocio,
              nombre: dto.nombre,
              imagenes,
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = modulo.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.use((req, _res, next) => {
      req.user = { idNegocio: 7 };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    const origen = await app.getUrl();
    const imagen = new FormData();
    imagen.set('imagen', new Blob(['image-bytes'], { type: 'image/png' }), 'foto.png');
    const subida = await fetch(`${origen}/api/productos/imagenes`, {
      method: 'POST',
      body: imagen,
    });
    assert.equal(subida.status, 201);
    const { url } = await subida.json();
    assert.match(url, /^\/uploads\/productos\/7\/[a-f0-9-]+\.png$/);
    assert.equal(
      (await readFile(join(temporal, url.slice(1)))).toString(),
      'image-bytes',
    );
    const datos = new FormData();
    for (const [clave, valor] of Object.entries({
      nombre: 'Producto',
      descripcion: 'Descripción',
      idCategoria: '1',
      precioBase: '10',
      stock: '3',
      imagenesSubidas: JSON.stringify([url]),
    }))
      datos.set(clave, valor);
    const respuesta = await fetch(`${origen}/api/productos`, {
      method: 'POST',
      body: datos,
    });
    assert.equal(respuesta.status, 201);
    assert.deepEqual((await respuesta.json()).imagenes, [url]);
    datos.set('imagenesSubidas', JSON.stringify([url.replace('/7/', '/8/')]));
    const invalida = await fetch(`${origen}/api/productos`, {
      method: 'POST',
      body: datos,
    });
    assert.equal(invalida.status, 400);
  } finally {
    if (app) await app.close();
    process.chdir(directorioAnterior);
    process.env = previas;
    await rm(temporal, { recursive: true, force: true });
  }
});
