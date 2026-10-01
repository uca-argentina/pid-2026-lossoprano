import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum CondicionPago {
  CONTADO = 'CONTADO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  CUENTA_CORRIENTE = 'CUENTA_CORRIENTE',
}

export type LineaPedido = { idProducto: number; nombre: string; cantidad: number; precioUnitario: string; subtotal: string };

// Copias históricas: eliminar o editar un producto no altera una compra confirmada.
@Entity('pedido')
@Index('pedido_confirmacion_idx', ['idCliente', 'claveConfirmacion'], { unique: true })
export class Pedido {
  @PrimaryGeneratedColumn({ name: 'id_pedido' }) idPedido: number;
  @Column({ name: 'id_cliente' }) idCliente: number;
  @Column({ name: 'id_negocio_comprador' }) idNegocioComprador: number;
  @Column({ name: 'id_negocio_vendedor' }) idNegocioVendedor: number;
  @Column({ name: 'clave_confirmacion', type: 'uuid' }) claveConfirmacion: string;
  @Column({ name: 'direccion_entrega', length: 255 }) direccionEntrega: string;
  @Column({ name: 'condicion_pago', type: 'varchar', length: 20 }) condicionPago: CondicionPago;
  @Column({ length: 20, default: 'CONFIRMADO' }) estado: string;
  @Column('jsonb') items: LineaPedido[];
  @Column({ type: 'decimal', precision: 20, scale: 2 }) total: string;
  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' }) creadoEn: Date;
}
