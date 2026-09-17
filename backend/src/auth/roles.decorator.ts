import { SetMetadata } from '@nestjs/common';
import { RolCliente } from '../users/user.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolCliente[]) => SetMetadata(ROLES_KEY, roles);
