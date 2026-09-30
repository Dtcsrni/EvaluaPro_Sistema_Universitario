/**
 * Validaciones de vinculacion de entregas.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas.js';

export const esquemaListarEntregas = z.object({
  examenGeneradoId: esquemaObjectId.optional(),
  alumnoId: esquemaObjectId.optional(),
  periodoId: esquemaObjectId.optional(),
  loteId: z.string().trim().min(1).max(100).optional(),
  estado: z.enum(['pendiente', 'entregado']).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/).optional()
}).strict();

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
