/**
 * Reclamo de un comprador sobre una suborden entregada.
 * Guarda una copia de los productos reclamados con el precio pagado: la nota de crédito
 * simulada se calcula con esos importes y no con el precio actual del catálogo.
 * La suborden no cambia de estado: sigue ENTREGADA aunque el reclamo se apruebe.
 *
 * Estados: PENDIENTE → APROBADO → RECIBIDO (vuelve el stock)
 *          PENDIENTE → RECHAZADO (con motivo obligatorio, sin cambios en montos ni stock)
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { LineaPedido, Suborden } from './order.entity';

// Estados posibles de un reclamo.
export enum EstadoReclamo {
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  RECIBIDO = 'RECIBIDO',
  RECHAZADO = 'RECHAZADO',
}

// Tabla 'reclamo'. Molde para cualquier TABLA NUEVA: @Entity + @PrimaryGeneratedColumn + @Column + @CreateDateColumn,
// y después registrarla en forFeature de products.module.ts.
@Entity('reclamo')
@Index('reclamo_vendedor_idx', ['idNegocioVendedor'])
@Index('reclamo_comprador_idx', ['idNegocioComprador'])
export class Reclamo {
  // Id automático: en el save no lo mandás, lo pone la base.
  @PrimaryGeneratedColumn({ name: 'id_reclamo' })
  idReclamo: number;

  // Se referencia por nombre para no importar order.entity (que importa este archivo).
  // Relación: muchos reclamos → una suborden.
  @ManyToOne('Suborden', 'reclamos', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_suborden' })
  suborden: Suborden;

  @Index('reclamo_suborden_idx')
  // El id de la suborden reclamada, como número. Con esto hacés where: { idSuborden }.
  @Column({ name: 'id_suborden' })
  idSuborden: number;

  // Se copian de la suborden para comprobar rápido quién puede ver o resolver el reclamo.
  @Column({ name: 'id_negocio_comprador' })
  idNegocioComprador: number;

  @Column({ name: 'id_negocio_vendedor' })
  idNegocioVendedor: number;

  // Arranca PENDIENTE.
  @Column({ type: 'varchar', length: 20, default: EstadoReclamo.PENDIENTE })
  estado: EstadoReclamo;

  // Productos reclamados con el precio que se pagó en la compra.
  @Column('jsonb')
  items: LineaPedido[];

  // Texto obligatorio, máximo 500.
  @Column({ name: 'motivo', length: 500 })
  motivo: string;

  // Motivo obligatorio cuando el vendedor rechaza; el comprador lo ve en su historial.
  // nullable: true → puede quedar vacío (null). Molde para una columna OPCIONAL.
  @Column({ name: 'motivo_rechazo', type: 'varchar', length: 500, nullable: true })
  motivoRechazo: string | null;

  // Importe de la nota de crédito simulada: suma de cantidad × precio pagado.
  @Column({ type: 'decimal', precision: 20, scale: 2 })
  importe: string;

  // Número de la nota de crédito simulada; se genera al aprobar.
  @Column({ name: 'nota_credito', type: 'varchar', length: 30, nullable: true })
  notaCredito: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  // Cuándo el vendedor aprobó o rechazó.
  @Column({ name: 'resuelto_en', type: 'timestamptz', nullable: true })
  resueltoEn: Date | null;

  // Cuándo el vendedor confirmó que recibió los productos devueltos.
  @Column({ name: 'recibido_en', type: 'timestamptz', nullable: true })
  recibidoEn: Date | null;
}
