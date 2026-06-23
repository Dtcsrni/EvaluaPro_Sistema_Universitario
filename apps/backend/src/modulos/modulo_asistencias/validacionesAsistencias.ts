/**
 * Validaciones Zod del módulo de asistencias.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

// ─── Sesión ─────────────────────────────────────────────────────────────────
export const esquemaCrearSesion = z
  .object({
    periodoId: esquemaObjectId,
    fecha: z.string().datetime({ offset: true }),
    grupo: z.string().min(1).max(50),
    temaId: z.string().optional(),
    temaNombre: z.string().max(200).optional(),
    observaciones: z.string().max(500).optional(),
    modo: z.enum(['manual', 'qr_automatico']).optional()
  })
  .strict();

export const esquemaActualizarSesion = z
  .object({
    observaciones: z.string().max(500).optional(),
    temaId: z.string().optional(),
    temaNombre: z.string().max(200).optional()
  })
  .strict();

// ─── Registros (pase de lista) ───────────────────────────────────────────────
const esquemaRegistroIndividual = z.object({
  alumnoId: esquemaObjectId,
  estado: z.enum(['P', 'F', 'R', 'J']),
  justificacion: z.string().max(300).optional()
});

export const esquemaGuardarRegistros = z
  .object({
    registros: z.array(esquemaRegistroIndividual).min(1)
  })
  .strict();

// ─── Regla ───────────────────────────────────────────────────────────────────
export const esquemaCrearRegla = z
  .object({
    periodoId: esquemaObjectId,
    grupo: z.string().max(50).nullable().optional(),
    maxFaltas: z.number().int().min(0).max(200),
    accion: z.enum(['bloquear_examen', 'advertir']).optional(),
    excepcionPermitida: z.boolean().optional(),
    contarRetardos: z.boolean().optional(),
    retardosEquivalenFalta: z.number().int().min(2).max(10).optional()
  })
  .strict();

export const esquemaActualizarRegla = z
  .object({
    maxFaltas: z.number().int().min(0).max(200).optional(),
    accion: z.enum(['bloquear_examen', 'advertir']).optional(),
    excepcionPermitida: z.boolean().optional(),
    contarRetardos: z.boolean().optional(),
    retardosEquivalenFalta: z.number().int().min(2).max(10).optional()
  })
  .strict();

// ─── Excepción ───────────────────────────────────────────────────────────────
export const esquemaCrearExcepcion = z
  .object({
    alumnoId: esquemaObjectId,
    periodoId: esquemaObjectId,
    motivo: z.string().max(500).optional()
  })
  .strict();

// ─── Resumen (query params) ───────────────────────────────────────────────────
export const esquemaQueryResumen = z
  .object({
    periodoId: z.string().min(1),
    grupo: z.string().optional()
  })
  .strict();
