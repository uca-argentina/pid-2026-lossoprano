import { useId } from 'react';

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

export default function CampoCategoria({ valorInicial = '' }: { valorInicial?: string }) {
  const listaId = useId();
  return <label className="field">
    <span>Categoría</span>
    <input name="categoria" list={listaId} defaultValue={valorInicial}
      placeholder="Elegí una categoría o escribí una nueva" maxLength={100} required />
    <datalist id={listaId}>
      {categoriasPredeterminadas.map(categoria => <option key={categoria} value={categoria} />)}
    </datalist>
    <small>Podés elegir una categoría sugerida o crear una propia escribiendo su nombre.</small>
  </label>;
}
