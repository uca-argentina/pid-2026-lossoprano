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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'development-secret'),
    });
  }

  validate(payload: { sub: number; idNegocio: number; rol: string }) {
    return payload;
  }
}
