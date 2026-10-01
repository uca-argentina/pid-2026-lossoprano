import { Transform } from 'class-transformer';
import { ArrayMinSize, IsEnum, IsNotEmpty, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { GuardarCarritoDto } from './guardar-carrito.dto';
import { CondicionPago } from '../order.entity';

export class ConfirmarPedidoDto extends GuardarCarritoDto {
  @ArrayMinSize(1) declare items: GuardarCarritoDto['items'];
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(255) direccionEntrega: string;
  @IsEnum(CondicionPago) condicionPago: CondicionPago;
  @IsUUID() claveConfirmacion: string;
  @IsString() @Matches(/^\d{1,18}\.\d{2}$/) total: string;
}
