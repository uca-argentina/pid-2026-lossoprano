/**
 * Reclamos dentro de la tarjeta de una suborden entregada.
 * El comprador inicia un reclamo eligiendo productos, cantidades y motivo; el vendedor
 * lo aprueba (nota de crédito simulada), lo rechaza con motivo obligatorio o confirma
 * la recepción de la devolución. La API vuelve a validar plazo, cantidades y permisos.
 */

import { FormEvent, useState } from 'react';
import { api, Reclamo, Suborden } from './api';
import { cantidadesReclamables, ESTADOS_RECLAMO, formatCurrency } from './utils';

const fechaHora = (valor: string) => new Date(valor).toLocaleString('es-AR');

type Props = {
  suborden: Suborden;
  rol: 'comprador' | 'vendedor';
  token: string;
  // Se llama después de cada acción, haya salido bien o no, para releer los pedidos.
  alActualizar: () => Promise<void>;
};

export default function Reclamos({ suborden, rol, token, alActualizar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const reclamos = suborden.reclamos ?? [];
  const disponibles = cantidadesReclamables(suborden);
  const quedanUnidades = [...disponibles.values()].some((cantidad) => cantidad > 0);
  const puedeIniciar =
    rol === 'comprador' && suborden.puedeReclamar === true && quedanUnidades;

  if (!reclamos.length && rol === 'vendedor') return null;

  return (
    <section
      className="reclamos"
      aria-label={`Reclamos de la orden #${suborden.idSuborden}`}
    >
      {reclamos.map((reclamo) => (
        <TarjetaReclamo
          key={reclamo.idReclamo}
          reclamo={reclamo}
          rol={rol}
          token={token}
          alActualizar={alActualizar}
        />
      ))}
      {rol === 'comprador' &&
        suborden.estado === 'ENTREGADA' &&
        suborden.limiteReclamo &&
        !abierto && (
          <div className="reclamo-inicio">
            <small>
              {suborden.puedeReclamar
                ? quedanUnidades
                  ? `Podés iniciar un reclamo hasta el ${fechaHora(suborden.limiteReclamo)}.`
                  : 'Ya reclamaste todas las unidades de esta orden.'
                : `El plazo para reclamar venció el ${fechaHora(suborden.limiteReclamo)}.`}
            </small>
            {puedeIniciar && (
              <button
                type="button"
                className="secondary"
                onClick={() => setAbierto(true)}
              >
                Iniciar reclamo
              </button>
            )}
          </div>
        )}
      {abierto && (
        <FormularioReclamo
          suborden={suborden}
          disponibles={disponibles}
          token={token}
          alCerrar={() => setAbierto(false)}
          alActualizar={alActualizar}
        />
      )}
    </section>
  );
}

function FormularioReclamo({
  suborden,
  disponibles,
  token,
  alCerrar,
  alActualizar,
}: {
  suborden: Suborden;
  disponibles: Map<number, number>;
  token: string;
  alCerrar: () => void;
  alActualizar: () => Promise<void>;
}) {
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const items = Object.entries(cantidades)
    .map(([id, valor]) => ({ idProducto: Number(id), cantidad: Number(valor) }))
    .filter((item) => Number.isInteger(item.cantidad) && item.cantidad > 0);
  const importe = items.reduce((total, item) => {
    const linea = suborden.items.find((i) => i.idProducto === item.idProducto);
    return total + Number(linea?.precioUnitario ?? 0) * item.cantidad;
  }, 0);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!items.length) return setError('Elegí al menos un producto y su cantidad.');
    if (!motivo.trim()) return setError('Indicá el motivo del reclamo.');
    setEnviando(true);
    setError('');
    try {
      await api.crearReclamo(
        suborden.idSuborden,
        { items, motivo: motivo.trim() },
        token,
      );
      alCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el reclamo.');
    } finally {
      setEnviando(false);
      await alActualizar();
    }
  }

  return (
    <form className="reclamo-formulario" onSubmit={enviar}>
      <b>Nuevo reclamo</b>
      <ul>
        {suborden.items.map((item) => {
          const maximo = disponibles.get(item.idProducto) ?? 0;
          return (
            <li key={item.idProducto}>
              <label>
                <span>
                  {item.nombre}
                  <small>
                    {maximo > 0
                      ? `Hasta ${maximo} de ${item.cantidad} · ${formatCurrency(item.precioUnitario)} c/u`
                      : 'Sin unidades para reclamar'}
                  </small>
                </span>
                <input
                  type="number"
                  min="0"
                  max={maximo}
                  step="1"
                  inputMode="numeric"
                  placeholder="0"
                  disabled={maximo === 0}
                  value={cantidades[item.idProducto] ?? ''}
                  onChange={(e) =>
                    setCantidades((actual) => ({
                      ...actual,
                      [item.idProducto]: e.target.value,
                    }))
                  }
                />
              </label>
            </li>
          );
        })}
      </ul>
      <label className="field">
        <span>Motivo</span>
        <textarea
          required
          maxLength={500}
          rows={3}
          placeholder="Ej.: llegaron 3 cajas golpeadas"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </label>
      <small>Nota de crédito estimada: {formatCurrency(importe)}</small>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="suborden-acciones">
        <button className="primary" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar reclamo'}
        </button>
        <button type="button" className="link" disabled={enviando} onClick={alCerrar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function TarjetaReclamo({
  reclamo,
  rol,
  token,
  alActualizar,
}: {
  reclamo: Reclamo;
  rol: 'comprador' | 'vendedor';
  token: string;
  alActualizar: () => Promise<void>;
}) {
  const [rechazando, setRechazando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [error, setError] = useState('');
  const [enCurso, setEnCurso] = useState(false);

  async function ejecutar(accion: () => Promise<unknown>, alTerminar?: () => void) {
    setEnCurso(true);
    setError('');
    try {
      await accion();
      alTerminar?.();
      // Recibir la devolución repone stock: se avisa igual que al cancelar un pedido.
      window.dispatchEvent(new Event('stock-actualizado'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el reclamo.');
    } finally {
      setEnCurso(false);
      await alActualizar();
    }
  }

  return (
    <article className={`reclamo ${reclamo.estado.toLowerCase()}`}>
      <header>
        <b>Reclamo #{reclamo.idReclamo}</b>
        <span className={`estado-reclamo ${reclamo.estado.toLowerCase()}`}>
          {ESTADOS_RECLAMO[reclamo.estado]}
        </span>
      </header>
      <ul className="suborden-items">
        {reclamo.items.map((item) => (
          <li key={item.idProducto}>
            <span>
              {item.cantidad} × {item.nombre}
            </span>
            <span>{formatCurrency(item.subtotal)}</span>
          </li>
        ))}
      </ul>
      <small>
        Motivo: {reclamo.motivo} · {fechaHora(reclamo.creadoEn)}
      </small>
      {reclamo.notaCredito && (
        <p className="reclamo-nota">
          Nota de crédito {reclamo.notaCredito} por {formatCurrency(reclamo.importe)}{' '}
          (simulada)
        </p>
      )}
      {reclamo.estado === 'APROBADO' && (
        <small>
          {rol === 'vendedor'
            ? 'Cuando recibas los productos devueltos, confirmá la recepción para reponer el stock.'
            : 'El vendedor repondrá el stock cuando reciba los productos devueltos.'}
        </small>
      )}
      {reclamo.estado === 'RECIBIDO' && reclamo.recibidoEn && (
        <small>Devolución recibida el {fechaHora(reclamo.recibidoEn)}.</small>
      )}
      {reclamo.estado === 'RECHAZADO' && (
        <p className="reclamo-rechazo">Respuesta del vendedor: {reclamo.motivoRechazo}</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {rol === 'vendedor' && reclamo.estado === 'PENDIENTE' && !rechazando && (
        <div className="suborden-acciones">
          <button
            type="button"
            className="primary"
            disabled={enCurso}
            onClick={() => ejecutar(() => api.aprobarReclamo(reclamo.idReclamo, token))}
          >
            Aprobar y emitir nota de crédito
          </button>
          <button
            type="button"
            className="danger"
            disabled={enCurso}
            onClick={() => setRechazando(true)}
          >
            Rechazar
          </button>
        </div>
      )}
      {rechazando && (
        <form
          className="reclamo-formulario"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (!motivoRechazo.trim()) return setError('Indicá el motivo del rechazo.');
            void ejecutar(
              () => api.rechazarReclamo(reclamo.idReclamo, motivoRechazo.trim(), token),
              () => setRechazando(false),
            );
          }}
        >
          <label className="field">
            <span>Motivo del rechazo</span>
            <textarea
              required
              maxLength={500}
              rows={3}
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
            />
            <small>El comprador lo verá en su historial de pedidos.</small>
          </label>
          <div className="suborden-acciones">
            <button className="danger" disabled={enCurso}>
              Confirmar rechazo
            </button>
            <button
              type="button"
              className="link"
              disabled={enCurso}
              onClick={() => {
                setRechazando(false);
                setError('');
              }}
            >
              Volver
            </button>
          </div>
        </form>
      )}
      {rol === 'vendedor' && reclamo.estado === 'APROBADO' && (
        <div className="suborden-acciones">
          <button
            type="button"
            className="primary"
            disabled={enCurso}
            onClick={() =>
              ejecutar(() => api.confirmarRecepcionReclamo(reclamo.idReclamo, token))
            }
          >
            Confirmar recepción de la devolución
          </button>
        </div>
      )}
    </article>
  );
}
