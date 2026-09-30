import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Negocio } from '../business/business.entity';
import { Cliente } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    @InjectRepository(Negocio) private readonly negocios: Repository<Negocio>,
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async registrar(dto: RegistroDto) {
    const [emailEnUso, identificacionFiscalEnUso] = await Promise.all([
        this.clientes.exists({ where: { email: dto.email.toLowerCase() } }),
        this.negocios.exists({ where: { identificacionFiscal: dto.negocio.identificacionFiscal } }),
    ]);

    if (emailEnUso) {
        throw new ConflictException('Ya existe una cuenta con ese correo electrónico.');
    }

    if (identificacionFiscalEnUso) {
        throw new ConflictException('Ya existe un negocio con esa identificación fiscal.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      return await this.dataSource.transaction(async manager => {
        const negocios = manager.getRepository(Negocio);
        const clientes = manager.getRepository(Cliente);
        const negocio = await negocios.save(negocios.create(dto.negocio));
        const cliente = await clientes.save(clientes.create({
        email: dto.email.toLowerCase(),
        passwordHash,
        rol: dto.rol,
        idNegocio: negocio.idNegocio,
        }));

        return this.crearSesion(cliente, negocio);
      });
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError.code === '23505') {
        throw new ConflictException('Ya existe una cuenta con ese correo electrónico o un negocio con esa identificación fiscal.');
      }
      throw error;
    }
  }

  async iniciarSesion(dto: LoginDto) {
    const cliente = await this.clientes.createQueryBuilder('cliente')
      .addSelect('cliente.passwordHash').leftJoinAndSelect('cliente.negocio', 'negocio')
      .where('cliente.email = :email', { email: dto.email.toLowerCase() }).getOne();
    if (!cliente || !(await bcrypt.compare(dto.password, cliente.passwordHash))) {
      throw new UnauthorizedException('Correo electrónico o contraseña incorrectos.');
    }
    return this.crearSesion(cliente, cliente.negocio);
  }

  private crearSesion(cliente: Cliente, negocio: Negocio) {
    const accessToken = this.jwt.sign({ sub: cliente.idCliente, idNegocio: cliente.idNegocio, rol: cliente.rol });
    return { accessToken, cliente: { idCliente: cliente.idCliente, email: cliente.email, rol: cliente.rol }, negocio };
  }
}
