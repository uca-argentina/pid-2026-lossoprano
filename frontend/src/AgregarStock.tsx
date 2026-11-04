/**
 * Modal para sumar unidades al stock actual, no para reemplazarlo por un valor
 * absoluto.
 * La API suma dentro de una transacción y mantiene la versión comercial para conservar
 * los carritos.
 */

import { FormEvent, useState } from 'react';
import { api, Producto } from './api';
import ModalProducto from './ModalProducto';

export default function AgregarStock({
  producto,
  token,
  alCerrar,
  alGuardar,
}: {
  producto: Producto;
  token: string;
  alCerrar: () => void;
  alGuardar: (producto: Producto) => void;
}) {
  const [cantidad, setCantidad] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const unidades = Number(cantidad);
  const valido =
    Number.isInteger(unidades) && unidades > 0 && unidades <= 2147483647 - producto.stock;

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado || !valido) return;
    setOcupado(true);
    setError('');
    try {
      alGuardar(await api.agregarStock(producto.idProducto, unidades, token));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo agregar stock.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ModalProducto
      titulo="Agregar stock"
      idTitulo="agregar-stock-titulo"
      ocupado={ocupado}
      alCerrar={alCerrar}
      compacto
    >
      <p className="stock-producto">{producto.nombre}</p>
      <p className="muted">
        Stock actual: <strong>{producto.stock} unidades</strong>
      </p>
      <form onSubmit={guardar}>
        <fieldset className="producto-campos" disabled={ocupado}>
          <label className="field">
            <span>Unidades a agregar</span>
            <input
              type="number"
              min="1"
              max={2147483647 - producto.stock}
              step="1"
              required
              autoFocus
              value={cantidad}
              onChange={(evento) => {
                setCantidad(evento.target.value);
                setError('');
              }}
            />
            <small>Ingresá la cantidad que recibiste.</small>
          </label>
          {valido && (
            <p className="stock-resumen" role="status">
              Stock después de agregar:{' '}
              <strong>{producto.stock + unidades} unidades</strong>
            </p>
          )}
          <p className="muted stock-aclaracion">
            Se sumará al stock disponible al guardar. Los productos permanecerán en los
            carritos de los compradores.
          </p>
          <div className="stock-acciones">
            <button type="button" className="link" onClick={alCerrar}>
              Cancelar
            </button>
            <button type="submit" className="primary" disabled={!valido}>
              {ocupado ? 'Guardando…' : 'Agregar stock'}
            </button>
          </div>
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
