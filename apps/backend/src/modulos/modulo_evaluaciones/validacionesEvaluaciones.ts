/**
 * validacionesEvaluaciones
 *
 * Responsabilidad: Contrato de validaciones de entrada/salida del dominio.
 * Limites: No relajar reglas sin actualizar tests y contratos de API.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

const esquemaFecha = z
  .string()
  .trim()
  .datetime({ offset: true })
  .or(z.string().trim().date())
  .transform((value) => new Date(value).toISOString());

export const esquemaCrearPolitica = z
  .object({
    codigo: z.enum(['POLICY_SV_EXCEL_2026', 'POLICY_LISC_ENCUADRE_2026']),
    version: z.number().int().min(1),
    nombre: z.string().trim().min(3).max(120),
    descripcion: z.string().trim().max(400).optional(),
    activa: z.boolean().optional(),
    parametros: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

export const esquemaConfigurarPeriodo = z
  .object({
    periodoId: esquemaObjectId,
    politicaCodigo: z.enum(['POLICY_SV_EXCEL_2026', 'POLICY_LISC_ENCUADRE_2026']),
    politicaVersion: z.number().int().min(1).optional(),
    cortes: z
      .array(
        z
          .object({
            numero: z.number().int().min(1).max(3),
            nombre: z.string().trim().min(1).max(120).optional(),
            fechaCorte: esquemaFecha,
            pesoContinua: z.number().min(0).max(1).optional(),
            pesoExamen: z.number().min(0).max(1).optional(),
            pesoBloqueExamenes: z.number().min(0).max(1).optional()
          })
          .strict()
      )
      .max(3)
      .optional(),
    pesosGlobales: z
      .object({
        continua: z.number().min(0).max(1),
        examenes: z.number().min(0).max(1)
      })
      .strict()
      .optional(),
    pesosExamenes: z
      .object({
        parcial1: z.number().min(0).max(1),
        parcial2: z.number().min(0).max(1),
        global: z.number().min(0).max(1)
      })
      .strict()
      .optional(),
    reglasCierre: z
      .object({
        requiereTeorico: z.boolean().optional(),
        requierePractica: z.boolean().optional(),
        requiereContinuaMinima: z.boolean().optional(),
        continuaMinima: z.number().min(0).max(10).optional()
      })
      .strict()
      .optional(),
    activo: z.boolean().optional()
  })
  .strict();

export const esquemaCrearEvidencia = z
  .object({
    periodoId: esquemaObjectId,
    alumnoId: esquemaObjectId,
    titulo: z.string().trim().min(3).max(180),
    descripcion: z.string().trim().max(600).optional(),
    calificacionDecimal: z.number().min(0).max(10).optional(),
    ponderacion: z.number().min(0).max(10).optional(),
    fechaEvidencia: esquemaFecha.optional(),
    corte: z.number().int().min(1).max(3).optional(),
    fuente: z.enum(['manual', 'classroom']).optional(),
    estadoCaptura: z.enum(['pendiente', 'calificada']).optional(),
    classroom: z
      .object({
        courseId: z.string().trim().min(1).max(128).optional(),
        courseWorkId: z.string().trim().min(1).max(128).optional(),
        submissionId: z.string().trim().min(1).max(128).optional(),
        classroomUserId: z.string().trim().min(1).max(128).optional(),
        pulledAt: esquemaFecha.optional(),
        submissionState: z.string().trim().min(1).max(64).optional(),
        assignedGrade: z.number().optional(),
        draftGrade: z.number().optional(),
        maxPoints: z.number().optional(),
        updateTime: esquemaFecha.optional(),
        courseName: z.string().trim().min(1).max(180).optional(),
        courseWorkTitle: z.string().trim().min(1).max(180).optional()
      })
      .strict()
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    const fuente = data.fuente ?? 'manual';
    const estadoCaptura = data.estadoCaptura ?? 'calificada';
    if (fuente === 'manual' && typeof data.calificacionDecimal !== 'number') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['calificacionDecimal'],
        message: 'calificacionDecimal es requerida para evidencias manuales.'
      });
      return;
    }
    if (fuente === 'classroom' && estadoCaptura === 'calificada' && typeof data.calificacionDecimal !== 'number') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['calificacionDecimal'],
        message: 'calificacionDecimal es requerida cuando la evidencia Classroom ya esta calificada.'
      });
    }
  });

export const esquemaComponenteExamen = z
  .object({
    periodoId: esquemaObjectId,
    alumnoId: esquemaObjectId,
    corte: z.enum(['parcial1', 'parcial2', 'global']),
    teoricoDecimal: z.number().min(0).max(10),
    practicas: z.array(z.number().min(0).max(10)).max(20).optional(),
    origen: z.enum(['manual', 'omr']).optional(),
    examenGeneradoId: esquemaObjectId.optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

export const esquemaInicializarEncuadre = z
  .object({
    periodoId: esquemaObjectId,
    carrera: z.string().trim().min(1).optional(),
    clave: z.string().trim().min(1).optional(),
    area: z.string().trim().optional(),
    horasDocente: z.number().int().min(0).optional(),
    horasIndependientes: z.number().int().min(0).optional(),
    horasTotales: z.number().int().min(0).optional(),
    creditos: z.number().min(0).optional(),
    objetivoGeneral: z.string().trim().optional(),
    cicloLectivo: z.string().trim().optional(),
    institucionNombre: z.string().trim().optional(),
    institucionLema: z.string().trim().optional(),
    logoBase64: z.string().trim().optional(),
    logoCarreraBase64: z.string().trim().optional(),
    porcentajeExamenes: z.number().min(0).max(100).optional(),
    porcentajeEvalContinua: z.number().min(0).max(100).optional(),
    ponderacion1erParcial: z.number().min(0).max(100).optional(),
    ponderacion2doParcial: z.number().min(0).max(100).optional(),
    ponderacionGlobal: z.number().min(0).max(100).optional(),
    ponderacionExamenEscrito: z.number().min(0).max(100).optional(),
    ponderacionPractica: z.number().min(0).max(100).optional(),
    ejeFormacion: z.string().trim().optional()
  })
  .strict();
