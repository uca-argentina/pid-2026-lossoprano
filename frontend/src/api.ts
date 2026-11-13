/**
 * Contrato entre React y la API Nest: tipos de solicitudes/respuestas y funciones
 * HTTP.
 * Las pantallas llaman a este objeto en lugar de repetir fetch y encabezados. Los
 * permisos se verifican nuevamente en el servidor.
 * Los importes llegan como strings decimales desde PostgreSQL; convertirlos solo
 * cuando una operación o presentación lo necesita.
 */

// TIPOS (type): describen la FORMA de lo que manda o devuelve el back. No hacen nada solos: sirven para que TypeScript te avise si escribís mal un nombre.
// Los nombres tienen que ser IGUALES a las propiedades de las entities del back.
export type Rol = 'COMPRADOR' | 'VENDEDOR';
export type ParticipacionSorteo = {
  compras: string;
  ventas: string;
  monto: string;
  peso: string;
  probabilidad: number;
};
export type PeriodoSorteo = {
  inicio: string;
  fin: string;
  volumen: string;
  comisiones: string;
  premio: string;
  ingresoPlataforma: string;
  pesoTotal: string;
  participantes: number;
  propia: ParticipacionSorteo;
};
export type ResumenSorteos = {
  demo: true;
  relojPrueba: { habilitado: boolean; adelantado: boolean };
  ahora: string;
  reglas: {
    comisionBps: number;
    premioNumerador: number;
    premioDenominador: number;
    dias: number;
  };
  actual: PeriodoSorteo;
  historial: (PeriodoSorteo & {
    ganador: { idNegocio: number; nombre: string } | null;
    esGanador: boolean;
    sorteadoEn: string;
  })[];
};
export type CondicionPago = 'CONTADO' | 'TRANSFERENCIA' | 'CUENTA_CORRIENTE';
export type EstadoSuborden =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'PREPARADA'
  | 'ENVIADA'
  | 'ENTREGADA'
  | 'RECHAZADA'
  | 'CANCELADA';
export type EstadoPedido = 'EN_CURSO' | 'COMPLETADA';
export type EntregaSuborden = {
  idNegocio: number;
  direccionEntrega: string;
  condicionPago: CondicionPago;
};
export type ConfirmacionPedido = {
  claveConfirmacion: string;
  total: string;
  entregas: EntregaSuborden[];
  items: Pick<ItemCarrito, 'idProducto' | 'version' | 'cantidad'>[];
};
export type LineaPedido = {
  idProducto: number;
  nombre: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
};
// Forma de una suborden tal como la devuelve el back (entity Suborden + lo que agrega el service).
export type Suborden = {
  idSuborden: number;
  idPedido: number;
  idNegocioVendedor: number;
  nombreVendedor: string;
  idNegocioComprador: number;
  nombreComprador: string;
  direccionEntrega: string;
  condicionPago: CondicionPago;
  // En el front los estados son TEXTO: 'PENDIENTE', 'ENTREGADA', etc. Se compara así: suborden.estado === 'ENTREGADA'.
  estado: EstadoSuborden;
  items: LineaPedido[];
  // decimal de la base → llega como string. Para cuentas: Number(total).
  total: string;
  creadoEn: string;
  actualizadoEn: string;
  // ? = puede no venir. | null = puede venir vacío. Las fechas llegan como texto.
  entregadaEn?: string | null;
  reclamos?: Reclamo[];
  // Solo en compras: fecha límite según el plazo del vendedor y si todavía está vigente.
  limiteReclamo?: string | null;
  puedeReclamar?: boolean;
  urgente?: boolean | null;
};
export type EstadoReclamo = 'PENDIENTE' | 'APROBADO' | 'RECIBIDO' | 'RECHAZADO';
export type Reclamo = {
  idReclamo: number;
  idSuborden: number;
  estado: EstadoReclamo;
  items: LineaPedido[];
  motivo: string;
  motivoRechazo: string | null;
  importe: string;
  notaCredito: string | null;
  creadoEn: string;
  resueltoEn: string | null;
  recibidoEn: string | null;
};
// Orden general de una compra, con una suborden por vendedor.
// Un pedido general con su lista de subórdenes (subordenes: Suborden[] → [] = lista).
export type Pedido = {
  idPedido: number;
  estado: EstadoPedido;
  total: string;
  creadoEn: string;
  subordenes: Suborden[];
};

export type Negocio = {
  montoMinimoOrden?: string;
  recargoUrgente?: number | string;
  diasReclamo?: number | string;
  idNegocio: number;
  razonSocial: string;
  nombreComercial: string;
  identificacionFiscal: string;
  telefono: string;
  direccion: string;
  paginaWeb?: string | null;
};

// Lo que devuelve el login: el token y los datos del usuario y su negocio. App.tsx lo guarda en localStorage.
export type Sesion = {
  accessToken: string;
  cliente: { idCliente: number; email: string; rol: Rol };
  negocio: Negocio;
};

export type Categoria = {
  idCategoria: number;
  nombre: string;
  idNegocio?: number | null;
};
export type CategoriaDisponible = {
  idCategoria: number;
  nombre: string;
  general: boolean;
  cantidadProductos: number;
};
export type PrecioEscalonado = { cantidadMinima: number; precioUnitario: string };

// Forma de un producto (igual a la entity Producto del back).
export type Producto = {
  cantidadMinimaCompra?: number | null;
  version: number;
  idProducto: number;
  idNegocio: number;
  negocio?: Negocio;
  nombre: string;
  descripcion: string;
  idCategoria: number;
  categoria: Categoria;
  precioBase: string;
  preciosEscalonados: PrecioEscalonado[];
  stock: number;
  imagenes: string[];
};

export type FiltrosProductos = {
  q?: string;
  categoria?: string;
  idNegocio?: number;
};

export type ItemCarrito = {
  idProducto: number;
  idNegocio: number;
  version: number;
  nombre: string;
  precioBase: string;
  precioUnitario: string;
  preciosEscalonados: PrecioEscalonado[];
  cantidad: number;
  stock: number;
  cantidadMinimaCompra?: number | null;
  imagen?: string;
};
export type VendedorCarrito = {
  idNegocio: number;
  nombreNegocio: string;
  subtotal: string;
  montoMinimoOrden: string;
  faltanteMinimo: string;
  cumpleMinimos: boolean;
  pedidosUrgentes: boolean;
};
// subtotal y cumpleMinimos resumen todo el carrito; cada vendedor tiene los suyos.
export type Carrito = {
  subtotal: string;
  cumpleMinimos: boolean;
  vendedores: VendedorCarrito[];
  items: ItemCarrito[];
} | null;

// Dirección base del back. Todas las rutas se pegan a esto: API_URL + '/pedidos/compras'.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const ASSET_URL = API_URL.replace(/\/api\/?$/, '');
export const imagenUrl = (ruta: string) =>
  /^https:\/\//.test(ruta) ? ruta : `${ASSET_URL}${ruta}`;

/**
 * Envía JSON y el token si corresponde. Convierte errores HTTP en Error para la
 * pantalla; distingue 204, null y cuerpo vacío del carrito.
 */
// FUNCIÓN CENTRAL: todas las llamadas al back pasan por acá.
// Parámetros: ruta ('/pedidos/compras'), opciones (method y body) y token.
// <T> = el molde: qué forma tiene lo que devuelve (lo pone cada función de abajo, ej solicitud<Pedido[]>).
async function solicitud<T>(
  ruta: string,
  opciones: RequestInit = {},
  token?: string,
): Promise<T> {
  // fetch hace la petición HTTP al back. await espera la respuesta.
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    // ...opciones copia method y body que le pasaste.
    ...opciones,
    headers: {
      // Avisa que el body va en JSON.
      'Content-Type': 'application/json',
      // Si hay token, lo manda en el header Authorization. El back lo lee en JwtStrategy → req.user.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });
  // ok = false cuando el back respondió error (400, 401, 403, 404, 409).
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}));
    // Lanza un error con el MENSAJE del back (ej 'Pedido no encontrado.'). La pantalla lo agarra en su catch y lo muestra con setError.
    throw new Error(
      Array.isArray(cuerpo.message)
        ? cuerpo.message[0]
        : (cuerpo.message ?? 'Ocurrió un error inesperado.'),
    );
  }
  // 204 = respuesta sin contenido.
  if (respuesta.status === 204) return undefined as T;
  if (ruta === '/carrito') {
    const texto = await respuesta.text();
    return texto.trim() ? JSON.parse(texto) : (null as T);
  }
  // Convierte la respuesta en objeto/lista de JS y la devuelve. Eso es lo que te da el await api.algo(...).
  return respuesta.json();
}

/**
 * Envía cada foto por separado para respetar el límite de tamaño de la plataforma.
 * Sustituye archivos por sus URLs antes de enviar el formulario del producto.
 */
async function subirImagenes(datos: FormData, token: string): Promise<FormData> {
  const formulario = new FormData();
  const rutas: string[] = [];
  for (const [clave, valor] of datos.entries()) {
    if (clave !== 'imagenes') {
      formulario.append(clave, valor);
      continue;
    }
    const archivo = new FormData();
    archivo.append('imagen', valor);
    const respuesta = await fetch(`${API_URL}/productos/imagenes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: archivo,
    });
    const cuerpo = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(cuerpo.message ?? 'No se pudo subir la imagen.');
    rutas.push(cuerpo.url);
  }
  if (rutas.length) formulario.set('imagenesSubidas', JSON.stringify(rutas));
  return formulario;
}

// OBJETO api: una función por cada endpoint del back. Las pantallas llaman api.misCompras(token), etc.
// FORMA de cada una: nombre: (parámetros) => solicitud<MOLDE>(RUTA, { method, body }, token)
// La RUTA tiene que ser la misma que @Controller + @Get/@Post/@Patch del back (sin /api).
export const api = {
  actualizarSorteos: (token: string) =>
    solicitud<ResumenSorteos>('/sorteos/actualizar', { method: 'POST' }, token),
  cambiarFechaSorteos: (fecha: string, token: string) =>
    solicitud<ResumenSorteos>(
      '/sorteos/reloj',
      { method: 'POST', body: JSON.stringify({ fecha }) },
      token,
    ),
  // LA LLAMA: el carrito (useCarrito.ts / PanelCarrito.tsx). VA A: orders.controller.confirmar (POST /pedidos).
  confirmarPedido: (datos: ConfirmacionPedido, token: string) =>
    solicitud<Pedido>('/pedidos', { method: 'POST', body: JSON.stringify(datos) }, token),
  // GET (sin method = GET). {} = sin opciones. Molde Pedido[] porque el back devuelve una LISTA de pedidos.
  // → back: @Get('compras') en orders.controller → service.listarCompras.
  // LA LLAMA: cargar() de Pedidos.tsx (comprador). VA A: orders.controller.compras → orders.service.listarCompras.
  misCompras: (token: string) => solicitud<Pedido[]>('/pedidos/compras', {}, token),
  // GET /pedidos/ventas → lista de subórdenes del vendedor.
  // LA LLAMA: cargar() de Pedidos.tsx (vendedor). VA A: orders.controller.ventas → orders.service.listarVentas.
  misVentas: (token: string) => solicitud<Suborden[]>('/pedidos/ventas', {}, token),
  // PATCH con :id y body.
  // `...${idSuborden}...` = template string: mete el valor de la variable en el texto de la ruta (el back lo agarra con @Param('id')).
  // JSON.stringify({ estado }) = convierte el body a texto JSON → el back lo recibe en @Body() dto (dto.estado).
  // LA LLAMA: cambiarEstado() de Pedidos.tsx con (suborden.idSuborden, accion.estado, token).
  // VA A: orders.controller.cambiarEstado → orders.service.cambiarEstado.
  cambiarEstadoSuborden: (idSuborden: number, estado: EstadoSuborden, token: string) =>
    solicitud<Suborden>(
      `/pedidos/subordenes/${idSuborden}/estado`,
      { method: 'PATCH', body: JSON.stringify({ estado }) },
      token,
    ),
  // POST con :id y body. datos tiene la forma de CrearReclamoDto del back: { items, motivo }.
  // MOLDE para cualquier POST nuevo sobre una suborden.
  // LA LLAMA: enviar() de Reclamos.tsx con (suborden.idSuborden, { items, motivo }, token).
  // VA A: orders.controller.crearReclamo → orders.service.crearReclamo.
  crearReclamo: (
    idSuborden: number,
    datos: { items: { idProducto: number; cantidad: number }[]; motivo: string },
    token: string,
  ) =>
    solicitud<Reclamo>(
      `/pedidos/subordenes/${idSuborden}/reclamos`,
      { method: 'POST', body: JSON.stringify(datos) },
      token,
    ),
  // PATCH sin body: solo { method: 'PATCH' }.
  // LA LLAMA: botón Aprobar de Reclamos.tsx. VA A: orders.controller.aprobarReclamo.
  aprobarReclamo: (idReclamo: number, token: string) =>
    solicitud<Reclamo>(
      `/pedidos/reclamos/${idReclamo}/aprobar`,
      { method: 'PATCH' },
      token,
    ),
  rechazarReclamo: (idReclamo: number, motivo: string, token: string) =>
    solicitud<Reclamo>(
      `/pedidos/reclamos/${idReclamo}/rechazar`,
      { method: 'PATCH', body: JSON.stringify({ motivo }) },
      token,
    ),
  confirmarRecepcionReclamo: (idReclamo: number, token: string) =>
    solicitud<Reclamo>(
      `/pedidos/reclamos/${idReclamo}/recepcion`,
      { method: 'PATCH' },
      token,
    ),
  obtenerCarrito: (token: string) => solicitud<Carrito>('/carrito', {}, token),
  guardarCarrito: (
    items: Pick<ItemCarrito, 'idProducto' | 'version' | 'cantidad'>[],
    token: string,
    importar = false,
  ) =>
    solicitud<Carrito>(
      '/carrito',
      { method: 'PUT', body: JSON.stringify({ items, importar }) },
      token,
    ),
  actualizarProducto: async (
    id: number,
    datos: FormData,
    token: string,
  ): Promise<Producto> => {
    const respuesta = await fetch(`${API_URL}/productos/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: await subirImagenes(datos, token),
    });
    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => ({}));
      throw new Error(
        Array.isArray(cuerpo.message)
          ? cuerpo.message[0]
          : (cuerpo.message ?? 'No se pudo actualizar el producto.'),
      );
    }
    return respuesta.json();
  },
  // PATCH /productos/:id/stock con body { cantidad } (mismo nombre que en AgregarStockDto). Devuelve el Producto actualizado.
  // LA LLAMA: guardar() de AgregarStock.tsx con (producto.idProducto, unidades, token).
  // VA A: products.controller.agregarStock → products.service.agregarStock.
  // { cantidad } = forma corta de { cantidad: cantidad } (el parámetro de esta función).
  agregarStock: (id: number, cantidad: number, token: string) =>
    solicitud<Producto>(
      `/productos/${id}/stock`,
      { method: 'PATCH', body: JSON.stringify({ cantidad }) },
      token,
    ),
  // DELETE. Sin <molde> porque no se usa la respuesta.
  eliminarProducto: (id: number, token: string) =>
    solicitud(`/productos/${id}`, { method: 'DELETE' }, token),
  validarCarrito: (items: { idProducto: number; version: number }[], token: string) =>
    solicitud<number[]>(
      '/productos/carrito/validar',
      { method: 'POST', body: JSON.stringify({ items }) },
      token,
    ),
  crearProducto: async (datos: FormData, token: string): Promise<Producto> => {
    const respuesta = await fetch(`${API_URL}/productos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: await subirImagenes(datos, token),
    });
    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => ({}));
      throw new Error(
        Array.isArray(cuerpo.message)
          ? cuerpo.message[0]
          : (cuerpo.message ?? 'No se pudo crear el producto.'),
      );
    }
    return respuesta.json();
  },
  categoriasDisponibles: (token: string) =>
    solicitud<CategoriaDisponible[]>('/categorias', {}, token),
  crearCategoria: (nombre: string, token: string) =>
    solicitud<CategoriaDisponible>(
      '/categorias',
      { method: 'POST', body: JSON.stringify({ nombre }) },
      token,
    ),
  eliminarCategoria: (idCategoria: number, token: string) =>
    solicitud(`/categorias/${idCategoria}`, { method: 'DELETE' }, token),
  // GET /productos/mi-negocio → Producto[] (lista).
  // LA LLAMA: useEffect de CrearProducto.tsx. VA A: products.controller.misProductos → products.service.buscarDeNegocio.
  misProductos: (token: string) =>
    solicitud<Producto[]>('/productos/mi-negocio', {}, token),
  listarCategorias: (token: string) =>
    solicitud<string[]>('/productos/categorias', {}, token),
  listarVendedores: (token: string) =>
    solicitud<Pick<Negocio, 'idNegocio' | 'nombreComercial'>[]>(
      '/productos/vendedores',
      {},
      token,
    ),
  buscarProductos: (filtros: FiltrosProductos, token: string) => {
    const parametros = new URLSearchParams();
    if (filtros.q) parametros.set('q', filtros.q);
    if (filtros.categoria) parametros.set('categoria', filtros.categoria);
    if (filtros.idNegocio) parametros.set('idNegocio', String(filtros.idNegocio));
    const query = parametros.toString();
    return solicitud<Producto[]>(`/productos${query ? `?${query}` : ''}`, {}, token);
  },
  obtenerProducto: (idProducto: number, token: string) =>
    solicitud<Producto>(`/productos/${idProducto}`, {}, token),
  // Login: no lleva token (todavía no tenés). Devuelve la Sesion con el accessToken.
  // LA LLAMA: enviar() de Ingreso en App.tsx. VA A: auth.controller.iniciarSesion → auth.service.iniciarSesion.
  iniciarSesion: (datos: { email: string; password: string }) =>
    solicitud<Sesion>('/auth/iniciar-sesion', {
      method: 'POST',
      body: JSON.stringify(datos),
    }),
  registrar: (datos: {
    email: string;
    password: string;
    rol: Rol;
    negocio: Omit<Negocio, 'idNegocio'>;
  }) =>
    solicitud<Sesion>('/auth/registro', {
      method: 'POST',
      body: JSON.stringify(datos),
    }),
  actualizarNegocio: (datos: Omit<Negocio, 'idNegocio'>, token: string) =>
    solicitud<Negocio>(
      '/negocios/mi-negocio',
      {
        method: 'PATCH',
        body: JSON.stringify(datos),
      },
      token,
    ),
  eliminarNegocio: (token: string) =>
    solicitud<{ mensaje: string }>(
      '/negocios/mi-negocio',
      {
        method: 'DELETE',
      },
      token,
    ),
};
