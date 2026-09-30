import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosController } from './products.controller';
import { Producto } from './products.entity';
import { ProductosService } from './products.service';
import { CarritoItem } from './cart-item.entity';
import { CarritoService } from './cart.service';
import { CarritoController } from './cart.controller';

@Module({ imports: [TypeOrmModule.forFeature([Producto, CarritoItem])], controllers: [ProductosController, CarritoController], providers: [ProductosService, CarritoService] })
export class ProductosModule {}
