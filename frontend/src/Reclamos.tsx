/**
 * Reclamos dentro de la tarjeta de una suborden entregada.
 * El comprador inicia un reclamo eligiendo productos, cantidades y motivo; el vendedor
 * lo aprueba (nota de crédito simulada), lo rechaza con motivo obligatorio o confirma
 * la recepción de la devolución. La API vuelve a validar plazo, cantidades y permisos.
 */

// ================= CÓMO LEER UN ARCHIVO DEL FRONT (React) =================
// ORDEN DE UN COMPONENTE (siempre igual):
//   1) imports: traen funciones/tipos/componentes de otros archivos.
//   2) export default function Nombre({ props }) { ... }  ← el componente es una FUNCIÓN.
//   3) adentro, arriba: const [dato, setDato] = useState(inicial)  ← datos que cambian.
//   4) después: funciones (cargar, guardar, enviar...) que llaman al back con api.algo(...).
//   5) al final: return ( ...JSX... )  ← lo que se VE en pantalla.
// FLUJO TÍPICO: useEffect → api.algo(token) (api.ts) → back → respuesta → setDato(respuesta) → React redibuja.
// CÓMO SE CONECTA CON OTROS ARCHIVOS:
//   - PROPS: el padre escribe <Hijo token={token} alGuardar={fn} />  y el hijo las recibe en function Hijo({ token, alGuardar }).
//   - api.algo(...) está en api.ts: arma la URL y hace el fetch al back.
// SINTAXIS QUE VAS A VER:
//   (x) => algo          función flecha (función sin nombre). () => fn(x) = 'ejecutá fn(x) cuando pase (click)'.
//   await               espera la respuesta del back (solo dentro de una función async).
//   a && <p/>           si a es verdadero, muestra <p/>; si no, nada.
//   a ? b : c           ternario: si a → b, si no → c.
//   x?.y                lee y solo si x existe (si x es null/undefined no explota).
//   x ?? valor          si x es null/undefined usa valor.
//   lista.map((e) => <li/>)   un elemento de pantalla por cada elemento de la lista.
//   {variable}          dentro del JSX: muestra el valor de la variable o ejecuta código JS.
//   `texto ${variable}` texto con una variable adentro.
//   ...objeto           copia todas las propiedades de un objeto/lista.
//   className="..."     es el class de HTML (estilos de CSS).
//   onClick / onChange / onSubmit   eventos: qué función se ejecuta al tocar / escribir / enviar.
// ==============================================================================
import { FormEvent, useState } from 'react';
import { api, Reclamo, Suborden } from './api';
import { cantidadesReclamables, ESTADOS_RECLAMO, formatCurrency } from './utils';

const fechaHora = (valor: string) => new Date(valor).toLocaleString('es-AR');

// Tipo de las PROPS que recibe el componente (lo que le pasa Pedidos.tsx).
type Props = {
  suborden: Suborden;
  rol: 'comprador' | 'vendedor';
  token: string;
  // Se llama después de cada acción, haya salido bien o no, para releer los pedidos.
  // Función async del padre (cargar de Pedidos.tsx) para recargar los pedidos.
  alActualizar: () => Promise<void>;
};

// COMPONENTE Reclamos: se dibuja dentro de cada tarjeta de suborden.
// { suborden, rol, token, alActualizar } = saca cada prop por nombre (desestructuración).
// DE DÓNDE VIENEN LAS PROPS (las pone Pedidos.tsx en <Reclamos ... />):
//   suborden = el elemento del .map de subórdenes · rol = 'comprador' o 'vendedor' (texto fijo en Pedidos)
//   token = el token que Pedidos recibió de App.tsx · alActualizar = la función cargar() de Pedidos.
export default function Reclamos({ suborden, rol, token, alActualizar }: Props) {
  // true = formulario de nuevo reclamo abierto.
  const [abierto, setAbierto] = useState(false);
  // ?? [] = si la suborden no trae reclamos (undefined), usa lista vacía.
  const reclamos = suborden.reclamos ?? [];
  const disponibles = cantidadesReclamables(suborden);
  const quedanUnidades = [...disponibles.values()].some((cantidad) => cantidad > 0);
  // Se puede iniciar reclamo si: es comprador Y está en plazo (puedeReclamar lo calcula el back) Y quedan unidades.
  const puedeIniciar =
    rol === 'comprador' && suborden.puedeReclamar === true && quedanUnidades;

  // return null = no dibuja nada.
  if (!reclamos.length && rol === 'vendedor') return null;

  return (
    <section
      className="reclamos"
      aria-label={`Reclamos de la orden #${suborden.idSuborden}`}
    >
      {/* Una tarjeta por reclamo ya hecho. */}
      {reclamos.map((reclamo) => (
        <TarjetaReclamo
          key={reclamo.idReclamo}
          reclamo={reclamo}
          rol={rol}
          token={token}
          alActualizar={alActualizar}
        />
      ))}
      {/* CONDICIÓN DE VARIAS PARTES con &&: comprador Y suborden ENTREGADA Y tiene fecha límite Y el formulario no está abierto.
         MOLDE para mostrar un botón solo en subórdenes entregadas. */}
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
            {/* Botón 'Iniciar reclamo': onClick={() => setAbierto(true)} abre el formulario. */}
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
      {/* Si está abierto, muestra el formulario. alCerrar={() => setAbierto(false)} lo cierra. */}
      {abierto && (
        // Le pasa props al formulario (función de abajo en este archivo): la suborden, las cantidades disponibles, el token,
        // alCerrar (cierra) y alActualizar (recarga).
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

// Componente del formulario (en el mismo archivo, sin export: solo se usa acá).
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
  // Texto del motivo (input controlado).
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Arma la lista { idProducto, cantidad } con lo que cargó el usuario (map) y saca los vacíos o 0 (filter).
  const items = Object.entries(cantidades)
    .map(([id, valor]) => ({ idProducto: Number(id), cantidad: Number(valor) }))
    .filter((item) => Number.isInteger(item.cantidad) && item.cantidad > 0);
  // reduce: recorre la lista acumulando un total (arranca en 0, el último parámetro).
  // Por cada item busca su precio (find) y suma precio × cantidad.
  const importe = items.reduce((total, item) => {
    const linea = suborden.items.find((i) => i.idProducto === item.idProducto);
    return total + Number(linea?.precioUnitario ?? 0) * item.cantidad;
  }, 0);

  // Se ejecuta al enviar el formulario.
  // LLAMADA AL BACK: api.crearReclamo (api.ts) → POST /pedidos/subordenes/:id/reclamos → orders.controller.crearReclamo → orders.service.crearReclamo.
  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    // Validaciones del front antes de llamar al back.
    if (!items.length) return setError('Elegí al menos un producto y su cantidad.');
    if (!motivo.trim()) return setError('Indicá el motivo del reclamo.');
    setEnviando(true);
    setError('');
    try {
      // POST /pedidos/subordenes/:id/reclamos. Argumentos en el MISMO ORDEN que en api.ts: (idSuborden, datos, token).
      // motivo.trim() saca espacios.
      await api.crearReclamo(
        suborden.idSuborden,
        { items, motivo: motivo.trim() },
        token,
      );
      // Si salió bien, cierra el formulario.
      alCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el reclamo.');
    } finally {
      setEnviando(false);
      // En el finally: recarga los pedidos (salga bien o mal) para ver el reclamo nuevo.
      await alActualizar();
    }
  }

  return (
    <form className="reclamo-formulario" onSubmit={enviar}>
      <b>Nuevo reclamo</b>
      <ul>
        {/* Un input por producto comprado. map con { } y return (en vez de => ( ) porque antes hace un cálculo (const maximo). */}
        {suborden.items.map((item) => {
          // Map.get(clave) → cantidad que queda por reclamar de ese producto (0 si no está).
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
                  // cantidades es un objeto { idProducto: 'texto' }. [item.idProducto] lee la clave de ESTE producto.
                  value={cantidades[item.idProducto] ?? ''}
                  onChange={(e) =>
                    // Actualiza solo la clave de este producto: copia todo (...actual) y pisa [item.idProducto] con lo escrito.
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
          // Input controlado: cada tecla guarda el texto en motivo.
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

// TARJETA DE UN RECLAMO (componente de este mismo archivo). La dibuja Reclamos con reclamos.map.
// Props: reclamo (elemento del map), rol, token y alActualizar (cargar de Pedidos).
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

  // Función genérica: recibe OTRA función (accion) que llama al back, la ejecuta con try/catch y después recarga.
  // Así no repiten el try/catch en aprobar, rechazar y confirmar recepción.
  async function ejecutar(accion: () => Promise<unknown>, alTerminar?: () => void) {
    setEnCurso(true);
    setError('');
    try {
      // Ejecuta la llamada que le pasaron (ej: () => api.aprobarReclamo(reclamo.idReclamo, token)).
      await accion();
      // ?.() = la llama solo si la pasaron (es opcional).
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
      {/* Botones del vendedor para un reclamo PENDIENTE.
         Aprobar → api.aprobarReclamo(reclamo.idReclamo, token) → PATCH /pedidos/reclamos/:id/aprobar → orders.service.aprobarReclamo. */}
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
      {/* Formulario de rechazo → api.rechazarReclamo(id, motivo, token) → PATCH /pedidos/reclamos/:id/rechazar con { motivo }. */}
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
      {/* Reclamo aprobado → botón confirmar recepción → api.confirmarRecepcionReclamo → vuelve el stock. */}
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
