/**
 * Carga datos de prueba a través de la API: dos vendedores con productos y un
 * comprador. Usa los mismos endpoints que la web, así que las validaciones y las
 * contraseñas quedan iguales que si se registraran a mano.
 *
 * Uso: con la API corriendo (npm run start:dev), en otra terminal desde backend/:
 *   npm run seed:demo
 * Se puede correr más de una vez: si una cuenta ya existe inicia sesión, y si un
 * vendedor ya tiene productos no vuelve a crearlos.
 */

const zlib = require('node:zlib');

const API = process.env.API_URL ?? 'http://localhost:3000/api';
const CLAVE = 'Demo1234';

const CUENTAS = [
  {
    email: 'vendedor@bulkmarket.com',
    rol: 'VENDEDOR',
    negocio: {
      razonSocial: 'Bodega Los Andes S.A.',
      nombreComercial: 'Bodega Los Andes',
      identificacionFiscal: '30711111119',
      telefono: '2614445555',
      direccion: 'San Martín 1200, Mendoza',
    },
    montoMinimoOrden: 50000,
    productos: [
      {
        nombre: 'Malbec Reserva caja x6',
        descripcion: 'Caja de 6 botellas de 750 ml.',
        categoria: 'Bebidas',
        precioBase: 42000,
        stock: 120,
        cantidadMinimaCompra: 2,
        preciosEscalonados: [
          { cantidadMinima: 10, precioUnitario: 39000 },
          { cantidadMinima: 30, precioUnitario: 36000 },
        ],
        color: [122, 30, 50],
      },
      {
        nombre: 'Torrontés caja x6',
        descripcion: 'Vino blanco, caja de 6 botellas de 750 ml.',
        categoria: 'Bebidas',
        precioBase: 33000,
        stock: 80,
        color: [214, 190, 90],
      },
      {
        nombre: 'Aceite de oliva 5 L',
        descripcion: 'Bidón de aceite de oliva extra virgen.',
        categoria: 'Alimentos',
        precioBase: 28500,
        stock: 60,
        color: [110, 140, 50],
      },
    ],
  },
  {
    email: 'vendedor2@bulkmarket.com',
    rol: 'VENDEDOR',
    negocio: {
      razonSocial: 'Distribuidora Norte S.R.L.',
      nombreComercial: 'Distribuidora Norte',
      identificacionFiscal: '30722222229',
      telefono: '1143332222',
      direccion: 'Av. Mitre 450, Campana',
    },
    montoMinimoOrden: 0,
    productos: [
      {
        nombre: 'Detergente 5 L',
        descripcion: 'Bidón de detergente concentrado.',
        categoria: 'Limpieza',
        precioBase: 9800,
        stock: 200,
        preciosEscalonados: [{ cantidadMinima: 12, precioUnitario: 8900 }],
        color: [40, 120, 200],
      },
      {
        nombre: 'Jabón de tocador x48',
        descripcion: 'Caja de 48 jabones de 90 g.',
        categoria: 'Higiene personal',
        precioBase: 21000,
        stock: 90,
        color: [235, 160, 190],
      },
    ],
  },
  {
    email: 'comprador@bulkmarket.com',
    rol: 'COMPRADOR',
    negocio: {
      razonSocial: 'Almacén La Esquina S.R.L.',
      nombreComercial: 'Almacén La Esquina',
      identificacionFiscal: '30733333339',
      telefono: '1155556666',
      direccion: 'Belgrano 980, Zárate',
    },
  },
];

/** Genera un PNG cuadrado de un solo color para usar como foto del producto. */
function pngDeColor([r, g, b], lado = 400) {
  const fila = Buffer.alloc(1 + lado * 3);
  for (let x = 0; x < lado; x++) fila.set([r, g, b], 1 + x * 3);
  const datos = zlib.deflateSync(Buffer.concat(Array(lado).fill(fila)));
  const crcTabla = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buffer) => {
    let c = 0xffffffff;
    for (const byte of buffer) c = crcTabla[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const bloque = (tipo, contenido) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(contenido.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo), contenido]);
    const control = Buffer.alloc(4);
    control.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, control]);
  };
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(lado, 0);
  cabecera.writeUInt32BE(lado, 4);
  cabecera.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', cabecera),
    bloque('IDAT', datos),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}

async function solicitud(ruta, opciones = {}, token) {
  const esFormulario = opciones.body instanceof FormData;
  const respuesta = await fetch(API + ruta, {
    ...opciones,
    headers: {
      ...(esFormulario ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const texto = await respuesta.text();
  const cuerpo = texto ? JSON.parse(texto) : null;
  if (!respuesta.ok) {
    const error = new Error(
      `${ruta}: ${[cuerpo?.message].flat().join(', ') || respuesta.status}`,
    );
    error.status = respuesta.status;
    throw error;
  }
  return cuerpo;
}

/** Registra la cuenta o, si ya existe, inicia sesión con la misma clave. */
async function cuenta({ email, rol, negocio }) {
  try {
    const sesion = await solicitud('/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ email, password: CLAVE, rol, negocio }),
    });
    console.log(`  + ${email} creada`);
    return sesion;
  } catch (error) {
    if (error.status !== 409) throw error;
    const sesion = await solicitud('/auth/iniciar-sesion', {
      method: 'POST',
      body: JSON.stringify({ email, password: CLAVE }),
    });
    console.log(`  = ${email} ya existía`);
    return sesion;
  }
}

async function main() {
  try {
    await fetch(API);
  } catch {
    console.error(
      `No se pudo conectar con ${API}. Levantá la API con "npm run start:dev" y volvé a intentar.`,
    );
    process.exit(1);
  }
  console.log('Cargando datos de prueba...');
  for (const datos of CUENTAS) {
    const { accessToken } = await cuenta(datos);
    if (datos.rol !== 'VENDEDOR') continue;
    await solicitud(
      '/negocios/mi-negocio',
      {
        method: 'PATCH',
        body: JSON.stringify({ montoMinimoOrden: datos.montoMinimoOrden }),
      },
      accessToken,
    );
    const existentes = await solicitud('/productos/mi-negocio', {}, accessToken);
    if (existentes.length) {
      console.log(`    ${existentes.length} producto(s) ya cargados, no se agregan más`);
      continue;
    }
    const categorias = await solicitud('/categorias', {}, accessToken);
    for (const producto of datos.productos) {
      const categoria = categorias.find((c) => c.nombre === producto.categoria);
      const formulario = new FormData();
      formulario.append('nombre', producto.nombre);
      formulario.append('descripcion', producto.descripcion);
      formulario.append('idCategoria', String(categoria.idCategoria));
      formulario.append('precioBase', String(producto.precioBase));
      formulario.append('stock', String(producto.stock));
      if (producto.cantidadMinimaCompra)
        formulario.append('cantidadMinimaCompra', String(producto.cantidadMinimaCompra));
      formulario.append(
        'preciosEscalonados',
        JSON.stringify(producto.preciosEscalonados ?? []),
      );
      formulario.append(
        'imagenes',
        new Blob([pngDeColor(producto.color)], { type: 'image/png' }),
        'foto.png',
      );
      await solicitud('/productos', { method: 'POST', body: formulario }, accessToken);
      console.log(`    + ${producto.nombre}`);
    }
  }
  console.log(`\nListo. Todas las cuentas usan la contraseña ${CLAVE}.`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
