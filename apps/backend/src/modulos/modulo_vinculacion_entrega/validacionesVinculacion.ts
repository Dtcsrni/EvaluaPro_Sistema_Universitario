/**
 * Validaciones de vinculacion de entregas.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

export const esquemaVincularEntrega = z.object({
  examenGeneradoId: esquemaObjectId,
  alumnoId: esquemaObjectId
});

export const esquemaVincularEntregaPorFolio = z.object({
  folio: z.string().min(1),
  alumnoId: esquemaObjectId,
  acordeonEntregado: z.boolean().optional(),
  bonoAcordeon: z.number().min(0).max(0.5).optional()
});

export const esquemaDeshacerEntregaPorFolio = z.object({
  folio: z.string().min(1),
  motivo: z.string().min(3).optional()
});
