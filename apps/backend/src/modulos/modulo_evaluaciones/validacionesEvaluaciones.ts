/**
 * validacionesEvaluaciones
 *
 * Responsabilidad: Contrato de validaciones de entrada/salida del dominio.
 * Limites: No relajar reglas sin actualizar tests y contratos de API.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas.js';

const esquemaFecha = z
  .string()
  .trim()
  .datetime({ offset: true })
  .or(z.string().trim().date())
  .transform((value) => new Date(value).toISOString());

export const esquemaListarEvidenciasEvaluacion = z.object({
  periodoId: esquemaObjectId.optional(),
  alumnoId: esquemaObjectId.optional(),
  incluirArchivadas: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
  limite: z.coerce.number().int().min(1).max(400).default(120),
  cursor: z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/).optional()
}).strict();

const grupoPesosGlobales = z.object({ continua: z.number().min(0).max(1), examenes: z.number().min(0).max(1) }).strict();
const grupoPesosExamenes = z.object({ parcial1: z.number().min(0).max(1), parcial2: z.number().min(0).max(1), global: z.number().min(0).max(1) }).strict();
const grupoPesosContinua = z.object({ c1: z.number().min(0).max(1), c2: z.number().min(0).max(1), c3: z.number().min(0).max(1) }).strict();
const grupoPesosComponentes = z.object({ teorico: z.number().min(0).max(1), practicas: z.number().min(0).max(1) }).strict();
const parametrosLisc = z.object({
  pesosGlobales: grupoPesosGlobales.optional(),
  pesosExamenes: grupoPesosExamenes.optional(),
  pesosContinuaCortes: grupoPesosContinua.optional(),
  pesosComponentesExamen: grupoPesosComponentes.optional(),
  umbralAprobacion: z.number().min(0).max(10).optional()
}).strict();
const parametrosSv = z.object({
  pesosExamen: z.object({ global: z.number().min(0).max(1), parciales: z.number().min(0).max(1) }).strict().optional()
}).strict();

export const esquemaCrearPolitica = z
  .object({
    codigo: z.string().trim().regex(/^POLICY_[A-Z][A-Z0-9_]{2,72}$/),
    familia: z.enum(['sv_excel_contract', 'lisc_encuadre']),
    nombre: z.string().trim().min(3).max(120),
    descripcion: z.string().trim().max(400).optional(),
    parametros: z.union([parametrosLisc, parametrosSv]).optional(),
    clientRequestId: z.string().uuid().optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    const esLisc = data.familia === 'lisc_encuadre';
    const parametrosEsSv = Boolean(data.parametros && 'pesosExamen' in data.parametros);
    if (data.parametros && esLisc === parametrosEsSv) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parametros'], message: 'Los parámetros no corresponden a la familia de cálculo.' });
      return;
    }
    const parametrosLiscRecibidos = data.parametros as z.infer<typeof parametrosLisc> | undefined;
    const parametrosSvRecibidos = data.parametros as z.infer<typeof parametrosSv> | undefined;
    const grupos: Array<Record<string, number> | undefined> = esLisc
      ? [parametrosLiscRecibidos?.pesosGlobales, parametrosLiscRecibidos?.pesosExamenes, parametrosLiscRecibidos?.pesosContinuaCortes, parametrosLiscRecibidos?.pesosComponentesExamen]
      : [parametrosSvRecibidos?.pesosExamen];
    for (const grupo of grupos) {
      if (!grupo) continue;
      const suma = Object.values(grupo).reduce((total: number, peso) => total + Number(peso), 0);
      if (Math.abs(suma - 1) > 0.000001) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['parametros'], message: 'Cada grupo de pesos debe sumar 1.' });
        return;
      }
    }
  });

export const esquemaActualizarEvidencia = z.object({
  periodoId: esquemaObjectId,
  alumnoId: esquemaObjectId,
  titulo: z.string().trim().min(3).max(180),
  descripcion: z.string().trim().max(600).optional(),
  calificacionDecimal: z.number().min(0).max(10),
  ponderacion: z.number().min(0).max(10).optional(),
  fechaEvidencia: esquemaFecha.optional(),
  corte: z.number().int().min(1).max(3).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  expectedUpdatedAt: esquemaFecha,
  motivoCambio: z.string().trim().min(3).max(400),
  confirmarEscritura: z.literal(true)
}).strict();

export const esquemaArchivarEvidencia = z.object({
  motivo: z.string().trim().min(3).max(400),
  confirmarEscritura: z.literal(true)
}).strict();

export const esquemaRestaurarEvidencia = z.object({
  motivo: z.string().trim().min(3).max(400),
  confirmarEscritura: z.literal(true)
}).strict();

export const esquemaConfigurarPeriodo = z
  .object({
    periodoId: esquemaObjectId,
    politicaCodigo: z.string().trim().regex(/^POLICY_[A-Z][A-Z0-9_]{2,72}$/),
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
  .strict()
  .superRefine((data, ctx) => {
    const pesos = [data.pesosGlobales, data.pesosExamenes];
    for (const grupo of pesos) {
      if (!grupo) continue;
      const suma = Object.values(grupo).reduce((total, peso) => total + peso, 0);
      if (Math.abs(suma - 1) > 0.000001) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pesosGlobales'], message: 'Cada grupo de pesos debe sumar 1.' });
        return;
      }
    }
  });

export const esquemaCrearEvidencia = z
  .object({
    clientRequestId: z.string().uuid().optional(),
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
