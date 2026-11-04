/**
 * DTO de entrada HTTP: describe y valida los campos aceptados antes de ejecutar la
 * lógica de negocio.
 * @Type/@Transform convierten valores de formularios o JSON; los decoradores de
 * class-validator controlan formato y límites.
 * Las validaciones que necesitan consultar la base (propiedad, stock o duplicados) se
 * resuelven en el servicio.
 */

import { IsInt, Max, Min } from 'class-validator';

export class AgregarStockDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  cantidad: number;
}
