/**
 * Formulario de edición de un producto existente con sus valores precargados.
 * Editar sin fotos nuevas conserva las anteriores. Una edición comercial invalida las
 * versiones del producto guardadas en carritos.
 */

import { FormEvent, useEffect, useState } from 'react';
import { api, imagenUrl, Producto } from './api';
import CampoCategoria, { EstadoCategorias } from './CampoCategoria';
import CampoPreciosEscalonados from './CampoPreciosEscalonados';
import ModalProducto from './ModalProducto';

export default function EditarProducto({
  producto,
  token,
  categorias,
  alCerrar,
  alGuardar,
  alEliminar,
}: {
  producto: Producto;
  token: string;
  categorias: EstadoCategorias;
  alCerrar: () => void;
  alGuardar: (producto: Producto) => void;
  alEliminar: (id: number) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [imagenes, setImagenes] = useState<File[]>([]);
  const [vistas, setVistas] = useState<string[]>([]);

  useEffect(() => {
    const urls = imagenes.map((imagen) => URL.createObjectURL(imagen));
    setVistas(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [imagenes]);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado) return;
    const datos = new FormData(evento.currentTarget);
    for (const campo of ['nombre', 'descripcion', 'idCategoria']) {
      const valor = String(datos.get(campo) ?? '').trim();
      if (!valor) {
        setError('Completá el nombre, la descripción y la categoría.');
        return;
      }
      datos.set(campo, valor);
    }
    datos.delete('imagenes');
    if (
      imagenes.length > 5 ||
      imagenes.some(
        (imagen) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(imagen.type) ||
          imagen.size === 0 ||
          imagen.size > 2 * 1024 * 1024,
      )
    ) {
      setError('Seleccioná hasta 5 imágenes JPG, PNG o WebP de hasta 2 MB cada una.');
      return;
    }
    imagenes.forEach((imagen) => datos.append('imagenes', imagen));
    setError('');
    setOcupado(true);
    try {
      alGuardar(await api.actualizarProducto(producto.idProducto, datos, token));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'No se pudo actualizar el producto.',
      );
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar() {
    if (
      ocupado ||
      !window.confirm(
        `¿Eliminar ${producto.nombre}? Se quitará también de los carritos de los compradores. Esta acción no se puede deshacer.`,
      )
    )
      return;
    setOcupado(true);
    setError('');
    try {
      await api.eliminarProducto(producto.idProducto, token);
      alEliminar(producto.idProducto);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'No se pudo eliminar el producto.',
      );
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ModalProducto
      titulo="Editar producto"
      idTitulo="editar-producto-titulo"
      ocupado={ocupado}
      alCerrar={alCerrar}
    >
      <p className="muted">
        Al guardar cambios, este producto se quitará de los carritos de los compradores.
      </p>
      <form onSubmit={guardar}>
        <fieldset className="producto-campos" disabled={ocupado}>
          <label className="field">
            <span>Nombre</span>
            <input
              name="nombre"
              defaultValue={producto.nombre}
              maxLength={150}
              required
            />
          </label>
          <label className="field">
            <span>Descripción</span>
            <textarea
              name="descripcion"
              defaultValue={producto.descripcion}
              rows={4}
              required
            />
          </label>
          <CampoCategoria estado={categorias} valorInicial={producto.idCategoria} />
          <div className="form-grid">
            <label className="field">
              <span>Precio base por unidad</span>
              <input
                name="precioBase"
                type="number"
                defaultValue={producto.precioBase}
                min="0.01"
                max="9999999999.99"
                step="0.01"
                required
              />
            </label>
            <label className="field">
              <span>Stock</span>
              <input
                name="stock"
                type="number"
                defaultValue={producto.stock}
                min="0"
                max="2147483647"
                step="1"
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Cantidad mínima de compra (opcional)</span>
            <input
              name="cantidadMinimaCompra"
              type="number"
              defaultValue={producto.cantidadMinimaCompra ?? ''}
              min="1"
              max="2147483647"
              step="1"
              placeholder="Sin mínimo: 1 unidad"
            />
            <small>
              Vacío permite comprar desde una unidad. Si el stock es menor que el mínimo,
              el producto no estará disponible para comprar.
            </small>
          </label>
          <CampoPreciosEscalonados inicial={producto.preciosEscalonados} />
          <div className="producto-imagenes">
            {(imagenes.length
              ? vistas
              : producto.imagenes.map((ruta) => imagenUrl(ruta))
            ).map((ruta, indice) => (
              <img key={ruta} src={ruta} alt={`Imagen ${indice + 1} del producto`} />
            ))}
          </div>
          <label className="field">
            <span>Reemplazar imágenes</span>
            <input
              name="imagenes"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(evento) => setImagenes(Array.from(evento.target.files ?? []))}
            />
            <small>
              Opcional. Si seleccionás nuevas imágenes, reemplazarán todas las actuales.
              Hasta 5 imágenes de 2 MB cada una.
            </small>
          </label>
          <button type="submit" className="primary">
            {ocupado ? 'Procesando…' : 'Guardar cambios'}
          </button>
        </fieldset>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="danger-zone">
        <div>
          <h2>Eliminar producto</h2>
          <p>Se eliminará del catálogo y de los carritos.</p>
        </div>
        <button type="button" className="danger" disabled={ocupado} onClick={eliminar}>
          Eliminar producto
        </button>
      </section>
    </ModalProducto>
  );
}
