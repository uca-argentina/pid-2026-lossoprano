/**
 * DTO de entrada HTTP: describe y valida los campos aceptados antes de ejecutar la
 * lógica de negocio.
 * @Type/@Transform convierten valores de formularios o JSON; los decoradores de
 * class-validator controlan formato y límites.
 * Las validaciones que necesitan consultar la base (propiedad, stock o duplicados) se
 * resuelven en el servicio.
 */

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearCategoriaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;
}
