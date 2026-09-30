import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RolCliente } from '../users/user.entity';
import { CategoriasService } from './categories.service';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';

@Controller('categorias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolCliente.VENDEDOR)
export class CategoriasController {
  constructor(private readonly categorias: CategoriasService) {}

  @Get()
  listar(@Request() request: { user: { idNegocio: number } }) {
    return this.categorias.listarDisponibles(request.user.idNegocio);
  }

  @Post()
  crear(@Request() request: { user: { idNegocio: number } }, @Body() dto: CrearCategoriaDto) {
    return this.categorias.crear(request.user.idNegocio, dto.nombre);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number, @Request() request: { user: { idNegocio: number } }) {
    return this.categorias.eliminar(id, request.user.idNegocio);
  }
}
