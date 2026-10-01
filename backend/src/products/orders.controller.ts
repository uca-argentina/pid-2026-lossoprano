import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConfirmarPedidoDto } from './dto/confirmar-pedido.dto';
import { PedidosService } from './orders.service';

@Controller('pedidos')
@UseGuards(JwtAuthGuard)
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}
  @Post()
  confirmar(@Request() req: { user: { sub: number } }, @Body() dto: ConfirmarPedidoDto) {
    return this.pedidos.confirmar(req.user.sub, dto);
  }
}
