import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Negocio } from '../business/business.entity';

export enum RolCliente {
  COMPRADOR = 'COMPRADOR',
  VENDEDOR = 'VENDEDOR',
}

@Entity('cliente')
export class Cliente {
  @PrimaryGeneratedColumn({ name: 'id_cliente' })
  idCliente: number;

  @ManyToOne(() => Negocio, (negocio) => negocio.clientes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_negocio' })
  negocio: Negocio;

  @Column({ name: 'id_negocio' })
  idNegocio: number;

  @Column({ length: 180, unique: true })
  email: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ name: 'rol', length: 20 })
  rol: RolCliente;
}
