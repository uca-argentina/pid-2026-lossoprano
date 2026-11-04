/**
 * Resumen visual de ventas entregadas del vendedor: métricas, productos y evolución
 * mensual.
 * La consulta recupera subórdenes y resumirVentas hace los cálculos sin modificar los
 * datos recibidos.
 */

import { useEffect, useState } from 'react';
import { api } from './api';
import { resumirVentas } from './resumenVentas';
import { formatCurrency } from './utils';

const nombreMes = (mes: string) =>
  new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('es-AR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });

export default function Dashboard({ token }: { token: string }) {
  const [resumen, setResumen] = useState<ReturnType<typeof resumirVentas> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [actualizacion, setActualizacion] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');
    api
      .misVentas(token)
      .then((ventas) => {
        if (activo) setResumen(resumirVentas(ventas));
      })
      .catch((error) => {
        if (activo)
          setError(
            error instanceof Error ? error.message : 'No se pudieron cargar las ventas.',
          );
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [token, actualizacion]);

  const maximoMensual = Math.max(
    1,
    ...(resumen?.meses.map((mes) => Number(mes.monto)) ?? []),
  );

  return (
    <>
      <section className="welcome">
        <span className="eyebrow">DASHBOARD</span>
        <h1>Tus ventas en números</h1>
        <p>Un resumen de las ventas entregadas de tu negocio.</p>
      </section>
      <section
        className="ventas-dashboard"
        aria-label="Resumen de ventas"
        aria-busy={cargando}
      >
        <div className="ventas-dashboard-encabezado">
          <p className="muted">
            Solo se incluyen subórdenes entregadas. Resumen y productos: todo el
            historial.
          </p>
          <button
            type="button"
            className="link"
            disabled={cargando}
            onClick={() => setActualizacion((valor) => valor + 1)}
          >
            Actualizar ventas
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {cargando && (
          <p className="muted" role="status">
            Cargando ventas…
          </p>
        )}
        {resumen && !cargando && !error && (
          <>
            <div className="ventas-metricas">
              <article className="ventas-tarjeta">
                <span>Ventas entregadas</span>
                <strong>{resumen.ventas}</strong>
                <small>Una venta por suborden</small>
              </article>
              <article className="ventas-tarjeta">
                <span>Monto total vendido</span>
                <strong>{formatCurrency(resumen.montoTotal)}</strong>
                <small>Importe de las ventas entregadas</small>
              </article>
              <article className="ventas-tarjeta">
                <span>Monto promedio por venta</span>
                <strong>{formatCurrency(resumen.montoPromedio)}</strong>
                <small>Total vendido dividido por ventas</small>
              </article>
            </div>
            {resumen.ventas === 0 && (
              <p className="muted">
                Todavía no tenés ventas entregadas. Cuando entregues un pedido, aparecerá
                en este resumen.
              </p>
            )}
            <div className="ventas-detalles">
              <article className="ventas-tarjeta">
                <h2>Productos más pedidos</h2>
                <p className="muted">
                  Los 5 productos con más unidades en ventas entregadas.
                </p>
                {resumen.productos.length === 0 ? (
                  <p className="muted">Todavía no hay productos para mostrar.</p>
                ) : (
                  <ol className="ventas-productos">
                    {resumen.productos.map((producto) => (
                      <li key={producto.idProducto}>
                        <span>{producto.nombre}</span>
                        <b>{producto.unidades} u.</b>
                      </li>
                    ))}
                  </ol>
                )}
              </article>
              <article className="ventas-tarjeta">
                <h2>Evolución mensual</h2>
                <p className="muted">
                  Últimos 12 meses, incluido el actual. Según la fecha de entrega (hora de
                  Argentina).
                </p>
                <ul className="ventas-meses">
                  {resumen.meses.map((mes) => (
                    <li key={mes.mes}>
                      <div className="ventas-mes-datos">
                        <span>{nombreMes(mes.mes)}</span>
                        <strong>{formatCurrency(mes.monto)}</strong>
                        <small>
                          {mes.ventas} {mes.ventas === 1 ? 'venta' : 'ventas'}
                        </small>
                      </div>
                      <div className="ventas-barra" aria-hidden="true">
                        <span
                          style={{
                            width: `${(Number(mes.monto) / maximoMensual) * 100}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </>
        )}
      </section>
    </>
  );
}
