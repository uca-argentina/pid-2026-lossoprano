/**
 * Entidad del comercio que participa en el marketplace. Una cuenta está asociada a
 * un negocio.
 * El mínimo monetario pertenece al vendedor, no a cada producto; sus datos de contacto
 * se usan en perfil y checkout.
 */

import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Cliente } from '../users/user.entity';

@Entity('negocio')
// Tabla 'negocio' = el COMERCIO (vendedor o comprador). idNegocio es el que viaja en el token y se usa en casi todos los where.
export class Negocio {
  @PrimaryGeneratedColumn({ name: 'id_negocio' })
  idNegocio: number;

  @Column({
    // REGLA MAYORISTA: monto mínimo de compra a este vendedor (lo chequea orders.service.confirmar).
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
  // Días que tiene el comprador para reclamar después de la entrega (lo usa orders.service.crearReclamo).
  @Column({ name: 'dias_reclamo', default: 7 })
  diasReclamo: number;
  @OneToMany(() => Cliente, (cliente) => cliente.negocio)
  clientes: Cliente[];

  @Column({name: 'recargo_pedido_urgente', default: 0})
  recargoUrgente: number;
}
