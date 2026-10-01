import { FormEvent, useEffect, useRef, useState } from 'react';
import { ASSET_URL, Carrito, CondicionPago, ConfirmacionPedido, PedidoConfirmado } from './api';
import { formatCurrency, siguienteTramo } from './utils';
import useCarrito from './useCarrito';
import CantidadCarrito from './CantidadCarrito';

export default function PanelCarrito({ estado, alCerrar, direccionInicial = '' }: { estado: ReturnType<typeof useCarrito>; alCerrar: () => void; direccionInicial?: string }) {
  const { avisoCarrito, actualizarCantidad, quitar, vaciar } = estado;
  const [resumen, setResumen] = useState<Carrito>(null);
  const carrito = resumen ?? estado.carrito;
  const [checkout, setCheckout] = useState(false);
  const [direccion, setDireccion] = useState(direccionInicial);
  const [pago, setPago] = useState<CondicionPago>('CONTADO');
  const [error, setError] = useState('');
  const [pedido, setPedido] = useState<PedidoConfirmado | null>(null);
  const intento = useRef<ConfirmacionPedido | null>(null);
  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    if (!carrito || estado.procesando) return;
    setError('');
    // Reutilizar la misma solicitud si se pierde la respuesta de la confirmación.
    intento.current ??= { direccionEntrega: direccion.trim(), condicionPago: pago, claveConfirmacion: crypto.randomUUID(), total: carrito.subtotal,
      items: carrito.items.map(({ idProducto, version, cantidad }) => ({ idProducto, version, cantidad })) };
    try { setPedido(await estado.confirmar(intento.current)); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo confirmar el pedido.'); }
  }
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
            {pedido ? <p className="success" role="status">Pedido #{pedido.idPedido} confirmado por {formatCurrency(pedido.total)}. Dirección de entrega: {pedido.direccionEntrega}. Condición de pago: {pedido.condicionPago === 'CUENTA_CORRIENTE' ? 'Cuenta corriente' : pedido.condicionPago === 'TRANSFERENCIA' ? 'Transferencia' : 'Contado'} (simulada).</p> : !carrito || carrito.items.length === 0 ? (
              <p className="muted">Todavía no agregaste productos.</p>
            ) : (
              <>
                <p className="muted">Vendedor: <b>{carrito.nombreNegocio}</b></p>
                <ul className="carrito-items">
                  {carrito.items.map(item => {
                    const proximo = siguienteTramo(item.preciosEscalonados, item.cantidad, item.stock);
                    return <li key={item.idProducto}>
                      {item.imagen && <img src={`${ASSET_URL}${item.imagen}`} alt={item.nombre} />}
                      <div className="carrito-item-info">
                        <b>{item.nombre}</b>
                        <span className="muted carrito-precio-unitario">
                          {Number(item.precioUnitario) < Number(item.precioBase) && <s>{formatCurrency(item.precioBase)}</s>} {formatCurrency(item.precioUnitario)} c/u
                        </span>
                        {item.cantidadMinimaCompra && <small>Mínimo: {item.cantidadMinimaCompra} unidades</small>}
                        {proximo && <small className="precio-mayorista">
                          Llevando {proximo.cantidadMinima} u pagás {formatCurrency(proximo.precioUnitario)} c/u
                        </small>}
                      </div>
                      {!checkout && <CantidadCarrito item={item} alGuardar={cantidad => actualizarCantidad(item.idProducto, cantidad)} />}
                      {checkout ? <span>{item.cantidad} unidades</span> : <button type="button" className="link" onClick={() => quitar(item.idProducto)}>Quitar</button>}
                    </li>;
                  })}
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
                  {carrito.cumpleMinimos ? 'Tu carrito cumple las condiciones mínimas del vendedor.' : Number(carrito.faltanteMinimo) > 0 ? `Te faltan ${formatCurrency(carrito.faltanteMinimo)} para alcanzar el monto mínimo del vendedor.` : 'Revisá las cantidades: cambió el stock disponible.'}
                </p>
                {!checkout && <button type="button" className="danger" disabled={estado.procesando} onClick={vaciar}>Vaciar carrito</button>}
                {!checkout && <button type="button" className="primary finalizar-compra" disabled={!carrito.cumpleMinimos || estado.procesando} onClick={() => { setResumen(carrito); setCheckout(true); }}>
                  Finalizar compra
                </button>}
                {checkout && <form onSubmit={confirmar} className="checkout-form">
                  <h3>Datos de entrega y pago</h3>
                  <label className="field"><span>Dirección de entrega</span><input required maxLength={255} autoComplete="street-address" value={direccion} disabled={estado.procesando || !!intento.current} onChange={e => setDireccion(e.target.value)} /></label>
                  <label className="field"><span>Condición de pago</span><select value={pago} disabled={estado.procesando || !!intento.current} onChange={e => setPago(e.target.value as CondicionPago)}>
                    <option value="CONTADO">Contado</option><option value="TRANSFERENCIA">Transferencia</option><option value="CUENTA_CORRIENTE">Cuenta corriente</option>
                  </select></label>
                  <p className="muted">El pago es simulado. No se realizará ningún cobro.</p>
                  {error && <p className="error" role="alert">{error}</p>}
                  <button type="submit" className="primary finalizar-compra" disabled={estado.procesando || !direccion.trim()}>{estado.procesando ? 'Confirmando…' : 'Confirmar pedido'}</button>
                  <button type="button" className="link" disabled={estado.procesando} onClick={() => { setCheckout(false); setResumen(null); intento.current = null; setError(''); }}>Volver al carrito</button>
                </form>}
              </>
            )}
          </aside>
        </div>
  );
}
