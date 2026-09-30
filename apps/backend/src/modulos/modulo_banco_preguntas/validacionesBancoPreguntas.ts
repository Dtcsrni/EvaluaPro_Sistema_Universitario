/**
 * Validaciones de banco de preguntas.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas.js';
import { esquemaReactivosBatch } from './reactivosContrato.js';

const esquemaOpcion = z
  .object({
    texto: z.string().min(1),
    esCorrecta: z.boolean()
  })
  .strict();

const regexDataUrlImagen = /^data:image\/(png|jpe?g|webp|gif|bmp|svg\+xml);base64,/i;

const esquemaImagenUrl = z.string().trim().refine((value) => {
  if (value.startsWith('data:')) return regexDataUrlImagen.test(value);
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}, {
  message: 'imagenUrl invalida'
});

export const esquemaCrearPregunta = z
  .object({
    periodoId: esquemaObjectId,
    tema: z.string().optional(),
    enunciado: z.string().min(1),
    imagenUrl: esquemaImagenUrl.optional(),
    opciones: z.array(esquemaOpcion)
  })
  .strict()
  .refine((data) => data.opciones.length === 5, {
    message: 'Se requieren 5 opciones'
  })
  .refine((data) => data.opciones.filter((opcion) => opcion.esCorrecta).length === 1, {
    message: 'Debe existir exactamente 1 opcion correcta'
  })
  .refine((data) => {
    const normalizadas = data.opciones.map((o) => String(o.texto ?? '').trim().replace(/\s+/g, ' ').toLowerCase());
    return new Set(normalizadas).size === normalizadas.length;
  }, {
    message: 'Las opciones no deben repetirse'
  });

export const esquemaActualizarPregunta = z
  .object({
    tema: z.string().optional(),
    enunciado: z.string().min(1).optional(),
    imagenUrl: esquemaImagenUrl.optional().nullable(),
    opciones: z.array(esquemaOpcion).optional()
  })
  .strict()
  .refine((data) => Boolean(data.tema || data.enunciado || data.imagenUrl !== undefined || data.opciones), {
    message: 'Debes enviar al menos un campo a actualizar'
  })
  .refine((data) => !data.opciones || data.opciones.length === 5, {
    message: 'Se requieren 5 opciones'
  })
  .refine((data) => !data.opciones || data.opciones.filter((opcion) => opcion.esCorrecta).length === 1, {
    message: 'Debe existir exactamente 1 opcion correcta'
  })
  .refine((data) => {
    if (!data.opciones) return true;
    const normalizadas = data.opciones.map((o) => String(o.texto ?? '').trim().replace(/\s+/g, ' ').toLowerCase());
    return new Set(normalizadas).size === normalizadas.length;
  }, {
    message: 'Las opciones no deben repetirse'
  });

export const esquemaCrearTemaBanco = z
  .object({
    periodoId: esquemaObjectId,
    nombre: z.string().min(1),
    clientRequestId: z.string().uuid().optional()
  })
  .strict();

export const esquemaActualizarTemaBanco = z
  .object({
    nombre: z.string().min(1),
    clientRequestId: z.string().uuid().optional()
  })
  .strict();

export const esquemaArchivarTemaBanco = z.object({
  clientRequestId: z.string().uuid().optional()
}).strict();

export const esquemaListarAuditoriaTemaBanco = z.object({
  limite: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/).optional()
}).strict();

export const esquemaMoverPreguntasTemaBanco = z
  .object({
    periodoId: esquemaObjectId,
    temaIdDestino: esquemaObjectId,
    preguntasIds: z.array(esquemaObjectId).min(1)
  })
  .strict();

export const esquemaQuitarTemaBanco = z
  .object({
    periodoId: esquemaObjectId,
    preguntasIds: z.array(esquemaObjectId).min(1)
  })
  .strict();

export const esquemaBodyVacioOpcional = z.object({}).strict().optional();

export const esquemaPreviewImportacionReactivos = z.union([
  esquemaReactivosBatch,
  z.object({ payload: esquemaReactivosBatch }).strict(),
  z.object({}).strict()
]);

export const esquemaConfirmarReactivos = z
  .object({
    planHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
    payload: esquemaReactivosBatch.optional()
  })
  .strict();

export const esquemaRegistrarCalibracionReactivo = z
  .object({
    reactivoVersionId: z.string().trim().min(1).max(128),
    cohorteKey: z.string().trim().min(1).max(128),
    calificacionIds: z.array(z.string().trim().min(1).max(128)).min(1).max(500)
      .refine((ids) => new Set(ids).size === ids.length, 'calificacionIds no debe contener duplicados')
  })
  .strict();

export const esquemaListarReactivos = z.object({
  periodoId: z.string().uuid().optional(),
  temaId: z.string().uuid().optional(),
  estado: z.enum(['draft', 'review', 'published', 'retired']).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/).optional()
}).strict();

export const esquemaListarImportacionesReactivos = z.object({
  limite: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().uuid().optional()
}).strict();
