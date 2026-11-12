/**
 * Entidad de cuenta autenticable (cliente): email, hash de contraseña, rol y negocio
 * asociado.
 * El hash no se selecciona por defecto y la relación se elimina en cascada al borrar
 * el negocio.
 */

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Negocio } from '../business/business.entity';

// Roles posibles. Se usa en @Roles(RolCliente.VENDEDOR) y viaja en el token (rol).
export enum RolCliente {
  COMPRADOR = 'COMPRADOR',
  VENDEDOR = 'VENDEDOR',
}

// Tabla 'cliente' = el USUARIO que inicia sesión (email + contraseña). Pertenece a un negocio (idNegocio).
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
