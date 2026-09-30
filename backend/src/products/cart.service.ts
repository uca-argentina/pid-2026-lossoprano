import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Cliente } from '../users/user.entity';
import { CarritoItem } from './cart-item.entity';
import { Producto } from './products.entity';
import { GuardarCarritoDto } from './dto/guardar-carrito.dto';

@Injectable()
export class CarritoService {
  constructor(private readonly db: DataSource) {}

  private async leer(manager: EntityManager, idCliente: number) {
    const filas = await manager.getRepository(CarritoItem).find({
      where: { idCliente }, relations: { producto: { negocio: true } }, order: { idProducto: 'ASC' },
    });
    const vigentes = filas.filter(item => item.version === item.producto.version);
    if (!vigentes.length) return null;
    const negocio = vigentes[0].producto.negocio;
    const subtotalCentavos = vigentes.reduce((total, item) => total + Math.round(Number(item.producto.precioBase) * 100) * item.cantidad, 0);
    const minimoCentavos = Math.round(Number(negocio.montoMinimoOrden) * 100);
    const faltanteCentavos = Math.max(0, minimoCentavos - subtotalCentavos);
    return { idNegocio: negocio.idNegocio, nombreNegocio: negocio.nombreComercial,
      subtotal: (subtotalCentavos / 100).toFixed(2), montoMinimoOrden: negocio.montoMinimoOrden,
      faltanteMinimo: (faltanteCentavos / 100).toFixed(2),
      cumpleMinimos: faltanteCentavos === 0 && vigentes.every(item => item.cantidad >= (item.producto.cantidadMinimaCompra ?? 1) && item.cantidad <= item.producto.stock),
      items: vigentes.map(item => ({ idProducto: item.idProducto, version: item.version,
        cantidad: item.cantidad, nombre: item.producto.nombre, precioBase: item.producto.precioBase,
        stock: item.producto.stock, cantidadMinimaCompra: item.producto.cantidadMinimaCompra, imagen: item.producto.imagenes[0] })) };
  }

  obtener(idCliente: number) { return this.leer(this.db.manager, idCliente); }

  guardar(idCliente: number, dto: GuardarCarritoDto) {
    return this.db.transaction(async manager => {
      const cliente = await manager.getRepository(Cliente).findOne({ where: { idCliente }, lock: { mode: 'pessimistic_write' } });
      if (!cliente) throw new UnauthorizedException('La cuenta ya no existe.');
      const repo = manager.getRepository(CarritoItem);
      if (dto.importar && await repo.exists({ where: { idCliente } })) return this.leer(manager, idCliente);
      const nuevos: CarritoItem[] = [];
      let vendedor: number | undefined;
      for (const item of [...dto.items].sort((a, b) => a.idProducto - b.idProducto)) {
        const producto = await manager.getRepository(Producto).findOne({ where: { idProducto: item.idProducto }, lock: { mode: 'pessimistic_read' } });
        if (!producto || producto.version !== item.version || producto.stock === 0) continue;
        const minimo = producto.cantidadMinimaCompra ?? 1;
        if (producto.stock < minimo) continue;
        if (item.cantidad < minimo && !dto.importar) throw new BadRequestException(`La cantidad mínima para ${producto.nombre} es ${minimo} unidades.`);
        if (producto.idNegocio === cliente.idNegocio) throw new BadRequestException('No podés comprar productos de tu propio negocio.');
        if (vendedor !== undefined && vendedor !== producto.idNegocio) throw new BadRequestException('El carrito solo puede tener productos de un vendedor.');
        vendedor = producto.idNegocio;
        nuevos.push(repo.create({ idCliente, idProducto: producto.idProducto, version: producto.version, cantidad: Math.max(minimo, Math.min(item.cantidad, producto.stock)) }));
      }
      await repo.delete({ idCliente });
      if (nuevos.length) await repo.save(nuevos);
      return this.leer(manager, idCliente);
    });
  }
}
