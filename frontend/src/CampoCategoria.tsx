import { useCallback, useEffect, useState } from 'react';
import { api, CategoriaDisponible } from './api';

export function useCategorias(token: string) {
  const [categorias, setCategorias] = useState<CategoriaDisponible[]>([]);
  const [error, setError] = useState('');
  const recargar = useCallback(async () => {
    try {
      setCategorias(await api.categoriasDisponibles(token));
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudieron cargar las categorías.');
    }
  }, [token]);
  useEffect(() => { void recargar(); }, [recargar]);
  async function crear(nombre: string) {
    const nueva = await api.crearCategoria(nombre, token);
    setCategorias(actual => [...actual, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
    return nueva;
  }
  async function eliminar(idCategoria: number) {
    await api.eliminarCategoria(idCategoria, token);
    setCategorias(actual => actual.filter(categoria => categoria.idCategoria !== idCategoria));
  }
  return { categorias, error, recargar, crear, eliminar };
}

export type EstadoCategorias = ReturnType<typeof useCategorias>;

export default function CampoCategoria({ estado, valorInicial }: { estado: EstadoCategorias; valorInicial?: number }) {
  const [valor, setValor] = useState(valorInicial ? String(valorInicial) : '');
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const generales = estado.categorias.filter(categoria => categoria.general);
  const propias = estado.categorias.filter(categoria => !categoria.general);

  async function crear() {
    if (guardando) return;
    if (!nombre.trim()) { setError('Escribí el nombre de la categoría.'); return; }
    setGuardando(true);
    setError('');
    try {
      const nueva = await estado.crear(nombre);
      setValor(String(nueva.idCategoria));
      setNombre('');
      setCreando(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo crear la categoría.');
    } finally { setGuardando(false); }
  }

  return <div className="field">
    <label>
      <span>Categoría</span>
      <select name="idCategoria" value={valor} onChange={evento => setValor(evento.target.value)} required>
        <option value="" disabled>Elegí una categoría</option>
        <optgroup label="Generales">
          {generales.map(categoria => <option key={categoria.idCategoria} value={categoria.idCategoria}>{categoria.nombre}</option>)}
        </optgroup>
        {propias.length > 0 && <optgroup label="Mis categorías">
          {propias.map(categoria => <option key={categoria.idCategoria} value={categoria.idCategoria}>{categoria.nombre}</option>)}
        </optgroup>}
      </select>
    </label>
    {creando ? <div className="categoria-nueva">
      <input aria-label="Nombre de la nueva categoría" value={nombre} maxLength={100} autoFocus placeholder="Nombre de la categoría"
        onChange={evento => setNombre(evento.target.value)}
        onKeyDown={evento => { if (evento.key === 'Enter') { evento.preventDefault(); void crear(); } }} />
      <button type="button" className="link" disabled={guardando} onClick={() => void crear()}>{guardando ? 'Creando…' : 'Crear'}</button>
      <button type="button" className="link" disabled={guardando} onClick={() => { setCreando(false); setError(''); }}>Cancelar</button>
    </div> : <button type="button" className="link categoria-agregar" onClick={() => setCreando(true)}>+ Crear una categoría propia</button>}
    {(error || estado.error) && <small role="alert">{error || estado.error}</small>}
  </div>;
}

export function GestionCategorias({ estado }: { estado: EstadoCategorias }) {
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [ocupada, setOcupada] = useState<number | null>(null);
  const propias = estado.categorias.filter(categoria => !categoria.general);

  async function eliminar(idCategoria: number, nombre: string) {
    if (ocupada || !window.confirm(`¿Eliminar la categoría ${nombre}?`)) return;
    setOcupada(idCategoria);
    setMensaje('');
    setError('');
    try {
      await estado.eliminar(idCategoria);
      setMensaje(`Categoría ${nombre} eliminada.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo eliminar la categoría.');
      void estado.recargar();
    } finally { setOcupada(null); }
  }

  return <section className="mis-categorias">
    <h2>Mis categorías</h2>
    <p className="muted">Las categorías generales están disponibles para todos. Las tuyas solo se pueden eliminar si no tienen productos.</p>
    {propias.length === 0 ? <p className="muted">Todavía no creaste categorías propias. Podés crearlas desde el formulario del producto.</p> :
      <ul className="categorias-lista">
        {propias.map(categoria => <li key={categoria.idCategoria}>
          <div><b>{categoria.nombre}</b><small>{categoria.cantidadProductos === 1 ? '1 producto' : `${categoria.cantidadProductos} productos`}
            {categoria.cantidadProductos > 0 && ' · no se puede eliminar mientras tenga productos'}</small></div>
          <button type="button" className="danger" disabled={ocupada !== null || categoria.cantidadProductos > 0}
            title={categoria.cantidadProductos > 0 ? 'Tiene productos asociados: cambiales la categoría o eliminalos primero.' : undefined}
            onClick={() => void eliminar(categoria.idCategoria, categoria.nombre)}>
            {ocupada === categoria.idCategoria ? 'Eliminando…' : 'Eliminar'}
          </button>
        </li>)}
      </ul>}
    {error && <p className="error" role="alert">{error}</p>}
    {mensaje && <p className="success" role="status">{mensaje}</p>}
  </section>;
}
