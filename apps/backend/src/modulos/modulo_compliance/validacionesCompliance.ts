/**
 * Validaciones para endpoints de cumplimiento.
 */
import { z } from 'zod';

const texto = z.string().trim().min(1).max(200);

export const esquemaCrearDsr = z
  .object({
    tipo: z.enum(['acceso', 'rectificacion', 'cancelacion', 'oposicion']),
    titularRef: texto.max(120),
    scope: texto.max(200),
    status: z.enum(['pendiente', 'en_proceso', 'resuelto', 'rechazado']).optional(),
    resolutionNote: z.string().trim().max(400).optional()
  })
  .strict();

export const esquemaPurgeCompliance = z
  .object({
    dryRun: z.boolean().optional(),
    olderThanDays: z.coerce.number().int().min(1).max(3650).optional()
  })
  .strict();
