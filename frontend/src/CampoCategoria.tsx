import { useEffect, useId, useMemo, useState } from 'react';
import { api } from './api';

const categoriasPredeterminadas = [
  'Alimentos',
  'Bebidas',
  'Perfumería',
  'Cosmética',
  'Higiene personal',
  'Limpieza',
  'Indumentaria',
  'Calzado',
  'Accesorios',
  'Hogar y decoración',
  'Librería y papelería',
  'Electrónica',
  'Ferretería',
  'Juguetes',
  'Mascotas',
];

export default function CampoCategoria({ token, valorInicial = '' }: { token: string; valorInicial?: string }) {
  const listaId = useId();
  const [categoriasExistentes, setCategoriasExistentes] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const categorias = await api.listarCategorias(token);
        if (activo) { setCategoriasExistentes(categorias); setError(''); }
      } catch {
        if (activo) setError('No se pudieron cargar las categorías de otros vendedores. Podés elegir una sugerida o escribir la tuya.');
      }
    }
    void cargar();
    window.addEventListener('focus', cargar);
    return () => { activo = false; window.removeEventListener('focus', cargar); };
  }, [token]);
  const categorias = useMemo(() => {
    const unicas = new Map<string, string>();
    for (const categoria of [...categoriasPredeterminadas, ...categoriasExistentes, valorInicial]) {
      const nombre = categoria.trim();
      const clave = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
      if (nombre && !unicas.has(clave)) unicas.set(clave, nombre);
    }
    return [...unicas.values()].sort((a, b) => a.localeCompare(b, 'es'));
  }, [categoriasExistentes, valorInicial]);
  return <label className="field">
    <span>Categoría</span>
    <input name="categoria" list={listaId} defaultValue={valorInicial}
      placeholder="Elegí una categoría o escribí una nueva" maxLength={100} required />
    <datalist id={listaId}>
      {categorias.map(categoria => <option key={categoria} value={categoria} />)}
    </datalist>
    <small>Podés elegir una categoría sugerida o crear una propia escribiendo su nombre.</small>
    {error && <small role="status">{error}</small>}
  </label>;
}
