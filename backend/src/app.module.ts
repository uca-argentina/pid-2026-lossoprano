/**
 * Módulo raíz que reúne autenticación, negocios, productos, categorías y sorteos.
 * La conexión PostgreSQL viene de DATABASE_URL. TypeORM sincroniza entidades solo en
 * desarrollo; producción usa migraciones SQL.
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { NegociosModule } from './business/business.module';
import { ProductosModule } from './products/products.module';
import { CategoriasModule } from './categories/categories.module';
import { SorteosModule } from './sweepstakes/sweepstakes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize:
          config.get<string>('NODE_ENV') !== 'production' &&
          !config.get<string>('VERCEL'),
        extra: { max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 },
      }),
    }),
    AuthModule,
    NegociosModule,
    ProductosModule,
    CategoriasModule,
    SorteosModule,
  ],
})
export class AppModule {}
