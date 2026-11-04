/**
 * DTO de entrada HTTP: describe y valida los campos aceptados antes de ejecutar la
 * lógica de negocio.
 * @Type/@Transform convierten valores de formularios o JSON; los decoradores de
 * class-validator controlan formato y límites.
 * Las validaciones que necesitan consultar la base (propiedad, stock o duplicados) se
 * resuelven en el servicio.
 */

import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { GuardarCarritoDto } from './guardar-carrito.dto';
import { CondicionPago, EstadoSuborden } from '../order.entity';

// Entrega y pago de la suborden de un vendedor.
export class EntregaSubordenDto {
  @IsInt()
  @Min(1)
  idNegocio: number;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  direccionEntrega: string;
  @IsEnum(CondicionPago)
  condicionPago: CondicionPago;
}

export class ConfirmarPedidoDto extends GuardarCarritoDto {
  @ArrayMinSize(1)
  declare items: GuardarCarritoDto['items'];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((entrega: EntregaSubordenDto) => entrega.idNegocio)
  @ValidateNested({ each: true })
  @Type(() => EntregaSubordenDto)
  entregas: EntregaSubordenDto[];
  @IsUUID()
  claveConfirmacion: string;
  @IsString()
  @Matches(/^\d{1,18}\.\d{2}$/)
  total: string;
}

export class CambiarEstadoDto {
  @IsEnum(EstadoSuborden)
  estado: EstadoSuborden;
}
