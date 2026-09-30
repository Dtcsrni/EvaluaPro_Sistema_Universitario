/**
 * Validaciones Zod del módulo de temarios.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas.js';

export const esquemaCrearTemarioManual = z
  .object({
    periodoId: esquemaObjectId,
    nombre: z.string().min(1).max(200),
    texto: z.string().min(1)
  })
  .strict();

export const esquemaCrearTemarioPdf = z
  .object({
    periodoId: esquemaObjectId,
    nombre: z.string().max(200).optional()
  })
  .strict();

export const esquemaActualizarTemario = z
  .object({
    nombre: z.string().trim().min(1).max(200),
    texto: z.string().min(1),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    motivoCambio: z.string().trim().min(1).max(500)
  })
  .strict();

export const esquemaEliminarTemario = z
  .object({
    confirmarEliminacion: z.literal(true),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    motivoCambio: z.string().trim().min(1).max(500)
  })
  .strict();

export const esquemaListarAuditoriaTemario = z
  .object({
    limite: z.coerce.number().int().min(1).max(200).default(50),
    cursor: z.string().max(512).optional()
  })
  .strict();

export const esquemaActualizarEstadoNodo = z
  .object({
    estado: z.enum(['pendiente', 'en_progreso', 'cubierto']),
    sesionAsistenciaId: esquemaObjectId.nullable().optional(),
    notas: z.string().max(1000).optional(),
    notes: z.string().max(1000).optional()
  })
  .strict();

export const esquemaBodyVacioOpcional = z.object({}).strict().optional();
