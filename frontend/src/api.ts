export type Rol = 'COMPRADOR' | 'VENDEDOR';

export type Negocio = {
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
  return respuesta.status === 204 ? undefined as T : respuesta.json();
}

export const api = {
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
