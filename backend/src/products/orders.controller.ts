/**
 * Rutas de confirmación, compras, ventas, transiciones de subórdenes y reclamos.
 * Las ventas exigen rol vendedor; cambiar un estado exige ser parte de esa suborden y
 * respetar las reglas del servicio.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RolCliente } from '../users/user.entity';
import { CambiarEstadoDto, ConfirmarPedidoDto } from './dto/confirmar-pedido.dto';
import { CrearReclamoDto, RechazarReclamoDto } from './dto/reclamo.dto';
import { PedidosService } from './orders.service';

type Solicitud = { user: { sub: number; idNegocio: number } };

@Controller('pedidos')
@UseGuards(JwtAuthGuard)
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}
  @Post()
  confirmar(@Request() req: Solicitud, @Body() dto: ConfirmarPedidoDto) {
    return this.pedidos.confirmar(req.user.sub, dto);
  }
  @Get('compras')
  compras(@Request() req: Solicitud) {
    return this.pedidos.listarCompras(req.user.idNegocio);
  }
  @Get('ventas')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  ventas(@Request() req: Solicitud) {
    return this.pedidos.listarVentas(req.user.idNegocio);
  }
  // El servicio decide qué cambios puede hacer el vendedor y cuáles el comprador de la suborden.
  @Patch('subordenes/:id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: Solicitud,
    @Body() dto: CambiarEstadoDto,
  ) {
    return this.pedidos.cambiarEstado(id, req.user.idNegocio, dto.estado);
  }

  // El comprador inicia un reclamo sobre una de sus subórdenes entregadas.
  @Post('subordenes/:id/reclamos')
  crearReclamo(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: Solicitud,
    @Body() dto: CrearReclamoDto,
  ) {
    return this.pedidos.crearReclamo(id, req.user.idNegocio, dto);
  }

  // Las tres acciones siguientes son del vendedor que recibió el reclamo.
  @Patch('reclamos/:id/aprobar')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  aprobarReclamo(@Param('id', ParseIntPipe) id: number, @Request() req: Solicitud) {
    return this.pedidos.aprobarReclamo(id, req.user.idNegocio);
  }

  @Patch('reclamos/:id/rechazar')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  rechazarReclamo(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: Solicitud,
    @Body() dto: RechazarReclamoDto,
  ) {
    return this.pedidos.rechazarReclamo(id, req.user.idNegocio, dto.motivo);
  }

  @Patch('reclamos/:id/recepcion')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  confirmarRecepcionReclamo(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: Solicitud,
  ) {
    return this.pedidos.confirmarRecepcionReclamo(id, req.user.idNegocio);
  }
}
