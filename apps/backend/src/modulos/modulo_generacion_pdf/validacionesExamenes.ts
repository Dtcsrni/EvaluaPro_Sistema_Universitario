/**
 * Validaciones de examenes (plantillas y generados).
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

const normalizarTexto = (valor: string) => valor.trim().replace(/\s+/g, ' ');
const esquemaTitulo = z.string().trim().min(3).max(120).transform(normalizarTexto);
const esquemaInstrucciones = z.string().trim().max(2000).transform(normalizarTexto);
const esquemaTema = z.string().trim().min(1).max(80).transform(normalizarTexto);
const esquemaBookletConfig = z
  .object({
    targetPages: z.number().int().positive().max(50).optional(),
    densityMode: z.enum(['balanced', 'compact', 'relaxed']).optional(),
    allowImages: z.boolean().optional(),
    imageBudgetPolicy: z.enum(['strict', 'balanced']).optional(),
    headerStyle: z.enum(['institutional', 'compact']).optional(),
    fontScale: z.number().min(0.8).max(1.3).optional(),
    lineSpacing: z.number().min(0.9).max(1.6).optional(),
    separateCoverPage: z.boolean().optional()
  })
  .strict();
const esquemaOmrConfig = z
  .object({
    sheetFamilyCode: z.enum(['S20_5A_BASIC', 'S50_5A_ID5_VR6', 'S100_5A_ID9_VR6_2P', 'CUSTOM_SCHEMA_V1']).optional(),
    sheetRevisionId: z.string().trim().max(120).optional(),
    prefillMode: z.enum(['none', 'roster', 'per-student']).optional(),
    identityMode: z.enum(['qr_plus_bubbled_id']).optional(),
    allowBlankGenericSheets: z.boolean().optional(),
    versionMode: z.enum(['single', 'multi_version']).optional(),
    ignoreUnusedTrailingQuestions: z.boolean().optional(),
    captureMode: z.enum(['pdf_and_mobile']).optional()
  })
  .strict();

/**
 * Garantiza unicidad semántica de IDs dentro del mismo payload.
 */
function validarIdsUnicos(ids: string[], ctx: z.RefinementCtx, etiqueta: string) {
  const vistos = new Set<string>();
  for (const id of ids) {
    if (vistos.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `No repitas ${etiqueta}`
      });
      return;
    }
    vistos.add(id);
  }
}

/**
 * Garantiza unicidad case-insensitive para campos de texto (ej. temas).
 */
function validarTextosUnicos(valores: string[], ctx: z.RefinementCtx, etiqueta: string) {
  const vistos = new Set<string>();
  for (const valor of valores) {
    const clave = normalizarTexto(valor).toLowerCase();
    if (vistos.has(clave)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `No repitas ${etiqueta}`
      });
      return;
    }
    vistos.add(clave);
  }
}

/**
 * Contrato de alta de plantilla:
 * - Permite selección explícita de preguntas o selección por temas.
 * - Si usa temas, exige periodo para resolver banco de preguntas.
 */
export const esquemaCrearPlantilla = z
  .object({
    periodoId: esquemaObjectId.optional(),
    tipo: z.enum(['parcial', 'global']),
    titulo: esquemaTitulo,
    instrucciones: esquemaInstrucciones.optional(),
    numeroPaginas: z.number().int().positive().max(50),
    reactivosObjetivo: z.number().int().positive().max(200).optional(),
    defaultVersionCount: z.number().int().positive().max(12).optional(),
    answerKeyMode: z.enum(['digital', 'scan_sheet']).optional(),
    preguntasIds: z.array(esquemaObjectId).optional(),
    temas: z.array(esquemaTema).max(50).optional(),
    bookletConfig: esquemaBookletConfig.optional(),
    omrConfig: esquemaOmrConfig.optional(),
    configuracionPdf: z
      .object({
        margenMm: z.number().positive().max(40).optional(),
        layout: z.string().trim().min(1).max(40).optional()
      })
      .strict()
      .optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    const preguntasIds = Array.isArray(data.preguntasIds) ? data.preguntasIds : [];
    const temas = Array.isArray(data.temas) ? data.temas : [];
    if (preguntasIds.length === 0 && temas.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La plantilla debe incluir preguntasIds o temas'
      });
    }
    if (temas.length > 0 && !data.periodoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'periodoId es obligatorio cuando se usan temas'
      });
    }
    if (preguntasIds.length > 0) {
      validarIdsUnicos(preguntasIds, ctx, 'preguntasIds');
    }
    if (temas.length > 0) {
      validarTextosUnicos(temas, ctx, 'temas');
    }
  });

export const esquemaGenerarExamen = z.object({
  plantillaId: esquemaObjectId
});

/**
 * Lote masivo para una plantilla ya validada.
 */
export const esquemaGenerarExamenesLote = z.object({
  plantillaId: esquemaObjectId,
  confirmarMasivo: z.boolean().optional(),
  loteId: z.string().trim().min(4).max(16).regex(/^[A-Za-z0-9_-]+$/).optional()
});

export const esquemaRegenerarExamenGenerado = z
  .object({
    // Si el examen ya fue descargado, se requiere confirmación explícita.
    forzar: z.boolean().optional()
  })
  .strict();

export const esquemaPurgarExamenesGenerados = z
  .object({
    dryRun: z.boolean().optional(),
    olderThanDays: z.number().int().positive().max(3650).optional(),
    scope: z.enum(['ttl', 'all']).optional()
  })
  .strict();

export const esquemaActualizarPlantilla = z
  .object({
    periodoId: esquemaObjectId.optional(),
    tipo: z.enum(['parcial', 'global']).optional(),
    titulo: esquemaTitulo.optional(),
    instrucciones: esquemaInstrucciones.optional(),
    numeroPaginas: z.number().int().positive().max(50).optional(),
    reactivosObjetivo: z.number().int().positive().max(200).optional(),
    defaultVersionCount: z.number().int().positive().max(12).optional(),
    answerKeyMode: z.enum(['digital', 'scan_sheet']).optional(),
    preguntasIds: z.array(esquemaObjectId).optional(),
    temas: z.array(esquemaTema).max(50).optional(),
    bookletConfig: esquemaBookletConfig.optional(),
    omrConfig: esquemaOmrConfig.optional(),
    configuracionPdf: z
      .object({
        margenMm: z.number().positive().max(40).optional(),
        layout: z.string().trim().min(1).max(40).optional()
      })
      .strict()
      .optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Array.isArray(data.preguntasIds) && data.preguntasIds.length > 0) {
      validarIdsUnicos(data.preguntasIds, ctx, 'preguntasIds');
    }
    if (Array.isArray(data.temas) && data.temas.length > 0) {
      validarTextosUnicos(data.temas, ctx, 'temas');
    }
  });

export const esquemaBodyVacioOpcional = z.object({}).strict().optional();
