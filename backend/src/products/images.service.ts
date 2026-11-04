/**
 * Almacenamiento de imágenes: archivos en desarrollo y Vercel Blob cuando está
 * configurado.
 * Valida MIME declarado, tamaño y pertenencia de rutas al negocio. Esta validación no
 * inspecciona el contenido binario real de la imagen.
 */

import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class ImagenesService {
  async guardar(imagen: Express.Multer.File, idNegocio: number): Promise<string> {
    const extension = EXTENSIONES[imagen.mimetype];
    if (!extension || imagen.size > 2 * 1024 * 1024) {
      throw new BadRequestException(
        'Las imágenes deben ser JPG, PNG o WebP de hasta 2 MB.',
      );
    }
    const nombre = `${randomUUID()}${extension}`;
    if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
      const blob = await put(`productos/${idNegocio}/${nombre}`, imagen.buffer, {
        access: 'public',
        contentType: imagen.mimetype,
      });
      return blob.url;
    }
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Configurá Vercel Blob para guardar imágenes.',
      );
    }
    const carpeta = join(process.cwd(), 'uploads', 'productos', String(idNegocio));
    await mkdir(carpeta, { recursive: true });
    await writeFile(join(carpeta, nombre), imagen.buffer);
    return `/uploads/productos/${idNegocio}/${nombre}`;
  }

  validar(rutas: string[], idNegocio: number): string[] {
    for (const ruta of rutas) {
      let pathname = ruta;
      if (
        process.env.BLOB_READ_WRITE_TOKEN ||
        process.env.BLOB_STORE_ID ||
        process.env.VERCEL ||
        process.env.NODE_ENV === 'production'
      ) {
        let url: URL;
        try {
          url = new URL(ruta);
        } catch {
          throw new BadRequestException('Imagen inválida.');
        }
        if (
          !process.env.BLOB_PUBLIC_URL ||
          url.origin !== process.env.BLOB_PUBLIC_URL.replace(/\/$/, '') ||
          url.search ||
          url.hash
        ) {
          throw new BadRequestException('Imagen inválida.');
        }
        pathname = url.pathname;
      } else {
        pathname = pathname.replace(/^\/uploads/, '');
      }
      if (
        !new RegExp(`^/productos/${idNegocio}/[a-zA-Z0-9-]+\\.(jpg|png|webp)$`).test(
          pathname,
        )
      ) {
        throw new BadRequestException('La imagen no pertenece a tu negocio.');
      }
    }
    return rutas;
  }
}
