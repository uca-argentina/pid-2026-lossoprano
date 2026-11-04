/**
 * Pantalla de sorteos compartida por ambos roles: premio, chances, reglas, historial
 * y reloj local de prueba.
 * El servidor determina los montos y el ganador. React solo los presenta y envía la
 * fecha elegida.
 * Al abrir o actualizar se cierran períodos vencidos; no existe aún una tarea
 * programada en segundo plano (ver TODO.md).
 */

import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ParticipacionSorteo, ResumenSorteos } from './api';

const moneda = (valor: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
    Number(valor),
  );
const fecha = (valor: string) =>
  new Date(valor).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
// datetime-local no incluye zona. Mostramos UTC-3 y al enviar agregamos -03:00
// explícitamente para que la zona del dispositivo no mueva el instante del cierre.
const fechaLocal = (valor: string) =>
  new Date(new Date(valor).getTime() - 3 * 3600000).toISOString().slice(0, 19);

export const probabilidad = (propia: ParticipacionSorteo) =>
  propia.peso !== '0' && propia.probabilidad < 0.000001
    ? '<0,000001%'
    : `${propia.probabilidad.toLocaleString('es-AR', { maximumFractionDigits: 6 })}%`;

export default function Sorteos({ token }: { token: string }) {
  const [resumen, setResumen] = useState<ResumenSorteos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [actualizacion, setActualizacion] = useState(0);
  const [fechaPrueba, setFechaPrueba] = useState('');
  const [cambiandoFecha, setCambiandoFecha] = useState(false);
  const [errorReloj, setErrorReloj] = useState('');
  const [avisoReloj, setAvisoReloj] = useState('');
  // El contador invalida respuestas de una instancia anterior. La referencia de bloqueo
  // evita dos envíos incluso antes de que React llegue a deshabilitar el botón.
  const solicitudReloj = useRef(0);
  const cambioEnCurso = useRef(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');
    setErrorReloj('');
    setAvisoReloj('');
    setCambiandoFecha(false);
    api
      .actualizarSorteos(token)
      .then((datos) => {
        if (activo) {
          setResumen(datos);
          setFechaPrueba(fechaLocal(datos.actual.fin));
        }
      })
      .catch((error) => {
        if (activo)
          setError(
            error instanceof Error ? error.message : 'No se pudieron cargar los sorteos.',
          );
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
      solicitudReloj.current++;
      cambioEnCurso.current = false;
    };
  }, [token, actualizacion]);

  /**
   * Transforma la hora del formulario de Argentina a ISO con zona explícita. Protege
   * contra doble envío y respuestas de una pantalla desmontada; con éxito muestra el
   * historial devuelto por el servidor.
   */
  async function cambiarFecha(evento: FormEvent) {
    evento.preventDefault();
    if (cambioEnCurso.current) return;
    cambioEnCurso.current = true;
    const solicitud = ++solicitudReloj.current;
    setCambiandoFecha(true);
    setErrorReloj('');
    setAvisoReloj('');
    try {
      const fecha = new Date(`${fechaPrueba}-03:00`).toISOString();
      const resultado = await api.cambiarFechaSorteos(fecha, token);
      if (solicitud === solicitudReloj.current) {
        const cerrado = resultado.historial.find(
          (sorteo) => sorteo.inicio === resumen?.actual.inicio,
        );
        setResumen(resultado);
        setFechaPrueba(fechaLocal(resultado.actual.fin));
        setAvisoReloj(
          cerrado?.ganador
            ? 'Fecha aplicada. El ganador quedó guardado en Resultados anteriores y comenzó un nuevo período.'
            : resultado.actual.inicio !== resumen?.actual.inicio
              ? 'Fecha aplicada. Comenzó un nuevo período; el anterior no tenía actividad o premio para elegir un ganador.'
              : 'Fecha aplicada. El período sigue abierto hasta su fecha de cierre.',
        );
      }
    } catch (error) {
      if (solicitud === solicitudReloj.current)
        setErrorReloj(
          error instanceof Error ? error.message : 'No se pudo cambiar la fecha.',
        );
    } finally {
      if (solicitud === solicitudReloj.current) {
        setCambiandoFecha(false);
        cambioEnCurso.current = false;
      }
    }
  }

  const actual = resumen?.actual;
  const reglas = resumen?.reglas;
  const comision = reglas ? reglas.comisionBps / 100 : 0;
  const aporte = reglas
    ? (comision * reglas.premioNumerador) / reglas.premioDenominador
    : 0;

  return (
    <>
      <section className="welcome">
        <span className="eyebrow">SORTEOS · DEMO</span>
        <h1>Cada negocio suma chances</h1>
        <p>Comprá, vendé y participá de un premio compartido cada 14 días.</p>
      </section>
      <section className="sorteos" aria-label="Sorteos" aria-busy={cargando}>
        <div className="sorteos-aviso">
          <strong>Premios simulados</strong>
          <span>Esta demo no cobra comisiones ni entrega dinero real.</span>
        </div>
        <div className="sorteos-encabezado">
          <p className="muted">
            Compradores y vendedores participan juntos. Solo cuentan pedidos entregados.
          </p>
          <button
            type="button"
            className="link"
            disabled={cargando || cambiandoFecha}
            onClick={() => setActualizacion((n) => n + 1)}
          >
            Actualizar sorteos
          </button>
        </div>
        {cargando && (
          <p role="status" className="muted">
            Cargando sorteos…
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!cargando && !error && actual && reglas && (
          <>
            <article className="sorteo-premio">
              <div>
                <span className="eyebrow">PREMIO EN FORMACIÓN</span>
                <h2>{moneda(actual.premio)}</h2>
                <p>
                  Del {fecha(actual.inicio)} hasta el {fecha(actual.fin)} a las 00:00
                  (Argentina).
                </p>
              </div>
              <div className="sorteo-premio-detalle">
                <strong>{actual.participantes} negocios participando</strong>
                <span>Un ganador por período · Premio simulado en pesos</span>
              </div>
            </article>
            {resumen.relojPrueba.habilitado && (
              <section
                className="sorteo-reloj ventas-tarjeta"
                aria-label="Reloj de prueba"
                aria-busy={cambiandoFecha}
              >
                <span className="eyebrow">PRUEBA LOCAL</span>
                <h2>Adelantá la fecha para probar el cierre</h2>
                <p className="muted">
                  Fecha actual del sorteo:{' '}
                  <strong>
                    {new Date(resumen.ahora).toLocaleString('es-AR', {
                      timeZone: 'America/Argentina/Buenos_Aires',
                      hourCycle: 'h23',
                    })}
                  </strong>{' '}
                  (Argentina).{' '}
                  {resumen.relojPrueba.adelantado
                    ? 'Reloj de prueba activo.'
                    : 'Usando la hora real.'}
                </p>
                <p>
                  Al llegar al {fecha(actual.fin)} a las 00:00, se guarda el ganador en
                  Resultados anteriores y comienza el siguiente período con el fondo y las
                  chances en cero.
                </p>
                <form onSubmit={cambiarFecha}>
                  <label className="field">
                    <span>Fecha y hora de prueba (Argentina)</span>
                    <input
                      type="datetime-local"
                      step="1"
                      required
                      min={fechaLocal(resumen.ahora)}
                      value={fechaPrueba}
                      disabled={cambiandoFecha}
                      onChange={(evento) => setFechaPrueba(evento.target.value)}
                    />
                  </label>
                  <button type="submit" className="primary" disabled={cambiandoFecha}>
                    {cambiandoFecha ? 'Aplicando fecha…' : 'Aplicar fecha de prueba'}
                  </button>
                </form>
                <p className="sorteo-reloj-nota">
                  La fecha se aplica a todas las cuentas de esta base local y se conserva
                  al reiniciar. Las nuevas entregas usan este reloj. Solo se puede
                  avanzar: los ganadores quedan guardados y no se vuelven a sortear. Los
                  períodos sin entregas no eligen ganador.
                </p>
                {cambiandoFecha && (
                  <p role="status" className="muted">
                    Actualizando la fecha y cerrando los períodos vencidos…
                  </p>
                )}
                {errorReloj && (
                  <p className="error" role="alert">
                    {errorReloj}
                  </p>
                )}
                {avisoReloj && (
                  <p className="success" role="status">
                    {avisoReloj}
                  </p>
                )}
              </section>
            )}
            <div className="ventas-metricas">
              <article className="ventas-tarjeta">
                <span>Tu monto participante</span>
                <strong>{moneda(actual.propia.monto)}</strong>
                <small>
                  Compras: {moneda(actual.propia.compras)} · Ventas:{' '}
                  {moneda(actual.propia.ventas)}
                </small>
              </article>
              <article className="ventas-tarjeta">
                <span>Tu probabilidad actual</span>
                <strong>{probabilidad(actual.propia)}</strong>
                <small>
                  Tu monto dividido por el monto participante de todos los negocios
                </small>
              </article>
              <article className="ventas-tarjeta">
                <span>Ventas entregadas de la plataforma</span>
                <strong>{moneda(actual.volumen)}</strong>
                <small>Cada venta aporta una sola vez al premio</small>
              </article>
            </div>
            {actual.propia.peso === '0' && (
              <p className="sorteo-vacio">
                Todavía no sumaste chances en este período. Tu primera compra o venta
                entregada te hace participar, sin monto mínimo.
              </p>
            )}
            <article className="ventas-tarjeta sorteo-reglas">
              <h2>Cómo funciona</h2>
              <ol>
                <li>
                  Cada peso comprado o vendido en pedidos entregados tiene el mismo peso.
                  $5.000 dan el doble de chances que $2.500; también cuentan los centavos.
                </li>
                <li>
                  Si comprás y vendés, ambos montos se suman para tu negocio. Los pedidos
                  pendientes, rechazados o cancelados no suman.
                </li>
                <li>
                  La comisión simulada es del {comision}% de cada venta:{' '}
                  {Number((comision - aporte).toFixed(4))}% para la plataforma y{' '}
                  {Number(aporte.toFixed(4))}% para el premio, con redondeo a centavos.
                </li>
                <li>
                  El premio se financia con {reglas.premioNumerador}/
                  {reglas.premioDenominador} de las comisiones. No se agrega ningún cargo
                  al comprador.
                </li>
                <li>
                  Los períodos duran 14 días consecutivos y cierran a las 00:00 de
                  Argentina. Al abrir o actualizar esta sección se sortean los períodos
                  vencidos con actividad. El resultado queda guardado.
                </li>
              </ol>
              <p className="muted">
                Tus chances cambian mientras otros negocios compran y venden. No hay un
                monto mínimo adicional para participar; siguen vigentes los mínimos
                comerciales de cada vendedor. Participan los negocios que siguen
                registrados al realizar el sorteo.
              </p>
              <dl className="sorteo-finanzas">
                <div>
                  <dt>Comisiones simuladas del período</dt>
                  <dd>{moneda(actual.comisiones)}</dd>
                </div>
                <div>
                  <dt>Para la plataforma</dt>
                  <dd>{moneda(actual.ingresoPlataforma)}</dd>
                </div>
                <div>
                  <dt>Para el premio</dt>
                  <dd>{moneda(actual.premio)}</dd>
                </div>
              </dl>
            </article>
            <section className="sorteo-historial" aria-label="Resultados anteriores">
              <h2>Resultados anteriores</h2>
              {resumen.historial.length === 0 ? (
                <p className="muted">Todavía no hay sorteos cerrados con actividad.</p>
              ) : (
                <ul>
                  {resumen.historial.map((sorteo) => (
                    <li key={sorteo.inicio} className="ventas-tarjeta">
                      <div>
                        <span className="eyebrow">CIERRE · {fecha(sorteo.fin)}</span>
                        <h3>{moneda(sorteo.premio)}</h3>
                        <p>
                          {sorteo.ganador
                            ? sorteo.esGanador
                              ? '¡Tu negocio ganó este premio simulado!'
                              : `Ganador: ${sorteo.ganador.nombre}`
                            : 'Sin ganador: no hubo premio o participantes elegibles.'}
                        </p>
                      </div>
                      <p className="muted">
                        {sorteo.participantes} negocios · Tu probabilidad al cierre:{' '}
                        {probabilidad(sorteo.propia)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </section>
    </>
  );
}
