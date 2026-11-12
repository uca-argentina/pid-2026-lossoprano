/**
 * Decorador @Roles: asocia roles permitidos a un controlador o método.
 * RolesGuard lee estos metadatos después de autenticar al usuario.
 */

import { SetMetadata } from '@nestjs/common';
import { RolCliente } from '../users/user.entity';

export const ROLES_KEY = 'roles';
// @Roles(RolCliente.VENDEDOR) en un controller guarda qué roles pueden entrar. RolesGuard (roles.guard.ts) lo lee.
// ...roles = acepta uno o varios roles.
export const Roles = (...roles: RolCliente[]) => SetMetadata(ROLES_KEY, roles);
