/**
 * Registra entidades y proveedores del catálogo, carrito, imágenes y pedidos.
 * Aunque varios controladores viven en este módulo, cada servicio mantiene su
 * responsabilidad de negocio.
 */

// MÓDULO: junta las piezas de una parte del backend (entities, controllers, services).
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosController } from './products.controller';
import { Producto } from './products.entity';
import { ProductosService } from './products.service';
import { CarritoItem } from './cart-item.entity';
import { Reclamo } from './claim.entity';
import { CarritoService } from './cart.service';
import { CarritoController } from './cart.controller';
import { PrecioEscalonado } from './price-tier.entity';
import { Categoria } from '../categories/category.entity';
import { Pedido, Suborden } from './order.entity';
import { PedidosController } from './orders.controller';
import { PedidosService } from './orders.service';
import { ImagenesService } from './images.service';

// Si una entity, controller o service NO está acá, Nest no lo conoce.
@Module({
  imports: [
    // forFeature: lista de ENTITIES (tablas) que este módulo usa.
    // Si creás una tabla nueva, la agregás acá (y su import arriba). Si no: no se crea la tabla y getRepository tira 'No metadata'.
    TypeOrmModule.forFeature([
      Producto,
      CarritoItem,
      PrecioEscalonado,
      Categoria,
      Pedido,
      Suborden,
      Reclamo,
    ]),
  ],
  // controllers: los que reciben las rutas HTTP. Un controller nuevo va acá o da 404.
  controllers: [ProductosController, CarritoController, PedidosController],
  // providers: los services. Nest los crea y se los pasa a los controllers por el constructor.
  providers: [ProductosService, CarritoService, PedidosService, ImagenesService],
})
export class ProductosModule {}
