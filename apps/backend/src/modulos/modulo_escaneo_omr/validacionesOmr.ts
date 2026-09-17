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

const capturaOmr = z
  .object({
    nombreArchivo: z.string().trim().min(1).max(200).optional(),
    imagenBase64: z.string().min(10).max(configuracion.omrImagenBase64MaxChars * 4)
  })
  .strict();

export const esquemaCrearJobOmr = z
  .object({
    generatedAssessmentId: z.string().trim().min(1).max(200),
    sourceType: z.enum(['image_batch', 'camera_capture', 'pdf']),
    capturas: z.array(capturaOmr).min(1).max(200)
  })
  .strict();

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
