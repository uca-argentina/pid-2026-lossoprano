/**
 * DTO de entrada HTTP: describe y valida los campos aceptados antes de ejecutar la
 * lógica de negocio.
 * @Type/@Transform convierten valores de formularios o JSON; los decoradores de
 * class-validator controlan formato y límites.
 * Las validaciones que necesitan consultar la base (propiedad, stock o duplicados) se
 * resuelven en el servicio.
 */

import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, Min, ValidateNested } from 'class-validator';

class ItemCarritoDto {
  @IsInt()
  @Min(1)
  idProducto: number;
  @IsInt()
  @Min(1)
  version: number;
}

export class ValidarCarritoDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ItemCarritoDto)
  items: ItemCarritoDto[];
}
