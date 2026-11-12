/**
 * Registro e inicio de sesión. Guarda hashes bcrypt, nunca la contraseña original.
 * El registro crea negocio y cliente en una única transacción. El JWT identifica
 * cliente, negocio y rol para futuras solicitudes.
 */

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
// SERVICE de login y registro. Lo llama auth.controller.ts.
export class AuthService {
  constructor(
    // Repositorios de las tablas cliente (usuario) y negocio. JwtService = firma tokens.
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    @InjectRepository(Negocio) private readonly negocios: Repository<Negocio>,
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Comprueba duplicados, calcula el hash de contraseña y crea negocio/cuenta
   * atómicamente. También traduce conflictos de unicidad causados por registros
   * simultáneos.
   */
  // REGISTRO. Lo llama auth.controller.registrar(dto). dto = body del front (api.registrar en api.ts).
  async registrar(dto: RegistroDto) {
    // Promise.all = hace las dos consultas a la vez. exists = true/false si hay alguna fila con ese where.
    const [emailEnUso, identificacionFiscalEnUso] = await Promise.all([
      this.clientes.exists({ where: { email: dto.email.toLowerCase() } }),
      this.negocios.exists({
        where: { identificacionFiscal: dto.negocio.identificacionFiscal },
      }),
    ]);

    if (emailEnUso) {
      throw new ConflictException('Ya existe una cuenta con ese correo electrónico.');
    }

    if (identificacionFiscalEnUso) {
      throw new ConflictException('Ya existe un negocio con esa identificación fiscal.');
    }

    // Nunca se guarda la contraseña: se guarda un hash (bcrypt).
    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const negocios = manager.getRepository(Negocio);
        const clientes = manager.getRepository(Cliente);
        // Crea el negocio (save sin id = crear) y después el cliente con el idNegocio nuevo.
        const negocio = await negocios.save(negocios.create(dto.negocio));
        const cliente = await clientes.save(
          clientes.create({
            email: dto.email.toLowerCase(),
            passwordHash,
            rol: dto.rol,
            idNegocio: negocio.idNegocio,
          }),
        );

        // Devuelve la sesión (token incluido) → el front la guarda (guardarSesion en App.tsx).
        return this.crearSesion(cliente, negocio);
      });
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError.code === '23505') {
        throw new ConflictException(
          'Ya existe una cuenta con ese correo electrónico o un negocio con esa identificación fiscal.',
        );
      }
      throw error;
    }
  }

  /**
   * Selecciona explícitamente el hash oculto por defecto y lo compara con bcrypt. Ante
   * cualquier credencial inválida devuelve el mismo error.
   */
  // LOGIN. Lo llama auth.controller.iniciarSesion(dto). dto = { email, password } del front.
  async iniciarSesion(dto: LoginDto) {
    const cliente = await this.clientes
      .createQueryBuilder('cliente')
      .addSelect('cliente.passwordHash')
      .leftJoinAndSelect('cliente.negocio', 'negocio')
      .where('cliente.email = :email', { email: dto.email.toLowerCase() })
      .getOne();
    // Si no existe el email o la contraseña no coincide → 401 (mismo mensaje para no dar pistas).
    if (!cliente || !(await bcrypt.compare(dto.password, cliente.passwordHash))) {
      throw new UnauthorizedException('Correo electrónico o contraseña incorrectos.');
    }
    return this.crearSesion(cliente, cliente.negocio);
  }

  /**
   * Firma la identidad mínima y devuelve la sesión sin incluir contraseña ni hash.
   */
  // ACÁ SE CREA EL TOKEN.
  private crearSesion(cliente: Cliente, negocio: Negocio) {
    // jwt.sign mete adentro del token: sub (id del usuario), idNegocio y rol.
    // Esto es lo que después aparece en req.user de TODOS los controllers (JwtStrategy.validate lo devuelve).
    const accessToken = this.jwt.sign({
      sub: cliente.idCliente,
      idNegocio: cliente.idNegocio,
      rol: cliente.rol,
    });
    // Lo que recibe el front: { accessToken, cliente, negocio } = el type Sesion de api.ts.
    return {
      accessToken,
      cliente: { idCliente: cliente.idCliente, email: cliente.email, rol: cliente.rol },
      negocio,
    };
  }
}
