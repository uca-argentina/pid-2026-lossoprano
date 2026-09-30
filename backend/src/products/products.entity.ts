import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';
import { Negocio } from '../business/business.entity';

@Entity('producto')
export class Producto {
  @PrimaryGeneratedColumn({ name: 'id_producto' })
  idProducto: number;

  @VersionColumn()
  version: number;

  @ManyToOne(() => Negocio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_negocio' })
  negocio: Negocio;

  @Column({ name: 'id_negocio' })
  idNegocio: number;

  @Column({ length: 150 })
  nombre: string;

  @Column('text')
  descripcion: string;

  @Column({ length: 100 })
  categoria: string;

  @Column({ name: 'precio_base', type: 'decimal', precision: 12, scale: 2 })
  precioBase: string;

  @Column('int')
  stock: number;

  @Column({ name: 'cantidad_minima_compra', type: 'int', nullable: true })
  cantidadMinimaCompra: number | null;

  @Column('text', { array: true })
  imagenes: string[];
}
