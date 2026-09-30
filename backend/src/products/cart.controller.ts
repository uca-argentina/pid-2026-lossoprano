import { Body, Controller, Get, Put, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CarritoService } from './cart.service';
import { GuardarCarritoDto } from './dto/guardar-carrito.dto';

@Controller('carrito')
@UseGuards(JwtAuthGuard)
export class CarritoController {
  constructor(private readonly carrito: CarritoService) {}
  @Get()
  async obtener(@Request() req: { user: { sub: number } }, @Res() respuesta: Response) {
    respuesta.json(await this.carrito.obtener(req.user.sub));
  }
  @Put()
  async guardar(@Request() req: { user: { sub: number } }, @Body() dto: GuardarCarritoDto, @Res() respuesta: Response) {
    respuesta.json(await this.carrito.guardar(req.user.sub, dto));
  }
}
