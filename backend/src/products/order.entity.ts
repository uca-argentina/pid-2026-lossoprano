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

export enum CondicionPago {
  CONTADO = 'CONTADO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  CUENTA_CORRIENTE = 'CUENTA_CORRIENTE',
}

export enum EstadoSuborden {
  PENDIENTE = 'PENDIENTE',
  CONFIRMADA = 'CONFIRMADA',
  PREPARADA = 'PREPARADA',
  ENVIADA = 'ENVIADA',
  ENTREGADA = 'ENTREGADA',
  RECHAZADA = 'RECHAZADA',
  CANCELADA = 'CANCELADA',
}

export enum EstadoPedido {
  EN_CURSO = 'EN_CURSO',
  COMPLETADA = 'COMPLETADA',
}

// Rechazada y cancelada cierran la suborden sin entrega.
export const subordenFinalizada = (estado: EstadoSuborden) =>
  estado === EstadoSuborden.ENTREGADA ||
  estado === EstadoSuborden.RECHAZADA ||
  estado === EstadoSuborden.CANCELADA;

export function conEstadoPedido(pedido: Pedido): Pedido & { estado: EstadoPedido } {
  const completa =
    pedido.subordenes.length > 0 &&
    pedido.subordenes.every((suborden) => subordenFinalizada(suborden.estado));
  return {
    ...pedido,
    estado: completa ? EstadoPedido.COMPLETADA : EstadoPedido.EN_CURSO,
  };
}

// Cambios de estado que puede hacer cada parte. Los estados sin transiciones son finales.
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
  ENTREGADA: { vendedor: [], comprador: [] },
  RECHAZADA: { vendedor: [], comprador: [] },
  CANCELADA: { vendedor: [], comprador: [] },
};

export type LineaPedido = {
  idProducto: number;
  nombre: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
};

// Orden general de una compra: agrupa una suborden por vendedor.
@Entity('pedido')
@Index('pedido_confirmacion_idx', ['idCliente', 'claveConfirmacion'], { unique: true })
export class Pedido {
  @PrimaryGeneratedColumn({ name: 'id_pedido' })
  idPedido: number;
  @Column({ name: 'id_cliente' })
  idCliente: number;
  @Column({ name: 'id_negocio_comprador' })
  idNegocioComprador: number;
  @Column({ name: 'clave_confirmacion', type: 'uuid' })
  claveConfirmacion: string;
  @Column({ type: 'decimal', precision: 20, scale: 2 })
  total: string;
  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
  @OneToMany(() => Suborden, (suborden) => suborden.pedido)
  subordenes: Suborden[];
}

// Copias históricas: eliminar o editar un producto o un negocio no altera una compra confirmada.
@Entity('suborden')
@Index('suborden_vendedor_idx', ['idNegocioVendedor'])
@Index('suborden_comprador_idx', ['idNegocioComprador'])
export class Suborden {
  @PrimaryGeneratedColumn({ name: 'id_suborden' })
  idSuborden: number;
  @ManyToOne(() => Pedido, (pedido) => pedido.subordenes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_pedido' })
  pedido: Pedido;
  @Index('suborden_pedido_idx')
  @Column({ name: 'id_pedido' })
  idPedido: number;
  @Column({ name: 'id_negocio_vendedor' })
  idNegocioVendedor: number;
  @Column({ name: 'nombre_vendedor', length: 150 })
  nombreVendedor: string;
  @Column({ name: 'id_negocio_comprador' })
  idNegocioComprador: number;
  @Column({ name: 'nombre_comprador', length: 150 })
  nombreComprador: string;
  @Column({ name: 'direccion_entrega', length: 255 })
  direccionEntrega: string;
  @Column({ name: 'condicion_pago', type: 'varchar', length: 20 })
  condicionPago: CondicionPago;
  @Column({ type: 'varchar', length: 20, default: EstadoSuborden.PENDIENTE })
  estado: EstadoSuborden;
  @Column('jsonb')
  items: LineaPedido[];
  @Column({ type: 'decimal', precision: 20, scale: 2 })
  total: string;
  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
  @Column({ name: 'entregada_en', type: 'timestamptz', nullable: true })
  entregadaEn: Date | null;
  @OneToMany(() => Reclamo, (reclamo) => reclamo.suborden)
  reclamos: Reclamo[];
}
