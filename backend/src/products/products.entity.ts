import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';
import { Negocio } from '../business/business.entity';
import { Categoria } from '../categories/category.entity';
import { PrecioEscalonado } from './price-tier.entity';

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

  // NO ACTION: una categoría con productos no se puede borrar.
  @ManyToOne(() => Categoria, { eager: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'id_categoria' })
  categoria: Categoria;

  @Column({ name: 'id_categoria' })
  idCategoria: number;

  @Column({ name: 'precio_base', type: 'decimal', precision: 12, scale: 2 })
  precioBase: string;

  @OneToMany(() => PrecioEscalonado, tramo => tramo.producto, { eager: true })
  preciosEscalonados: PrecioEscalonado[];

  @Column('int')
  stock: number;

  @Column({ name: 'cantidad_minima_compra', type: 'int', nullable: true })
  cantidadMinimaCompra: number | null;

  @Column('text', { array: true })
  imagenes: string[];
}
