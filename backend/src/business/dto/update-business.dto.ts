import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarNegocioDto {
  @ValidateIf((_obj, value) => value !== undefined) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9999999999.99)
  montoMinimoOrden?: number;
  @IsOptional() @IsString() @IsNotEmpty() razonSocial?: string;
  @IsOptional() @IsString() @IsNotEmpty() nombreComercial?: string;
  @IsOptional() @IsString() @Matches(/^\d{11}$/) identificacionFiscal?: string;
  @IsOptional() @IsString() @IsNotEmpty() @Matches(/^\d{8,}$/) telefono?: string;
  @IsOptional() @IsString() @IsNotEmpty() direccion?: string;
}
