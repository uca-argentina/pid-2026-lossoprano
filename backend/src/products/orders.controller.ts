/**
 * Rutas de confirmación, compras, ventas y transiciones de subórdenes.
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
}
