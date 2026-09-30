import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Negocio } from '../business/business.entity';

// Sin negocio es una categoría general, visible para todos los vendedores.
@Entity('categoria')
@Index(['idNegocio', 'clave'], { unique: true })
export class Categoria {
  @PrimaryGeneratedColumn({ name: 'id_categoria' })
  idCategoria: number;

  @Column({ length: 100 })
  nombre: string;

  // Nombre normalizado (minúsculas y sin acentos) para detectar duplicados.
  @Column({ length: 100, select: false })
  clave: string;

  @ManyToOne(() => Negocio, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'id_negocio' })
  negocio: Negocio | null;

  @Column({ name: 'id_negocio', type: 'int', nullable: true })
  idNegocio: number | null;
}

export function claveCategoria(nombre: string) {
  return nombre.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

export const CATEGORIAS_GENERALES = [
  'Alimentos', 'Bebidas', 'Perfumería', 'Cosmética', 'Higiene personal', 'Limpieza', 'Indumentaria', 'Calzado',
  'Accesorios', 'Hogar y decoración', 'Librería y papelería', 'Electrónica', 'Ferretería', 'Juguetes', 'Mascotas',
];
