/**
 * Validaciones de banderas de revision.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

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
