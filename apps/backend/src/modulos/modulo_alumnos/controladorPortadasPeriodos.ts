/** Administración de imágenes de portada asociadas a materias. */
import type { Response } from 'express';
import sharp from 'sharp';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';

export const LIMITE_PORTADA_BYTES = 20 * 1024 * 1024;
export const LIMITE_PORTADA_PIXELES = 20_000_000;
const FORMATOS_MIME = new Map([
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp']
]);

async function obtenerPeriodoPropio(req: SolicitudDocente) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.params.periodoId ?? '').trim();
  const periodo = await prisma.periodo.findFirst({ where: { id: periodoId, docenteId } });
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }
  return periodo;
}

export async function obtenerPortadaPeriodo(req: SolicitudDocente, res: Response) {
  const periodo = await obtenerPeriodoPropio(req);
  const portada = await prisma.periodoPortada.findUnique({ where: { periodoId: periodo.id } });
  if (!portada) {
    throw new ErrorAplicacion('PORTADA_NO_ENCONTRADA', 'La materia no tiene portada', 404);
  }

  res.setHeader('Content-Type', portada.mimeType);
  res.setHeader('Content-Length', String(portada.sizeBytes));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(Buffer.from(portada.contenido));
}

export async function guardarPortadaPeriodo(req: SolicitudDocente, res: Response) {
  const periodo = await obtenerPeriodoPropio(req);
  const archivo = req.file;
  if (!archivo) {
    throw new ErrorAplicacion('ARCHIVO_REQUERIDO', 'Selecciona una imagen de portada', 400);
  }
  if (archivo.size > LIMITE_PORTADA_BYTES) {
    throw new ErrorAplicacion('PORTADA_DEMASIADO_GRANDE', 'La imagen no debe superar 20 MiB', 413);
  }

  let normalizada: Buffer;
  let width: number;
  let height: number;
  try {
    const decoder = sharp(archivo.buffer, { failOn: 'error' });
    const metadata = await decoder.metadata();
    const mimeType = metadata.format ? FORMATOS_MIME.get(metadata.format) : undefined;
    if (!mimeType || archivo.mimetype.toLowerCase() !== mimeType) {
      throw new ErrorAplicacion('FORMATO_PORTADA_INVALIDO', 'Usa una imagen JPG/JPEG, PNG o WebP válida', 415);
    }
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > LIMITE_PORTADA_PIXELES) {
      throw new ErrorAplicacion('DIMENSIONES_PORTADA_INVALIDAS', 'La imagen no debe superar 20 megapíxeles', 413);
    }
    if ((metadata.pages ?? 1) > 1) {
      throw new ErrorAplicacion('FORMATO_PORTADA_INVALIDO', 'La portada debe ser una imagen estática', 415);
    }

    const resultado = await sharp(archivo.buffer, { limitInputPixels: LIMITE_PORTADA_PIXELES, failOn: 'error' })
      .rotate()
      .resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    normalizada = resultado.data;
    width = resultado.info.width;
    height = resultado.info.height;
  } catch (error) {
    if (error instanceof ErrorAplicacion) throw error;
    throw new ErrorAplicacion('FORMATO_PORTADA_INVALIDO', 'No se pudo leer la imagen de portada', 400);
  }
  const bytesPersistidos = Uint8Array.from(normalizada);

  await prisma.periodoPortada.upsert({
    where: { periodoId: periodo.id },
    create: {
      periodoId: periodo.id,
      contenido: bytesPersistidos,
      mimeType: 'image/webp',
      sizeBytes: normalizada.byteLength,
      width,
      height
    },
    update: {
      contenido: bytesPersistidos,
      mimeType: 'image/webp',
      sizeBytes: normalizada.byteLength,
      width,
      height
    }
  });

  res.json({ ok: true, mimeType: 'image/webp', sizeBytes: normalizada.byteLength, width, height });
}

export async function eliminarPortadaPeriodo(req: SolicitudDocente, res: Response) {
  const periodo = await obtenerPeriodoPropio(req);
  await prisma.periodoPortada.deleteMany({ where: { periodoId: periodo.id } });
  res.json({ ok: true });
}
