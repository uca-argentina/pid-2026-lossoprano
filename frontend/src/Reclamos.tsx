/**
 * Reclamos dentro de la tarjeta de una suborden entregada.
 * El comprador inicia un reclamo eligiendo productos, cantidades y motivo; el vendedor
 * lo aprueba (nota de crédito simulada), lo rechaza con motivo obligatorio o confirma
 * la recepción de la devolución. La API vuelve a validar plazo, cantidades y permisos.
 */

import { FormEvent, useState } from 'react';
import { api, Reclamo, Suborden } from './api';
import { cantidadesReclamables, ESTADOS_RECLAMO, formatCurrency } from './utils';

// Muestra fecha y hora en formato argentino.
const fechaHora = (valor: string) => new Date(valor).toLocaleString('es-AR');

type Props = {
  suborden: Suborden;
  rol: 'comprador' | 'vendedor';
  token: string;
  // Se llama después de cada acción, haya salido bien o no, para releer los pedidos.
  alActualizar: () => Promise<void>;
};

// Lista de reclamos de una suborden y botón para iniciar uno nuevo.
export default function Reclamos({ suborden, rol, token, alActualizar }: Props) {
  const [abierto, setAbierto] = useState(false);
  // Reclamos existentes, unidades que todavía se pueden reclamar y si se puede iniciar uno.
  const reclamos = suborden.reclamos ?? [];
  const disponibles = cantidadesReclamables(suborden);
  const quedanUnidades = [...disponibles.values()].some((cantidad) => cantidad > 0);
  const puedeIniciar =
    rol === 'comprador' && suborden.puedeReclamar === true && quedanUnidades;

  // El vendedor no ve nada si la suborden no tiene reclamos.
  if (!reclamos.length && rol === 'vendedor') return null;

  return (
    <section
      className="reclamos"
      aria-label={`Reclamos de la orden #${suborden.idSuborden}`}
    >
      {/* Una tarjeta por reclamo */}
      {reclamos.map((reclamo) => (
        <TarjetaReclamo
          key={reclamo.idReclamo}
          reclamo={reclamo}
          rol={rol}
          token={token}
          alActualizar={alActualizar}
        />
      ))}
      {/* Comprador: plazo para reclamar y botón para iniciar */}
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
      {/* Formulario del reclamo nuevo */}
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

// Formulario para elegir productos, cantidades y motivo del reclamo.
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
  // Productos con una cantidad válida cargada y el importe estimado de la nota de crédito.
  const items = Object.entries(cantidades)
    .map(([id, valor]) => ({ idProducto: Number(id), cantidad: Number(valor) }))
    .filter((item) => Number.isInteger(item.cantidad) && item.cantidad > 0);
  const importe = items.reduce((total, item) => {
    const linea = suborden.items.find((i) => i.idProducto === item.idProducto);
    return total + Number(linea?.precioUnitario ?? 0) * item.cantidad;
  }, 0);

  // Guarda la cantidad escrita para un producto.
  function cambiarCantidad(idProducto: number, valor: string) {
    setCantidades((actual) => ({ ...actual, [idProducto]: valor }));
  }

  // Valida y manda el reclamo a la api; después recarga los pedidos.
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
      {/* Un renglón por producto con la cantidad a reclamar */}
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
                  onChange={(e) => cambiarCantidad(item.idProducto, e.target.value)}
                />
              </label>
            </li>
          );
        })}
      </ul>
      {/* Motivo e importe estimado */}
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
      {/* Error y botones Enviar / Cancelar */}
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

// Un reclamo con su estado y, para el vendedor, los botones para resolverlo.
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
  // Clase CSS según el estado del reclamo (se usa dos veces).
  const claseEstado = reclamo.estado.toLowerCase();

  // Corre una acción de la api, muestra el error si falla y siempre recarga los pedidos.
  // AYUDA: acción nueva sobre un reclamo: function x() { void ejecutar(() => api.algo(reclamo.idReclamo, token)); } (ya maneja error y recarga).
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

  // Aprueba el reclamo y emite la nota de crédito.
  function aprobar() {
    void ejecutar(() => api.aprobarReclamo(reclamo.idReclamo, token));
  }

  // Valida el motivo y rechaza el reclamo; si sale bien, cierra el formulario.
  function confirmarRechazo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!motivoRechazo.trim()) return setError('Indicá el motivo del rechazo.');
    void ejecutar(
      () => api.rechazarReclamo(reclamo.idReclamo, motivoRechazo.trim(), token),
      () => setRechazando(false),
    );
  }

  // Cierra el formulario de rechazo sin guardar.
  function cancelarRechazo() {
    setRechazando(false);
    setError('');
  }

  // Confirma que llegó la devolución (repone el stock).
  function confirmarRecepcion() {
    void ejecutar(() => api.confirmarRecepcionReclamo(reclamo.idReclamo, token));
  }

  return (
    <article className={`reclamo ${claseEstado}`}>
      {/* Número y estado del reclamo */}
      <header>
        <b>Reclamo #{reclamo.idReclamo}</b>
        <span className={`estado-reclamo ${claseEstado}`}>
          {ESTADOS_RECLAMO[reclamo.estado]}
        </span>
      </header>
      {/* Productos reclamados, motivo y fecha */}
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
      {/* Datos según el estado: nota de crédito, devolución o rechazo */}
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
      {/* Error de la última acción */}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {/* Vendedor con reclamo pendiente: aprobar o rechazar */}
      {rol === 'vendedor' && reclamo.estado === 'PENDIENTE' && !rechazando && (
        <div className="suborden-acciones">
          <button
            type="button"
            className="primary"
            disabled={enCurso}
            onClick={() => aprobar()}
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
      {/* Formulario para escribir el motivo del rechazo */}
      {rechazando && (
        <form className="reclamo-formulario" onSubmit={confirmarRechazo}>
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
              onClick={() => cancelarRechazo()}
            >
              Volver
            </button>
          </div>
        </form>
      )}
      {/* Vendedor con reclamo aprobado: confirmar que llegó la devolución */}
      {rol === 'vendedor' && reclamo.estado === 'APROBADO' && (
        <div className="suborden-acciones">
          <button
            type="button"
            className="primary"
            disabled={enCurso}
            onClick={() => confirmarRecepcion()}
          >
            Confirmar recepción de la devolución
          </button>
        </div>
      )}
    </article>
  );
}
