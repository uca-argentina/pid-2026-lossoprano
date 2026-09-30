import { plainToInstance, Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class PrecioEscalonadoDto {
  @IsInt() @Min(2) @Max(2147483647) cantidadMinima: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) precioUnitario: number;
}

export class CrearProductoDto {
  @Transform(({ value }) => value === '' || value == null ? null : Number(value))
  @IsOptional() @IsInt() @Min(1) @Max(2147483647)
  cantidadMinimaCompra: number | null = null;
  @IsString() @IsNotEmpty() @MaxLength(150) nombre: string;
  @IsString() @IsNotEmpty() descripcion: string;
  @Type(() => Number) @IsInt({ message: 'Elegí una categoría.' }) @Min(1) idCategoria: number;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) @IsPositive() precioBase: number;

  @Type(() => Number) @IsInt({ message: 'El stock debe ser un número entero.' }) @Min(0) @Max(2147483647) stock: number;

  // Llega como JSON dentro del formulario multipart.
  @Transform(({ value }) => {
    if (value === '' || value == null) return [];
    let lista: unknown = value;
    if (typeof value === 'string') {
      try { lista = JSON.parse(value); } catch { return value; }
    }
    return Array.isArray(lista) ? plainToInstance(PrecioEscalonadoDto, lista as object[]) : lista;
  })
  @IsArray({ message: 'Los precios escalonados no tienen un formato válido.' }) @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  preciosEscalonados: PrecioEscalonadoDto[] = [];
}
