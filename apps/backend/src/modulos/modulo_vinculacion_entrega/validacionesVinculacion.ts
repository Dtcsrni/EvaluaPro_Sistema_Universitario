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
  alumnoId: esquemaObjectId
});

export const esquemaDeshacerEntregaPorFolio = z.object({
  folio: z.string().min(1),
  motivo: z.string().min(3).optional()
});
