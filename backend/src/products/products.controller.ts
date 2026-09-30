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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RolCliente } from '../users/user.entity';
import { BuscarProductosDto } from './dto/buscar-productos.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ProductosService } from './products.service';
import { ValidarCarritoDto } from './dto/validar-carrito.dto';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANIO_MAXIMO = 2 * 1024 * 1024;
const CANTIDAD_MAXIMA_IMAGENES = 5;
const CARPETA_IMAGENES = 'uploads/productos';
mkdirSync(CARPETA_IMAGENES, { recursive: true });

@Controller('productos')
@UseGuards(JwtAuthGuard)
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  @UseInterceptors(
    FilesInterceptor('imagenes', CANTIDAD_MAXIMA_IMAGENES, {
      storage: diskStorage({
        destination: CARPETA_IMAGENES,
        filename: (_req, archivo, callback) => callback(null, `${randomUUID()}${extname(archivo.originalname)}`),
      }),
      fileFilter: (_req, archivo, callback) => callback(null, TIPOS_PERMITIDOS.includes(archivo.mimetype)),
      limits: { fileSize: TAMANIO_MAXIMO },
    }),
  )
  async crear(
    @Request() request: { user: { idNegocio: number } },
    @Body() dto: CrearProductoDto,
    @UploadedFiles() imagenes: Express.Multer.File[],
  ) {
    if (!imagenes || imagenes.length === 0) {
      throw new BadRequestException('Seleccioná entre una y cinco imágenes.');
    }
    const rutas = imagenes.map((imagen) => `/uploads/productos/${imagen.filename}`);
    return this.productos.crear(request.user.idNegocio, dto, rutas);
  }

  @Get()
  buscar(@Query() filtros: BuscarProductosDto) {
    return this.productos.buscar(filtros);
  }

  @Post('carrito/validar')
  validarCarrito(@Body() dto: ValidarCarritoDto) {
    return this.productos.validarCarrito(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  @UseInterceptors(FilesInterceptor('imagenes', CANTIDAD_MAXIMA_IMAGENES, {
    storage: diskStorage({
      destination: CARPETA_IMAGENES,
      filename: (_req, archivo, callback) => callback(null, `${randomUUID()}${extname(archivo.originalname)}`),
    }),
    fileFilter: (_req, archivo, callback) => TIPOS_PERMITIDOS.includes(archivo.mimetype)
      ? callback(null, true)
      : callback(new BadRequestException('Las imágenes deben ser JPG, PNG o WebP.'), false),
    limits: { fileSize: TAMANIO_MAXIMO },
  }))
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: { user: { idNegocio: number } },
    @Body() dto: CrearProductoDto,
    @UploadedFiles() imagenes: Express.Multer.File[],
  ) {
    return this.productos.actualizar(id, request.user.idNegocio, dto,
      imagenes?.length ? imagenes.map(imagen => `/uploads/productos/${imagen.filename}`) : undefined);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  eliminar(@Param('id', ParseIntPipe) id: number, @Request() request: { user: { idNegocio: number } }) {
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

  @Get(':id')
  buscarUno(@Param('id', ParseIntPipe) id: number) {
    return this.productos.buscarUno(id);
  }
}
