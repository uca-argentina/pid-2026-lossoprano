/**
 * Formulario multipart de alta de producto: recopila campos, fotos y precios por
 * cantidad.
 * Las categorías y los tramos se delegan a campos reutilizables; el backend vuelve a
 * validar los valores antes de guardar.
 */

import { FormEvent, useEffect, useState } from 'react';
import { api, Producto } from './api';
import CampoCategoria, { EstadoCategorias } from './CampoCategoria';
import CampoPreciosEscalonados from './CampoPreciosEscalonados';
import ModalProducto from './ModalProducto';

export default function NuevoProducto({
  token,
  categorias,
  alCerrar,
  alCrear,
}: {
  token: string;
  categorias: EstadoCategorias;
  alCerrar: () => void;
  alCrear: (producto: Producto) => void;
}) {
  const [imagenes, setImagenes] = useState<File[]>([]);
  const [vistas, setVistas] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const urls = imagenes.map((imagen) => URL.createObjectURL(imagen));
    setVistas(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [imagenes]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;
    const datos = new FormData(evento.currentTarget);
    setError('');
    for (const campo of ['nombre', 'descripcion', 'idCategoria']) {
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
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(imagen.type) ||
        imagen.size === 0 ||
        imagen.size > 2 * 1024 * 1024
      ) {
        setError('Las imágenes deben ser JPG, PNG o WebP de hasta 2 MB.');
        return;
      }
    }

    setGuardando(true);
    try {
      alCrear(await api.crearProducto(datos, token));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo crear el producto.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalProducto
      titulo="Crear nuevo producto"
      idTitulo="crear-producto-titulo"
      ocupado={guardando}
      alCerrar={alCerrar}
    >
      <form onSubmit={enviar}>
        <fieldset className="producto-campos" disabled={guardando}>
          <label className="field">
            <span>Nombre</span>
            <input name="nombre" maxLength={150} required />
          </label>
          <label className="field">
            <span>Descripción</span>
            <textarea name="descripcion" rows={4} required />
          </label>
          <CampoCategoria estado={categorias} />
          <div className="form-grid">
            <label className="field">
              <span>Precio base por unidad</span>
              <input
                name="precioBase"
                type="number"
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
              min="1"
              max="2147483647"
              step="1"
              placeholder="Sin mínimo: 1 unidad"
            />
            <small>Dejá el campo vacío para permitir compras desde una unidad.</small>
          </label>
          <CampoPreciosEscalonados />
          <label className="field">
            <span>Imágenes</span>
            <input
              name="imagenes"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              required
              onChange={(evento) => {
                setImagenes(Array.from(evento.target.files ?? []));
                setError('');
              }}
            />
            <small>Hasta 5 imágenes JPG, PNG o WebP de 2 MB cada una.</small>
          </label>
          <div className="producto-imagenes">
            {vistas.map((vista, indice) => (
              <img
                key={vista}
                src={vista}
                alt={imagenes[indice]?.name ?? 'Imagen del producto'}
              />
            ))}
          </div>
          <button type="submit" className="primary">
            {guardando ? 'Guardando…' : 'Crear producto'}
          </button>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </ModalProducto>
  );
}
