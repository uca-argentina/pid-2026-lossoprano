/**
 * Rutas públicas /auth: reciben DTO ya validados y delegan registro o ingreso en
 * AuthService.
 * El controlador adapta HTTP; el servicio contiene la lógica y el acceso a la base.
 */

import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('registro')
  registrar(@Body() dto: RegistroDto) {
    return this.auth.registrar(dto);
  }

  @Post('iniciar-sesion')
  iniciarSesion(@Body() dto: LoginDto) {
    return this.auth.iniciarSesion(dto);
  }
}
