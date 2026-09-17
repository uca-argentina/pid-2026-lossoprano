import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Cliente } from '../users/user.entity';

@Entity('negocio')
export class Negocio {
  @PrimaryGeneratedColumn({ name: 'id_negocio' })
  idNegocio: number;

  @Column({ name: 'razon_social', length: 150 })
  razonSocial: string;

  @Column({ name: 'nombre_comercial', length: 150 })
  nombreComercial: string;

  @Column({ name: 'identificacion_fiscal', length: 50, unique: true })
  identificacionFiscal: string;

  @Column({ name: 'telefono', length: 40 })
  telefono: string;

  @Column({ name: 'direccion', length: 255 })
  direccion: string;

  @OneToMany(() => Cliente, (cliente) => cliente.negocio)
  clientes: Cliente[];
}
