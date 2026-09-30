import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BuscarProductosDto } from './dto/buscar-productos.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { Producto } from './products.entity';
import { ValidarCarritoDto } from './dto/validar-carrito.dto';

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

  async actualizar(idProducto: number, idNegocio: number, dto: CrearProductoDto, imagenes?: string[]) {
    const resultado = await this.productos.update({ idProducto, idNegocio }, {
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      categoria: dto.categoria,
      stock: dto.stock,
      precioBase: dto.precioBase.toFixed(2),
      ...(imagenes ? { imagenes } : {}),
    });
    if (!resultado.affected) throw new NotFoundException('Producto no encontrado.');
    return this.buscarUno(idProducto);
  }

  async eliminar(idProducto: number, idNegocio: number) {
    const resultado = await this.productos.delete({ idProducto, idNegocio });
    if (!resultado.affected) throw new NotFoundException('Producto no encontrado.');
    return { mensaje: 'Producto eliminado correctamente.' };
  }

  async validarCarrito(dto: ValidarCarritoDto) {
    if (!dto.items.length) return [];
    const productos = await this.productos.findBy({ idProducto: In(dto.items.map(item => item.idProducto)) });
    return productos.filter(producto => dto.items.some(item =>
      item.idProducto === producto.idProducto && item.version === producto.version,
    )).map(producto => producto.idProducto);
  }
}
