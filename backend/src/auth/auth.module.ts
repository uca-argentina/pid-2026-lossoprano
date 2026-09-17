import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Negocio } from '../business/business.entity';
import { Cliente } from '../users/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cliente, Negocio]),
    PassportModule,
    JwtModule.registerAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET', 'development-secret'), signOptions: { expiresIn: '8h' } }) }),
  ],
  controllers: [AuthController], providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
