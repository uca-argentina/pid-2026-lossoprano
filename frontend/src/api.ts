/**
 * Contrato entre React y la API Nest: tipos de solicitudes/respuestas y funciones
 * HTTP.
 * Las pantallas llaman a este objeto en lugar de repetir fetch y encabezados. Los
 * permisos se verifican nuevamente en el servidor.
 * Los importes llegan como strings decimales desde PostgreSQL; convertirlos solo
 * cuando una operación o presentación lo necesita.
 */

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
export type Suborden = {
  idSuborden: number;
  idPedido: number;
  idNegocioVendedor: number;
  nombreVendedor: string;
  idNegocioComprador: number;
  nombreComprador: string;
  direccionEntrega: string;
  condicionPago: CondicionPago;
  estado: EstadoSuborden;
  items: LineaPedido[];
  total: string;
  creadoEn: string;
  actualizadoEn: string;
};
// Orden general de una compra, con una suborden por vendedor.
export type Pedido = {
  idPedido: number;
  estado: EstadoPedido;
  total: string;
  creadoEn: string;
  subordenes: Suborden[];
};

export type Negocio = {
  montoMinimoOrden?: string;
  idNegocio: number;
  razonSocial: string;
  nombreComercial: string;
  identificacionFiscal: string;
  telefono: string;
  direccion: string;
};

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
};
// subtotal y cumpleMinimos resumen todo el carrito; cada vendedor tiene los suyos.
export type Carrito = {
  subtotal: string;
  cumpleMinimos: boolean;
  vendedores: VendedorCarrito[];
  items: ItemCarrito[];
} | null;

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const ASSET_URL = API_URL.replace(/\/api\/?$/, '');
export const imagenUrl = (ruta: string) =>
  /^https:\/\//.test(ruta) ? ruta : `${ASSET_URL}${ruta}`;

/**
 * Envía JSON y el token si corresponde. Convierte errores HTTP en Error para la
 * pantalla; distingue 204, null y cuerpo vacío del carrito.
 */
async function solicitud<T>(
  ruta: string,
  opciones: RequestInit = {},
  token?: string,
): Promise<T> {
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}));
    throw new Error(
      Array.isArray(cuerpo.message)
        ? cuerpo.message[0]
        : (cuerpo.message ?? 'Ocurrió un error inesperado.'),
    );
  }
  if (respuesta.status === 204) return undefined as T;
  if (ruta === '/carrito') {
    const texto = await respuesta.text();
    return texto.trim() ? JSON.parse(texto) : (null as T);
  }
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

export const api = {
  actualizarSorteos: (token: string) =>
    solicitud<ResumenSorteos>('/sorteos/actualizar', { method: 'POST' }, token),
  cambiarFechaSorteos: (fecha: string, token: string) =>
    solicitud<ResumenSorteos>(
      '/sorteos/reloj',
      { method: 'POST', body: JSON.stringify({ fecha }) },
      token,
    ),
  confirmarPedido: (datos: ConfirmacionPedido, token: string) =>
    solicitud<Pedido>('/pedidos', { method: 'POST', body: JSON.stringify(datos) }, token),
  misCompras: (token: string) => solicitud<Pedido[]>('/pedidos/compras', {}, token),
  misVentas: (token: string) => solicitud<Suborden[]>('/pedidos/ventas', {}, token),
  cambiarEstadoSuborden: (idSuborden: number, estado: EstadoSuborden, token: string) =>
    solicitud<Suborden>(
      `/pedidos/subordenes/${idSuborden}/estado`,
      { method: 'PATCH', body: JSON.stringify({ estado }) },
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
  agregarStock: (id: number, cantidad: number, token: string) =>
    solicitud<Producto>(
      `/productos/${id}/stock`,
      { method: 'PATCH', body: JSON.stringify({ cantidad }) },
      token,
    ),
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
