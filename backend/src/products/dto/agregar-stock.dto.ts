/**
 * DTO de entrada HTTP: describe y valida los campos aceptados antes de ejecutar la
 * lógica de negocio.
 * @Type/@Transform convierten valores de formularios o JSON; los decoradores de
 * class-validator controlan formato y límites.
 * Las validaciones que necesitan consultar la base (propiedad, stock o duplicados) se
 * resuelven en el servicio.
 */

// DTO = la forma que tiene que tener el BODY que manda el front. Se usa en el controller: @Body() dto: AgregarStockDto.
// Los decoradores vienen de class-validator. Si no se cumplen → 400 automático (lo hace el ValidationPipe de main.ts).
import { IsInt, Max, Min } from 'class-validator';

export class AgregarStockDto {
  // Tiene que ser un número entero.
  @IsInt()
  // Mínimo 1.
  @Min(1)
  // Máximo el entero más grande de la base.
  @Max(2147483647)
  // El NOMBRE tiene que coincidir con lo que manda el front en el body: { cantidad: 10 }.
  // En el service lo leés como dto.cantidad.
  cantidad: number;
}
