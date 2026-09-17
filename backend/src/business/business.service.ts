import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Negocio } from './business.entity';
import { ActualizarNegocioDto } from './dto/update-business.dto';

@Injectable()
export class NegociosService {
  constructor(@InjectRepository(Negocio) private readonly negocios: Repository<Negocio>) {}

  async buscarUno(idNegocio: number) {
    const negocio = await this.negocios.findOneBy({ idNegocio });
    if (!negocio) throw new NotFoundException('Negocio no encontrado.');
    return negocio;
  }

  async actualizar(idNegocio: number, dto: ActualizarNegocioDto) {
    const negocio = await this.buscarUno(idNegocio);
    Object.assign(negocio, dto);
    return this.negocios.save(negocio);
  }

  async eliminar(idNegocio: number) {
    const negocio = await this.buscarUno(idNegocio);
    await this.negocios.remove(negocio);
  }
}
