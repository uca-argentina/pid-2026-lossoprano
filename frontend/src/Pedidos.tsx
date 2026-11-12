/**
 * Pantalla reutilizada para compras del negocio y ventas recibidas. El prop tipo
 * elige una única consulta.
 * El comprador ve pedidos generales; el vendedor administra solo sus subórdenes.
 * Las acciones visibles son una ayuda de interfaz: las transiciones y el propietario
 * se vuelven a controlar en la API.
 */

// useState = guarda datos que, si cambian, hacen que React vuelva a dibujar la pantalla.
// useEffect = ejecuta algo cuando la pantalla aparece (o cuando cambian ciertos valores).
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
import { ReactNode, useEffect, useState } from 'react';
// api = el objeto con las llamadas al back. Los demás son TIPOS (formas de los datos).
import { api, EstadoSuborden, Pedido, Suborden } from './api';
// Otro componente (otro archivo .tsx) que se usa adentro de este como <Reclamos ... />.
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

// COMPONENTE Pedidos: una función que devuelve lo que se ve (JSX).
// Lo usa App.tsx así: <Pedidos token={...} tipo="compras" /> o tipo="ventas".
// Lo que va entre ({ }) son las PROPS: datos que le pasa el componente padre.
// PROPS que recibe (las pone App.tsx): token = sesion.accessToken (del login) · tipo = 'compras' o 'ventas' (texto fijo en App.tsx).
export default function Pedidos({
  token,
  tipo,
}: {
  token: string;
  tipo: 'compras' | 'ventas';
}) {
  // true si es la pantalla del vendedor (Pedidos recibidos), false si es Mis compras.
  const esVenta = tipo === 'ventas';
  // useState: [valorActual, funciónParaCambiarlo] = useState(valorInicial).
  // vista = qué pestaña está elegida ('activos' o 'historial').
  const [vista, setVista] = useState<Vista>('activos');
  // Lista de compras. Lista → arranca en [] (vacía). <Pedido[]> = de qué tipo es.
  const [compras, setCompras] = useState<Pedido[]>([]);
  // Lista de ventas (subórdenes recibidas).
  const [ventas, setVentas] = useState<Suborden[]>([]);
  // true mientras espera al back → muestra 'Cargando pedidos…'.
  const [cargando, setCargando] = useState(true);
  // Texto del error. Texto → arranca en ''. Si tiene algo, se muestra en rojo.
  const [error, setError] = useState('');
  // id de la suborden que se está actualizando (para deshabilitar botones). null = ninguna.
  const [enCurso, setEnCurso] = useState<number | null>(null);

  /**
   * Consulta solamente compras o ventas según tipo. Centraliza la recarga inicial y la
   * posterior a una transición.
   */
  // Pide los datos al back y los guarda en el estado. async porque usa await.
  async function cargar() {
    // try/catch: si el back responde error, salta al catch.
    try {
      // Vendedor: pide sus ventas (GET /pedidos/ventas). await espera la lista; setVentas la guarda → React redibuja.
      // Si el else tuviera DOS líneas, necesitaría llaves { }.
      if (esVenta) setVentas(await api.misVentas(token));
      else setCompras(await api.misCompras(token));
    // e = el error que lanzó solicitud en api.ts; e.message = el mensaje del back.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los pedidos.');
    // finally se ejecuta SIEMPRE (haya error o no).
    } finally {
      setCargando(false);
    }
  }

  // Ejecuta cargar() cuando aparece la pantalla y cada vez que cambian token o tipo (la lista [token, tipo]).
  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tipo]);

  /**
   * Solicita la transición elegida y vuelve a consultar incluso si falla, porque la otra
   * parte pudo haber actualizado la suborden.
   */
  // Se ejecuta al tocar un botón de estado (Confirmar, Preparada, Enviada, Entregada, Rechazar, Cancelar).
  // PARÁMETROS: suborden = la del .map donde está el botón · estado = accion.estado (de ACCIONES_VENDEDOR / ACCIONES_COMPRADOR en utils.ts).
  // LA LLAMA: el onClick de cada botón que arma acciones() más abajo.
  async function cambiarEstado(suborden: Suborden, estado: EstadoSuborden) {
    // true si la acción es rechazar o cancelar.
    const devuelveStock = estado === 'RECHAZADA' || estado === 'CANCELADA';
    if (
      devuelveStock &&
      // Ventanita del navegador '¿Seguro...?'. Si toca Cancelar → return (no hace nada).
      !window.confirm(
        `¿Seguro que querés ${estado === 'RECHAZADA' ? 'rechazar' : 'cancelar'} la orden #${suborden.idSuborden}? No se puede deshacer.`,
      )
    )
      return;
    // Marca esta suborden como 'en curso' (deshabilita los botones).
    setEnCurso(suborden.idSuborden);
    setError('');
    try {
      // Llama al back: PATCH /pedidos/subordenes/:id/estado con { estado }.
      await api.cambiarEstadoSuborden(suborden.idSuborden, estado, token);
      if (devuelveStock) window.dispatchEvent(new Event('stock-actualizado'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el pedido.');
    } finally {
      // La otra parte pudo haber cambiado el estado: se vuelve a leer siempre.
      // Vuelve a pedir los datos para mostrar el estado nuevo.
      await cargar();
      setEnCurso(null);
    }
  }

  // Arma los BOTONES de estado de una suborden.
  // disponibles[suborden.estado] = acciones posibles desde el estado actual (definidas en utils.ts).
  // ?.map = si no hay acciones (undefined), no explota. map transforma cada acción en un <button>.
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
        // Al tocar el botón llama a cambiarEstado (arriba) con la suborden de esta tarjeta y el estado de esta acción.
        // () => ... = se ejecuta recién al hacer click (si pusieras cambiarEstado(...) directo, se ejecutaría al dibujar).
        onClick={() => cambiarEstado(suborden, accion.estado)}
      >
        {accion.etiqueta}
      </button>
    ));

  // filter = se queda solo con los que cumplen la condición.
  // Historial → pedidos COMPLETADA; Seguimiento → EN_CURSO.
  const comprasVisibles = compras.filter((pedido) =>
    vista === 'historial' ? pedido.estado === 'COMPLETADA' : pedido.estado === 'EN_CURSO',
  );
  // Una venta entregada con un reclamo abierto sigue en Pedidos recibidos hasta resolverlo.
  // Una venta está activa si no terminó O tiene un reclamo abierto (.some = ¿alguno cumple?).
  const ventaActiva = (suborden: Suborden) =>
    !subordenFinalizada(suborden.estado) ||
    (suborden.reclamos ?? []).some(reclamoAbierto);
  // Filtra las ventas según la pestaña elegida.
  const ventasVisibles = ventas.filter(
    (suborden) => ventaActiva(suborden) === (vista === 'activos'),
  );
  const vistas: { id: Vista; etiqueta: string }[] = [
    { id: 'activos', etiqueta: esVenta ? 'Pedidos recibidos' : 'Seguimiento' },
    { id: 'historial', etiqueta: 'Historial' },
  ];

  // Lo que se VE. JSX = HTML dentro de JavaScript. Lo que va entre { } es código JS.
  return (
    <>
      <section className="welcome">
        {/* Ternario: si es venta muestra un texto, si no otro. */}
        <span className="eyebrow">{esVenta ? 'PEDIDOS' : 'MIS COMPRAS'}</span>
        {/* Mismo componente, distinto texto según esVenta (calculado arriba a partir de la prop tipo). */}
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
          {/* Un botón por pestaña. onClick={() => setVista(opcion.id)} cambia la pestaña → React redibuja con la otra lista. */}
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
          // Botón 'Actualizar pedidos': onClick limpia el error, pone cargando en true y vuelve a llamar a cargar().
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
        {/* && = 'si hay error, mostrá esto'. Si error es '' no se muestra nada. */}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {/* Mientras cargando es true (arranca en true y cargar() lo pone en false en el finally) muestra este texto. */}
        {cargando && <p className="muted">Cargando pedidos…</p>}
        {/* Vista del VENDEDOR: si ya cargó y es venta → si no hay ventas muestra un texto; si hay, una tarjeta por suborden. */}
        {!cargando &&
          esVenta &&
          // Ternario: si la lista filtrada está vacía muestra un texto; si no ( : ), dibuja las tarjetas.
          (ventasVisibles.length === 0 ? (
            <p className="muted">
              {vista === 'historial'
                ? 'Todavía no tenés pedidos recibidos finalizados.'
                : 'No tenés pedidos recibidos en curso.'}
            </p>
          ) : (
            // <TarjetaSuborden ... /> = usa el componente TarjetaSuborden (definido al final de ESTE archivo).
            // Cada atributo de abajo es una PROP que le llega a TarjetaSuborden({ suborden, titulo, detalle, acciones }).
            // map: por cada suborden dibuja una <TarjetaSuborden>. 'suborden' es el nombre de cada elemento: SOLO existe dentro de este map.
            // key = identificador único para React (si falta, solo da un aviso).
            ventasVisibles.map((suborden) => (
              <TarjetaSuborden
                key={suborden.idSuborden}
                suborden={suborden}
                // Template string: arma el texto 'Orden #12 · Almacén La Esquina' con datos de la suborden.
                titulo={`Orden #${suborden.idSuborden} · ${suborden.nombreComprador}`}
                // fecha() está arriba en este archivo: convierte el texto de fecha del back en dd/mm/aaaa.
                detalle={`Pedido #${suborden.idPedido} del ${fecha(suborden.creadoEn)}`}
                // Prop acciones = los botones del vendedor para esta suborden (función acciones de arriba + tabla de utils.ts).
                acciones={acciones(suborden, ACCIONES_VENDEDOR)}
              >
                {/* Componente de reclamos de esta suborden. Le pasa PROPS: suborden, rol, token y alActualizar (la función cargar, para recargar). */}
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
          // Lo mismo para el comprador: texto si está vacío, si no un <article> por pedido.
          (comprasVisibles.length === 0 ? (
            <p className="muted">
              {vista === 'historial'
                ? 'Todavía no tenés órdenes completadas.'
                : 'No tenés compras en curso.'}
            </p>
          ) : (
            // Vista del COMPRADOR: por cada pedido dibuja un <article>.
            comprasVisibles.map((pedido) => (
              // Tarjeta de UN pedido general. 'pedido' = cada elemento de comprasVisibles (solo existe dentro de este map).
              <article className="pedido" key={pedido.idPedido}>
                <header>
                  {/* {pedido.idPedido} muestra el número que vino del back. */}
                  <h2>Pedido #{pedido.idPedido}</h2>
                  <span className={`estado-pedido ${pedido.estado.toLowerCase()}`}>
                    {/* ESTADOS_PEDIDO (utils.ts) traduce 'EN_CURSO' → 'En curso'. [ ] = leer la propiedad cuyo nombre está en una variable. */}
                    {ESTADOS_PEDIDO[pedido.estado]}
                  </span>
                </header>
                <p className="muted">
                  {/* formatCurrency (utils.ts) muestra el total como moneda. */}
                  {fecha(pedido.creadoEn)} · Total {formatCurrency(pedido.total)}
                </p>
                <p className="muted">
                  {pedido.estado === 'COMPLETADA'
                    ? 'Todas las subórdenes están entregadas o cerradas.'
                    : 'La orden se completará cuando todas sus subórdenes estén entregadas o cerradas.'}{' '}
                  Las rechazadas o canceladas se consideran cerradas.
                </p>
                {/* Dentro de cada pedido, una tarjeta por suborden (un vendedor cada una).
                   ACÁ ADENTRO es donde agregás cosas por suborden (botones, textos) usando suborden.idSuborden, suborden.estado, etc. */}
                {pedido.subordenes.map((suborden) => (
                  // Una tarjeta por suborden del pedido. Mismas props que en la vista del vendedor, pero con el nombre del VENDEDOR como título.
                  <TarjetaSuborden
                    key={suborden.idSuborden}
                    suborden={suborden}
                    titulo={suborden.nombreVendedor}
                    detalle={`Orden #${suborden.idSuborden}`}
                    // Para el comprador usa la tabla ACCIONES_COMPRADOR (solo Cancelar).
                    acciones={acciones(suborden, ACCIONES_COMPRADOR)}
                  >
                    {/* Reclamos.tsx dentro de la tarjeta, con rol="comprador" (texto fijo): ahí aparece el botón 'Iniciar reclamo' si está ENTREGADA. */}
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
// COMPONENTE de este mismo archivo: dibuja una suborden (vendedor, estado, productos, total).
// Props: suborden, titulo, detalle, acciones (botones) y children (lo que va entre <TarjetaSuborden> y </TarjetaSuborden>, ej: <Reclamos />).
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
    // Lo que dibuja TarjetaSuborden con las props que recibió.
    <article className="suborden">
      <header>
        <div>
          {/* titulo y detalle = las props que le pasó Pedidos. */}
          <b>{titulo}</b>
          <small>{detalle}</small>
        </div>
        {/* El estado: className con el estado en minúscula (para el color en CSS) y el texto lindo de ESTADOS_SUBORDEN (utils.ts). */}
        <span className={`estado-suborden ${suborden.estado.toLowerCase()}`}>
          {ESTADOS_SUBORDEN[suborden.estado]}
        </span>
      </header>
      <ul className="suborden-items">
        {/* Un renglón por producto comprado: cantidad × nombre y subtotal. items viene del back (columna jsonb de la suborden). */}
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
        {/* Traduce la condición de pago a texto (utils.ts). */}
        {CONDICIONES_PAGO[suborden.condicionPago]} (simulado)
      </small>
      <small>
        Última actualización: {new Date(suborden.actualizadoEn).toLocaleString('es-AR')}
      </small>
      {/* Si hay botones de estado (prop acciones), los muestra. */}
      {acciones && acciones.length > 0 && (
        <div className="suborden-acciones">{acciones}</div>
      )}
      {/* children = lo que se escribió ENTRE <TarjetaSuborden> y </TarjetaSuborden> en Pedidos (el componente <Reclamos />). */}
      {children}
    </article>
  );
}
