import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsPositive, IsString, Min } from 'class-validator';

export class CrearProductoDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsString() @IsNotEmpty() descripcion: string;
  @IsString() @IsNotEmpty() categoria: string;

  @Type(() => Number) @IsNumber() @IsPositive() precioBase: number;

  @Type(() => Number) @IsNumber() @Min(0) stock: number;
}
