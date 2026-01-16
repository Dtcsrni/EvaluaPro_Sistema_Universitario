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
  });

export const esquemaAsignarMateriaPregunta = z
  .object({
    periodoId: esquemaObjectId
  })
  .strict();

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
  });
