/**
 * Arranque de Nest: prefijo /api, CORS y validación de DTO para todas las rutas.
 * En producción exige configuración explícita; en desarrollo también expone los
 * archivos locales de uploads.
 */

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('Set JWT_SECRET to a random secret of at least 32 characters.');
    }
    if (!process.env.FRONTEND_URL) {
      throw new Error('Set FRONTEND_URL to the frontend production origin.');
    }
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  if (!process.env.VERCEL) {
    app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  }
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
