import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, ASSET_URL, Producto } from './api';
import { formatCurrency } from './utils';

type ItemCarrito = { idProducto: number; nombre: string; precioBase: string; cantidad: number; stock: number; imagen?: string };
type Carrito = { idNegocio: number; nombreNegocio: string; items: ItemCarrito[] } | null;

function useCarrito(idCliente: number) {
  const clave = `bulkmarket-carrito-${idCliente}`;
  const [carrito, setCarrito] = useState<Carrito>(() => {
    const valor = localStorage.getItem(clave);
    return valor ? JSON.parse(valor) : null;
  });

  useEffect(() => {
    if (carrito) localStorage.setItem(clave, JSON.stringify(carrito));
    else localStorage.removeItem(clave);
  }, [carrito, clave]);

  function agregar(producto: Producto, cantidad: number) {
    if (carrito && carrito.idNegocio !== producto.idNegocio) {
      const confirmado = window.confirm(
        `Tu carrito tiene productos de ${carrito.nombreNegocio}. Solo podés comprarle a un vendedor por vez.\n\n¿Vaciar el carrito y agregar este producto de ${producto.negocio?.nombreComercial ?? 'otra marca'}?`,
      );
      if (!confirmado) return;
    }

    setCarrito(actual => {
      const base: Carrito =
        actual && actual.idNegocio === producto.idNegocio
          ? actual
          : { idNegocio: producto.idNegocio, nombreNegocio: producto.negocio?.nombreComercial ?? 'Vendedor', items: [] };
      const existente = base!.items.find(item => item.idProducto === producto.idProducto);
      const items = existente
        ? base!.items.map(item => (item.idProducto === producto.idProducto ? { ...item, cantidad: item.cantidad + cantidad } : item))
        : [
            ...base!.items,
            {
              idProducto: producto.idProducto,
              nombre: producto.nombre,
              precioBase: producto.precioBase,
              cantidad,
              stock: producto.stock,
              imagen: producto.imagenes[0],
            },
          ];
      return { ...base!, items };
    });
  }

  function actualizarCantidad(idProducto: number, cantidad: number) {
    setCarrito(actual => {
      if (!actual) return actual;
      const items = actual.items.map(item => (item.idProducto === idProducto ? { ...item, cantidad } : item));
      return { ...actual, items };
    });
  }

  function quitar(idProducto: number) {
    setCarrito(actual => {
      if (!actual) return actual;
      const items = actual.items.filter(item => item.idProducto !== idProducto);
      return items.length > 0 ? { ...actual, items } : null;
    });
  }

  function vaciar() {
    setCarrito(null);
  }

  return { carrito, agregar, actualizarCantidad, quitar, vaciar };
}

export default function PanelComprador({ token, idCliente }: { token: string; idCliente: number }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [todosLosProductos, setTodosLosProductos] = useState<Producto[]>([]);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState<Producto | null>(null);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const { carrito, agregar, actualizarCantidad, quitar, vaciar } = useCarrito(idCliente);

  async function buscar(evento?: FormEvent) {
    evento?.preventDefault();
    setCargando(true);
    setError('');
    try {
      const filtered = await api.buscarProductos({ q: q || undefined, categoria: categoria || undefined }, token);
      setProductos(filtered);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudieron buscar productos.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, categoria]);

  // Load all products initially to build category list
  useEffect(() => {
    async function loadAllProducts() {
      try {
        const allProducts = await api.buscarProductos({ q: undefined, categoria: undefined }, token);
        setTodosLosProductos(allProducts);
        setProductos(allProducts);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'No se pudieron cargar productos.');
      }
    }
    loadAllProducts();
  }, [token]);

  const categorias = useMemo(() => Array.from(new Set(todosLosProductos.map(producto => producto.categoria))).sort(), [todosLosProductos]);
  const totalItemsCarrito = carrito?.items.reduce((total, item) => total + item.cantidad, 0) ?? 0;
  const subtotalCarrito = carrito?.items.reduce((total, item) => total + item.cantidad * Number(item.precioBase), 0) ?? 0;

  return (
    <section className="explorar">
      <div className="explorar-header">
        <div>
          <h2>Explorar catálogo</h2>
          <p className="muted">Buscá productos y marcas para armar tu pedido.</p>
        </div>
        <button type="button" className="carrito-boton" onClick={() => setCarritoAbierto(true)}>
          🛒 Carrito{totalItemsCarrito > 0 && <span className="carrito-badge">{totalItemsCarrito}</span>}
        </button>
      </div>

      <form className="buscador" onSubmit={buscar}>
        <input placeholder="Buscar productos o marcas…" value={q} onChange={evento => setQ(evento.target.value)} />
        <select value={categoria} onChange={evento => setCategoria(evento.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(opcion => <option key={opcion} value={opcion}>{opcion}</option>)}
        </select>
        <button type="submit" className="primary">Buscar</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {cargando && <p className="muted">Buscando…</p>}
      {!cargando && productos.length === 0 && <p className="muted">No encontramos productos con esos criterios.</p>}

      <div className="producto-grilla">
        {productos.map(producto => (
          <article className="producto-card" key={producto.idProducto} onClick={() => setDetalle(producto)}>
            {producto.imagenes[0] && <img src={`${ASSET_URL}${producto.imagenes[0]}`} alt={producto.nombre} />}
            <div className="producto-info">
              <span className="producto-marca">{producto.negocio?.nombreComercial}</span>
              <b>{producto.nombre}</b>
              <span className="muted">{producto.categoria}</span>
              <div className="producto-precio">{formatCurrency(producto.precioBase)}</div>
              <small>Stock: {producto.stock}</small>
            </div>
          </article>
        ))}
      </div>

      {detalle && <DetalleProducto producto={detalle} alCerrar={() => setDetalle(null)} alAgregar={(cantidad) => { agregar(detalle, cantidad); setDetalle(null); setCarritoAbierto(true); }} />}

      {carritoAbierto && (
        <div className="overlay" onClick={() => setCarritoAbierto(false)}>
          <aside className="carrito-panel" onClick={evento => evento.stopPropagation()}>
            <header>
              <h2>Tu carrito</h2>
              <button type="button" className="link" onClick={() => setCarritoAbierto(false)}>Cerrar</button>
            </header>
            {!carrito || carrito.items.length === 0 ? (
              <p className="muted">Todavía no agregaste productos.</p>
            ) : (
              <>
                <p className="muted">Vendedor: <b>{carrito.nombreNegocio}</b></p>
                <ul className="carrito-items">
                  {carrito.items.map(item => (
                    <li key={item.idProducto}>
                      {item.imagen && <img src={`${ASSET_URL}${item.imagen}`} alt={item.nombre} />}
                      <div className="carrito-item-info">
                        <b>{item.nombre}</b>
                        <span className="muted">{formatCurrency(item.precioBase)} c/u</span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={item.stock}
                        value={item.cantidad}
                        onChange={evento => actualizarCantidad(item.idProducto, Math.max(1, Math.min(item.stock, Number(evento.target.value))))}
                      />
                      <button type="button" className="link" onClick={() => quitar(item.idProducto)}>Quitar</button>
                    </li>
                  ))}
                </ul>
                <div className="carrito-subtotal">
                  <span>Subtotal</span>
                  <b>{formatCurrency(subtotalCarrito)}</b>
                </div>
                <button type="button" className="danger" onClick={vaciar}>Vaciar carrito</button>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function DetalleProducto({ producto, alCerrar, alAgregar }: { producto: Producto; alCerrar: () => void; alAgregar: (cantidad: number) => void }) {
  const [cantidad, setCantidad] = useState(1);

  return (
    <div className="overlay" onClick={alCerrar}>
      <div className="detalle-panel" onClick={evento => evento.stopPropagation()}>
        <button type="button" className="link detalle-cerrar" onClick={alCerrar}>Cerrar ✕</button>
        <div className="detalle-imagenes">
          {producto.imagenes.map(imagen => <img key={imagen} src={`${ASSET_URL}${imagen}`} alt={producto.nombre} />)}
        </div>
        <div className="detalle-info">
          <span className="producto-marca">{producto.negocio?.nombreComercial}</span>
          <h2>{producto.nombre}</h2>
          <span className="muted">{producto.categoria}</span>
          <p>{producto.descripcion}</p>
          <div className="producto-precio">{formatCurrency(producto.precioBase)} <small>por unidad</small></div>
          <small>Stock disponible: {producto.stock}</small>
          <div className="detalle-agregar">
            <input
              type="number"
              min={1}
              max={producto.stock}
              value={cantidad}
              onChange={evento => setCantidad(Math.max(1, Math.min(producto.stock, Number(evento.target.value))))}
            />
            <button type="button" className="primary" disabled={producto.stock === 0} onClick={() => alAgregar(cantidad)}>
              Agregar al carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
