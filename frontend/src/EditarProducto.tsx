import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, ASSET_URL, Producto } from './api';
import CampoCategoria from './CampoCategoria';

export default function EditarProducto({ producto, token, alCerrar, alGuardar, alEliminar }: {
  producto: Producto; token: string; alCerrar: () => void;
  alGuardar: (producto: Producto) => void; alEliminar: (id: number) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [imagenes, setImagenes] = useState<File[]>([]);
  const [vistas, setVistas] = useState<string[]>([]);

  useLayoutEffect(() => {
    const elemento = dialogo.current!;
    const cuerpo = document.body;
    const raiz = document.documentElement;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const propiedades = ['position', 'top', 'left', 'width', 'overflow', 'padding-right'] as const;
    const estilosPrevios = propiedades.map(propiedad => ({
      propiedad,
      valor: cuerpo.style.getPropertyValue(propiedad),
      prioridad: cuerpo.style.getPropertyPriority(propiedad),
    }));
    const overflowPrevio = raiz.style.getPropertyValue('overflow');
    const prioridadOverflow = raiz.style.getPropertyPriority('overflow');
    const anchoScrollbar = window.innerWidth - raiz.clientWidth;
    const paddingDerecho = parseFloat(window.getComputedStyle(cuerpo).paddingRight) || 0;
    cuerpo.style.position = 'fixed';
    cuerpo.style.top = `-${scrollY}px`;
    cuerpo.style.left = `-${scrollX}px`;
    cuerpo.style.width = '100%';
    cuerpo.style.overflow = 'hidden';
    cuerpo.style.paddingRight = `${paddingDerecho + anchoScrollbar}px`;
    raiz.style.overflow = 'hidden';
    elemento.showModal();
    return () => {
      elemento.close();
      for (const { propiedad, valor, prioridad } of estilosPrevios) {
        if (valor) cuerpo.style.setProperty(propiedad, valor, prioridad);
        else cuerpo.style.removeProperty(propiedad);
      }
      if (overflowPrevio) raiz.style.setProperty('overflow', overflowPrevio, prioridadOverflow);
      else raiz.style.removeProperty('overflow');
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
    };
  }, []);
  useEffect(() => {
    const urls = imagenes.map(imagen => URL.createObjectURL(imagen));
    setVistas(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [imagenes]);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado) return;
    const datos = new FormData(evento.currentTarget);
    for (const campo of ['nombre', 'descripcion', 'categoria']) {
      const valor = String(datos.get(campo) ?? '').trim();
      if (!valor) { setError('Completá el nombre, la descripción y la categoría.'); return; }
      datos.set(campo, valor);
    }
    datos.delete('imagenes');
    if (imagenes.length > 5 || imagenes.some(imagen =>
      !['image/jpeg', 'image/png', 'image/webp'].includes(imagen.type) || imagen.size === 0 || imagen.size > 2 * 1024 * 1024,
    )) { setError('Seleccioná hasta 5 imágenes JPG, PNG o WebP de hasta 2 MB cada una.'); return; }
    imagenes.forEach(imagen => datos.append('imagenes', imagen));
    setError('');
    setOcupado(true);
    try { alGuardar(await api.actualizarProducto(producto.idProducto, datos, token)); }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo actualizar el producto.'); }
    finally { setOcupado(false); }
  }

  async function eliminar() {
    if (ocupado || !window.confirm(`¿Eliminar ${producto.nombre}? Se quitará también de los carritos de los compradores. Esta acción no se puede deshacer.`)) return;
    setOcupado(true);
    setError('');
    try {
      await api.eliminarProducto(producto.idProducto, token);
      alEliminar(producto.idProducto);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo eliminar el producto.'); }
    finally { setOcupado(false); }
  }

  return <dialog ref={dialogo} className="editar-producto-modal" aria-labelledby="editar-producto-titulo"
    onCancel={evento => { evento.preventDefault(); if (!ocupado) alCerrar(); }}
    onClick={evento => { if (evento.target === evento.currentTarget && !ocupado) alCerrar(); }}>
    <div className="editar-producto-contenido">
      <header><h2 id="editar-producto-titulo">Editar producto</h2>
        <button type="button" className="link" disabled={ocupado} onClick={alCerrar}>Cerrar ✕</button></header>
      <p className="muted">Al guardar cambios, este producto se quitará de los carritos de los compradores.</p>
      <form onSubmit={guardar}>
        <fieldset className="producto-campos" disabled={ocupado}>
          <label className="field"><span>Nombre</span><input name="nombre" defaultValue={producto.nombre} maxLength={150} required /></label>
          <label className="field"><span>Descripción</span><textarea name="descripcion" defaultValue={producto.descripcion} rows={4} required /></label>
          <CampoCategoria token={token} valorInicial={producto.categoria} />
          <div className="form-grid">
            <label className="field"><span>Precio base por unidad</span><input name="precioBase" type="number" defaultValue={producto.precioBase} min="0.01" max="9999999999.99" step="0.01" required /></label>
            <label className="field"><span>Stock</span><input name="stock" type="number" defaultValue={producto.stock} min="0" max="2147483647" step="1" required /></label>
          </div>
          <div className="producto-imagenes">{(imagenes.length ? vistas : producto.imagenes.map(ruta => `${ASSET_URL}${ruta}`)).map((ruta, indice) =>
            <img key={ruta} src={ruta} alt={`Imagen ${indice + 1} del producto`} />)}</div>
          <label className="field"><span>Reemplazar imágenes</span><input name="imagenes" type="file" accept="image/jpeg,image/png,image/webp" multiple
            onChange={evento => setImagenes(Array.from(evento.target.files ?? []))} />
            <small>Opcional. Si seleccionás nuevas imágenes, reemplazarán todas las actuales. Hasta 5 imágenes de 2 MB cada una.</small></label>
          <button type="submit" className="primary">{ocupado ? 'Procesando…' : 'Guardar cambios'}</button>
        </fieldset>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="danger-zone"><div><h2>Eliminar producto</h2><p>Se eliminará del catálogo y de los carritos.</p></div>
        <button type="button" className="danger" disabled={ocupado} onClick={eliminar}>Eliminar producto</button></section>
    </div>
  </dialog>;
}
