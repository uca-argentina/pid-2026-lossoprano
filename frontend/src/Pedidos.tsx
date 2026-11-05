/**
 * Pantalla reutilizada para compras del negocio y ventas recibidas. El prop tipo
 * elige una única consulta.
 * El comprador ve pedidos generales; el vendedor administra solo sus subórdenes.
 * Las acciones visibles son una ayuda de interfaz: las transiciones y el propietario
 * se vuelven a controlar en la API.
 */

import { ReactNode, useEffect, useState } from 'react';
import { api, EstadoSuborden, Pedido, Suborden } from './api';
import Reclamos from './Reclamos';
import {
  ACCIONES_COMPRADOR,
  ACCIONES_VENDEDOR,
  CONDICIONES_PAGO,
  ESTADOS_PEDIDO,
  ESTADOS_SUBORDEN,
  formatCurrency,
  reclamoAbierto,
  subordenFinalizada,
} from './utils';

type Vista = 'activos' | 'historial';
const fecha = (valor: string) => new Date(valor).toLocaleDateString('es-AR');

export default function Pedidos({
  token,
  tipo,
}: {
  token: string;
  tipo: 'compras' | 'ventas';
}) {
  const esVenta = tipo === 'ventas';
  const [vista, setVista] = useState<Vista>('activos');
  const [compras, setCompras] = useState<Pedido[]>([]);
  const [ventas, setVentas] = useState<Suborden[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [enCurso, setEnCurso] = useState<number | null>(null);

  /**
   * Consulta solamente compras o ventas según tipo. Centraliza la recarga inicial y la
   * posterior a una transición.
   */
  async function cargar() {
    try {
      if (esVenta) setVentas(await api.misVentas(token));
      else setCompras(await api.misCompras(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los pedidos.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tipo]);

  /**
   * Solicita la transición elegida y vuelve a consultar incluso si falla, porque la otra
   * parte pudo haber actualizado la suborden.
   */
  async function cambiarEstado(suborden: Suborden, estado: EstadoSuborden) {
    const devuelveStock = estado === 'RECHAZADA' || estado === 'CANCELADA';
    if (
      devuelveStock &&
      !window.confirm(
        `¿Seguro que querés ${estado === 'RECHAZADA' ? 'rechazar' : 'cancelar'} la orden #${suborden.idSuborden}? No se puede deshacer.`,
      )
    )
      return;
    setEnCurso(suborden.idSuborden);
    setError('');
    try {
      await api.cambiarEstadoSuborden(suborden.idSuborden, estado, token);
      if (devuelveStock) window.dispatchEvent(new Event('stock-actualizado'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el pedido.');
    } finally {
      // La otra parte pudo haber cambiado el estado: se vuelve a leer siempre.
      await cargar();
      setEnCurso(null);
    }
  }

  const acciones = (suborden: Suborden, disponibles: typeof ACCIONES_VENDEDOR) =>
    disponibles[suborden.estado]?.map((accion) => (
      <button
        key={accion.estado}
        type="button"
        className={
          accion.estado === 'RECHAZADA' || accion.estado === 'CANCELADA'
            ? 'danger'
            : 'primary'
        }
        disabled={enCurso !== null}
        onClick={() => cambiarEstado(suborden, accion.estado)}
      >
        {accion.etiqueta}
      </button>
    ));

  const comprasVisibles = compras.filter((pedido) =>
    vista === 'historial' ? pedido.estado === 'COMPLETADA' : pedido.estado === 'EN_CURSO',
  );
  // Una venta entregada con un reclamo abierto sigue en Pedidos recibidos hasta resolverlo.
  const ventaActiva = (suborden: Suborden) =>
    !subordenFinalizada(suborden.estado) ||
    (suborden.reclamos ?? []).some(reclamoAbierto);
  const ventasVisibles = ventas.filter(
    (suborden) => ventaActiva(suborden) === (vista === 'activos'),
  );
  const vistas: { id: Vista; etiqueta: string }[] = [
    { id: 'activos', etiqueta: esVenta ? 'Pedidos recibidos' : 'Seguimiento' },
    { id: 'historial', etiqueta: 'Historial' },
  ];

  return (
    <>
      <section className="welcome">
        <span className="eyebrow">{esVenta ? 'PEDIDOS' : 'MIS COMPRAS'}</span>
        <h1>{esVenta ? 'Gestioná tus pedidos' : 'Seguí tus compras'}</h1>
        <p>
          {esVenta
            ? 'Administrá los pedidos recibidos y sus reclamos, y consultá el historial de los entregados, rechazados o cancelados.'
            : 'Consultá el seguimiento de tus compras y el historial de órdenes completadas. Desde una orden entregada podés iniciar un reclamo.'}
        </p>
      </section>
      <section className="pedidos">
        <div
          className="pedidos-tabs"
          role="group"
          aria-label={esVenta ? 'Pedidos recibidos' : 'Mis compras'}
        >
          {vistas.map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              aria-pressed={vista === opcion.id}
              className={vista === opcion.id ? 'active' : ''}
              onClick={() => setVista(opcion.id)}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="link pedidos-actualizar"
          disabled={cargando || enCurso !== null}
          onClick={() => {
            setError('');
            setCargando(true);
            void cargar();
          }}
        >
          Actualizar pedidos
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {cargando && <p className="muted">Cargando pedidos…</p>}
        {!cargando &&
          esVenta &&
          (ventasVisibles.length === 0 ? (
            <p className="muted">
              {vista === 'historial'
                ? 'Todavía no tenés pedidos recibidos finalizados.'
                : 'No tenés pedidos recibidos en curso.'}
            </p>
          ) : (
            ventasVisibles.map((suborden) => (
              <TarjetaSuborden
                key={suborden.idSuborden}
                suborden={suborden}
                titulo={`Orden #${suborden.idSuborden} · ${suborden.nombreComprador}`}
                detalle={`Pedido #${suborden.idPedido} del ${fecha(suborden.creadoEn)}`}
                acciones={acciones(suborden, ACCIONES_VENDEDOR)}
              >
                <Reclamos
                  suborden={suborden}
                  rol="vendedor"
                  token={token}
                  alActualizar={cargar}
                />
              </TarjetaSuborden>
            ))
          ))}
        {!cargando &&
          !esVenta &&
          (comprasVisibles.length === 0 ? (
            <p className="muted">
              {vista === 'historial'
                ? 'Todavía no tenés órdenes completadas.'
                : 'No tenés compras en curso.'}
            </p>
          ) : (
            comprasVisibles.map((pedido) => (
              <article className="pedido" key={pedido.idPedido}>
                <header>
                  <h2>Pedido #{pedido.idPedido}</h2>
                  <span className={`estado-pedido ${pedido.estado.toLowerCase()}`}>
                    {ESTADOS_PEDIDO[pedido.estado]}
                  </span>
                </header>
                <p className="muted">
                  {fecha(pedido.creadoEn)} · Total {formatCurrency(pedido.total)}
                </p>
                <p className="muted">
                  {pedido.estado === 'COMPLETADA'
                    ? 'Todas las subórdenes están entregadas o cerradas.'
                    : 'La orden se completará cuando todas sus subórdenes estén entregadas o cerradas.'}{' '}
                  Las rechazadas o canceladas se consideran cerradas.
                </p>
                {pedido.subordenes.map((suborden) => (
                  <TarjetaSuborden
                    key={suborden.idSuborden}
                    suborden={suborden}
                    titulo={suborden.nombreVendedor}
                    detalle={`Orden #${suborden.idSuborden}`}
                    acciones={acciones(suborden, ACCIONES_COMPRADOR)}
                  >
                    <Reclamos
                      suborden={suborden}
                      rol="comprador"
                      token={token}
                      alActualizar={cargar}
                    />
                  </TarjetaSuborden>
                ))}
              </article>
            ))
          ))}
      </section>
    </>
  );
}

/**
 * Presenta datos históricos. Recibe los botones de estado en acciones y los reclamos
 * como children; no calcula permisos ni modifica pedidos.
 */
function TarjetaSuborden({
  suborden,
  titulo,
  detalle,
  acciones,
  children,
}: {
  suborden: Suborden;
  titulo: string;
  detalle: string;
  acciones?: ReactNode[];
  children?: ReactNode;
}) {
  return (
    <article className="suborden">
      <header>
        <div>
          <b>{titulo}</b>
          <small>{detalle}</small>
        </div>
        <span className={`estado-suborden ${suborden.estado.toLowerCase()}`}>
          {ESTADOS_SUBORDEN[suborden.estado]}
        </span>
      </header>
      <ul className="suborden-items">
        {suborden.items.map((item) => (
          <li key={item.idProducto}>
            <span>
              {item.cantidad} × {item.nombre}
            </span>
            <span>{formatCurrency(item.subtotal)}</span>
          </li>
        ))}
      </ul>
      <div className="suborden-total">
        <span>Total</span>
        <b>{formatCurrency(suborden.total)}</b>
      </div>
      <small>
        Entrega: {suborden.direccionEntrega} · Pago:{' '}
        {CONDICIONES_PAGO[suborden.condicionPago]} (simulado)
      </small>
      <small>
        Última actualización: {new Date(suborden.actualizadoEn).toLocaleString('es-AR')}
      </small>
      {acciones && acciones.length > 0 && (
        <div className="suborden-acciones">{acciones}</div>
      )}
      {children}
    </article>
  );
}
