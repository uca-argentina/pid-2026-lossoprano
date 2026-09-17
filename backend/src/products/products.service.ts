import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuscarProductosDto } from './dto/buscar-productos.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { Producto } from './products.entity';

@Injectable()
export class ProductosService {
  constructor(@InjectRepository(Producto) private readonly productos: Repository<Producto>) {}

  async crear(idNegocio: number, dto: CrearProductoDto, rutasImagenes: string[]) {
    const producto = this.productos.create({
      ...dto,
      precioBase: dto.precioBase.toFixed(2),
      idNegocio,
      imagenes: rutasImagenes,
    });
    return this.productos.save(producto);
  }

  async buscar(filtros: BuscarProductosDto) {
    const consulta = this.productos
      .createQueryBuilder('producto')
      .leftJoinAndSelect('producto.negocio', 'negocio')
      .orderBy('producto.idProducto', 'DESC')
      .take(filtros.limit ?? 24)
      .skip(filtros.offset ?? 0);

    if (filtros.q) {
      consulta.andWhere('(producto.nombre ILIKE :q OR producto.descripcion ILIKE :q)', { q: `%${filtros.q}%` });
    }
    if (filtros.categoria) {
      consulta.andWhere('producto.categoria ILIKE :categoria', { categoria: filtros.categoria });
    }
    if (filtros.idNegocio) {
      consulta.andWhere('producto.idNegocio = :idNegocio', { idNegocio: filtros.idNegocio });
    }

    return consulta.getMany();
  }

  async buscarDeNegocio(idNegocio: number) {
    return this.productos.find({ where: { idNegocio }, order: { idProducto: 'DESC' } });
  }

  async buscarUno(idProducto: number) {
    const producto = await this.productos.findOne({ where: { idProducto }, relations: { negocio: true } });
    if (!producto) throw new NotFoundException('Producto no encontrado.');
    return producto;
  }
}
