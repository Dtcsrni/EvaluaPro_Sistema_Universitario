/**
 * Validaciones de eventos de uso (telemetria ligera).
 */
import { z } from 'zod';

const esquemaMetaPrimitivo = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null()
]);

const esquemaMetaObjeto = z
  .record(z.string().trim().min(1).max(50), esquemaMetaPrimitivo)
  .refine((obj) => Object.keys(obj).length <= 50, { message: 'Meta demasiado grande' });

const esquemaMeta = z.union([
  esquemaMetaPrimitivo,
  z.array(esquemaMetaPrimitivo).max(50),
  esquemaMetaObjeto
]);

const esquemaEventoUso = z
  .object({
  sessionId: z.string().min(1).max(200).optional(),
  pantalla: z.string().min(1).max(200).optional(),
  accion: z.string().min(1).max(200),
  exito: z.boolean().optional(),
  duracionMs: z.number().int().nonnegative().max(10 * 60 * 1000).optional(),
  meta: esquemaMeta.optional()
  })
  .strict();

export const esquemaRegistrarEventosUso = z
  .object({
    eventos: z.array(esquemaEventoUso).min(1).max(100)
  })
  .strict();
