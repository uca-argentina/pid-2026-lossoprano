/**
 * Adaptación HTTP del catálogo y subida multipart de fotos.
 * JWT autentica; @Roles limita las escrituras a vendedores; los servicios controlan
 * que el producto sea propio.
 * Las imágenes se almacenan antes de guardar sus rutas en el producto.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImagenesService } from './images.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RolCliente } from '../users/user.entity';
import { BuscarProductosDto } from './dto/buscar-productos.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ProductosService } from './products.service';
import { ValidarCarritoDto } from './dto/validar-carrito.dto';
import { AgregarStockDto } from './dto/agregar-stock.dto';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANIO_MAXIMO = 2 * 1024 * 1024;
const CANTIDAD_MAXIMA_IMAGENES = 5;

@Controller('productos')
@UseGuards(JwtAuthGuard)
export class ProductosController {
  constructor(
    private readonly productos: ProductosService,
    private readonly almacenamiento: ImagenesService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  @UseInterceptors(
    FilesInterceptor('imagenes', CANTIDAD_MAXIMA_IMAGENES, {
      storage: memoryStorage(),
      fileFilter: (_req, archivo, callback) =>
        callback(null, TIPOS_PERMITIDOS.includes(archivo.mimetype)),
      limits: { fileSize: TAMANIO_MAXIMO },
    }),
  )
  async crear(
    @Request() request: { user: { idNegocio: number } },
    @Body() dto: CrearProductoDto,
    @UploadedFiles() imagenes: Express.Multer.File[],
  ) {
    const rutas = await this.rutasImagenes(imagenes, dto, request.user.idNegocio);
    if (rutas.length === 0) {
      throw new BadRequestException('Seleccioná entre una y cinco imágenes.');
    }
    return this.productos.crear(request.user.idNegocio, dto, rutas);
  }

  // Cada archivo viaja por separado para respetar el límite de Vercel.
  @Post('imagenes')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: memoryStorage(),
      limits: { fileSize: TAMANIO_MAXIMO },
    }),
  )
  async subirImagen(
    @Request() request: { user: { idNegocio: number } },
    @UploadedFile() imagen?: Express.Multer.File,
  ) {
    if (!imagen) throw new BadRequestException('Seleccioná una imagen.');
    return { url: await this.almacenamiento.guardar(imagen, request.user.idNegocio) };
  }

  private async rutasImagenes(
    imagenes: Express.Multer.File[] | undefined,
    dto: CrearProductoDto,
    idNegocio: number,
  ) {
    const rutas = this.almacenamiento.validar(dto.imagenesSubidas ?? [], idNegocio);
    if (rutas.length + (imagenes?.length ?? 0) > CANTIDAD_MAXIMA_IMAGENES) {
      throw new BadRequestException('Seleccioná entre una y cinco imágenes.');
    }
    for (const imagen of imagenes ?? [])
      rutas.push(await this.almacenamiento.guardar(imagen, idNegocio));
    return rutas;
  }

  @Get()
  buscar(
    @Query() filtros: BuscarProductosDto,
    @Request() request: { user: { idNegocio: number } },
  ) {
    return this.productos.buscar(filtros, request.user.idNegocio);
  }

  @Post('carrito/validar')
  validarCarrito(
    @Body() dto: ValidarCarritoDto,
    @Request() request: { user: { idNegocio: number } },
  ) {
    return this.productos.validarCarrito(dto, request.user.idNegocio);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  @UseInterceptors(
    FilesInterceptor('imagenes', CANTIDAD_MAXIMA_IMAGENES, {
      storage: memoryStorage(),
      fileFilter: (_req, archivo, callback) =>
        TIPOS_PERMITIDOS.includes(archivo.mimetype)
          ? callback(null, true)
          : callback(
              new BadRequestException('Las imágenes deben ser JPG, PNG o WebP.'),
              false,
            ),
      limits: { fileSize: TAMANIO_MAXIMO },
    }),
  )
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: { user: { idNegocio: number } },
    @Body() dto: CrearProductoDto,
    @UploadedFiles() imagenes: Express.Multer.File[],
  ) {
    const rutas = await this.rutasImagenes(imagenes, dto, request.user.idNegocio);
    return this.productos.actualizar(
      id,
      request.user.idNegocio,
      dto,
      rutas.length ? rutas : undefined,
    );
  }

  @Patch(':id/stock')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  agregarStock(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: { user: { idNegocio: number } },
    @Body() dto: AgregarStockDto,
  ) {
    return this.productos.agregarStock(id, request.user.idNegocio, dto.cantidad);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: { user: { idNegocio: number } },
  ) {
    return this.productos.eliminar(id, request.user.idNegocio);
  }

  @Get('mi-negocio')
  misProductos(@Request() request: { user: { idNegocio: number } }) {
    return this.productos.buscarDeNegocio(request.user.idNegocio);
  }

  @Get('categorias')
  listarCategorias() {
    return this.productos.listarCategorias();
  }

  @Get('vendedores')
  listarVendedores(@Request() request: { user: { idNegocio: number } }) {
    return this.productos.listarVendedores(request.user.idNegocio);
  }

  @Get(':id')
  // Las rutas estáticas deben declararse antes de esta ruta.
  buscarUno(@Param('id', ParseIntPipe) id: number) {
    return this.productos.buscarUno(id);
  }
}
