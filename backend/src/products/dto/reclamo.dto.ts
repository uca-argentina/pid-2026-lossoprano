import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMinSize,
  ArrayUnique,
} from 'class-validator';

export class CrearReclamoDto {
  @IsArray({ message: 'Elegí los productos a reclamar.' })
  @ArrayMinSize(1, { message: 'Elegí al menos un producto.' })
  @ArrayMaxSize(500)
  @ArrayUnique((item: ItemReclamoDto) => item.idProducto)
  @ValidateNested({ each: true })
  @Type(() => ItemReclamoDto)
  items: ItemReclamoDto[];
  @IsString({ message: 'Escribí el motivo del reclamo.' })
  @IsNotEmpty({ message: 'Escribí el motivo del reclamo.' })
  @MaxLength(500, { message: 'El motivo puede tener hasta 500 caracteres.' })
  motivo: string;
}

export class ItemReclamoDto {
  @IsInt({ message: 'El producto no es válido.' })
  idProducto: number;

  @IsInt({ message: 'La cantidad tiene que ser un número entero.' })
  @Min(1, { message: 'La cantidad tiene que ser al menos 1.' })
  cantidad: number;
}
