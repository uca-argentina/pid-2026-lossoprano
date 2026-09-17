import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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

  @Get('mi-negocio')
  misProductos(@Request() request: { user: { idNegocio: number } }) {
    return this.productos.buscarDeNegocio(request.user.idNegocio);
  }

  @Get(':id')
  buscarUno(@Param('id', ParseIntPipe) id: number) {
    return this.productos.buscarUno(id);
  }
}
