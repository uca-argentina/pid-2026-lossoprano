/**
 * Pantalla reutilizada para compras del negocio y ventas recibidas. El prop tipo
 * elige una única consulta.
 * El comprador ve pedidos generales; el vendedor administra solo sus subórdenes.
 * Las acciones visibles son una ayuda de interfaz: las transiciones y el propietario
 * se vuelven a controlar en la API.
 */

import { ReactNode, useEffect, useState, useRef } from 'react';
import { api, EstadoSuborden, Pedido, Suborden, Carrito, ItemCarrito, Producto } from './api';
import {  } from './useCarrito';
import Reclamos from './Reclamos';
import agregarAlCarrito from './Comprador';
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
// Muestra una fecha en formato argentino (dd/mm/aaaa).
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
  const [carrito, setCarrito] = useState<Carrito>(null);
    const [avisoCarrito, setAviso] = useState('');
    const [listo, setListo] = useState(false);
    const [procesando, setProcesando] = useState(false);


    const actual = useRef<Carrito>(null);
      const ocupado = useRef(false);
      const revision = useRef(0);
      const activo = useRef(false);
    // Las referencias permiten leer el último valor desde callbacks sin depender del render
    // que los creó. ocupado coordina escrituras; revision identifica respuestas de consultas viejas.
    function mostrar(valor: Carrito) {
    actual.current = valor;
    if (activo.current) setCarrito(valor);
  }
   useEffect(() => {
    activo.current = true;
    let cancelado = false;
    let cargando = false;
    let falloCarga = false;})
  // Compras de la pestaña elegida: en curso o completadas.
  const comprasVisibles = compras.filter((pedido) =>
    vista === 'historial' ? pedido.estado === 'COMPLETADA' : pedido.estado === 'EN_CURSO',
  );
  // Ventas de la pestaña elegida: activas o finalizadas.
  const ventasVisibles = ventas.filter(
    (suborden) => ventaActiva(suborden) === (vista === 'activos'),
  );
  // Pestañas que se muestran arriba de la lista.
  const vistas: { id: Vista; etiqueta: string }[] = [
    { id: 'activos', etiqueta: esVenta ? 'Pedidos recibidos' : 'Seguimiento' },
    { id: 'historial', etiqueta: 'Historial' },
  ];

  // Carga los pedidos al entrar y cuando cambia el token o el tipo.
  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tipo]);

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
      // AYUDA: pedir un texto al cambiar estado: const x = estado === 'ENVIADA' ? window.prompt('...') ?? '' : '';  → pasarlo como parámetro extra (api.ts + body).
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

  // Limpia el error y vuelve a pedir los pedidos al tocar "Actualizar pedidos".
  function actualizarPedidos() {
    setError('');
    setCargando(true);
    void cargar();
  }

  // Arma los botones de cambio de estado que corresponden a la suborden.
  // AYUDA: los botones de estado salen de ACCIONES_VENDEDOR / ACCIONES_COMPRADOR (utils.ts). Botón propio en la tarjeta: hijo de <TarjetaSuborden>.
  function acciones(suborden: Suborden, disponibles: typeof ACCIONES_VENDEDOR) {
    return disponibles[suborden.estado]?.map((accion) => (
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
  }

  // Una venta entregada con un reclamo abierto sigue en Pedidos recibidos hasta resolverlo.
  function ventaActiva(suborden: Suborden) {
    return (
      !subordenFinalizada(suborden.estado) ||
      (suborden.reclamos ?? []).some(reclamoAbierto)
    );
  }
  function limitarCantidad(cantidad: number, stock: number, minimo = 1) {
  if (!Number.isInteger(stock) || stock < minimo) return 0;
  return Math.max(
    minimo,
    Math.min(stock, Number.isFinite(cantidad) ? Math.trunc(cantidad) : minimo),
  );
}

async function guardar(
    items: Pick<ItemCarrito, 'idProducto' | 'version' | 'cantidad'>[],
  ) {
    
   
    
      mostrar(await api.guardarCarrito(items, token));
      
  }
async function agregar(producto: Producto, cantidad: number, idNegocio) {
    if (producto.idNegocio === idNegocio) {
      setAviso('No podés comprar productos de tu propio negocio.');
      return false;
    }
    const unidades = limitarCantidad(
      cantidad,
      producto.stock,
      producto.cantidadMinimaCompra ?? 1,
    );
    if (!unidades) return false;
    // El carrito admite varios vendedores: se suma al resto sin vaciarlo.
    const items = actual.current?.items ?? [];
    const existente = items.find((item) => item.idProducto === producto.idProducto);
    const nuevo = {
      idProducto: producto.idProducto,
      version: producto.version,
      cantidad: limitarCantidad(
        (existente?.version === producto.version ? existente.cantidad : 0) + unidades,
        producto.stock,
        producto.cantidadMinimaCompra ?? 1,
      ),
    };
    return guardar([
      ...items.filter((item) => item.idProducto !== producto.idProducto),
      nuevo,
    ]);
  }
  async function repetirPedido(pedido:Pedido){
    
    const subordenes = pedido.subordenes;
    const item = subordenes[0];
    const producto = api.obtenerProducto(item.items[0].idProducto,token);
    agregar(producto, token,true);
    subordenes.map((p)=> api.obtenerProducto(p.items.map((q)=> q.idProducto),token))
    //const items = subordenes.map((p)=>p.map((q)=>agregar(api.obtenerProducto(q.idProducto,token, q.cantidad, q.idNegocio))); 
    // pedido.subordenes.items.map((p)=>agregar(api.obtenerProducto(p.idProducto,token, true));



  }

  return (
    <>
      {/* Encabezado: cambia según sea compras o ventas */}
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
        {/* Pestañas: en curso / historial */}
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
        {/* Botón para volver a cargar los pedidos */}
        <button
          type="button"
          className="link pedidos-actualizar"
          disabled={cargando || enCurso !== null}
          onClick={() => actualizarPedidos()}
        >
          Actualizar pedidos
        </button>
        {/* Avisos de error y de carga */}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {cargando && <p className="muted">Cargando pedidos…</p>}
        {/* Vendedor: una tarjeta por cada pedido recibido */}
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
        {/* Comprador: cada pedido con sus subórdenes por vendedor */}
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
                <button type="button" className="link" onClick={repetirPedido(pedido.subordenes)}>REPETIR PEDIDO</button>
                
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
      {/* Título, detalle y estado */}
      <header>
        <div>
          <b>{titulo}</b>
          <small>{detalle}</small>
        </div>
        <span className={`estado-suborden ${suborden.estado.toLowerCase()}`}>
          {ESTADOS_SUBORDEN[suborden.estado]}
        </span>
      </header>
      {/* Productos de la suborden con su subtotal */}
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
      {/* Total, entrega, pago y última actualización */}
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
      {/* Botones de estado y reclamos */}
      {acciones && acciones.length > 0 && (
        <div className="suborden-acciones">{acciones}</div>
      )}
      {children}
    </article>
  );
}
