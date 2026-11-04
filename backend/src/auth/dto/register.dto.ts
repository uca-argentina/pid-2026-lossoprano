/**
 * DTO de entrada HTTP: describe y valida los campos aceptados antes de ejecutar la
 * lógica de negocio.
 * @Type/@Transform convierten valores de formularios o JSON; los decoradores de
 * class-validator controlan formato y límites.
 * Las validaciones que necesitan consultar la base (propiedad, stock o duplicados) se
 * resuelven en el servicio.
 */

import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RolCliente } from '../../users/user.entity';

class RegistroNegocioDto {
  @IsString()
  @IsNotEmpty()
  razonSocial: string;
  @IsString()
  @IsNotEmpty()
  nombreComercial: string;
  @IsString()
  @Matches(/^\d{11}$/)
  identificacionFiscal: string;
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8,}$/)
  telefono: string;
  @IsString()
  @IsNotEmpty()
  direccion: string;
}

export class RegistroDto {
  @IsEmail()
  email: string;
  @IsString()
  @MinLength(8)
  password: string;
  @IsEnum(RolCliente)
  rol: RolCliente;
  @ValidateNested()
  @Type(() => RegistroNegocioDto)
  negocio: RegistroNegocioDto;
}
