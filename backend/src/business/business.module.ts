import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Negocio } from './business.entity';
import { NegociosController } from './business.controller';
import { NegociosService } from './business.service';

@Module({ imports: [TypeOrmModule.forFeature([Negocio])], controllers: [NegociosController], providers: [NegociosService] })
export class NegociosModule {}
