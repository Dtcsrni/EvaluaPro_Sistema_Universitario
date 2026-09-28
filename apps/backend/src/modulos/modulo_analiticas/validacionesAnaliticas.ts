/**
 * Validaciones de banderas de revision.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas.js';

export const esquemaCrearBandera = z
  .object({
    examenGeneradoId: esquemaObjectId,
    alumnoId: esquemaObjectId,
    tipo: z.enum(['similitud', 'patron', 'duplicado', 'otro']),
    severidad: z.enum(['baja', 'media', 'alta']).optional(),
    descripcion: z.string().optional(),
    sugerencia: z.string().optional()
  })
  .strict();

const esquemaValorCsv = z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()]);
const esquemaFilaCsv = z
  .record(z.string(), esquemaValorCsv)
  .refine((fila) => Object.keys(fila).length <= 200, { message: 'Demasiadas columnas en fila' });

export const esquemaExportarCsv = z
  .object({
    columnas: z.array(z.string().trim().min(1).max(50)).min(1).max(50),
    filas: z.array(esquemaFilaCsv).max(5000)
  })
  .strict();

export const esquemaGuardarCalificacionesManualesParcial2 = z
  .object({
    periodoId: z.string().trim().min(1).max(128),
    practicaDecimal: z.number().min(0).max(10).nullable(),
    examenDecimal: z.number().min(0).max(5).nullable(),
    bonoGuiaEstudio: z.boolean()
  })
  .strict()
  .superRefine((datos, contexto) => {
    if (datos.bonoGuiaEstudio && datos.examenDecimal === null) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['bonoGuiaEstudio'], message: 'El bono requiere una calificación manual de examen.' });
    }
  });

export const esquemaActualizarFaltanteManualParcial2 = z
  .object({
    periodoId: esquemaObjectId,
    courseId: z.string().trim().min(1).max(128),
    courseWorkId: z.string().trim().min(1).max(128),
    faltante: z.boolean()
  })
  .strict();
