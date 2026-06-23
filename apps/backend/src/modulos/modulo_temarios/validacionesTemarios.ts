/**
 * Validaciones Zod del módulo de temarios.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

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

export const esquemaActualizarEstadoNodo = z
  .object({
    estado: z.enum(['pendiente', 'en_progreso', 'cubierto']),
    sesionAsistenciaId: esquemaObjectId.nullable().optional(),
    notas: z.string().max(1000).optional(),
    notes: z.string().max(1000).optional()
  })
  .strict();

export const esquemaBodyVacioOpcional = z.object({}).strict().optional();
