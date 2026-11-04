/**
 * Registra entidades y proveedores del catálogo, carrito, imágenes y pedidos.
 * Aunque varios controladores viven en este módulo, cada servicio mantiene su
 * responsabilidad de negocio.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosController } from './products.controller';
import { Producto } from './products.entity';
import { ProductosService } from './products.service';
import { CarritoItem } from './cart-item.entity';
import { CarritoService } from './cart.service';
import { CarritoController } from './cart.controller';
import { PrecioEscalonado } from './price-tier.entity';
import { Categoria } from '../categories/category.entity';
import { Pedido, Suborden } from './order.entity';
import { PedidosController } from './orders.controller';
import { PedidosService } from './orders.service';
import { ImagenesService } from './images.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Producto,
      CarritoItem,
      PrecioEscalonado,
      Categoria,
      Pedido,
      Suborden,
    ]),
  ],
  controllers: [ProductosController, CarritoController, PedidosController],
  providers: [ProductosService, CarritoService, PedidosService, ImagenesService],
})
export class ProductosModule {}
