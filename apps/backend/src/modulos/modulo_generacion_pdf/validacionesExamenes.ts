/**
 * Validaciones de examenes (plantillas y generados).
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

export const esquemaCrearPlantilla = z.object({
  periodoId: esquemaObjectId.optional(),
  tipo: z.enum(['parcial', 'global']),
  titulo: z.string().min(1),
  instrucciones: z.string().optional(),
  totalReactivos: z.number().int().positive(),
  preguntasIds: z.array(esquemaObjectId).optional(),
  temas: z.array(z.string().min(1)).optional(),
  configuracionPdf: z
    .object({
      margenMm: z.number().positive().optional(),
      layout: z.string().optional()
    })
    .strict()
    .optional()
}).superRefine((data, ctx) => {
  const preguntasIds = Array.isArray(data.preguntasIds) ? data.preguntasIds : [];
  const temas = Array.isArray(data.temas) ? data.temas : [];
  if (preguntasIds.length === 0 && temas.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La plantilla debe incluir preguntasIds o temas'
    });
  }
  if (temas.length > 0 && !data.periodoId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'periodoId es obligatorio cuando se usan temas'
    });
  }
});

export const esquemaGenerarExamen = z.object({
  plantillaId: esquemaObjectId,
  alumnoId: esquemaObjectId.optional()
});
