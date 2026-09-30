import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';

export class CrearProductoDto {
  @IsString() @IsNotEmpty() @MaxLength(150) nombre: string;
  @IsString() @IsNotEmpty() descripcion: string;
  @IsString() @IsNotEmpty() @MaxLength(100) categoria: string;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) @IsPositive() precioBase: number;

  @Type(() => Number) @IsInt({ message: 'El stock debe ser un número entero.' }) @Min(0) @Max(2147483647) stock: number;
}
