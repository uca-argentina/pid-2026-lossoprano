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

import { LineaPedido } from './order.entity';

export enum EstadoReclamo {
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
}

@Entity('reclamo')
export class Reclamo {
  @PrimaryGeneratedColumn({ name: 'id_reclamo' })
  idReclamo: number;



  @Column({ name: 'id_suborden' })
  idSuborden: number;

  @Column({ name: 'motivo', length: 500 })
  motivo: string;
  @Column({ name: 'id_negocio_comprador' })
  idNegocioComprador: number;
  @Column({ name: 'id_negocio_vendedor' })
  idNegocioVendedor: number;
  @Column({ type: 'varchar', length: 20, default: EstadoReclamo.PENDIENTE })
    estado: EstadoReclamo;
  @Column('jsonb')
  items: LineaPedido[];
  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}