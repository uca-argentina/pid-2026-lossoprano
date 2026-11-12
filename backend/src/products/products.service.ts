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
// REGLA MAYORISTA: valida los precios escalonados que carga el vendedor.
// Cada tramo tiene que empezar en más unidades que el mínimo de compra y tener precio más bajo que el anterior.
export function validarPreciosEscalonados(dto: CrearProductoDto) {
  // [...lista] hace una copia; ?? [] usa lista vacía si no vino nada; sort ordena por cantidad (menor a mayor).
  const tramos = [...(dto.preciosEscalonados ?? [])].sort(
    (a, b) => a.cantidadMinima - b.cantidadMinima,
  );
  const minimo = dto.cantidadMinimaCompra ?? 1;
  let anterior = { cantidadMinima: minimo, precioUnitario: dto.precioBase };
  // Recorre cada tramo y compara con el anterior.
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
  // map: devuelve cada tramo con el precio en texto de 2 decimales (toFixed(2)).
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

// SERVICE de productos: lógica y acceso a la base.
@Injectable()
export class ProductosService {
  constructor(
    // Otra forma de pedir el repositorio: Nest te lo da ya armado en this.productos.
    // Es lo mismo que this.db.getRepository(Producto) en orders.service.ts.
    // Usás: this.productos.find(...), this.productos.findOne(...), this.productos.save(...).
    @InjectRepository(Producto) private readonly productos: Repository<Producto>,
  ) {}

  /**
   * Valida categoría y tramos y guarda ambos junto al producto. El ID del propietario
   * proviene del JWT, no del formulario.
   */
  // CREAR PRODUCTO. idNegocio sale del token (no del formulario), así nadie crea productos a nombre de otro.
  // LO LLAMA: products.controller.ts → crear() con (request.user.idNegocio, dto, rutas).
  async crear(idNegocio: number, dto: CrearProductoDto, rutasImagenes: string[]) {
    // Llama a la función de arriba de este archivo. Si hay tramos inválidos tira 400 y no sigue.
    const tramos = validarPreciosEscalonados(dto);
    // Transacción: guarda producto y precios escalonados juntos o nada.
    return this.productos.manager.transaction(async (manager) => {
      await validarCategoria(manager, dto.idCategoria, idNegocio);
      const repo = manager.getRepository(Producto);
      // save sin id → crea. { idProducto } = saca solo el id de lo que devolvió save (desestructuración).
      const { idProducto } = await repo.save(
        repo.create({
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          idCategoria: dto.idCategoria,
          stock: dto.stock,
          cantidadMinimaCompra: dto.cantidadMinimaCompra,
          // El precio llega como número y se guarda como texto con 2 decimales.
          precioBase: dto.precioBase.toFixed(2),
          idNegocio,
          imagenes: rutasImagenes,
        }),
      );
      // this.guardarTramos = función privada de esta clase (más abajo). Guarda los precios escalonados con el id del producto recién creado.
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
  // CATÁLOGO (Explorar). Usa createQueryBuilder: forma avanzada de armar la consulta.
  // where '<>' = distinto: no muestra tus propios productos.
  // LO LLAMA: products.controller.ts → buscar() con (@Query filtros, request.user.idNegocio).
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
  // MIS PRODUCTOS. MOLDE de listado más simple del proyecto:
  // LO LLAMA: products.controller.ts → misProductos() con (request.user.idNegocio).
  // DEVUELVE la lista → en el front setMisProductos(productos) en CrearProducto.tsx.
  async buscarDeNegocio(idNegocio: number) {
    // find → lista de filas que cumplen el where.
    const productos = await this.productos.find({
      // Forma corta de { idNegocio: idNegocio }: columna idNegocio = negocio del token.
      where: { idNegocio },
      // Del más nuevo al más viejo.
      order: { idProducto: 'DESC' },
    });
    // map aplica ordenarTramos a cada producto y devuelve la lista. Esto le llega al front.
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
  // UN producto por id.
  async buscarUno(idProducto: number) {
    const producto = await this.productos.findOne({
      where: { idProducto },
      relations: { negocio: true },
    });
    // findOne devuelve null si no existe → 404.
    if (!producto) throw new NotFoundException('Producto no encontrado.');
    return ordenarTramos(producto);
  }

  /**
   * Actualiza solo un producto del dueño autenticado, guarda sus tramos y retira
   * referencias obsoletas de carritos. Sin fotos nuevas conserva las rutas anteriores.
   */
  // EDITAR PRODUCTO.
  // LO LLAMA: products.controller.ts → actualizar() con (id de la URL, request.user.idNegocio, dto, rutas o undefined).
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
      // update(DÓNDE, QUÉ CAMBIAR). Dónde = { idProducto, idNegocio }: así solo edita si el producto es TUYO.
      const resultado = await repo.update(
        { idProducto, idNegocio },
        {
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          idCategoria: dto.idCategoria,
          stock: dto.stock,
          cantidadMinimaCompra: dto.cantidadMinimaCompra,
          precioBase: dto.precioBase.toFixed(2),
          // Solo cambia las fotos si mandaron nuevas.
          ...(imagenes ? { imagenes } : {}),
        },
      );
      // affected = cuántas filas cambió. 0 → no existe o no es tuyo → 404.
      if (!resultado.affected) throw new NotFoundException('Producto no encontrado.');
      await this.guardarTramos(manager, idProducto, tramos);
      // Si cambió el producto, lo saca de todos los carritos (precio/condiciones viejas).
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
  // AGREGAR STOCK. Recibe (id del producto, negocio del token, cantidad del body).
  // LO LLAMA: products.controller.ts → agregarStock() con (id de la URL, request.user.idNegocio, dto.cantidad).
  // En el front: guardar() de AgregarStock.tsx → api.agregarStock(producto.idProducto, unidades, token).
  async agregarStock(idProducto: number, idNegocio: number, cantidad: number) {
    return this.productos.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Producto);
      // Serializa la reposición con compras y otras reposiciones del mismo producto.
      // Busca el producto que sea de ESTE negocio (where con dos condiciones = las dos se tienen que cumplir).
      const producto = await repo.findOne({
        where: { idProducto, idNegocio },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      // No existe o no es tuyo → 404.
      if (!producto) throw new NotFoundException('Producto no encontrado.');
      // No puede pasar el máximo entero → 400.
      if (producto.stock + cantidad > 2147483647) {
        throw new BadRequestException('El stock no puede superar 2147483647 unidades.');
      }
      // Una reposición conserva la versión comercial y los carritos existentes.
      // SQL directo para sumar stock sin cambiar la versión. Alternativa simple: producto.stock += cantidad; await repo.save(producto);
      await manager.query(
        'UPDATE producto SET stock = stock + $1 WHERE id_producto = $2 AND id_negocio = $3',
        [cantidad, idProducto, idNegocio],
      );
      // Devuelve el producto actualizado. El front lo usa para reemplazar la tarjeta (actualizarProducto en CrearProducto.tsx).
      return ordenarTramos(
        await repo.findOneOrFail({ where: { idProducto, idNegocio } }),
      );
    });
  }

  /**
   * Elimina por ID y propietario. Las referencias de carrito se borran por cascada; los
   * pedidos conservan sus copias históricas.
   */
  // ELIMINAR. delete con { idProducto, idNegocio } → solo borra si es tuyo.
  // LO LLAMA: products.controller.ts → eliminar() con (id de la URL, request.user.idNegocio).
  async eliminar(idProducto: number, idNegocio: number) {
    const resultado = await this.productos.delete({ idProducto, idNegocio });
    if (!resultado.affected) throw new NotFoundException('Producto no encontrado.');
    // Devuelve un OBJETO (con llaves). En el front lo leés como respuesta.mensaje.
    return { mensaje: 'Producto eliminado correctamente.' };
  }

  /**
   * Devuelve los IDs que siguen existiendo, no son propios y conservan la versión vista
   * por el comprador.
   */
  // Revisa qué productos del carrito siguen válidos (existen, no son tuyos, misma versión).
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
