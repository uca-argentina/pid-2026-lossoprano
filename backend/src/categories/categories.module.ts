import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from '../products/products.entity';
import { CategoriasController } from './categories.controller';
import { CategoriasService } from './categories.service';
import { Categoria } from './category.entity';

@Module({ imports: [TypeOrmModule.forFeature([Categoria, Producto])], controllers: [CategoriasController], providers: [CategoriasService] })
export class CategoriasModule {}
