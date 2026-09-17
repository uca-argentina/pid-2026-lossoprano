import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class BuscarProductosDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @Type(() => Number) @IsInt() idNegocio?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}
