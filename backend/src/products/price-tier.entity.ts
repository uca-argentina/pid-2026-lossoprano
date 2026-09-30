import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Producto } from './products.entity';

// Desde cantidadMinima unidades, el precio unitario pasa a ser precioUnitario.
@Entity('precio_escalonado')
@Index(['idProducto', 'cantidadMinima'], { unique: true })
export class PrecioEscalonado {
  @PrimaryGeneratedColumn({ name: 'id_precio_escalonado' })
  idPrecioEscalonado: number;

  @ManyToOne(() => Producto, producto => producto.preciosEscalonados, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;

  @Column({ name: 'id_producto' })
  idProducto: number;

  @Column({ name: 'cantidad_minima', type: 'int' })
  cantidadMinima: number;

  @Column({ name: 'precio_unitario', type: 'decimal', precision: 12, scale: 2 })
  precioUnitario: string;
}

// Devuelve el precio del tramo más alto alcanzado, o el precio base si no se alcanzó ninguno.
export function precioParaCantidad(precioBase: string, tramos: Pick<PrecioEscalonado, 'cantidadMinima' | 'precioUnitario'>[], cantidad: number) {
  let precio = precioBase;
  let mayor = 0;
  for (const tramo of tramos ?? []) {
    if (tramo.cantidadMinima <= cantidad && tramo.cantidadMinima > mayor) {
      precio = tramo.precioUnitario;
      mayor = tramo.cantidadMinima;
    }
  }
  return precio;
}
