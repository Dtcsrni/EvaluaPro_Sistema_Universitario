/**
 * validacionesClassroom
 *
 * Responsabilidad: Contrato de validaciones de entrada/salida del dominio.
 * Limites: No relajar reglas sin actualizar tests y contratos de API.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

export const esquemaMapearClassroom = z
  .object({
    periodoId: esquemaObjectId,
    courseId: z.string().trim().min(1).max(128),
    courseWorkId: z.string().trim().min(1).max(128),
    tituloEvidencia: z.string().trim().min(1).max(180).optional(),
    descripcionEvidencia: z.string().trim().max(600).optional(),
    ponderacion: z.number().min(0).max(100).optional(),
    corte: z.number().int().min(1).max(3).optional(),
    activo: z.boolean().optional(),
    asignacionesAlumnos: z
      .array(
        z
          .object({
            classroomUserId: z.string().trim().min(1).max(128),
            alumnoId: esquemaObjectId
          })
          .strict()
      )
      .max(300)
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

export const esquemaPullClassroom = z
  .object({
    periodoId: esquemaObjectId,
    courseId: z.string().trim().min(1).max(128).optional(),
    courseWorkId: z.string().trim().min(1).max(128).optional(),
    dryRun: z.boolean().optional(),
    limiteSubmissions: z.number().int().min(1).max(500).optional()
  })
  .strict();

export const esquemaActualizarMapeoAlumnosCurso = z
  .object({
    periodoId: esquemaObjectId,
    asignaciones: z
      .array(
        z
          .object({
            classroomUserId: z.string().trim().min(1).max(128),
            alumnoId: esquemaObjectId.nullable().optional()
          })
          .strict()
      )
      .max(500)
  })
  .strict();

export const esquemaActividadClassroomSeleccionada = z
  .object({
    courseId: z.string().trim().min(1).max(128),
    courseWorkId: z.string().trim().min(1).max(128),
    tituloEvidencia: z.string().trim().min(1).max(180).optional(),
    descripcionEvidencia: z.string().trim().max(600).optional(),
    ponderacion: z.number().min(0).max(100).optional(),
    corte: z.number().int().min(1).max(3).optional(),
    activo: z.boolean().optional()
  })
  .strict();

export const esquemaPreviewImportacionClassroom = z
  .object({
    periodoId: esquemaObjectId,
    actividades: z.array(esquemaActividadClassroomSeleccionada).min(1).max(100),
    limiteSubmissions: z.number().int().min(1).max(500).optional()
  })
  .strict();

export const esquemaEjecutarImportacionClassroom = esquemaPreviewImportacionClassroom;
