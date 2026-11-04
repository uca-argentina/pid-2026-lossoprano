/**
 * Lógica del catálogo: búsqueda, alta, edición, reposición y baja con control de
 * propietario.
 * Una edición actualiza versión y retira el producto de todos los carritos. La
 * reposición suma stock sin invalidarlos.
 * Las operaciones compuestas usan transacciones para guardar producto y tramos juntos.
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { BuscarProductosDto } from './dto/buscar-productos.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { Producto } from './products.entity';
import { ValidarCarritoDto } from './dto/validar-carrito.dto';
import { CarritoItem } from './cart-item.entity';
import { PrecioEscalonado } from './price-tier.entity';
import { validarCategoria } from '../categories/categories.service';

// Los tramos deben superar la cantidad mínima de compra y bajar el precio a medida que sube la cantidad.
/**
 * Ordena una copia de los tramos y comprueba cantidades crecientes y precios
 * decrecientes desde el mínimo comercial. Devuelve precios normalizados a dos
 * decimales.
 */
export function validarPreciosEscalonados(dto: CrearProductoDto) {
  const tramos = [...(dto.preciosEscalonados ?? [])].sort(
    (a, b) => a.cantidadMinima - b.cantidadMinima,
  );
  const minimo = dto.cantidadMinimaCompra ?? 1;
  let anterior = { cantidadMinima: minimo, precioUnitario: dto.precioBase };
  for (const tramo of tramos) {
    if (tramo.cantidadMinima <= minimo) {
      throw new BadRequestException(
        `Cada precio escalonado debe empezar en más de ${minimo} ${minimo === 1 ? 'unidad' : 'unidades'}.`,
      );
    }
    if (tramo.cantidadMinima === anterior.cantidadMinima)
      throw new BadRequestException('No repitas la cantidad de un precio escalonado.');
    if (tramo.precioUnitario >= anterior.precioUnitario) {
      throw new BadRequestException(
        'Cada precio escalonado debe ser menor que el precio base y que el del tramo anterior.',
      );
    }
    anterior = tramo;
  }
  return tramos.map((tramo) => ({
    cantidadMinima: tramo.cantidadMinima,
    precioUnitario: tramo.precioUnitario.toFixed(2),
  }));
}

/**
 * Ordena los tramos cargados para que consultas y formularios reciban el mismo orden
 * por cantidad.
 */
function ordenarTramos<T extends Pick<Producto, 'preciosEscalonados'>>(producto: T) {
  producto.preciosEscalonados?.sort((a, b) => a.cantidadMinima - b.cantidadMinima);
  return producto;
}

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto) private readonly productos: Repository<Producto>,
  ) {}

  /**
   * Valida categoría y tramos y guarda ambos junto al producto. El ID del propietario
   * proviene del JWT, no del formulario.
   */
  async crear(idNegocio: number, dto: CrearProductoDto, rutasImagenes: string[]) {
    const tramos = validarPreciosEscalonados(dto);
    return this.productos.manager.transaction(async (manager) => {
      await validarCategoria(manager, dto.idCategoria, idNegocio);
      const repo = manager.getRepository(Producto);
      const { idProducto } = await repo.save(
        repo.create({
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          idCategoria: dto.idCategoria,
          stock: dto.stock,
          cantidadMinimaCompra: dto.cantidadMinimaCompra,
          precioBase: dto.precioBase.toFixed(2),
          idNegocio,
          imagenes: rutasImagenes,
        }),
      );
      await this.guardarTramos(manager, idProducto, tramos);
      return ordenarTramos(await repo.findOneOrFail({ where: { idProducto } }));
    });
  }

  /**
   * Reemplaza todos los tramos del producto dentro de la transacción del llamador.
   */
  private async guardarTramos(
    manager: EntityManager,
    idProducto: number,
    tramos: ReturnType<typeof validarPreciosEscalonados>,
  ) {
    const repo = manager.getRepository(PrecioEscalonado);
    await repo.delete({ idProducto });
    if (tramos.length)
      await repo.insert(tramos.map((tramo) => ({ ...tramo, idProducto })));
  }

  /**
   * Arma una consulta paginada con filtros opcionales y excluye el negocio actual. Los
   * parámetros evitan concatenar valores del usuario como SQL.
   */
  async buscar(filtros: BuscarProductosDto, idNegocioActual: number) {
    const consulta = this.productos
      .createQueryBuilder('producto')
      .leftJoinAndSelect('producto.negocio', 'negocio')
      .leftJoinAndSelect('producto.categoria', 'categoria')
      .leftJoinAndSelect('producto.preciosEscalonados', 'tramo')
      .where('producto.idNegocio <> :idNegocioActual', { idNegocioActual })
      .orderBy('producto.idProducto', 'DESC')
      .addOrderBy('tramo.cantidadMinima', 'ASC')
      .take(filtros.limit ?? 24)
      .skip(filtros.offset ?? 0);

    if (filtros.q) {
      consulta.andWhere('(producto.nombre ILIKE :q OR producto.descripcion ILIKE :q)', {
        q: `%${filtros.q}%`,
      });
    }
    if (filtros.categoria) {
      consulta.andWhere('categoria.nombre ILIKE :categoria', {
        categoria: filtros.categoria,
      });
    }
    if (filtros.idNegocio) {
      consulta.andWhere('producto.idNegocio = :idNegocio', {
        idNegocio: filtros.idNegocio,
      });
    }

    return consulta.getMany();
  }

  /**
   * Recupera el catálogo propio para la pantalla de gestión del vendedor.
   */
  async buscarDeNegocio(idNegocio: number) {
    const productos = await this.productos.find({
      where: { idNegocio },
      order: { idProducto: 'DESC' },
    });
    return productos.map(ordenarTramos);
  }

  // Nombres de las categorías que tienen productos, para el filtro de Explorar.
  async listarCategorias(): Promise<string[]> {
    const filas = await this.productos
      .createQueryBuilder('producto')
      .innerJoin('producto.categoria', 'categoria')
      .select('categoria.nombre', 'categoria')
      .distinct(true)
      .orderBy('categoria', 'ASC')
      .getRawMany<{ categoria: string }>();
    return filas.map((fila) => fila.categoria);
  }

  /**
   * Devuelve negocios que tienen productos de otros vendedores para alimentar el filtro
   * del catálogo.
   */
  async listarVendedores(idNegocioActual: number) {
    return this.productos
      .createQueryBuilder('producto')
      .innerJoin('producto.negocio', 'negocio')
      .select('negocio.idNegocio', 'idNegocio')
      .addSelect('negocio.nombreComercial', 'nombreComercial')
      .distinct(true)
      .where('producto.idNegocio <> :idNegocioActual', { idNegocioActual })
      .orderBy('negocio.nombreComercial', 'ASC')
      .getRawMany<{ idNegocio: number; nombreComercial: string }>();
  }

  /**
   * Carga el producto con información de su negocio y responde 404 si ya no existe.
   */
  async buscarUno(idProducto: number) {
    const producto = await this.productos.findOne({
      where: { idProducto },
      relations: { negocio: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado.');
    return ordenarTramos(producto);
  }

  /**
   * Actualiza solo un producto del dueño autenticado, guarda sus tramos y retira
   * referencias obsoletas de carritos. Sin fotos nuevas conserva las rutas anteriores.
   */
  async actualizar(
    idProducto: number,
    idNegocio: number,
    dto: CrearProductoDto,
    imagenes?: string[],
  ) {
    const tramos = validarPreciosEscalonados(dto);
    return this.productos.manager.transaction(async (manager) => {
      await validarCategoria(manager, dto.idCategoria, idNegocio);
      const repo = manager.getRepository(Producto);
      const resultado = await repo.update(
        { idProducto, idNegocio },
        {
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          idCategoria: dto.idCategoria,
          stock: dto.stock,
          cantidadMinimaCompra: dto.cantidadMinimaCompra,
          precioBase: dto.precioBase.toFixed(2),
          ...(imagenes ? { imagenes } : {}),
        },
      );
      if (!resultado.affected) throw new NotFoundException('Producto no encontrado.');
      await this.guardarTramos(manager, idProducto, tramos);
      await manager.getRepository(CarritoItem).delete({ idProducto });
      return ordenarTramos(
        await repo.findOneOrFail({ where: { idProducto }, relations: { negocio: true } }),
      );
    });
  }

  /**
   * Suma unidades al stock bloqueado y controla el límite entero de PostgreSQL; no
   * cambia la versión comercial del producto.
   */
  async agregarStock(idProducto: number, idNegocio: number, cantidad: number) {
    return this.productos.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Producto);
      // Serializa la reposición con compras y otras reposiciones del mismo producto.
      const producto = await repo.findOne({
        where: { idProducto, idNegocio },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (!producto) throw new NotFoundException('Producto no encontrado.');
      if (producto.stock + cantidad > 2147483647) {
        throw new BadRequestException('El stock no puede superar 2147483647 unidades.');
      }
      // Una reposición conserva la versión comercial y los carritos existentes.
      await manager.query(
        'UPDATE producto SET stock = stock + $1 WHERE id_producto = $2 AND id_negocio = $3',
        [cantidad, idProducto, idNegocio],
      );
      return ordenarTramos(
        await repo.findOneOrFail({ where: { idProducto, idNegocio } }),
      );
    });
  }

  /**
   * Elimina por ID y propietario. Las referencias de carrito se borran por cascada; los
   * pedidos conservan sus copias históricas.
   */
  async eliminar(idProducto: number, idNegocio: number) {
    const resultado = await this.productos.delete({ idProducto, idNegocio });
    if (!resultado.affected) throw new NotFoundException('Producto no encontrado.');
    return { mensaje: 'Producto eliminado correctamente.' };
  }

  /**
   * Devuelve los IDs que siguen existiendo, no son propios y conservan la versión vista
   * por el comprador.
   */
  async validarCarrito(dto: ValidarCarritoDto, idNegocioComprador: number) {
    if (!dto.items.length) return [];
    const productos = await this.productos.findBy({
      idProducto: In(dto.items.map((item) => item.idProducto)),
    });
    return productos
      .filter(
        (producto) =>
          producto.idNegocio !== idNegocioComprador &&
          dto.items.some(
            (item) =>
              item.idProducto === producto.idProducto &&
              item.version === producto.version,
          ),
      )
      .map((producto) => producto.idProducto);
  }
}
