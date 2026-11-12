/**
 * Extrae el JWT del encabezado, comprueba firma y vencimiento y devuelve sus datos
 * como request.user.
 * Los servicios que necesitan el negocio vigente también consultan la base; un token
 * firmado no representa por sí solo una fila existente.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// @Injectable: Nest puede crear esta clase solo y pasársela a quien la necesite.
@Injectable()
// Estrategia JWT: la usa JwtAuthGuard (@UseGuards(JwtAuthGuard)) para revisar el token de cada petición.
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // De dónde saca el token: del header 'Authorization: Bearer <token>' (lo pone api.ts del front).
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Si el token venció (dura 8h) → 401.
      ignoreExpiration: false,
      // Clave para comprobar la firma del token. Sale de JWT_SECRET del backend/.env.
      secretOrKey: config.get<string>('JWT_SECRET', 'development-secret'),
    });
  }

  // Si la firma está bien, Nest llama a validate con el contenido del token (payload).
  // El payload lo armó auth.service al hacer login: { sub: idUsuario, idNegocio, rol }.
  validate(payload: { sub: number; idNegocio: number; rol: string }) {
    // Lo que devuelve validate queda en request.user.
    // Por eso en los controllers escribís req.user.idNegocio.
    return payload;
  }
}
