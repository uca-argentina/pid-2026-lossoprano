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
  const [checkout, setCheckout] = useState(false);
  // Entrega y pago se eligen por vendedor: cada uno recibe su propia suborden.
  const [entregas, setEntregas] = useState<Record<number, Entrega>>({});
  const [error, setError] = useState('');
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const intento = useRef<ConfirmacionPedido | null>(null);
  // resumen congela lo que se está confirmando; el carrito en segundo plano puede seguir
  // recibiendo actualizaciones, pero no debe cambiar silenciosamente el pedido revisado.
  const carrito = resumen ?? estado.carrito;
  // Valores por defecto de entrega para un vendedor que todavía no se editó.
  const entregaInicial: Entrega = { direccion: direccionInicial, pago: 'CONTADO' };
  // Bloquea los campos mientras se confirma o si ya hubo un intento.
  const bloqueado = estado.procesando || !!intento.current;

  // Bloquea el scroll de la página y permite cerrar el panel con Escape.
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

  // Devuelve la dirección y el pago elegidos para un vendedor.
  function entrega(idNegocio: number) {
    return entregas[idNegocio] ?? entregaInicial;
  }

  // Cambia la dirección o el pago de un vendedor.
  function cambiarEntrega(idNegocio: number, cambio: Partial<Entrega>) {
    setEntregas((actual) => ({
      ...actual,
      [idNegocio]: { ...(actual[idNegocio] ?? entregaInicial), ...cambio },
    }));
  }

  // Congela el carrito actual y pasa al paso de entrega y pago.
  function irAlCheckout() {
    setResumen(carrito);
    setCheckout(true);
  }

  // Vuelve al carrito y descarta el intento de confirmación.
  function volverAlCarrito() {
    setCheckout(false);
    setResumen(null);
    intento.current = null;
    setError('');
  }

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

  return (
    // Fondo oscuro: al hacer clic afuera del panel se cierra
    <div className="overlay" onClick={() => alCerrar()}>
      <aside
        className="carrito-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-carrito"
        onClick={(evento) => evento.stopPropagation()}
      >
        {/* Título y botón para cerrar */}
        <header>
          <h2 id="titulo-carrito">Tu carrito</h2>
          <button type="button" className="link" onClick={() => alCerrar()}>
            Cerrar
          </button>
        </header>
        {/* Avisos del carrito */}
        {avisoCarrito && (
          <p className="muted" role="status">
            {avisoCarrito}
          </p>
        )}
        {/* Pedido confirmado, carrito vacío o lista de productos */}
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
            {/* Un bloque por vendedor con sus productos, mínimos y entrega */}
            {carrito.vendedores.map((vendedor) => {
              const montoMinimo = Number(vendedor.montoMinimoOrden);
              const subtotal = Number(vendedor.subtotal);
              const faltante = Number(vendedor.faltanteMinimo);
              const entregaVendedor = entrega(vendedor.idNegocio);
              return (
                <section
                  className="carrito-vendedor"
                  key={vendedor.idNegocio}
                  aria-label={`Productos de ${vendedor.nombreNegocio}`}
                >
                  <p className="muted">
                    Vendedor: <b>{vendedor.nombreNegocio}</b>
                  </p>
                  {/* Productos de este vendedor */}
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
                                {Number(item.precioUnitario) <
                                  Number(item.precioBase) && (
                                  <s>{formatCurrency(item.precioBase)}</s>
                                )}{' '}
                                {formatCurrency(item.precioUnitario)} c/u
                              </span>
                              {item.cantidadMinimaCompra && (
                                <small>
                                  Mínimo: {item.cantidadMinimaCompra} unidades
                                </small>
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
                  {/* Subtotal del vendedor */}
                  <div className="carrito-subtotal carrito-subtotal-vendedor">
                    <span>Subtotal de {vendedor.nombreNegocio}</span>
                    <b>{formatCurrency(vendedor.subtotal)}</b>
                  </div>
                  {/* Barra de progreso hacia el pedido mínimo */}
                  {montoMinimo > 0 && (
                    <div className="carrito-progreso">
                      <div className="carrito-progreso-etiquetas">
                        <span>
                          Pedido mínimo: {formatCurrency(vendedor.montoMinimoOrden)}
                        </span>
                        <b>
                          {Math.min(100, Math.floor((subtotal / montoMinimo) * 100))}%
                        </b>
                      </div>
                      <progress
                        max={montoMinimo}
                        value={Math.min(subtotal, montoMinimo)}
                        aria-label={`Progreso hacia el monto mínimo de ${vendedor.nombreNegocio}`}
                        aria-valuetext={
                          faltante > 0
                            ? `Faltan ${formatCurrency(vendedor.faltanteMinimo)} para alcanzar el mínimo`
                            : 'Monto mínimo alcanzado'
                        }
                      />
                    </div>
                  )}
                  {/* Aviso si no llega a los mínimos */}
                  {!vendedor.cumpleMinimos && (
                    <p className="muted" role="status">
                      {faltante > 0
                        ? `Te faltan ${formatCurrency(vendedor.faltanteMinimo)} para alcanzar el monto mínimo de este vendedor.`
                        : 'Revisá las cantidades: cambió el stock disponible.'}
                    </p>
                  )}
                  {/* En el checkout: dirección y forma de pago de este vendedor */}
                  {checkout && (
                    <div className="carrito-entrega">
                      <label className="field">
                        <span>Dirección de entrega</span>
                        <input
                          form="checkout"
                          required
                          maxLength={255}
                          autoComplete="street-address"
                          value={entregaVendedor.direccion}
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
                          value={entregaVendedor.pago}
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
              );
            })}
            {/* Total y aviso de mínimos de todo el carrito */}
            <div className="carrito-subtotal">
              <span>Total</span>
              <b>{formatCurrency(carrito.subtotal)}</b>
            </div>
            <p className={carrito.cumpleMinimos ? 'success' : 'muted'} role="status">
              {carrito.cumpleMinimos
                ? 'Tu carrito cumple las condiciones mínimas de cada vendedor.'
                : 'Para finalizar la compra, cada vendedor del carrito tiene que cumplir sus mínimos.'}
            </p>
            {/* Botones Vaciar y Finalizar compra */}
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
                onClick={() => irAlCheckout()}
              >
                Finalizar compra
              </button>
            )}
            {/* Checkout: confirmar el pedido o volver al carrito */}
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
                  onClick={() => volverAlCarrito()}
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
