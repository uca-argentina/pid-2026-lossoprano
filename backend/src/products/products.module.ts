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
import { Pedido } from './order.entity';
import { PedidosController } from './orders.controller';
import { PedidosService } from './orders.service';

@Module({ imports: [TypeOrmModule.forFeature([Producto, CarritoItem, PrecioEscalonado, Categoria, Pedido])], controllers: [ProductosController, CarritoController, PedidosController], providers: [ProductosService, CarritoService, PedidosService] })
export class ProductosModule {}
