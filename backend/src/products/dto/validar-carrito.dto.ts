import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, Min, ValidateNested } from 'class-validator';

class ItemCarritoDto {
  @IsInt() @Min(1) idProducto: number;
  @IsInt() @Min(1) version: number;
}

export class ValidarCarritoDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true })
  @Type(() => ItemCarritoDto)
  items: ItemCarritoDto[];
}
