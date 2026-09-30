import { useState } from 'react';
import { PrecioEscalonado } from './api';
import { formatCurrency } from './utils';

type Fila = { clave: number; cantidadMinima: string; precioUnitario: string };
let siguienteClave = 0;
const MAXIMO_TRAMOS = 10;

// Se envía como JSON en un campo oculto del formulario multipart.
export default function CampoPreciosEscalonados({ inicial = [] }: { inicial?: PrecioEscalonado[] }) {
  const [filas, setFilas] = useState<Fila[]>(() => inicial.map(tramo => ({
    clave: siguienteClave++, cantidadMinima: String(tramo.cantidadMinima), precioUnitario: tramo.precioUnitario,
  })));
  const valor = JSON.stringify(filas.map(fila => ({ cantidadMinima: Number(fila.cantidadMinima), precioUnitario: Number(fila.precioUnitario) })));
  const cambiar = (clave: number, campo: 'cantidadMinima' | 'precioUnitario', texto: string) =>
    setFilas(actual => actual.map(fila => fila.clave === clave ? { ...fila, [campo]: texto } : fila));

  return <fieldset className="precios-escalonados">
    <legend>Precios por cantidad (opcional)</legend>
    <small>El precio unitario baja cuando el comprador llega a cada cantidad. Cada tramo debe tener un precio menor que el anterior.</small>
    <input type="hidden" name="preciosEscalonados" value={valor} />
    {filas.map((fila, indice) => <div className="tramo-fila" key={fila.clave}>
      <label>
        <span>Desde (unidades)</span>
        <input type="number" min="2" max="2147483647" step="1" required value={fila.cantidadMinima}
          aria-label={`Cantidad desde la que aplica el tramo ${indice + 1}`}
          onChange={evento => cambiar(fila.clave, 'cantidadMinima', evento.target.value)} />
      </label>
      <label>
        <span>Precio c/u</span>
        <input type="number" min="0.01" max="9999999999.99" step="0.01" required value={fila.precioUnitario}
          aria-label={`Precio unitario del tramo ${indice + 1}`}
          onChange={evento => cambiar(fila.clave, 'precioUnitario', evento.target.value)} />
      </label>
      <button type="button" className="link" aria-label={`Quitar tramo ${indice + 1}`}
        onClick={() => setFilas(actual => actual.filter(item => item.clave !== fila.clave))}>Quitar</button>
    </div>)}
    {filas.length < MAXIMO_TRAMOS && <button type="button" className="link"
      onClick={() => setFilas(actual => [...actual, { clave: siguienteClave++, cantidadMinima: '', precioUnitario: '' }])}>
      + Agregar precio por cantidad
    </button>}
  </fieldset>;
}

// Resumen de precios: "1 a 11 u: $100 · 12 a 47 u: $90 · 48 u o más: $80".
export function TablaPrecios({ precioBase, tramos, minimo = 1 }: { precioBase: string; tramos: PrecioEscalonado[]; minimo?: number }) {
  if (!tramos.length) return null;
  const ordenados = [...tramos].sort((a, b) => a.cantidadMinima - b.cantidadMinima);
  const filas = [{ cantidadMinima: minimo, precioUnitario: precioBase }, ...ordenados];
  return <table className="tabla-precios">
    <caption>Precios por cantidad</caption>
    <thead><tr><th scope="col">Cantidad</th><th scope="col">Precio c/u</th></tr></thead>
    <tbody>
      {filas.map((fila, indice) => {
        const hasta = filas[indice + 1]?.cantidadMinima;
        return <tr key={fila.cantidadMinima}>
          <td>{hasta ? `${fila.cantidadMinima} a ${hasta - 1} u` : `${fila.cantidadMinima} u o más`}</td>
          <td>{formatCurrency(fila.precioUnitario)}</td>
        </tr>;
      })}
    </tbody>
  </table>;
}
