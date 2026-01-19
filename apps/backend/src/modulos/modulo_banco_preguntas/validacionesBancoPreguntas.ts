/**
 * Validaciones de banco de preguntas.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

const esquemaOpcion = z
  .object({
    texto: z.string().min(1),
    esCorrecta: z.boolean()
  })
  .strict();

export const esquemaCrearPregunta = z
  .object({
    periodoId: esquemaObjectId,
    tema: z.string().optional(),
    enunciado: z.string().min(1),
    imagenUrl: z.string().url().optional(),
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
    imagenUrl: z.string().url().optional().nullable(),
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
    nombre: z.string().min(1)
  })
  .strict();

export const esquemaActualizarTemaBanco = z
  .object({
    nombre: z.string().min(1)
  })
  .strict();

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
