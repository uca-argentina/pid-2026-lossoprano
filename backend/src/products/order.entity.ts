/**
 * Pedido general y subórdenes por vendedor, con copias históricas de nombres,
 * precios y entregas.
 * TRANSICIONES concentra los cambios permitidos a cada parte. Una orden general está
 * completa cuando todas sus partes están cerradas.
 * Rechazar o cancelar cuenta como cierre, pero no como una venta entregada.
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Reclamo } from './claim.entity';

// enum = lista cerrada de valores posibles. Se usa como CondicionPago.CONTADO, etc.
export enum CondicionPago {
  CONTADO = 'CONTADO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  CUENTA_CORRIENTE = 'CUENTA_CORRIENTE',
}

// ESTADOS DE UNA SUBORDEN (el ciclo del pedido):
// PENDIENTE → CONFIRMADA → PREPARADA → ENVIADA → ENTREGADA
// Desde PENDIENTE el vendedor puede RECHAZAR; en PENDIENTE o CONFIRMADA el comprador puede CANCELAR.
// En el código: EstadoSuborden.ENTREGADA (back) o 'ENTREGADA' (texto, en el front).
export enum EstadoSuborden {
  PENDIENTE = 'PENDIENTE',
  CONFIRMADA = 'CONFIRMADA',
  PREPARADA = 'PREPARADA',
  ENVIADA = 'ENVIADA',
  ENTREGADA = 'ENTREGADA',
  RECHAZADA = 'RECHAZADA',
  CANCELADA = 'CANCELADA',
}

// Estado del pedido GENERAL. No se guarda en la base: se calcula con conEstadoPedido (abajo).
export enum EstadoPedido {
  EN_CURSO = 'EN_CURSO',
  COMPLETADA = 'COMPLETADA',
}

// Rechazada y cancelada cierran la suborden sin entrega.
// ¿Terminó la suborden? true si está ENTREGADA, RECHAZADA o CANCELADA.
// || = 'o'. Recibe un estado y devuelve true/false.
export const subordenFinalizada = (estado: EstadoSuborden) =>
  estado === EstadoSuborden.ENTREGADA ||
  estado === EstadoSuborden.RECHAZADA ||
  estado === EstadoSuborden.CANCELADA;

// Calcula el estado del pedido general a partir de sus subórdenes.
export function conEstadoPedido(pedido: Pedido): Pedido & { estado: EstadoPedido } {
  // completa = tiene al menos una suborden Y (&&) TODAS (.every) están finalizadas.
  const completa =
    pedido.subordenes.length > 0 &&
    pedido.subordenes.every((suborden) => subordenFinalizada(suborden.estado));
  // ...pedido copia todas las propiedades del pedido y le agrega estado.
  // Ternario: condición ? valorSiTrue : valorSiFalse.
  return {
    ...pedido,
    estado: completa ? EstadoPedido.COMPLETADA : EstadoPedido.EN_CURSO,
  };
}

// Cambios de estado que puede hacer cada parte. Los estados sin transiciones son finales.
// TRANSICIONES: qué estado puede poner cada parte desde cada estado.
// Ej: desde PENDIENTE el vendedor puede CONFIRMADA o RECHAZADA, el comprador CANCELADA.
// orders.service.cambiarEstado lo consulta: si el estado pedido no está en la lista → error.
export const TRANSICIONES: Record<
  EstadoSuborden,
  { vendedor: EstadoSuborden[]; comprador: EstadoSuborden[] }
> = {
  PENDIENTE: {
    vendedor: [EstadoSuborden.CONFIRMADA, EstadoSuborden.RECHAZADA],
    comprador: [EstadoSuborden.CANCELADA],
  },
  CONFIRMADA: {
    vendedor: [EstadoSuborden.PREPARADA],
    comprador: [EstadoSuborden.CANCELADA],
  },
  PREPARADA: { vendedor: [EstadoSuborden.ENVIADA], comprador: [] },
  ENVIADA: { vendedor: [EstadoSuborden.ENTREGADA], comprador: [] },
  // Listas vacías = estado final, nadie lo puede cambiar.
  ENTREGADA: { vendedor: [], comprador: [] },
  RECHAZADA: { vendedor: [], comprador: [] },
  CANCELADA: { vendedor: [], comprador: [] },
};

// type = solo describe una forma (no es tabla). Cada producto comprado dentro de una suborden.
// precioUnitario y subtotal son string porque vienen de columnas decimal.
export type LineaPedido = {
  idProducto: number;
  nombre: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
};

// Orden general de una compra: agrupa una suborden por vendedor.
// ENTITY = TABLA. @Entity('pedido') → la tabla se llama 'pedido'.
// Pedido = la compra completa (puede tener varios vendedores → varias subórdenes).
@Entity('pedido')
// Índice único: evita confirmar dos veces el mismo pedido (doble click).
@Index('pedido_confirmacion_idx', ['idCliente', 'claveConfirmacion'], { unique: true })
export class Pedido {
  // Id automático. name = nombre de la columna en la base; abajo, el nombre en el código (idPedido).
  @PrimaryGeneratedColumn({ name: 'id_pedido' })
  idPedido: number;
  // @Column = columna normal. Arriba el nombre en la base, abajo la propiedad que usás en TypeScript.
  @Column({ name: 'id_cliente' })
  idCliente: number;
  @Column({ name: 'id_negocio_comprador' })
  idNegocioComprador: number;
  @Column({ name: 'clave_confirmacion', type: 'uuid' })
  claveConfirmacion: string;
  // decimal con 2 decimales → TypeORM lo devuelve como STRING. Para hacer cuentas: Number(total).
  @Column({ type: 'decimal', precision: 20, scale: 2 })
  total: string;
  // Fecha de creación: la pone la base sola al hacer save.
  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
  // Relación: un pedido tiene MUCHAS subórdenes. No es columna; sirve para traerlas con relations: ['subordenes'].
  @OneToMany(() => Suborden, (suborden) => suborden.pedido)
  subordenes: Suborden[];
}

// Copias históricas: eliminar o editar un producto o un negocio no altera una compra confirmada.
// SUBORDEN = la parte de un pedido que corresponde a UN vendedor. Es la que cambia de estado y la que se reclama.
@Entity('suborden')
@Index('suborden_vendedor_idx', ['idNegocioVendedor'])
@Index('suborden_comprador_idx', ['idNegocioComprador'])
export class Suborden {
  @PrimaryGeneratedColumn({ name: 'id_suborden' })
  idSuborden: number;
  // Relación inversa: muchas subórdenes pertenecen a UN pedido. @JoinColumn dice qué columna los une (id_pedido).
  @ManyToOne(() => Pedido, (pedido) => pedido.subordenes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_pedido' })
  pedido: Pedido;
  @Index('suborden_pedido_idx')
  @Column({ name: 'id_pedido' })
  idPedido: number;
  // Quién VENDE esta parte. Se usa para chequear que el vendedor logueado sea el dueño.
  @Column({ name: 'id_negocio_vendedor' })
  idNegocioVendedor: number;
  @Column({ name: 'nombre_vendedor', length: 150 })
  nombreVendedor: string;
  // Quién COMPRA. Se usa para chequear que el comprador logueado sea el dueño (ej: crearReclamo).
  @Column({ name: 'id_negocio_comprador' })
  idNegocioComprador: number;
  @Column({ name: 'nombre_comprador', length: 150 })
  nombreComprador: string;
  @Column({ name: 'direccion_entrega', length: 255 })
  direccionEntrega: string;
  @Column({ name: 'condicion_pago', type: 'varchar', length: 20 })
  condicionPago: CondicionPago;
  // Estado actual. default: arranca en PENDIENTE al crearse.
  @Column({ type: 'varchar', length: 20, default: EstadoSuborden.PENDIENTE })
  estado: EstadoSuborden;
  // jsonb: guarda la lista de productos comprados (LineaPedido[]) como JSON en una sola columna.
  @Column('jsonb')
  items: LineaPedido[];
  @Column({ type: 'decimal', precision: 20, scale: 2 })
  total: string;
  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
  // Se actualiza sola cada vez que se hace save sobre esta fila.
  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
  // Cuándo se entregó. nullable: true → puede ser null (todavía no entregada). Por eso el tipo es Date | null.
  @Column({ name: 'entregada_en', type: 'timestamptz', nullable: true })
  entregadaEn: Date | null;
  // Una suborden puede tener muchos reclamos.
  @OneToMany(() => Reclamo, (reclamo) => reclamo.suborden)
  reclamos: Reclamo[];
}
