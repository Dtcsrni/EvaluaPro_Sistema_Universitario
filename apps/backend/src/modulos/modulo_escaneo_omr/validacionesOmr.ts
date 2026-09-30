/**
 * Validaciones de escaneo OMR.
 */
import { z } from 'zod';
import { configuracion } from '../../configuracion.js';

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
  clientRequestId: z.string().uuid()
}).strict();

export const esquemaReintentarIngestaOmr = z.object({ clientRequestId: z.string().uuid() }).strict();

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
  finalResponses: z.array(z.object({ numeroPregunta: z.number().int().positive(), opcion: z.string().trim().length(1).nullable() }).strict()).optional()
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
