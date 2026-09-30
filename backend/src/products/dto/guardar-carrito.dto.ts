import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

class GuardarItemDto {
  @IsInt() @Min(1) idProducto: number;
  @IsInt() @Min(1) version: number;
  @IsInt() @Min(1) cantidad: number;
}

export class GuardarCarritoDto {
  @IsArray() @ArrayMaxSize(500) @ArrayUnique((item: GuardarItemDto) => item.idProducto)
  @ValidateNested({ each: true }) @Type(() => GuardarItemDto)
  items: GuardarItemDto[];
  @IsOptional() @IsBoolean() importar?: boolean;
}
