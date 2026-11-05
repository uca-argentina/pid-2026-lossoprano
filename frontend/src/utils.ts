/**
 * Funciones y etiquetas compartidas de presentación: estados, acciones por rol,
 * moneda y precios por cantidad.
 * Las tablas de acciones deben acompañar las reglas de transición del backend. Ocultar
 * un botón no reemplaza la autorización del servidor.
 */

import type {
  CondicionPago,
  EstadoPedido,
  EstadoReclamo,
  EstadoSuborden,
  Reclamo,
  Suborden,
} from './api';

export const CONDICIONES_PAGO: Record<CondicionPago, string> = {
  CONTADO: 'Contado',
  TRANSFERENCIA: 'Transferencia',
  CUENTA_CORRIENTE: 'Cuenta corriente',
};
export const ESTADOS_PEDIDO: Record<EstadoPedido, string> = {
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
};
export const ESTADOS_SUBORDEN: Record<EstadoSuborden, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  PREPARADA: 'Preparada',
  ENVIADA: 'Enviada',
  ENTREGADA: 'Entregada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
};
export const ESTADOS_RECLAMO: Record<EstadoReclamo, string> = {
  PENDIENTE: 'Reclamo pendiente',
  APROBADO: 'Aprobado · esperando devolución',
  RECIBIDO: 'Devolución recibida',
  RECHAZADO: 'Reclamo rechazado',
};
// Un reclamo abierto todavía requiere una acción del vendedor.
export const reclamoAbierto = (reclamo: Reclamo) =>
  reclamo.estado === 'PENDIENTE' || reclamo.estado === 'APROBADO';

/**
 * Unidades que el comprador todavía puede reclamar por producto. Copia la regla del
 * backend (los rechazados no consumen unidades) solo para limitar el formulario.
 */
export function cantidadesReclamables(suborden: Suborden) {
  const disponibles = new Map(suborden.items.map((i) => [i.idProducto, i.cantidad]));
  for (const reclamo of suborden.reclamos ?? []) {
    if (reclamo.estado === 'RECHAZADO') continue;
    for (const item of reclamo.items)
      disponibles.set(
        item.idProducto,
        (disponibles.get(item.idProducto) ?? 0) - item.cantidad,
      );
  }
  return disponibles;
}
export const subordenFinalizada = (estado: EstadoSuborden) =>
  estado === 'ENTREGADA' || estado === 'RECHAZADA' || estado === 'CANCELADA';
type Accion = { estado: EstadoSuborden; etiqueta: string };
// Cambios de estado que ofrece la interfaz a cada parte; la API vuelve a validarlos.
export const ACCIONES_VENDEDOR: Partial<Record<EstadoSuborden, Accion[]>> = {
  PENDIENTE: [
    { estado: 'CONFIRMADA', etiqueta: 'Confirmar' },
    { estado: 'RECHAZADA', etiqueta: 'Rechazar' },
  ],
  CONFIRMADA: [{ estado: 'PREPARADA', etiqueta: 'Marcar preparada' }],
  PREPARADA: [{ estado: 'ENVIADA', etiqueta: 'Marcar enviada' }],
  ENVIADA: [{ estado: 'ENTREGADA', etiqueta: 'Marcar entregada' }],
};
export const ACCIONES_COMPRADOR: Partial<Record<EstadoSuborden, Accion[]>> = {
  PENDIENTE: [{ estado: 'CANCELADA', etiqueta: 'Cancelar' }],
  CONFIRMADA: [{ estado: 'CANCELADA', etiqueta: 'Cancelar' }],
};

/**
 * Formatea importes para la interfaz. Actualmente usa USD/en-US; la pantalla Sorteos
 * utiliza su propio formato ARS. Es presentación, no cálculo contable.
 */
export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
type Tramo = { cantidadMinima: number; precioUnitario: string };

// Precio del tramo más alto alcanzado; si no alcanza ninguno, el precio base.
/**
 * Selecciona el mayor umbral alcanzado, independientemente del orden del arreglo de
 * tramos.
 */
export function precioParaCantidad(
  precioBase: string,
  tramos: Tramo[] = [],
  cantidad: number,
) {
  return tramos.reduce(
    (mejor, tramo) =>
      tramo.cantidadMinima <= cantidad && tramo.cantidadMinima > mejor.cantidadMinima
        ? tramo
        : mejor,
    { cantidadMinima: 0, precioUnitario: precioBase },
  ).precioUnitario;
}

/**
 * Busca el siguiente descuento alcanzable sin exceder stock, para sugerirlo en el
 * carrito.
 */
export function siguienteTramo(tramos: Tramo[] = [], cantidad: number, stock: number) {
  return [...tramos]
    .sort((a, b) => a.cantidadMinima - b.cantidadMinima)
    .find((tramo) => tramo.cantidadMinima > cantidad && tramo.cantidadMinima <= stock);
}
