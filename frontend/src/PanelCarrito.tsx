/**
 * Panel lateral del carrito y formulario de checkout por vendedor.
 * Al avanzar al checkout conserva una revisión del carrito y genera una clave UUID
 * reutilizable para reintentos.
 * Una confirmación produce un pedido general y una suborden por vendedor. El pago
 * mostrado es simulado.
 */

import { FormEvent, useEffect, useRef, useState } from 'react';
import { imagenUrl, Carrito, CondicionPago, ConfirmacionPedido, Pedido } from './api';
import { CONDICIONES_PAGO, formatCurrency, siguienteTramo } from './utils';
import useCarrito from './useCarrito';
import CantidadCarrito from './CantidadCarrito';

type Entrega = { direccion: string; pago: CondicionPago };

export default function PanelCarrito({
  estado,
  alCerrar,
  direccionInicial = '',
}: {
  estado: ReturnType<typeof useCarrito>;
  alCerrar: () => void;
  direccionInicial?: string;
}) {
  const { avisoCarrito, actualizarCantidad, quitar, vaciar } = estado;
  const [resumen, setResumen] = useState<Carrito>(null);
  // resumen congela lo que se está confirmando; el carrito en segundo plano puede seguir
  // recibiendo actualizaciones, pero no debe cambiar silenciosamente el pedido revisado.
  const carrito = resumen ?? estado.carrito;
  const [checkout, setCheckout] = useState(false);
  // Entrega y pago se eligen por vendedor: cada uno recibe su propia suborden.
  const [entregas, setEntregas] = useState<Record<number, Entrega>>({});
  const entregaInicial: Entrega = { direccion: direccionInicial, pago: 'CONTADO' };
  const entrega = (idNegocio: number) => entregas[idNegocio] ?? entregaInicial;
  const cambiarEntrega = (idNegocio: number, cambio: Partial<Entrega>) =>
    setEntregas((actual) => ({
      ...actual,
      [idNegocio]: { ...(actual[idNegocio] ?? entregaInicial), ...cambio },
    }));
  const [error, setError] = useState('');
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const intento = useRef<ConfirmacionPedido | null>(null);
  /**
   * Conserva el UUID y la revisión exacta del intento: si la respuesta se pierde, el
   * reintento no crea otra orden ni descuenta stock dos veces.
   */
  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    if (!carrito || estado.procesando) return;
    setError('');
    // Reutilizar la misma solicitud si se pierde la respuesta de la confirmación.
    intento.current ??= {
      claveConfirmacion: crypto.randomUUID(),
      total: carrito.subtotal,
      entregas: carrito.vendedores.map(({ idNegocio }) => ({
        idNegocio,
        direccionEntrega: entrega(idNegocio).direccion.trim(),
        condicionPago: entrega(idNegocio).pago,
      })),
      items: carrito.items.map(({ idProducto, version, cantidad }) => ({
        idProducto,
        version,
        cantidad,
      })),
    };
    try {
      setPedido(await estado.confirmar(intento.current));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo confirmar el pedido.');
    }
  }
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const cerrar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', cerrar);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', cerrar);
    };
  }, [alCerrar]);
  const bloqueado = estado.procesando || !!intento.current;
  return (
    <div className="overlay" onClick={() => alCerrar()}>
      <aside
        className="carrito-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-carrito"
        onClick={(evento) => evento.stopPropagation()}
      >
        <header>
          <h2 id="titulo-carrito">Tu carrito</h2>
          <button type="button" className="link" onClick={() => alCerrar()}>
            Cerrar
          </button>
        </header>
        {avisoCarrito && (
          <p className="muted" role="status">
            {avisoCarrito}
          </p>
        )}
        {pedido ? (
          <div className="pedido-confirmado" role="status">
            <p className="success">
              Pedido #{pedido.idPedido} generado por {formatCurrency(pedido.total)}.
            </p>
            <ul className="pedido-resumen">
              {pedido.subordenes.map((suborden) => (
                <li key={suborden.idSuborden}>
                  <b>{suborden.nombreVendedor}</b>{' '}
                  <span>{formatCurrency(suborden.total)}</span>
                  <small>
                    Entrega: {suborden.direccionEntrega}. Pago:{' '}
                    {CONDICIONES_PAGO[suborden.condicionPago]} (simulado).
                  </small>
                </li>
              ))}
            </ul>
            <p className="muted">
              Cada vendedor tiene que confirmar su parte. Podés seguir el estado desde Mis
              Compras.
            </p>
          </div>
        ) : !carrito || carrito.items.length === 0 ? (
          <p className="muted">Todavía no agregaste productos.</p>
        ) : (
          <>
            {carrito.vendedores.map((vendedor) => (
              <section
                className="carrito-vendedor"
                key={vendedor.idNegocio}
                aria-label={`Productos de ${vendedor.nombreNegocio}`}
              >
                <p className="muted">
                  Vendedor: <b>{vendedor.nombreNegocio}</b>
                </p>
                <ul className="carrito-items">
                  {carrito.items
                    .filter((item) => item.idNegocio === vendedor.idNegocio)
                    .map((item) => {
                      const proximo = siguienteTramo(
                        item.preciosEscalonados,
                        item.cantidad,
                        item.stock,
                      );
                      return (
                        <li key={item.idProducto}>
                          {item.imagen && (
                            <img src={imagenUrl(item.imagen)} alt={item.nombre} />
                          )}
                          <div className="carrito-item-info">
                            <b>{item.nombre}</b>
                            <span className="muted carrito-precio-unitario">
                              {Number(item.precioUnitario) < Number(item.precioBase) && (
                                <s>{formatCurrency(item.precioBase)}</s>
                              )}{' '}
                              {formatCurrency(item.precioUnitario)} c/u
                            </span>
                            {item.cantidadMinimaCompra && (
                              <small>Mínimo: {item.cantidadMinimaCompra} unidades</small>
                            )}
                            {proximo && (
                              <small className="precio-mayorista">
                                Llevando {proximo.cantidadMinima} u pagás{' '}
                                {formatCurrency(proximo.precioUnitario)} c/u
                              </small>
                            )}
                          </div>
                          {!checkout && (
                            <CantidadCarrito
                              item={item}
                              alGuardar={(cantidad) =>
                                actualizarCantidad(item.idProducto, cantidad)
                              }
                            />
                          )}
                          {checkout ? (
                            <span>{item.cantidad} unidades</span>
                          ) : (
                            <button
                              type="button"
                              className="link"
                              onClick={() => quitar(item.idProducto)}
                            >
                              Quitar
                            </button>
                          )}
                        </li>
                      );
                    })}
                </ul>
                <div className="carrito-subtotal carrito-subtotal-vendedor">
                  <span>Subtotal de {vendedor.nombreNegocio}</span>
                  <b>{formatCurrency(vendedor.subtotal)}</b>
                </div>
                {Number(vendedor.montoMinimoOrden) > 0 && (
                  <div className="carrito-progreso">
                    <div className="carrito-progreso-etiquetas">
                      <span>
                        Pedido mínimo: {formatCurrency(vendedor.montoMinimoOrden)}
                      </span>
                      <b>
                        {Math.min(
                          100,
                          Math.floor(
                            (Number(vendedor.subtotal) /
                              Number(vendedor.montoMinimoOrden)) *
                              100,
                          ),
                        )}
                        %
                      </b>
                    </div>
                    <progress
                      max={Number(vendedor.montoMinimoOrden)}
                      value={Math.min(
                        Number(vendedor.subtotal),
                        Number(vendedor.montoMinimoOrden),
                      )}
                      aria-label={`Progreso hacia el monto mínimo de ${vendedor.nombreNegocio}`}
                      aria-valuetext={
                        Number(vendedor.faltanteMinimo) > 0
                          ? `Faltan ${formatCurrency(vendedor.faltanteMinimo)} para alcanzar el mínimo`
                          : 'Monto mínimo alcanzado'
                      }
                    />
                  </div>
                )}
                {!vendedor.cumpleMinimos && (
                  <p className="muted" role="status">
                    {Number(vendedor.faltanteMinimo) > 0
                      ? `Te faltan ${formatCurrency(vendedor.faltanteMinimo)} para alcanzar el monto mínimo de este vendedor.`
                      : 'Revisá las cantidades: cambió el stock disponible.'}
                  </p>
                )}
                {checkout && (
                  <div className="carrito-entrega">
                    <label className="field">
                      <span>Dirección de entrega</span>
                      <input
                        form="checkout"
                        required
                        maxLength={255}
                        autoComplete="street-address"
                        value={entrega(vendedor.idNegocio).direccion}
                        disabled={bloqueado}
                        onChange={(e) =>
                          cambiarEntrega(vendedor.idNegocio, {
                            direccion: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Condición de pago</span>
                      <select
                        form="checkout"
                        value={entrega(vendedor.idNegocio).pago}
                        disabled={bloqueado}
                        onChange={(e) =>
                          cambiarEntrega(vendedor.idNegocio, {
                            pago: e.target.value as CondicionPago,
                          })
                        }
                      >
                        {Object.entries(CONDICIONES_PAGO).map(([valor, etiqueta]) => (
                          <option key={valor} value={valor}>
                            {etiqueta}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </section>
            ))}
            <div className="carrito-subtotal">
              <span>Total</span>
              <b>{formatCurrency(carrito.subtotal)}</b>
            </div>
            <p className={carrito.cumpleMinimos ? 'success' : 'muted'} role="status">
              {carrito.cumpleMinimos
                ? 'Tu carrito cumple las condiciones mínimas de cada vendedor.'
                : 'Para finalizar la compra, cada vendedor del carrito tiene que cumplir sus mínimos.'}
            </p>
            {!checkout && (
              <button
                type="button"
                className="danger"
                disabled={estado.procesando}
                onClick={vaciar}
              >
                Vaciar carrito
              </button>
            )}
            {!checkout && (
              <button
                type="button"
                className="primary finalizar-compra"
                disabled={!carrito.cumpleMinimos || estado.procesando}
                onClick={() => {
                  setResumen(carrito);
                  setCheckout(true);
                }}
              >
                Finalizar compra
              </button>
            )}
            {checkout && (
              <form id="checkout" onSubmit={confirmar} className="checkout-form">
                <p className="muted">
                  Se genera un pedido con una orden para cada vendedor. El pago es
                  simulado: no se realizará ningún cobro.
                </p>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="primary finalizar-compra"
                  disabled={
                    estado.procesando ||
                    carrito.vendedores.some(
                      ({ idNegocio }) => !entrega(idNegocio).direccion.trim(),
                    )
                  }
                >
                  {estado.procesando ? 'Confirmando…' : 'Confirmar pedido'}
                </button>
                <button
                  type="button"
                  className="link"
                  disabled={estado.procesando}
                  onClick={() => {
                    setCheckout(false);
                    setResumen(null);
                    intento.current = null;
                    setError('');
                  }}
                >
                  Volver al carrito
                </button>
              </form>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
