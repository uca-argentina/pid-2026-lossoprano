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
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<RolCliente[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rolesPermitidos || rolesPermitidos.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: { rol: RolCliente } }>();
    if (!rolesPermitidos.includes(user.rol)) {
      throw new ForbiddenException('No tenés permisos para realizar esta acción.');
    }
    return true;
  }
}
