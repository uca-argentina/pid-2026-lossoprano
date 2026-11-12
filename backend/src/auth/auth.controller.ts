/**
 * Rutas públicas /auth: reciben DTO ya validados y delegan registro o ingreso en
 * AuthService.
 * El controlador adapta HTTP; el servicio contiene la lógica y el acceso a la base.
 */

import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/register.dto';

// Rutas /api/auth/... Este controller NO tiene @UseGuards(JwtAuthGuard): son públicas (no piden token).
@Controller('auth')
export class AuthController {
  // Nest le pasa el AuthService. Queda en this.auth para usarlo en las funciones.
  constructor(private readonly auth: AuthService) {}

  // POST /api/auth/registro → crea usuario y negocio.
  @Post('registro')
  // @Body() dto: el body del front, validado con RegistroDto. El controller no tiene lógica: se lo pasa al service.
  registrar(@Body() dto: RegistroDto) {
    return this.auth.registrar(dto);
  }

  // POST /api/auth/iniciar-sesion → login. Devuelve el token (accessToken) que el front guarda en localStorage.
  @Post('iniciar-sesion')
  iniciarSesion(@Body() dto: LoginDto) {
    return this.auth.iniciarSesion(dto);
  }
}
