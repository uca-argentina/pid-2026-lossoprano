/**
 * Arranque de Nest: prefijo /api, CORS y validación de DTO para todas las rutas.
 * En producción exige configuración explícita; en desarrollo también expone los
 * archivos locales de uploads.
 */

// IMPORTS: traen piezas de otras librerías o archivos para usarlas acá.
// ValidationPipe: valida los DTO automáticamente (lo usamos abajo).
import { ValidationPipe } from '@nestjs/common';
// NestFactory: crea la aplicación Nest.
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
// AppModule: el módulo raíz, que junta todos los demás módulos (auth, productos, etc.).
import { AppModule } from './app.module';

// bootstrap = la función que ARRANCA el backend. Es async porque adentro usa await.
async function bootstrap() {
  // Solo en producción (Vercel): exige que existan las variables de entorno. En tu compu (desarrollo) esto no corre.
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('Set JWT_SECRET to a random secret of at least 32 characters.');
    }
    if (!process.env.FRONTEND_URL) {
      throw new Error('Set FRONTEND_URL to the frontend production origin.');
    }
  }
  // Crea la app a partir de AppModule. await = espera a que termine de crearla.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Todas las rutas empiezan con /api. Por eso @Controller('pedidos') queda como /api/pedidos.
  app.setGlobalPrefix('api');
  // CORS: deja que el front (localhost:5173) llame al back (localhost:3000). Sin esto el navegador bloquea los fetch.
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' });
  // Valida TODOS los @Body() con su DTO.
  // whitelist: true → borra del body los campos que no están en el DTO.
  // transform: true → convierte el body en una instancia del DTO (y tipos, ej. '5' → 5 cuando corresponde).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // En local, sirve las imágenes subidas desde la carpeta uploads en la ruta /uploads.
  if (!process.env.VERCEL) {
    app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  }
  // Arranca el servidor en el puerto del .env (PORT) o en 3000 si no hay.
  await app.listen(process.env.PORT ?? 3000);
}
// Ejecuta la función de arranque. void = no espero su resultado.
void bootstrap();
