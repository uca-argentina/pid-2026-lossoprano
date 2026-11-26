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

  // Carga los productos del vendedor cada vez que cambia el token.
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

  // Reemplaza en la lista el producto que cambió, manteniendo los demás.
  // AYUDA: después de cambiar un producto en el back: const r = await api.algo(...); actualizarProducto(r);  (refresca la lista)
  function actualizarProducto(producto: Producto) {
    setMisProductos((actual) =>
      actual.map((item) => (item.idProducto === producto.idProducto ? producto : item)),
    );
  }

  // Limpia el mensaje y abre el modal para crear un producto nuevo.
  function abrirCreacion() {
    setMensaje('');
    setCrear(true);
  }

  // Limpia el mensaje y abre el modal para editar el producto elegido.
  function abrirEdicion(producto: Producto) {
    setMensaje('');
    setProductoSeleccionado(producto);
  }

  // Limpia el mensaje y abre el modal para sumar stock al producto elegido.
  function abrirStock(producto: Producto) {
    setMensaje('');
    setProductoStock(producto);
  }

  // Agrega el producto recién creado arriba de la lista y cierra el modal.
  function productoCreado(producto: Producto) {
    setMisProductos((actual) => [producto, ...actual]);
    setCrear(false);
    setMensaje('Producto creado correctamente.');
    void categorias.recargar();
  }

  // Guarda el stock nuevo en la lista, cierra el modal y avisa cuántas unidades quedaron.
  function stockGuardado(producto: Producto) {
    actualizarProducto(producto);
    setProductoStock(null);
    setMensaje(`Stock de ${producto.nombre} actualizado: ${producto.stock} unidades.`);
  }

  // Guarda los cambios del producto editado en la lista y cierra el modal.
  function productoGuardado(producto: Producto) {
    actualizarProducto(producto);
    setProductoSeleccionado(null);
    setMensaje('Producto actualizado correctamente.');
    void categorias.recargar();
  }

  // Saca de la lista el producto borrado y cierra el modal.
  function productoEliminado(id: number) {
    setMisProductos((actual) => actual.filter((item) => item.idProducto !== id));
    setProductoSeleccionado(null);
    setMensaje('Producto eliminado correctamente.');
    void categorias.recargar();
  }

  return (
    <section className="business-panel" id="crear-producto">
      <div className="mis-productos">
        {/* Título de la sección y botón para crear un producto */}
        <header className="mis-productos-header">
          <h2>Mis productos</h2>
          <button type="button" className="primary" onClick={() => abrirCreacion()}>
            Crear nuevo producto
          </button>
        </header>

        {/* Avisos: éxito, error, cargando y lista vacía */}
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

        {/* Grilla con una tarjeta por producto */}
        <div className="producto-grilla">
          {misProductos.map((producto) => {
            const primeraImagen = producto.imagenes[0];
            const cantidadPrecios = producto.preciosEscalonados.length;
            return (
              <article
                className="producto-card"
                key={producto.idProducto}
                aria-label={producto.nombre}
              >
                {/* Tarjeta clickeable: muestra los datos y abre la edición */}
                <button
                  type="button"
                  className="producto-card-editar"
                  aria-label={`Editar ${producto.nombre}`}
                  onClick={() => abrirEdicion(producto)}
                >
                  {primeraImagen && (
                    <img src={imagenUrl(primeraImagen)} alt={producto.nombre} />
                  )}
                  <div className="producto-info">
                    <b>{producto.nombre}</b>
                    <span className="muted">{producto.categoria.nombre}</span>
                    <div className="producto-precio">
                      {formatCurrency(producto.precioBase)}
                    </div>
                    {cantidadPrecios > 0 && (
                      <small>
                        {cantidadPrecios === 1
                          ? '1 precio por cantidad'
                          : `${cantidadPrecios} precios por cantidad`}
                      </small>
                    )}
                    <small>Stock: {producto.stock}</small>
                    {producto.cantidadMinimaCompra && (
                      <small>Mínimo: {producto.cantidadMinimaCompra} unidades</small>
                    )}
                  </div>
                </button>

                {/* Botones de la tarjeta: editar y agregar stock */}
                <div className="producto-acciones">
                  <button
                    type="button"
                    className="link"
                    onClick={() => abrirEdicion(producto)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="stock-boton"
                    onClick={() => abrirStock(producto)}
                  >
                    Agregar stock
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <hr className="product-separator" />

      {/* Administración de categorías */}
      <GestionCategorias estado={categorias} />

      {/* Modal para crear un producto */}
      {crear && (
        <NuevoProducto
          token={token}
          categorias={categorias}
          alCerrar={() => setCrear(false)}
          alCrear={productoCreado}
        />
      )}

      {/* Modal para agregar stock */}
      {productoStock && (
        <AgregarStock
          producto={productoStock}
          token={token}
          alCerrar={() => setProductoStock(null)}
          alGuardar={stockGuardado}
        />
      )}

      {/* Modal para editar o borrar un producto */}
      {productoSeleccionado && (
        <EditarProducto
          producto={productoSeleccionado}
          token={token}
          categorias={categorias}
          alCerrar={() => setProductoSeleccionado(null)}
          alGuardar={productoGuardado}
          alEliminar={productoEliminado}
        />
      )}
    </section>
  );
}
