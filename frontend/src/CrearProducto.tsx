/**
 * Pantalla del catálogo del vendedor. Coordina listado, alta, edición, borrado,
 * reposición y categorías.
 * Los formularios y modales viven en componentes separados para reutilizar sus campos
 * y mantener esta pantalla centrada en el flujo.
 */

import { useEffect, useState } from 'react';
import { api, imagenUrl, Producto } from './api';
import { formatCurrency } from './utils';
import EditarProducto from './EditarProducto';
import NuevoProducto from './NuevoProducto';
import AgregarStock from './AgregarStock';
import { GestionCategorias, useCategorias } from './CampoCategoria';

export default function CrearProducto({ token }: { token: string }) {
  const [misProductos, setMisProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [crear, setCrear] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [productoStock, setProductoStock] = useState<Producto | null>(null);
  const categorias = useCategorias(token);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    api
      .misProductos(token)
      .then((productos) => {
        if (activo) {
          setMisProductos(productos);
          setError('');
        }
      })
      .catch((error) => {
        if (activo)
          setError(
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar los productos.',
          );
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [token]);

  function actualizarProducto(producto: Producto) {
    setMisProductos((actual) =>
      actual.map((item) => (item.idProducto === producto.idProducto ? producto : item)),
    );
  }

  return (
    <section className="business-panel" id="crear-producto">
      <div className="mis-productos">
        <header className="mis-productos-header">
          <h2>Mis productos</h2>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setMensaje('');
              setCrear(true);
            }}
          >
            Crear nuevo producto
          </button>
        </header>
        {mensaje && (
          <p className="success" role="status">
            {mensaje}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {cargando && (
          <p className="muted" role="status">
            Cargando productos…
          </p>
        )}
        {!cargando && !error && misProductos.length === 0 && (
          <p className="muted">
            Todavía no tenés productos. Creá el primero para empezar a vender.
          </p>
        )}
        <div className="producto-grilla">
          {misProductos.map((producto) => (
            <article
              className="producto-card"
              key={producto.idProducto}
              aria-label={producto.nombre}
            >
              <button
                type="button"
                className="producto-card-editar"
                aria-label={`Editar ${producto.nombre}`}
                onClick={() => {
                  setMensaje('');
                  setProductoSeleccionado(producto);
                }}
              >
                {producto.imagenes[0] && (
                  <img src={imagenUrl(producto.imagenes[0])} alt={producto.nombre} />
                )}
                <div className="producto-info">
                  <b>{producto.nombre}</b>
                  <span className="muted">{producto.categoria.nombre}</span>
                  <div className="producto-precio">
                    {formatCurrency(producto.precioBase)}
                  </div>
                  {producto.preciosEscalonados.length > 0 && (
                    <small>
                      {producto.preciosEscalonados.length === 1
                        ? '1 precio por cantidad'
                        : `${producto.preciosEscalonados.length} precios por cantidad`}
                    </small>
                  )}
                  <small>Stock: {producto.stock}</small>
                  {producto.cantidadMinimaCompra && (
                    <small>Mínimo: {producto.cantidadMinimaCompra} unidades</small>
                  )}
                </div>
              </button>
              <div className="producto-acciones">
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setMensaje('');
                    setProductoSeleccionado(producto);
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="stock-boton"
                  onClick={() => {
                    setMensaje('');
                    setProductoStock(producto);
                  }}
                >
                  Agregar stock
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <hr className="product-separator" />
      <GestionCategorias estado={categorias} />
      {crear && (
        <NuevoProducto
          token={token}
          categorias={categorias}
          alCerrar={() => setCrear(false)}
          alCrear={(producto) => {
            setMisProductos((actual) => [producto, ...actual]);
            setCrear(false);
            setMensaje('Producto creado correctamente.');
            void categorias.recargar();
          }}
        />
      )}
      {productoStock && (
        <AgregarStock
          producto={productoStock}
          token={token}
          alCerrar={() => setProductoStock(null)}
          alGuardar={(producto) => {
            actualizarProducto(producto);
            setProductoStock(null);
            setMensaje(
              `Stock de ${producto.nombre} actualizado: ${producto.stock} unidades.`,
            );
          }}
        />
      )}
      {productoSeleccionado && (
        <EditarProducto
          producto={productoSeleccionado}
          token={token}
          categorias={categorias}
          alCerrar={() => setProductoSeleccionado(null)}
          alGuardar={(producto) => {
            actualizarProducto(producto);
            setProductoSeleccionado(null);
            setMensaje('Producto actualizado correctamente.');
            void categorias.recargar();
          }}
          alEliminar={(id) => {
            setMisProductos((actual) => actual.filter((item) => item.idProducto !== id));
            setProductoSeleccionado(null);
            setMensaje('Producto eliminado correctamente.');
            void categorias.recargar();
          }}
        />
      )}
    </section>
  );
}
