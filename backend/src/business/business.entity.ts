/**
 * Entidad del comercio que participa en el marketplace. Una cuenta está asociada a
 * un negocio.
 * El mínimo monetario pertenece al vendedor, no a cada producto; sus datos de contacto
 * se usan en perfil y checkout.
 */

import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Cliente } from '../users/user.entity';

@Entity('negocio')
export class Negocio {
  @PrimaryGeneratedColumn({ name: 'id_negocio' })
  idNegocio: number;

  @Column({
    name: 'monto_minimo_orden',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  montoMinimoOrden: string;

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

  @Column({ name: 'pagina_web', type: 'varchar', length: 200, nullable: true })
  paginaWeb: string | null;
  @Column({ name: 'dias_reclamo', default: 7 })
  diasReclamo: number;
  @OneToMany(() => Cliente, (cliente) => cliente.negocio)
  clientes: Cliente[];
}
