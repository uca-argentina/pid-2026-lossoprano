import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ASSET_URL, Negocio, Producto } from './api';
import { formatCurrency, precioParaCantidad } from './utils';
import { TablaPrecios } from './CampoPreciosEscalonados';

import { limitarCantidad } from './useCarrito';
import type useCarrito from './useCarrito';

export default function PanelComprador({ token, idNegocio, estadoCarrito, abrirCarrito }: {
  token: string; idNegocio: number; estadoCarrito: ReturnType<typeof useCarrito>; abrirCarrito: () => void;
}) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [vendedores, setVendedores] = useState<Pick<Negocio, 'idNegocio' | 'nombreComercial'>[]>([]);
  const [vendedor, setVendedor] = useState(() => estadoCarrito.carrito ? String(estadoCarrito.carrito.idNegocio) : '');
  const busquedaActual = useRef(0);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState<Producto | null>(null);
  const { avisoCarrito, agregar } = estadoCarrito;
  const vendedorCarrito = estadoCarrito.carrito?.idNegocio;

  useEffect(() => {
    setVendedor(vendedorCarrito ? String(vendedorCarrito) : '');
  }, [vendedorCarrito]);

  async function buscar(evento?: FormEvent) {
    evento?.preventDefault();
    const solicitudActual = ++busquedaActual.current;
    setCargando(true);
    setError('');
    try {
      const filtered = await api.buscarProductos({ q: q || undefined, categoria: categoria || undefined, idNegocio: vendedor ? Number(vendedor) : undefined }, token);
      if (solicitudActual === busquedaActual.current) setProductos(filtered);
    } catch (error) {
      if (solicitudActual === busquedaActual.current) setError(error instanceof Error ? error.message : 'No se pudieron buscar productos.');
    } finally {
      if (solicitudActual === busquedaActual.current) setCargando(false);
    }
  }

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { busquedaActual.current++; };
  }, [q, categoria, vendedor, token]);

  useEffect(() => {
    const refrescar = () => { setDetalle(null); void buscar(); };
    window.addEventListener('stock-actualizado', refrescar);
    return () => window.removeEventListener('stock-actualizado', refrescar);
  }, [q, categoria, vendedor, token]);

  useEffect(() => {
    let activo = true;
    async function cargarFiltros() {
      try {
        const [categoriasDisponibles, vendedoresDisponibles] = await Promise.all([
          api.listarCategorias(token), api.listarVendedores(token),
        ]);
        if (activo) {
          setCategorias(categoriasDisponibles);
          setVendedores(vendedoresDisponibles);
        }
      } catch (error) {
        if (activo) setError(error instanceof Error ? error.message : 'No se pudieron cargar los filtros.');
      }
    }
    void cargarFiltros();
    return () => { activo = false; };
  }, [token]);


  return (
    <section className="explorar">
      <div className="explorar-header">
        <div>
          <h2>Explorar catálogo</h2>
          <p className="muted">Buscá productos y filtrá por vendedor para armar tu pedido.</p>
        </div>
      </div>

      <form className="buscador" onSubmit={buscar}>
        <input aria-label="Buscar productos" placeholder="Buscar productos…" value={q} onChange={evento => setQ(evento.target.value)} />
        <select aria-label="Filtrar por vendedor" value={vendedor} onChange={evento => setVendedor(evento.target.value)}>
          <option value="">Todos los vendedores</option>
          {vendedores.map(negocio => <option key={negocio.idNegocio} value={negocio.idNegocio}>{negocio.nombreComercial}</option>)}
        </select>
        <select aria-label="Filtrar por categoría" value={categoria} onChange={evento => setCategoria(evento.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(opcion => <option key={opcion} value={opcion}>{opcion}</option>)}
        </select>
        <button type="submit" className="primary">Buscar</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {avisoCarrito && <p className="muted" role="status">{avisoCarrito}</p>}
      {cargando && <p className="muted">Buscando…</p>}
      {!cargando && productos.length === 0 && <p className="muted">No encontramos productos con esos criterios.</p>}

      <div className="producto-grilla">
        {productos.map(producto => (
          <article className="producto-card" key={producto.idProducto} onClick={() => setDetalle(producto)}>
            {producto.imagenes[0] && <img src={`${ASSET_URL}${producto.imagenes[0]}`} alt={producto.nombre} />}
            <div className="producto-info">
              <span className="producto-marca">{producto.negocio?.nombreComercial}</span>
              <b>{producto.nombre}</b>
              <span className="muted">{producto.categoria.nombre}</span>
              <div className="producto-precio">{formatCurrency(producto.precioBase)}</div>
              {producto.preciosEscalonados.length > 0 && <small className="precio-mayorista">
                Desde {producto.preciosEscalonados[producto.preciosEscalonados.length - 1].cantidadMinima} u: {formatCurrency(producto.preciosEscalonados[producto.preciosEscalonados.length - 1].precioUnitario)} c/u
              </small>}
              <small>Stock: {producto.stock}</small>
              {producto.cantidadMinimaCompra && <small>Mínimo: {producto.cantidadMinimaCompra} unidades</small>}
              {Number(producto.negocio?.montoMinimoOrden) > 0 && <small>Pedido mínimo: {formatCurrency(producto.negocio!.montoMinimoOrden!)}</small>}
              {producto.stock < (producto.cantidadMinimaCompra ?? 1) && <small>No disponible para comprar</small>}
            </div>
          </article>
        ))}
      </div>

      {detalle && <DetalleProducto producto={detalle} mensaje={avisoCarrito} esPropio={detalle.idNegocio === idNegocio} alCerrar={() => setDetalle(null)} alAgregar={async (cantidad) => { if (await agregar(detalle, cantidad)) { setVendedor(String(detalle.idNegocio)); setDetalle(null); abrirCarrito(); } }} />}

    </section>
  );
}

function DetalleProducto({ producto, mensaje, esPropio, alCerrar, alAgregar }: { producto: Producto; mensaje: string; esPropio: boolean; alCerrar: () => void; alAgregar: (cantidad: number) => void | Promise<void> }) {
  const minimo = producto.cantidadMinimaCompra ?? 1;
  const disponible = producto.stock >= minimo;
  const [cantidad, setCantidad] = useState(minimo);
  const precioUnitario = precioParaCantidad(producto.precioBase, producto.preciosEscalonados, cantidad);
  const [agregando, setAgregando] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handlePrevImage = () => {
    setCurrentImageIndex(prev => (prev === 0 ? producto.imagenes.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => (prev === producto.imagenes.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="overlay" onClick={alCerrar}>
      <div className="detalle-panel" onClick={evento => evento.stopPropagation()}>
        <button type="button" className="link detalle-cerrar" onClick={alCerrar}>Cerrar ✕</button>
        <div className="detalle-imagenes">
          {producto.imagenes.length > 1 ? (
            <>
              <button
                type="button"
                className="carousel-nav prev"
                onClick={handlePrevImage}
                disabled={producto.imagenes.length === 0}
              >
                ‹
              </button>
              <div className="carousel-slider">
                <img
                  key={`current-${currentImageIndex}`}
                  src={`${ASSET_URL}${producto.imagenes[currentImageIndex]}`}
                  alt={producto.nombre}
                />
              </div>
              <button
                type="button"
                className="carousel-nav next"
                onClick={handleNextImage}
                disabled={producto.imagenes.length === 0}
              >
                ›
              </button>
              {producto.imagenes.length > 2 && (
                <div className="carousel-dots">
                  {producto.imagenes.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={currentImageIndex === index ? 'active' : ''}
                      onClick={() => setCurrentImageIndex(index)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <img
              src={`${ASSET_URL}${producto.imagenes[0]}`}
              alt={producto.nombre}
            />
          )}
        </div>
        <div className="detalle-info">
          <span className="producto-marca">{producto.negocio?.nombreComercial}</span>
          <h2>{producto.nombre}</h2>
          <span className="muted">{producto.categoria.nombre}</span>
          <p>{producto.descripcion}</p>
          <div className="producto-precio">{formatCurrency(producto.precioBase)} <small>por unidad</small></div>
          <TablaPrecios precioBase={producto.precioBase} tramos={producto.preciosEscalonados} minimo={minimo} />
          <small>Stock disponible: {producto.stock}</small>
          {producto.cantidadMinimaCompra && <p className="muted">Cantidad mínima: {minimo} unidades.</p>}
          {Number(producto.negocio?.montoMinimoOrden) > 0 && <p className="muted">Pedido mínimo a este vendedor: {formatCurrency(producto.negocio!.montoMinimoOrden!)}.</p>}
          {!disponible && <p className="muted">No hay stock suficiente para comprar la cantidad mínima.</p>}
          <div className="detalle-agregar">
            <input
              type="number"
              min={minimo}
              step={1}
              max={producto.stock}
              disabled={esPropio || !disponible}
              value={cantidad}
              onChange={evento => setCantidad(limitarCantidad(evento.target.valueAsNumber, producto.stock, minimo))}
            />
            <button type="button" className="primary" disabled={agregando || esPropio || !disponible} onClick={async () => {
              setAgregando(true);
              try { await alAgregar(cantidad); } finally { setAgregando(false); }
            }}>
              {agregando ? 'Agregando…' : 'Agregar al carrito'}
            </button>
          </div>
          {disponible && !esPropio && <p className="muted detalle-total">
            {cantidad} u × {formatCurrency(precioUnitario)} = <b>{formatCurrency(Number(precioUnitario) * cantidad)}</b>
          </p>}
          {esPropio && <p className="muted">Este producto pertenece a tu negocio. No podés agregarlo al carrito.</p>}
          {mensaje && <p className="muted" role="status">{mensaje}</p>}
        </div>
      </div>
    </div>
  );
}
