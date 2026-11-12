/**
 * Autorización por rol: obtiene los roles declarados con @Roles y los compara con
 * request.user.
 * No decide la propiedad de productos o pedidos; esa comprobación corresponde al
 * servicio que opera sobre ellos.
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolCliente } from '../users/user.entity';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
// Guard de roles: se usa así en un controller:
//   @UseGuards(RolesGuard)
//   @Roles(RolCliente.VENDEDOR)
// Si el usuario logueado no tiene ese rol → 403.
export class RolesGuard implements CanActivate {
  // Reflector: permite leer lo que pusiste en @Roles(...).
  constructor(private readonly reflector: Reflector) {}

  // canActivate: Nest lo llama ANTES de la función del controller. true = deja pasar.
  canActivate(context: ExecutionContext): boolean {
    // Lee los roles de @Roles(...) de la función o de la clase.
    const rolesPermitidos = this.reflector.getAllAndOverride<RolCliente[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Si la ruta no tiene @Roles, deja pasar a cualquiera logueado.
    if (!rolesPermitidos || rolesPermitidos.length === 0) return true;

    // Agarra request.user (lo puso JwtStrategy.validate a partir del token).
    const { user } = context.switchToHttp().getRequest<{ user: { rol: RolCliente } }>();
    // includes: ¿el rol del usuario está en la lista permitida? Si no → 403.
    if (!rolesPermitidos.includes(user.rol)) {
      throw new ForbiddenException('No tenés permisos para realizar esta acción.');
    }
    // Tiene el rol: deja pasar.
    return true;
  }
}
