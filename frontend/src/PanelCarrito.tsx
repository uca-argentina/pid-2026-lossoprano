import { useEffect } from 'react';
import { ASSET_URL } from './api';
import { formatCurrency } from './utils';
import useCarrito from './useCarrito';
import CantidadCarrito from './CantidadCarrito';

export default function PanelCarrito({ estado, alCerrar }: { estado: ReturnType<typeof useCarrito>; alCerrar: () => void }) {
  const { carrito, avisoCarrito, actualizarCantidad, quitar, vaciar } = estado;
  const subtotalCarrito = carrito?.subtotal ?? '0.00';
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const cerrar = (evento: KeyboardEvent) => { if (evento.key === 'Escape') alCerrar(); };
    window.addEventListener('keydown', cerrar);
    return () => { document.body.style.overflow = anterior; window.removeEventListener('keydown', cerrar); };
  }, [alCerrar]);
  return (
        <div className="overlay" onClick={() => alCerrar()}>
          <aside className="carrito-panel" role="dialog" aria-modal="true" aria-labelledby="titulo-carrito" onClick={evento => evento.stopPropagation()}>
            <header>
              <h2 id="titulo-carrito">Tu carrito</h2>
              <button type="button" className="link" onClick={() => alCerrar()}>Cerrar</button>
            </header>
            {avisoCarrito && <p className="muted" role="status">{avisoCarrito}</p>}
            {!carrito || carrito.items.length === 0 ? (
              <p className="muted">Todavía no agregaste productos.</p>
            ) : (
              <>
                <p className="muted">Vendedor: <b>{carrito.nombreNegocio}</b></p>
                <ul className="carrito-items">
                  {carrito.items.map(item => (
                    <li key={item.idProducto}>
                      {item.imagen && <img src={`${ASSET_URL}${item.imagen}`} alt={item.nombre} />}
                      <div className="carrito-item-info">
                        <b>{item.nombre}</b>
                        <span className="muted carrito-precio-unitario">{formatCurrency(item.precioBase)} c/u</span>
                        {item.cantidadMinimaCompra && <small>Mínimo: {item.cantidadMinimaCompra} unidades</small>}
                      </div>
                      <CantidadCarrito item={item} alGuardar={cantidad => actualizarCantidad(item.idProducto, cantidad)} />
                      <button type="button" className="link" onClick={() => quitar(item.idProducto)}>Quitar</button>
                    </li>
                  ))}
                </ul>
                <div className="carrito-subtotal">
                  <span>Subtotal</span>
                  <b>{formatCurrency(subtotalCarrito)}</b>
                </div>
                {Number(carrito.montoMinimoOrden) > 0 && <div className="carrito-progreso">
                  <div className="carrito-progreso-etiquetas">
                    <span>Pedido mínimo: {formatCurrency(carrito.montoMinimoOrden)}</span>
                    <b>{Math.min(100, Math.floor(Number(subtotalCarrito) / Number(carrito.montoMinimoOrden) * 100))}%</b>
                  </div>
                  <progress
                    max={Number(carrito.montoMinimoOrden)}
                    value={Math.min(Number(subtotalCarrito), Number(carrito.montoMinimoOrden))}
                    aria-label="Progreso hacia el monto mínimo del pedido"
                    aria-valuetext={Number(carrito.faltanteMinimo) > 0 ? `Faltan ${formatCurrency(carrito.faltanteMinimo)} para alcanzar el mínimo` : 'Monto mínimo alcanzado'}
                  />
                </div>}
                <p className={carrito.cumpleMinimos ? 'success' : 'muted'} role="status">
                  {carrito.cumpleMinimos ? 'Tu carrito cumple las condiciones mínimas del vendedor.' : `Te faltan ${formatCurrency(carrito.faltanteMinimo)} para alcanzar el monto mínimo del vendedor.`}
                </p>
                <button type="button" className="danger" onClick={vaciar}>Vaciar carrito</button>
                <button type="button" className="primary finalizar-compra" disabled={!carrito.cumpleMinimos}>
                  Finalizar compra
                </button>
              </>
            )}
          </aside>
        </div>
  );
}
