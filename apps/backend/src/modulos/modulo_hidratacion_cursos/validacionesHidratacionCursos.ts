/**
 * Validaciones Zod para hidratacion de cursos iniciados.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas.js';

export const esquemaHidratacionMultipart = z
  .object({
    periodoId: esquemaObjectId,
    temaId: z.string().trim().min(1).max(128).optional()
  })
  .strict();
