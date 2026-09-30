import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Cliente } from '../users/user.entity';
import { Producto } from './products.entity';

@Entity('carrito_item')
@Check('"cantidad" > 0')
export class CarritoItem {
  @PrimaryColumn({ name: 'id_cliente' }) idCliente: number;
  @Index() @PrimaryColumn({ name: 'id_producto' }) idProducto: number;
  @ManyToOne(() => Cliente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cliente' }) cliente: Cliente;
  @ManyToOne(() => Producto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_producto' }) producto: Producto;
  @Column('int') cantidad: number;
  @Column('int') version: number;
}
