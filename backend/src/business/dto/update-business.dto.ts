import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ActualizarNegocioDto {
  @IsOptional() @IsString() @IsNotEmpty() razonSocial?: string;
  @IsOptional() @IsString() @IsNotEmpty() nombreComercial?: string;
  @IsOptional() @IsString() @Matches(/^\d{11}$/) identificacionFiscal?: string;
  @IsOptional() @IsString() @IsNotEmpty() @Matches(/^\d{8,}$/) telefono?: string;
  @IsOptional() @IsString() @IsNotEmpty() direccion?: string;
}
