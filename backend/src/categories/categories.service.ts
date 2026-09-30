import { BadRequestException, ConflictException, Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { Producto } from '../products/products.entity';
import { Categoria, CATEGORIAS_GENERALES, claveCategoria } from './category.entity';

@Injectable()
export class CategoriasService implements OnApplicationBootstrap {
  constructor(@InjectRepository(Categoria) private readonly categorias: Repository<Categoria>) {}

  async onApplicationBootstrap() {
    await this.crearGenerales();
  }

  async crearGenerales() {
    const existentes = await this.categorias.find({ where: { idNegocio: IsNull() }, select: { idCategoria: true, clave: true } });
    const faltantes = CATEGORIAS_GENERALES.filter(nombre => !existentes.some(categoria => categoria.clave === claveCategoria(nombre)));
    if (faltantes.length) await this.categorias.insert(faltantes.map(nombre => ({ nombre, clave: claveCategoria(nombre), idNegocio: null })));
  }

  // Generales y propias del negocio, con la cantidad de productos del negocio en cada una.
  async listarDisponibles(idNegocio: number) {
    const filas = await this.categorias.createQueryBuilder('categoria')
      .leftJoin(Producto, 'producto', 'producto.idCategoria = categoria.idCategoria AND producto.idNegocio = :idNegocio', { idNegocio })
      .select('categoria.idCategoria', 'idCategoria')
      .addSelect('categoria.nombre', 'nombre')
      .addSelect('categoria.idNegocio IS NULL', 'general')
      .addSelect('COUNT(producto.idProducto)', 'cantidadProductos')
      .where('categoria.idNegocio IS NULL OR categoria.idNegocio = :idNegocio', { idNegocio })
      .groupBy('categoria.idCategoria')
      .orderBy('categoria.nombre', 'ASC')
      .getRawMany<{ idCategoria: number; nombre: string; general: boolean; cantidadProductos: string }>();
    return filas.map(fila => ({ ...fila, cantidadProductos: Number(fila.cantidadProductos) }));
  }

  async crear(idNegocio: number, nombre: string) {
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    const clave = claveCategoria(limpio);
    if (!clave) throw new BadRequestException('Escribí el nombre de la categoría.');
    const repetida = await this.categorias.createQueryBuilder('categoria')
      .where('categoria.clave = :clave', { clave })
      .andWhere('(categoria.idNegocio IS NULL OR categoria.idNegocio = :idNegocio)', { idNegocio })
      .getExists();
    if (repetida) throw new ConflictException(`Ya existe una categoría llamada ${limpio}.`);
    const { idCategoria } = await this.categorias.save(this.categorias.create({ nombre: limpio, clave, idNegocio }));
    return { idCategoria, nombre: limpio, general: false, cantidadProductos: 0 };
  }

  async eliminar(idCategoria: number, idNegocio: number) {
    return this.categorias.manager.transaction(async manager => {
      const categoria = await manager.getRepository(Categoria).findOne({ where: { idCategoria }, lock: { mode: 'pessimistic_write' } });
      if (!categoria || (categoria.idNegocio !== null && categoria.idNegocio !== idNegocio)) throw new NotFoundException('Categoría no encontrada.');
      if (categoria.idNegocio === null) throw new BadRequestException('Las categorías generales no se pueden eliminar.');
      const productos = await manager.getRepository(Producto).countBy({ idCategoria });
      if (productos) {
        throw new ConflictException(`No se puede eliminar ${categoria.nombre}: tiene ${productos} ${productos === 1 ? 'producto asociado' : 'productos asociados'}.`);
      }
      await manager.getRepository(Categoria).delete({ idCategoria });
      return { mensaje: 'Categoría eliminada correctamente.' };
    });
  }
}

// Verifica que el negocio pueda usar la categoría y la bloquea para que no se elimine mientras tanto.
export async function validarCategoria(manager: EntityManager, idCategoria: number, idNegocio: number) {
  const categoria = await manager.getRepository(Categoria).findOne({ where: { idCategoria }, lock: { mode: 'pessimistic_read' } });
  if (!categoria || (categoria.idNegocio !== null && categoria.idNegocio !== idNegocio)) {
    throw new BadRequestException('Elegí una categoría válida.');
  }
  return categoria;
}
