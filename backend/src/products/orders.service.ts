import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Cliente } from '../users/user.entity';
import { Negocio } from '../business/business.entity';
import { CarritoItem } from './cart-item.entity';
import { Producto } from './products.entity';
import { PrecioEscalonado, precioParaCantidad } from './price-tier.entity';
import { LineaPedido, Pedido } from './order.entity';
import { ConfirmarPedidoDto } from './dto/confirmar-pedido.dto';

const centavos = (valor: string) => BigInt(valor.replace('.', ''));
const importe = (valor: bigint) => `${valor / 100n}.${(valor % 100n).toString().padStart(2, '0')}`;

@Injectable()
export class PedidosService {
  constructor(private readonly db: DataSource) {}

  confirmar(idCliente: number, dto: ConfirmarPedidoDto) {
    return this.db.transaction(async manager => {
      const cliente = await manager.getRepository(Cliente).findOne({ where: { idCliente }, lock: { mode: 'pessimistic_write' } });
      if (!cliente) throw new UnauthorizedException('La cuenta ya no existe.');
      const pedidos = manager.getRepository(Pedido);
      const anterior = await pedidos.findOneBy({ idCliente, claveConfirmacion: dto.claveConfirmacion });
      if (anterior) return anterior;
      const carrito = manager.getRepository(CarritoItem);
      const filas = await carrito.find({ where: { idCliente }, order: { idProducto: 'ASC' } });
      if (!filas.length || filas.length !== dto.items.length || filas.some(fila => !dto.items.some(item =>
        item.idProducto === fila.idProducto && item.version === fila.version && item.cantidad === fila.cantidad))) {
        throw new ConflictException('El carrito cambió. Revisalo antes de confirmar.');
      }
      const items: LineaPedido[] = [];
      let vendedor: number | undefined;
      let total = 0n;
      for (const fila of filas) {
        const producto = await manager.getRepository(Producto).findOne({ where: { idProducto: fila.idProducto }, loadEagerRelations: false, lock: { mode: 'pessimistic_write' } });
        if (!producto || producto.version !== fila.version) throw new ConflictException('Un producto cambió. Revisá el carrito.');
        if (producto.idNegocio === cliente.idNegocio || (vendedor !== undefined && vendedor !== producto.idNegocio)) throw new ConflictException('El vendedor del carrito no es válido.');
        vendedor = producto.idNegocio;
        if (fila.cantidad < (producto.cantidadMinimaCompra ?? 1) || fila.cantidad > producto.stock) throw new ConflictException(`No hay stock suficiente o no se cumple el mínimo de ${producto.nombre}.`);
        const tramos = await manager.getRepository(PrecioEscalonado).findBy({ idProducto: producto.idProducto });
        const precioUnitario = precioParaCantidad(producto.precioBase, tramos, fila.cantidad);
        const subtotal = centavos(precioUnitario) * BigInt(fila.cantidad);
        total += subtotal;
        items.push({ idProducto: producto.idProducto, nombre: producto.nombre, cantidad: fila.cantidad, precioUnitario, subtotal: importe(subtotal) });
      }
      const negocio = await manager.getRepository(Negocio).findOne({ where: { idNegocio: vendedor! }, lock: { mode: 'pessimistic_read' } });
      if (!negocio || total < centavos(negocio.montoMinimoOrden)) throw new ConflictException('No se alcanza el monto mínimo del vendedor.');
      if (importe(total) !== dto.total) throw new ConflictException('El importe cambió. Revisá el carrito antes de confirmar.');
      for (const item of items) {
        // El movimiento de inventario no es una edición comercial: conserva la versión del carrito.
        await manager.query('UPDATE producto SET stock = stock - $1 WHERE id_producto = $2', [item.cantidad, item.idProducto]);
      }
      const pedido = await pedidos.save(pedidos.create({ idCliente, idNegocioComprador: cliente.idNegocio, idNegocioVendedor: vendedor!,
        direccionEntrega: dto.direccionEntrega, condicionPago: dto.condicionPago, claveConfirmacion: dto.claveConfirmacion, items, total: importe(total) }));
      await carrito.delete({ idCliente });
      return pedido;
    });
  }
}
