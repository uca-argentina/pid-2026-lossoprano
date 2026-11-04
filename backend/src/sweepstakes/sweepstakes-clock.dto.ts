/**
 * Contrato del cambio de fecha de prueba: exige una fecha ISO válida con zona
 * horaria explícita.
 * El servicio también impide retroceder para no reabrir un período ni cambiar un
 * ganador guardado.
 */

import { IsISO8601, Matches } from 'class-validator';

export class CambiarFechaSorteosDto {
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  fecha: string;
}
