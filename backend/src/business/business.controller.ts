import { Body, Controller, Delete, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActualizarNegocioDto } from './dto/update-business.dto';
import { NegociosService } from './business.service';

@Controller('negocios')
@UseGuards(JwtAuthGuard)
export class NegociosController {
  constructor(private readonly negocios: NegociosService) {}

  @Get('mi-negocio')
  buscarElMio(@Request() request: { user: { idNegocio: number } }) {
    return this.negocios.buscarUno(request.user.idNegocio);
  }

  @Patch('mi-negocio')
  actualizarElMio(
    @Request() request: { user: { idNegocio: number } },
    @Body() dto: ActualizarNegocioDto,
  ) {
    return this.negocios.actualizar(request.user.idNegocio, dto);
  }
  @Delete('mi-negocio')
  async eliminarElMio(@Request() request: { user: { idNegocio: number } }) {
    await this.negocios.eliminar(request.user.idNegocio);
    return { mensaje: 'Negocio eliminado correctamente.' };
  }
}
