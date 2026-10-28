/**
 * Validaciones de escaneo OMR.
 */
import { z } from 'zod';
import { configuracion } from '../../configuracion.js';
import { MAX_JOB_PAGES } from './limitesIngestaPdfOmr.js';

export const esquemaAnalizarOmr = z.object({
  folio: z.string().optional(),
  numeroPagina: z.number().int().min(0).optional(),
  imagenBase64: z.string().min(10).max(configuracion.omrImagenBase64MaxChars)
});

export const esquemaPrevalidarLoteOmr = z.object({
  capturas: z
    .array(
      z
        .object({
          nombreArchivo: z.string().trim().min(1).max(200).optional(),
          imagenBase64: z.string().min(10).max(configuracion.omrImagenBase64MaxChars)
        })
        .strict()
    )
    .min(1)
    .max(200)
});

export const esquemaCrearIngestaPdfOmr = z.object({
  generatedAssessmentId: z.string().trim().min(1).max(200),
  clientRequestId: z.string().uuid(),
  sharedFormCopies: z.enum(['true', 'false']).optional()
}).strict();

export const esquemaAsignarAlumnoCopiaOmr = z.object({ studentId: z.string().trim().min(1).max(200) }).strict();

export const esquemaReintentarIngestaOmr = z.object({ clientRequestId: z.string().uuid() }).strict();
export const esquemaCalificarIngestaPdfOmr = z.object({ clientRequestId: z.string().uuid() }).strict();

const esquemaAssessmentIdsMultipart = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}, z.array(z.string().trim().min(1).max(200)).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, 'assessmentIds no debe contener duplicados'));

export const esquemaPrevalidarReferenciaIngestaOmr = z.object({
  assessmentIds: esquemaAssessmentIdsMultipart
}).strict();

export const esquemaResolverPaginaIngestaOmr = z.object({
  generatedAssessmentId: z.string().trim().min(1).max(200).optional(),
  examPage: z.number().int().positive().optional(),
  resolutionReason: z.string().trim().min(1).max(500),
  finalResponses: z.array(z.object({
    numeroPregunta: z.number().int().positive(),
    opcion: z.enum(['A', 'B', 'C', 'D', 'E']).nullable(),
    tipoMarcaManual: z.enum(['valid', 'blank', 'double', 'smudge']),
    selectedOptions: z.array(z.enum(['A', 'B', 'C', 'D', 'E'])).max(5)
  }).strict().superRefine((answer, context) => {
    const options = new Set(answer.selectedOptions);
    if (options.size !== answer.selectedOptions.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedOptions'], message: 'Las opciones marcadas no deben repetirse.' });
    }
    if (answer.tipoMarcaManual === 'valid' && (!answer.opcion || answer.selectedOptions.length !== 1 || answer.selectedOptions[0] !== answer.opcion)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['opcion'], message: 'Una marca válida requiere una sola opción marcada que coincida con la respuesta.' });
    }
    if (answer.tipoMarcaManual === 'blank' && (answer.opcion !== null || answer.selectedOptions.length !== 0)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['tipoMarcaManual'], message: 'Una respuesta en blanco no debe contener opciones.' });
    }
    if (answer.tipoMarcaManual === 'double' && (answer.opcion !== null || answer.selectedOptions.length < 2)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedOptions'], message: 'Una doble marca requiere al menos dos opciones y no tiene una respuesta única.' });
    }
    if (answer.tipoMarcaManual === 'smudge' && answer.opcion !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['opcion'], message: 'Una tachadura o borrón no tiene respuesta única.' });
    }
    if (answer.tipoMarcaManual === 'smudge' && answer.selectedOptions.length !== 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedOptions'], message: 'Una tachadura o borrón no debe registrar opciones como marcas confirmadas.' });
    }
  })).optional(),
  confirmOriginalVisualReview: z.literal(true).optional(),
  confirmBlindOmrReview: z.literal(true).optional()
}).strict().superRefine((value, context) => {
  if (value.finalResponses !== undefined && value.confirmOriginalVisualReview !== true) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmOriginalVisualReview'], message: 'La revisión de respuestas requiere confirmar el cotejo visual con el original.' });
  }
  if (value.confirmBlindOmrReview === true && value.confirmOriginalVisualReview !== true) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmBlindOmrReview'], message: 'La revisión ciega requiere confirmar también el cotejo visual con el original.' });
  }
});

export const esquemaRegistrarVerdadTerrenoOmr = z.object({
  bonusVisible: z.boolean().optional(),
  finalResponses: z.array(z.object({
    numeroPregunta: z.number().int().positive(),
    opcion: z.enum(['A', 'B', 'C', 'D', 'E']).nullable(),
    tipoMarcaManual: z.enum(['valid', 'blank', 'double', 'smudge']),
    selectedOptions: z.array(z.enum(['A', 'B', 'C', 'D', 'E'])).max(5)
  }).strict().superRefine((answer, context) => {
    const options = new Set(answer.selectedOptions);
    if (options.size !== answer.selectedOptions.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedOptions'], message: 'Las opciones marcadas no deben repetirse.' });
    if (answer.tipoMarcaManual === 'valid' && (!answer.opcion || answer.selectedOptions.length !== 1 || answer.selectedOptions[0] !== answer.opcion)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['opcion'], message: 'Una marca válida requiere una sola opción marcada que coincida con la respuesta.' });
    if (answer.tipoMarcaManual === 'blank' && (answer.opcion !== null || answer.selectedOptions.length !== 0)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['tipoMarcaManual'], message: 'Una respuesta en blanco no debe contener opciones.' });
    if (answer.tipoMarcaManual === 'double' && (answer.opcion !== null || answer.selectedOptions.length < 2)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedOptions'], message: 'Una doble marca requiere al menos dos opciones y no tiene una respuesta única.' });
    if (answer.tipoMarcaManual === 'smudge' && (answer.opcion !== null || answer.selectedOptions.length !== 0)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedOptions'], message: 'Una tachadura o borrón no debe registrar opciones como marcas confirmadas.' });
  })).min(1).max(100),
  confirmOriginalVisualReview: z.literal(true),
  confirmBlindOmrReview: z.literal(true)
}).strict();

export const esquemaExportarDatasetIngestaOmr = z.object({
  pageIndexes: z.array(z.number().int().positive().max(MAX_JOB_PAGES)).min(1).max(MAX_JOB_PAGES)
    .refine((indexes) => new Set(indexes).size === indexes.length, 'pageIndexes no debe contener duplicados'),
  confirmarDatosIdentificables: z.literal(true)
}).strict();

const capturaOmr = z
  .object({
    nombreArchivo: z.string().trim().min(1).max(200).optional(),
    imagenBase64: z.string().min(10).max(configuracion.omrImagenBase64MaxChars * 4)
  })
  .strict();

export const esquemaCrearJobOmr = z
  .object({
    generatedAssessmentId: z.string().trim().min(1).max(200),
    clientRequestId: z.string().uuid().optional(),
    sourceType: z.enum(['image_batch', 'camera_capture', 'pdf']),
    capturas: z.array(capturaOmr).min(1).max(200)
  })
  .strict();

export const esquemaListarJobsOmr = z.object({
  generatedAssessmentId: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'finalized', 'pendiente']).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().min(1).max(256).optional()
}).strict();

export const esquemaResolverJobOmr = z
  .object({
    resolutionReason: z.string().trim().min(1).max(500),
    finalIdentity: z.record(z.string(), z.unknown()).optional(),
    finalResponses: z
      .array(
        z
          .object({
            numeroPregunta: z.number().int().positive(),
            opcion: z.string().trim().length(1).nullable()
          })
          .strict()
      )
      .optional(),
    overrides: z.record(z.string(), z.unknown()).optional()
  })
  .strict();
