import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosController } from './products.controller';
import { Producto } from './products.entity';
import { ProductosService } from './products.service';

@Module({ imports: [TypeOrmModule.forFeature([Producto])], controllers: [ProductosController], providers: [ProductosService] })
export class ProductosModule {}
