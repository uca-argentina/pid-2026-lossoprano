/**
 * Agrupa el controlador, servicio y repositorio de Negocio que necesita la edición
 * del perfil comercial.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Negocio } from './business.entity';
import { NegociosController } from './business.controller';
import { NegociosService } from './business.service';

@Module({
  imports: [TypeOrmModule.forFeature([Negocio])],
  controllers: [NegociosController],
  providers: [NegociosService],
})
export class NegociosModule {}
