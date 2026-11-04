/**
 * Registra sorteos y reloj y expone sus rutas autenticadas.
 * GET consulta; POST actualizar procesa cierres vencidos; POST reloj avanza el tiempo
 * local y ejecuta esos mismos cierres.
 */

import { Body, Controller, Get, Module, Post, Request, UseGuards } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Negocio } from '../business/business.entity';
import { Suborden } from '../products/order.entity';
import { Sorteo } from './sweepstakes.entity';
import { SorteosService } from './sweepstakes.service';
import { RelojSorteos } from './sweepstakes-clock';
import { CambiarFechaSorteosDto } from './sweepstakes-clock.dto';

@Controller('sorteos')
@UseGuards(JwtAuthGuard)
export class SorteosController {
  constructor(private readonly sorteos: SorteosService) {}

  @Get()
  resumen(@Request() req: { user: { idNegocio: number } }) {
    return this.sorteos.resumen(req.user.idNegocio);
  }

  @Post('actualizar')
  actualizar(@Request() req: { user: { idNegocio: number } }) {
    return this.sorteos.actualizar(req.user.idNegocio);
  }

  @Post('reloj')
  cambiarFecha(
    @Request() req: { user: { idNegocio: number } },
    @Body() dto: CambiarFechaSorteosDto,
  ) {
    return this.sorteos.cambiarFecha(req.user.idNegocio, dto.fecha);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Sorteo, RelojSorteos, Suborden, Negocio])],
  controllers: [SorteosController],
  providers: [SorteosService],
})
export class SorteosModule {}
