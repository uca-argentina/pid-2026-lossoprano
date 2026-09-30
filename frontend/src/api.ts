export type Rol = 'COMPRADOR' | 'VENDEDOR';

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

export type Producto = {
  cantidadMinimaCompra?: number | null;
  version: number;
  idProducto: number;
  idNegocio: number;
  negocio?: Negocio;
  nombre: string;
  descripcion: string;
  categoria: string;
  precioBase: string;
  stock: number;
  imagenes: string[];
};

export type FiltrosProductos = {
  q?: string;
  categoria?: string;
  idNegocio?: number;
};

export type ItemCarrito = { idProducto: number; version: number; nombre: string; precioBase: string; cantidad: number; stock: number; cantidadMinimaCompra?: number | null; imagen?: string };
export type Carrito = { idNegocio: number; nombreNegocio: string; items: ItemCarrito[]; subtotal: string; montoMinimoOrden: string; faltanteMinimo: string; cumpleMinimos: boolean } | null;

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
export const ASSET_URL = API_URL.replace(/\/api\/?$/, '');

async function solicitud<T>(ruta: string, opciones: RequestInit = {}, token?: string): Promise<T> {
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opciones.headers },
  });
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}));
    throw new Error(Array.isArray(cuerpo.message) ? cuerpo.message[0] : cuerpo.message ?? 'Ocurrió un error inesperado.');
  }
  if (respuesta.status === 204) return undefined as T;
  if (ruta === '/carrito') {
    const texto = await respuesta.text();
    return texto.trim() ? JSON.parse(texto) : null as T;
  }
  return respuesta.json();
}

export const api = {
  obtenerCarrito: (token: string) => solicitud<Carrito>('/carrito', {}, token),
  guardarCarrito: (items: Pick<ItemCarrito, 'idProducto' | 'version' | 'cantidad'>[], token: string, importar = false) =>
    solicitud<Carrito>('/carrito', { method: 'PUT', body: JSON.stringify({ items, importar }) }, token),
  actualizarProducto: async (id: number, datos: FormData, token: string): Promise<Producto> => {
    const respuesta = await fetch(`${API_URL}/productos/${id}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: datos,
    });
    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => ({}));
      throw new Error(Array.isArray(cuerpo.message) ? cuerpo.message[0] : cuerpo.message ?? 'No se pudo actualizar el producto.');
    }
    return respuesta.json();
  },
  eliminarProducto: (id: number, token: string) => solicitud(`/productos/${id}`, { method: 'DELETE' }, token),
  validarCarrito: (items: { idProducto: number; version: number }[], token: string) =>
    solicitud<number[]>('/productos/carrito/validar', { method: 'POST', body: JSON.stringify({ items }) }, token),
  crearProducto: async (datos: FormData, token: string): Promise<void> => {
    const respuesta = await fetch(`${API_URL}/productos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: datos,
    });
    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => ({}));
      throw new Error(Array.isArray(cuerpo.message) ? cuerpo.message[0] : cuerpo.message ?? 'No se pudo crear el producto.');
    }
  },
  misProductos: (token: string) => solicitud<Producto[]>('/productos/mi-negocio', {}, token),
  listarCategorias: (token: string) => solicitud<string[]>('/productos/categorias', {}, token),
  listarVendedores: (token: string) => solicitud<Pick<Negocio, 'idNegocio' | 'nombreComercial'>[]>('/productos/vendedores', {}, token),
  buscarProductos: (filtros: FiltrosProductos, token: string) => {
    const parametros = new URLSearchParams();
    if (filtros.q) parametros.set('q', filtros.q);
    if (filtros.categoria) parametros.set('categoria', filtros.categoria);
    if (filtros.idNegocio) parametros.set('idNegocio', String(filtros.idNegocio));
    const query = parametros.toString();
    return solicitud<Producto[]>(`/productos${query ? `?${query}` : ''}`, {}, token);
  },
  obtenerProducto: (idProducto: number, token: string) => solicitud<Producto>(`/productos/${idProducto}`, {}, token),
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
  actualizarNegocio: (
    datos: Omit<Negocio, 'idNegocio'>,
    token: string
  ) =>
    solicitud<Negocio>('/negocios/mi-negocio', {
      method: 'PATCH',
      body: JSON.stringify(datos),
    }, token),
  eliminarNegocio: (token: string) =>
    solicitud<{ mensaje: string }>('/negocios/mi-negocio', {
      method: 'DELETE',
    }, token),
};
