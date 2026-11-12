/**
 * Guardia de autenticación: exige un JWT válido antes de ejecutar el controlador
 * protegido.
 * Usa la estrategia jwt registrada en AuthModule.
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// @UseGuards(JwtAuthGuard) en un controller = exige token válido. Usa JwtStrategy (jwt.strategy.ts). Sin token → 401.
export class JwtAuthGuard extends AuthGuard('jwt') {}
