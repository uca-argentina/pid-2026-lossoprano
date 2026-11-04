/**
 * Carrito persistente por cuenta con validación de versión, stock y mínimos.
 * Al leer calcula precio por cantidad y subtotales por vendedor. Al guardar reemplaza
 * el conjunto de líneas en una transacción.
 * Guardar no reserva stock: la validación definitiva y el descuento ocurren durante el
 * checkout.
 */

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Cliente } from '../users/user.entity';
import { Negocio } from '../business/business.entity';
import { CarritoItem } from './cart-item.entity';
import { Producto } from './products.entity';
import { precioParaCantidad } from './price-tier.entity';
import { GuardarCarritoDto } from './dto/guardar-carrito.dto';

@Injectable()
export class CarritoService {
  constructor(private readonly db: DataSource) {}

  /**
   * Reconstruye el carrito desde productos vigentes. Descarta versiones antiguas y
   * calcula mínimos y precios por cada vendedor; devuelve null cuando no quedan líneas
   * válidas.
   */
  private async leer(manager: EntityManager, idCliente: number) {
    const filas = await manager.getRepository(CarritoItem).find({
      where: { idCliente },
      relations: { producto: { negocio: true, preciosEscalonados: true } },
      order: { idProducto: 'ASC' },
    });
    const vigentes = filas.filter((item) => item.version === item.producto.version);
    if (!vigentes.length) return null;
    const precios = vigentes.map((item) =>
      precioParaCantidad(
        item.producto.precioBase,
        item.producto.preciosEscalonados,
        item.cantidad,
      ),
    );
    // Cada vendedor del carrito tiene su propio subtotal y sus propios mínimos.
    const grupos = new Map<
      number,
      { negocio: Negocio; centavos: number; cantidadesValidas: boolean }
    >();
    vigentes.forEach((item, i) => {
      const negocio = item.producto.negocio;
      const grupo = grupos.get(negocio.idNegocio) ?? {
        negocio,
        centavos: 0,
        cantidadesValidas: true,
      };
      grupo.centavos += Math.round(Number(precios[i]) * 100) * item.cantidad;
      grupo.cantidadesValidas &&=
        item.cantidad >= (item.producto.cantidadMinimaCompra ?? 1) &&
        item.cantidad <= item.producto.stock;
      grupos.set(negocio.idNegocio, grupo);
    });
    const vendedores = [...grupos.values()]
      .sort((a, b) => a.negocio.idNegocio - b.negocio.idNegocio)
      .map(({ negocio, centavos, cantidadesValidas }) => {
        const faltanteCentavos = Math.max(
          0,
          Math.round(Number(negocio.montoMinimoOrden) * 100) - centavos,
        );
        return {
          idNegocio: negocio.idNegocio,
          nombreNegocio: negocio.nombreComercial,
          subtotal: (centavos / 100).toFixed(2),
          montoMinimoOrden: negocio.montoMinimoOrden,
          faltanteMinimo: (faltanteCentavos / 100).toFixed(2),
          cumpleMinimos: faltanteCentavos === 0 && cantidadesValidas,
        };
      });
    return {
      subtotal: (
        [...grupos.values()].reduce((total, grupo) => total + grupo.centavos, 0) / 100
      ).toFixed(2),
      cumpleMinimos: vendedores.every((vendedor) => vendedor.cumpleMinimos),
      vendedores,
      items: vigentes.map((item, i) => ({
        idProducto: item.idProducto,
        idNegocio: item.producto.idNegocio,
        version: item.version,
        cantidad: item.cantidad,
        nombre: item.producto.nombre,
        precioBase: item.producto.precioBase,
        precioUnitario: precios[i],
        preciosEscalonados: item.producto.preciosEscalonados
          .map(({ cantidadMinima, precioUnitario }) => ({
            cantidadMinima,
            precioUnitario,
          }))
          .sort((a, b) => a.cantidadMinima - b.cantidadMinima),
        stock: item.producto.stock,
        cantidadMinimaCompra: item.producto.cantidadMinimaCompra,
        imagen: item.producto.imagenes[0],
      })),
    };
  }

  /**
   * Lee usando el administrador normal de la conexión. Las lecturas dentro de un
   * guardado usan el administrador de esa transacción.
   */
  obtener(idCliente: number) {
    return this.leer(this.db.manager, idCliente);
  }

  /**
   * Serializa operaciones de la misma cuenta, filtra versiones vencidas y reemplaza sus
   * líneas. La importación del carrito antiguo solo se acepta si el servidor aún no
   * tiene uno.
   */
  guardar(idCliente: number, dto: GuardarCarritoDto) {
    return this.db.transaction(async (manager) => {
      const cliente = await manager
        .getRepository(Cliente)
        .findOne({ where: { idCliente }, lock: { mode: 'pessimistic_write' } });
      if (!cliente) throw new UnauthorizedException('La cuenta ya no existe.');
      const repo = manager.getRepository(CarritoItem);
      if (dto.importar && (await repo.exists({ where: { idCliente } })))
        return this.leer(manager, idCliente);
      const nuevos: CarritoItem[] = [];
      for (const item of [...dto.items].sort((a, b) => a.idProducto - b.idProducto)) {
        const producto = await manager.getRepository(Producto).findOne({
          where: { idProducto: item.idProducto },
          lock: { mode: 'pessimistic_read' },
          loadEagerRelations: false,
        });
        if (!producto || producto.version !== item.version || producto.stock === 0)
          continue;
        const minimo = producto.cantidadMinimaCompra ?? 1;
        if (producto.stock < minimo) continue;
        if (item.cantidad < minimo && !dto.importar)
          throw new BadRequestException(
            `La cantidad mínima para ${producto.nombre} es ${minimo} unidades.`,
          );
        if (producto.idNegocio === cliente.idNegocio)
          throw new BadRequestException(
            'No podés comprar productos de tu propio negocio.',
          );
        nuevos.push(
          repo.create({
            idCliente,
            idProducto: producto.idProducto,
            version: producto.version,
            cantidad: Math.max(minimo, Math.min(item.cantidad, producto.stock)),
          }),
        );
      }
      await repo.delete({ idCliente });
      if (nuevos.length) await repo.save(nuevos);
      return this.leer(manager, idCliente);
    });
  }
}
