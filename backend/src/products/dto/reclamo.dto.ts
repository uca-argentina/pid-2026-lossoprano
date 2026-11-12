/**
 * DTOs de reclamos. Controlan la forma de lo que llega (lista de productos, cantidades
 * enteras positivas y motivo). Que los productos sean de la compra y que las cantidades
 * no superen lo entregado se comprueba en el servicio, porque necesita la base.
 */

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Quita espacios al principio y al final: un motivo de solo espacios cuenta como vacío.
// Función que saca los espacios de adelante y atrás de un texto (trim). Se usa con @Transform.
const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Un producto reclamado.
// DTO de UN producto dentro del reclamo: { idProducto, cantidad }.
export class ItemReclamoDto {
  // { message: '...' } = texto del error que le llega al front si falla.
  @IsInt({ message: 'El producto no es válido.' })
  idProducto: number;

  @IsInt({ message: 'La cantidad tiene que ser un número entero.' })
  @Min(1, { message: 'La cantidad tiene que ser al menos 1.' })
  cantidad: number;
}

// Lo que manda el comprador al iniciar un reclamo.
// Body de POST /api/pedidos/subordenes/:id/reclamos → { items: [...], motivo: '...' }.
export class CrearReclamoDto {
  // Tiene que ser una lista...
  @IsArray({ message: 'Elegí los productos a reclamar.' })
  // ...con al menos 1 elemento...
  @ArrayMinSize(1, { message: 'Elegí al menos un producto.' })
  @ArrayMaxSize(500)
  // ...sin productos repetidos...
  @ArrayUnique((item: ItemReclamoDto) => item.idProducto, {
    message: 'No repitas el mismo producto.',
  })
  // ...y cada elemento se valida con ItemReclamoDto (@Type dice con qué clase).
  @ValidateNested({ each: true })
  @Type(() => ItemReclamoDto)
  items: ItemReclamoDto[];

  // Antes de validar, le saca los espacios al motivo.
  @Transform(recortar)
  // Se validan de abajo hacia arriba: el primer mensaje es el de "vacío".
  @MaxLength(500, { message: 'El motivo puede tener hasta 500 caracteres.' })
  @IsNotEmpty({ message: 'Escribí el motivo del reclamo.' })
  // Texto obligatorio. Para un campo OPCIONAL usarías @IsOptional() y el nombre con ?: (ej: comentario?: string).
  @IsString({ message: 'Escribí el motivo del reclamo.' })
  motivo: string;
}

// Lo que manda el vendedor al rechazar: el motivo es obligatorio.
export class RechazarReclamoDto {
  @Transform(recortar)
  // Se validan de abajo hacia arriba: el primer mensaje es el de "vacío".
  @MaxLength(500, { message: 'El motivo puede tener hasta 500 caracteres.' })
  @IsNotEmpty({ message: 'Indicá el motivo del rechazo.' })
  @IsString({ message: 'Indicá el motivo del rechazo.' })
  motivo: string;
}
