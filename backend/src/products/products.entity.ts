/**
 * Producto comercial del catálogo: propietario, categoría, precios, mínimos, stock y
 * rutas de fotos.
 * La versión identifica cambios comerciales y permite detectar carritos obsoletos.
 * Reponer o descontar stock conserva esa versión.
 */

import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  VersionColumn,
} from 'typeorm';
import { Negocio } from '../business/business.entity';
import { Categoria } from '../categories/category.entity';
import { PrecioEscalonado } from './price-tier.entity';

// Tabla 'producto'. Cada fila es un producto que vende UN negocio.
@Entity('producto')
export class Producto {
  @PrimaryGeneratedColumn({ name: 'id_producto' })
  idProducto: number;

  // Número de versión: sube solo cada vez que se edita el producto. Sirve para detectar carritos con precios viejos.
  @VersionColumn({ default: 1 })
  version: number;

  // Muchos productos → un negocio (el vendedor dueño).
  @ManyToOne(() => Negocio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_negocio' })
  negocio: Negocio;

  // El dueño del producto. Para 'mis productos': where: { idNegocio }.
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

  // decimal → llega como STRING ('1500.00'). Para cuentas usá Number(producto.precioBase); para guardar, String(numero).
  @Column({ name: 'precio_base', type: 'decimal', precision: 12, scale: 2 })
  precioBase: string;

  // Precios por cantidad (regla mayorista: más unidades → precio más bajo). eager: true → se traen solos con el producto.
  @OneToMany(() => PrecioEscalonado, (tramo) => tramo.producto, { eager: true })
  preciosEscalonados: PrecioEscalonado[];

  // Stock disponible (entero).
  @Column('int')
  stock: number;

  // Mínimo de unidades por compra (regla mayorista). nullable → puede no tener mínimo (null).
  @Column({ name: 'cantidad_minima_compra', type: 'int', nullable: true })
  cantidadMinimaCompra: number | null;

  // Lista de rutas de las fotos.
  @Column('text', { array: true })
  imagenes: string[];
}
