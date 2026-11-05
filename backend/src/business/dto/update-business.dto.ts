/**
 * DTO de entrada HTTP: describe y valida los campos aceptados antes de ejecutar la
 * lógica de negocio.
 * @Type/@Transform convierten valores de formularios o JSON; los decoradores de
 * class-validator controlan formato y límites.
 * Las validaciones que necesitan consultar la base (propiedad, stock o duplicados) se
 * resuelven en el servicio.
 */

import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarNegocioDto {
  @ValidateIf((_obj, value) => value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  montoMinimoOrden?: number;
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  razonSocial?: string;
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombreComercial?: string;
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/)
  identificacionFiscal?: string;
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8,}$/)
  telefono?: string;
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  direccion?: string;
  @IsOptional()
  @IsString({ message: 'La página web tiene que ser texto.' })
  @MaxLength(200, { message: 'La página web puede tener hasta 200 caracteres.' })
  paginaWeb?: string;
}
