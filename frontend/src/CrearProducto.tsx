import { FormEvent, useEffect, useState } from 'react';
import { api, ASSET_URL, Producto } from './api';
import { formatCurrency } from './utils';
import EditarProducto from './EditarProducto';

interface CrearProductoProps {
  token: string;
  listPosition?: 'above' | 'below';
}

export default function CrearProducto({ token, listPosition = 'below' }: CrearProductoProps) {
  const [imagenes, setImagenes] = useState<File[]>([]);
  const [vistas, setVistas] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [misProductos, setMisProductos] = useState<Producto[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);

  useEffect(() => {
    const urls = imagenes.map(imagen => URL.createObjectURL(imagen));
    setVistas(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [imagenes]);

  useEffect(() => {
    api.misProductos(token).then(setMisProductos).catch(() => {});
  }, [token]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    setError('');
    setMensaje('');

    for (const campo of ['nombre', 'descripcion', 'categoria']) {
      const valor = String(datos.get(campo)).trim();
      if (!valor) {
        setError('Completá el nombre, la descripción y la categoría.');
        return;
      }
      datos.set(campo, valor);
    }

    if (imagenes.length === 0 || imagenes.length > 5) {
      setError('Seleccioná entre una y cinco imágenes.');
      return;
    }
    for (const imagen of imagenes) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(imagen.type) || imagen.size === 0 || imagen.size > 2 * 1024 * 1024) {
        setError('Las imágenes deben ser JPG, PNG o WebP de hasta 2 MB.');
        return;
      }
    }

    setGuardando(true);
    try {
      await api.crearProducto(datos, token);
      formulario.reset();
      setImagenes([]);
      setMensaje('Producto creado correctamente.');
      setMisProductos(await api.misProductos(token));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo crear el producto.');
    } finally {
      setGuardando(false);
    }
  }

  const productosList = misProductos.length > 0 ? (
    <div className="mis-productos">
      <h2>Mis productos</h2>
      <div className="producto-grilla">
        {misProductos.map(producto => (
          <article className="producto-card" key={producto.idProducto} role="button" tabIndex={0}
            onClick={() => setProductoSeleccionado(producto)}
            onKeyDown={evento => {
              if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                setProductoSeleccionado(producto);
              }
            }}>
            {producto.imagenes[0] && <img src={`${ASSET_URL}${producto.imagenes[0]}`} alt={producto.nombre} />}
            <div className="producto-info">
              <b>{producto.nombre}</b>
              <span className="muted">{producto.categoria}</span>
              <div className="producto-precio">{formatCurrency(producto.precioBase)}</div>
              <small>Stock: {producto.stock}</small>
            </div>
          </article>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <section className="business-panel" id="crear-producto">
      {listPosition === 'above' && productosList}
      {listPosition === 'above' && productosList && <hr className="product-separator" />}
      <form onSubmit={enviar}>
        <h2>Crear producto</h2>
        <fieldset className="producto-campos" disabled={guardando}>
          <label className="field">
            <span>Nombre</span>
            <input name="nombre" maxLength={150} required />
          </label>
          <label className="field">
            <span>Descripción</span>
            <textarea name="descripcion" rows={4} required />
          </label>
          <label className="field">
            <span>Categoría</span>
            <input name="categoria" maxLength={100} required />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Precio base por unidad</span>
              <input name="precioBase" type="number" min="0.01" max="9999999999.99" step="0.01" required />
            </label>
            <label className="field">
              <span>Stock</span>
              <input name="stock" type="number" min="0" max="2147483647" step="1" required />
            </label>
          </div>
          <label className="field">
            <span>Imágenes</span>
            <input name="imagenes" type="file" accept="image/jpeg,image/png,image/webp" multiple required
              onChange={evento => {
                setImagenes(Array.from(evento.target.files ?? []));
                setError('');
                setMensaje('');
              }} />
            <small>Hasta 5 imágenes JPG, PNG o WebP de 2 MB cada una.</small>
          </label>
          <div className="producto-imagenes">
            {vistas.map((vista, indice) => <img key={vista} src={vista} alt={imagenes[indice]?.name ?? 'Imagen del producto'} />)}
          </div>
          <button type="submit" className="primary">{guardando ? 'Guardando…' : 'Crear producto'}</button>
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        {mensaje && <p className="success" role="status">{mensaje}</p>}
      </form>
      {listPosition === 'below' && productosList}
      {productoSeleccionado && <EditarProducto
        producto={productoSeleccionado}
        token={token}
        alCerrar={() => setProductoSeleccionado(null)}
        alGuardar={producto => {
          setMisProductos(actual => actual.map(item => item.idProducto === producto.idProducto ? producto : item));
          setProductoSeleccionado(null);
          setMensaje('Producto actualizado correctamente.');
        }}
        alEliminar={id => {
          setMisProductos(actual => actual.filter(item => item.idProducto !== id));
          setProductoSeleccionado(null);
          setMensaje('Producto eliminado correctamente.');
        }}
      />}
    </section>
  );
}
