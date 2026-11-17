/**
 * Catálogo de otros negocios: búsqueda, filtros y detalle con fotos, precios y
 * cantidad.
 * Aunque se llame Comprador, también lo usan los vendedores cuando realizan compras.
 * El servidor excluye los productos propios y valida stock y mínimos al confirmar; la
 * interfaz anticipa esos mensajes.
 */

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { api, imagenUrl, Negocio, Producto } from './api';
import { formatCurrency, precioParaCantidad } from './utils';
import { TablaPrecios } from './CampoPreciosEscalonados';

import { limitarCantidad } from './useCarrito';
import type useCarrito from './useCarrito';

export default function PanelComprador({
  token,
  idNegocio,
  estadoCarrito,
  abrirCarrito,
}: {
  token: string;
  idNegocio: number;
  estadoCarrito: ReturnType<typeof useCarrito>;
  abrirCarrito: () => void;
}) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [vendedores, setVendedores] = useState<
    Pick<Negocio, 'idNegocio' | 'nombreComercial'>[]
  >([]);
  const [vendedor, setVendedor] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState<Producto | null>(null);
  // Número de la última búsqueda: sirve para ignorar respuestas viejas.
  const busquedaActual = useRef(0);
  const { avisoCarrito, agregar } = estadoCarrito;

  // Busca de nuevo cada vez que cambia el texto o un filtro.
  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      busquedaActual.current++;
    };
  }, [busqueda, categoria, vendedor, token]);

  // Cuando cambia el stock en otra pantalla, cierra el detalle y vuelve a buscar.
  useEffect(() => {
    const refrescar = () => {
      setDetalle(null);
      void buscar();
    };
    window.addEventListener('stock-actualizado', refrescar);
    return () => window.removeEventListener('stock-actualizado', refrescar);
  }, [busqueda, categoria, vendedor, token]);

  // Carga las listas de categorías y vendedores para los filtros.
  useEffect(() => {
    let activo = true;
    async function cargarFiltros() {
      try {
        const [categoriasDisponibles, vendedoresDisponibles] = await Promise.all([
          api.listarCategorias(token),
          api.listarVendedores(token),
        ]);
        if (activo) {
          setCategorias(categoriasDisponibles);
          setVendedores(vendedoresDisponibles);
        }
      } catch (error) {
        if (activo)
          setError(
            error instanceof Error ? error.message : 'No se pudieron cargar los filtros.',
          );
      }
    }
    void cargarFiltros();
    return () => {
      activo = false;
    };
  }, [token]);

  // Pide a la api los productos que coinciden con la búsqueda y los filtros.
  async function buscar(evento?: FormEvent) {
    evento?.preventDefault();
    const solicitudActual = ++busquedaActual.current;
    setCargando(true);
    setError('');
    try {
      const encontrados = await api.buscarProductos(
        {
          q: busqueda || undefined,
          categoria: categoria || undefined,
          idNegocio: vendedor ? Number(vendedor) : undefined,
        },
        token,
      );
      if (solicitudActual === busquedaActual.current) setProductos(encontrados);
    } catch (error) {
      if (solicitudActual === busquedaActual.current)
        setError(
          error instanceof Error ? error.message : 'No se pudieron buscar productos.',
        );
    } finally {
      if (solicitudActual === busquedaActual.current) setCargando(false);
    }
  }

  // Agrega el producto al carrito; si sale bien, cierra el detalle y abre el carrito.
  async function agregarAlCarrito(producto: Producto, cantidad: number) {
    if (await agregar(producto, cantidad)) {
      setDetalle(null);
      abrirCarrito();
    }
  }

  return (
    <section className="explorar">
      {/* Título de la sección */}
      <div className="explorar-header">
        <div>
          <h2>Explorar catálogo</h2>
          <p className="muted">
            Buscá productos y combiná varios vendedores en un mismo pedido.
          </p>
        </div>
      </div>

      {/* Buscador con filtros de vendedor y categoría */}
      <form className="buscador" onSubmit={buscar}>
        <input
          aria-label="Buscar productos"
          placeholder="Buscar productos…"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
        />
        <select
          aria-label="Filtrar por vendedor"
          value={vendedor}
          onChange={(evento) => setVendedor(evento.target.value)}
        >
          <option value="">Todos los vendedores</option>
          {vendedores.map((negocio) => (
            <option key={negocio.idNegocio} value={negocio.idNegocio}>
              {negocio.nombreComercial}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por categoría"
          value={categoria}
          onChange={(evento) => setCategoria(evento.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
        <button type="submit" className="primary">
          Buscar
        </button>
      </form>

      {/* Avisos: error, carrito, buscando y sin resultados */}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {avisoCarrito && (
        <p className="muted" role="status">
          {avisoCarrito}
        </p>
      )}
      {cargando && <p className="muted">Buscando…</p>}
      {!cargando && productos.length === 0 && (
        <p className="muted">No encontramos productos con esos criterios.</p>
      )}

      {/* Grilla de productos; al hacer clic se abre el detalle */}
      <div className="producto-grilla">
        {productos.map((producto) => {
          const primeraImagen = producto.imagenes[0];
          const tramos = producto.preciosEscalonados;
          const ultimoTramo = tramos[tramos.length - 1];
          const negocio = producto.negocio;
          const montoMinimo = Number(negocio?.montoMinimoOrden);
          return (
            <article
              className="producto-card"
              key={producto.idProducto}
              onClick={() => setDetalle(producto)}
            >
              {primeraImagen && (
                <img src={imagenUrl(primeraImagen)} alt={producto.nombre} />
              )}
              <div className="producto-info">
                <span className="producto-marca">
                  {negocio?.nombreComercial}
                </span>
                <b>{producto.nombre}</b>
                <span className="muted">{producto.categoria.nombre}</span>
                <div className="producto-precio">
                  {formatCurrency(producto.precioBase)}
                </div>
                {tramos.length > 0 && (
                  <small className="precio-mayorista">
                    Desde {ultimoTramo.cantidadMinima} u:{' '}
                    {formatCurrency(ultimoTramo.precioUnitario)} c/u
                  </small>
                )}
                <small>Stock: {producto.stock}</small>
                {producto.cantidadMinimaCompra && (
                  <small>Mínimo: {producto.cantidadMinimaCompra} unidades</small>
                )}
                {montoMinimo > 0 && (
                  <small>
                    Pedido mínimo: {formatCurrency(negocio!.montoMinimoOrden!)}
                  </small>
                )}
                {producto.stock < (producto.cantidadMinimaCompra ?? 1) && (
                  <small>No disponible para comprar</small>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Modal con el detalle del producto elegido */}
      {detalle && (
        <DetalleProducto
          producto={detalle}
          mensaje={avisoCarrito}
          esPropio={detalle.idNegocio === idNegocio}
          alCerrar={() => setDetalle(null)}
          alAgregar={(cantidad) => agregarAlCarrito(detalle, cantidad)}
        />
      )}
    </section>
  );
}

/**
 * Muestra fotos y condiciones del producto. La cabecera de cierre queda fuera del
 * contenido desplazable para que ninguna proporción de imagen la tape.
 */
function DetalleProducto({
  producto,
  mensaje,
  esPropio,
  alCerrar,
  alAgregar,
}: {
  producto: Producto;
  mensaje: string;
  esPropio: boolean;
  alCerrar: () => void;
  alAgregar: (cantidad: number) => void | Promise<void>;
}) {
  // Va antes de los useState porque es el valor inicial de la cantidad.
  const minimo = producto.cantidadMinimaCompra ?? 1;
  const [cantidad, setCantidad] = useState(minimo);
  const [agregando, setAgregando] = useState(false);
  const [indiceImagen, setIndiceImagen] = useState(0);
  // Si alcanza el stock para el mínimo y el precio unitario según la cantidad elegida.
  const disponible = producto.stock >= minimo;
  const precioUnitario = precioParaCantidad(
    producto.precioBase,
    producto.preciosEscalonados,
    cantidad,
  );

  // Muestra la foto anterior (desde la primera vuelve a la última).
  function imagenAnterior() {
    setIndiceImagen((anterior) =>
      anterior === 0 ? producto.imagenes.length - 1 : anterior - 1,
    );
  }

  // Muestra la foto siguiente (desde la última vuelve a la primera).
  function imagenSiguiente() {
    setIndiceImagen((anterior) =>
      anterior === producto.imagenes.length - 1 ? 0 : anterior + 1,
    );
  }

  // Ajusta la cantidad escrita entre el mínimo y el stock.
  function cambiarCantidad(evento: ChangeEvent<HTMLInputElement>) {
    setCantidad(limitarCantidad(evento.target.valueAsNumber, producto.stock, minimo));
  }

  // Agrega al carrito y deshabilita el botón mientras tanto.
  async function confirmarAgregar() {
    setAgregando(true);
    try {
      await alAgregar(cantidad);
    } finally {
      setAgregando(false);
    }
  }

  return (
    // Fondo oscuro: al hacer clic afuera se cierra el detalle
    <div className="overlay" onClick={alCerrar}>
      <div className="detalle-panel" onClick={(evento) => evento.stopPropagation()}>
        {/* Botón para cerrar, fijo arriba */}
        <header className="detalle-encabezado">
          <button type="button" className="link detalle-cerrar" onClick={alCerrar}>
            Cerrar ✕
          </button>
        </header>
        <div className="detalle-contenido">
          {/* Fotos: carrusel si hay más de una */}
          <div className="detalle-imagenes">
            {producto.imagenes.length > 1 ? (
              <>
                <button
                  type="button"
                  className="carousel-nav prev"
                  onClick={imagenAnterior}
                  disabled={producto.imagenes.length === 0}
                >
                  ‹
                </button>
                <div className="carousel-slider">
                  <img
                    key={`current-${indiceImagen}`}
                    src={imagenUrl(producto.imagenes[indiceImagen])}
                    alt={producto.nombre}
                  />
                </div>
                <button
                  type="button"
                  className="carousel-nav next"
                  onClick={imagenSiguiente}
                  disabled={producto.imagenes.length === 0}
                >
                  ›
                </button>
                {producto.imagenes.length > 2 && (
                  <div className="carousel-dots">
                    {producto.imagenes.map((_, indice) => (
                      <button
                        key={indice}
                        type="button"
                        className={indiceImagen === indice ? 'active' : ''}
                        onClick={() => setIndiceImagen(indice)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <img src={imagenUrl(producto.imagenes[0])} alt={producto.nombre} />
            )}
          </div>
          {/* Datos del producto, precios y condiciones */}
          <div className="detalle-info">
            <span className="producto-marca">{producto.negocio?.nombreComercial}</span>
            <h2>{producto.nombre}</h2>
            <span className="muted">{producto.categoria.nombre}</span>
            <p>{producto.descripcion}</p>
            <div className="producto-precio">
              {formatCurrency(producto.precioBase)} <small>por unidad</small>
            </div>
            <TablaPrecios
              precioBase={producto.precioBase}
              tramos={producto.preciosEscalonados}
              minimo={minimo}
            />
            <small>Stock disponible: {producto.stock}</small>
            {producto.cantidadMinimaCompra && (
              <p className="muted">Cantidad mínima: {minimo} unidades.</p>
            )}
            {Number(producto.negocio?.montoMinimoOrden) > 0 && (
              <p className="muted">
                Pedido mínimo a este vendedor:{' '}
                {formatCurrency(producto.negocio!.montoMinimoOrden!)}.
              </p>
            )}
            {!disponible && (
              <p className="muted">
                No hay stock suficiente para comprar la cantidad mínima.
              </p>
            )}
            {/* Cantidad y botón para agregar al carrito */}
            <div className="detalle-agregar">
              <input
                type="number"
                min={minimo}
                step={1}
                max={producto.stock}
                disabled={esPropio || !disponible}
                value={cantidad}
                onChange={cambiarCantidad}
              />
              <button
                type="button"
                className="primary"
                disabled={agregando || esPropio || !disponible}
                onClick={() => confirmarAgregar()}
              >
                {agregando ? 'Agregando…' : 'Agregar al carrito'}
              </button>
            </div>
            {/* Total estimado y avisos */}
            {disponible && !esPropio && (
              <p className="muted detalle-total">
                {cantidad} u × {formatCurrency(precioUnitario)} ={' '}
                <b>{formatCurrency(Number(precioUnitario) * cantidad)}</b>
              </p>
            )}
            {esPropio && (
              <p className="muted">
                Este producto pertenece a tu negocio. No podés agregarlo al carrito.
              </p>
            )}
            {mensaje && (
              <p className="muted" role="status">
                {mensaje}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
