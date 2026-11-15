/**
 * Hook y controles compartidos para consultar, crear y eliminar categorías del
 * vendedor.
 * Las categorías generales se pueden usar pero no borrar; las propias requieren no
 * tener productos asociados para eliminarlas.
 */

import { KeyboardEvent, useCallback, useEffect, useState } from 'react';
import { api, CategoriaDisponible } from './api';

// Hook que carga las categorías del vendedor y permite crear y borrar.
export function useCategorias(token: string) {
  const [categorias, setCategorias] = useState<CategoriaDisponible[]>([]);
  const [error, setError] = useState('');
  // Vuelve a pedir las categorías a la api. Va antes del useEffect porque este la usa.
  const recargar = useCallback(async () => {
    try {
      setCategorias(await api.categoriasDisponibles(token));
      setError('');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'No se pudieron cargar las categorías.',
      );
    }
  }, [token]);

  // Carga las categorías al empezar y cuando cambia el token.
  useEffect(() => {
    void recargar();
  }, [recargar]);

  // Crea una categoría en la api y la suma a la lista ordenada por nombre.
  async function crear(nombre: string) {
    const nueva = await api.crearCategoria(nombre, token);
    setCategorias((actual) =>
      [...actual, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    );
    return nueva;
  }

  // Borra una categoría en la api y la saca de la lista.
  async function eliminar(idCategoria: number) {
    await api.eliminarCategoria(idCategoria, token);
    setCategorias((actual) =>
      actual.filter((categoria) => categoria.idCategoria !== idCategoria),
    );
  }

  return { categorias, error, recargar, crear, eliminar };
}

export type EstadoCategorias = ReturnType<typeof useCategorias>;

// Selector de categoría con opción de crear una nueva en el momento.
export default function CampoCategoria({
  estado,
  valorInicial,
}: {
  estado: EstadoCategorias;
  valorInicial?: number;
}) {
  const [valor, setValor] = useState(valorInicial ? String(valorInicial) : '');
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Categorías separadas en generales y propias del vendedor.
  const generales = estado.categorias.filter((categoria) => categoria.general);
  const propias = estado.categorias.filter((categoria) => !categoria.general);

  // Crea la categoría escrita y la deja elegida en el selector.
  async function crear() {
    if (guardando) return;
    if (!nombre.trim()) {
      setError('Escribí el nombre de la categoría.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const nueva = await estado.crear(nombre);
      setValor(String(nueva.idCategoria));
      setNombre('');
      setCreando(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo crear la categoría.');
    } finally {
      setGuardando(false);
    }
  }

  // Con Enter crea la categoría sin mandar el formulario del producto.
  function teclaEnNombre(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      void crear();
    }
  }

  // Oculta el campo de nueva categoría y borra el error.
  function cancelarCreacion() {
    setCreando(false);
    setError('');
  }

  return (
    <div className="field">
      {/* Selector con las categorías generales y las propias */}
      <label>
        <span>Categoría</span>
        <select
          name="idCategoria"
          value={valor}
          onChange={(evento) => setValor(evento.target.value)}
          required
        >
          <option value="" disabled>
            Elegí una categoría
          </option>
          <optgroup label="Generales">
            {generales.map((categoria) => (
              <option key={categoria.idCategoria} value={categoria.idCategoria}>
                {categoria.nombre}
              </option>
            ))}
          </optgroup>
          {propias.length > 0 && (
            <optgroup label="Mis categorías">
              {propias.map((categoria) => (
                <option key={categoria.idCategoria} value={categoria.idCategoria}>
                  {categoria.nombre}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {/* Campo para crear una categoría, o el botón para mostrarlo */}
      {creando ? (
        <div className="categoria-nueva">
          <input
            aria-label="Nombre de la nueva categoría"
            value={nombre}
            maxLength={100}
            autoFocus
            placeholder="Nombre de la categoría"
            onChange={(evento) => setNombre(evento.target.value)}
            onKeyDown={teclaEnNombre}
          />
          <button
            type="button"
            className="link"
            disabled={guardando}
            onClick={() => void crear()}
          >
            {guardando ? 'Creando…' : 'Crear'}
          </button>
          <button
            type="button"
            className="link"
            disabled={guardando}
            onClick={() => cancelarCreacion()}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="link categoria-agregar"
          onClick={() => setCreando(true)}
        >
          + Crear una categoría propia
        </button>
      )}
      {/* Error propio o del hook */}
      {(error || estado.error) && <small role="alert">{error || estado.error}</small>}
    </div>
  );
}

// Lista de categorías propias con botón para borrarlas.
export function GestionCategorias({ estado }: { estado: EstadoCategorias }) {
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [ocupada, setOcupada] = useState<number | null>(null);
  const propias = estado.categorias.filter((categoria) => !categoria.general);

  // Pide confirmación y borra la categoría; si falla, recarga la lista.
  async function eliminar(idCategoria: number, nombre: string) {
    if (ocupada || !window.confirm(`¿Eliminar la categoría ${nombre}?`)) return;
    setOcupada(idCategoria);
    setMensaje('');
    setError('');
    try {
      await estado.eliminar(idCategoria);
      setMensaje(`Categoría ${nombre} eliminada.`);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'No se pudo eliminar la categoría.',
      );
      void estado.recargar();
    } finally {
      setOcupada(null);
    }
  }

  return (
    <section className="mis-categorias">
      {/* Título y explicación */}
      <h2>Mis categorías</h2>
      <p className="muted">
        Las categorías generales están disponibles para todos. Las tuyas solo se pueden
        eliminar si no tienen productos.
      </p>
      {/* Lista de categorías propias, o aviso si no hay */}
      {propias.length === 0 ? (
        <p className="muted">
          Todavía no creaste categorías propias. Podés crearlas desde el formulario del
          producto.
        </p>
      ) : (
        <ul className="categorias-lista">
          {propias.map((categoria) => {
            const tieneProductos = categoria.cantidadProductos > 0;
            return (
              <li key={categoria.idCategoria}>
                <div>
                  <b>{categoria.nombre}</b>
                  <small>
                    {categoria.cantidadProductos === 1
                      ? '1 producto'
                      : `${categoria.cantidadProductos} productos`}
                    {tieneProductos && ' · no se puede eliminar mientras tenga productos'}
                  </small>
                </div>
                <button
                  type="button"
                  className="danger"
                  disabled={ocupada !== null || tieneProductos}
                  title={
                    tieneProductos
                      ? 'Tiene productos asociados: cambiales la categoría o eliminalos primero.'
                      : undefined
                  }
                  onClick={() => void eliminar(categoria.idCategoria, categoria.nombre)}
                >
                  {ocupada === categoria.idCategoria ? 'Eliminando…' : 'Eliminar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {/* Avisos de error y de éxito */}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {mensaje && (
        <p className="success" role="status">
          {mensaje}
        </p>
      )}
    </section>
  );
}
