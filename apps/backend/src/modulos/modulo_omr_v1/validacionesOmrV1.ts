/**
 * validacionesOmrV1
 *
 * Responsabilidad: Contrato de validaciones de entrada/salida del dominio.
 * Limites: No relajar reglas sin actualizar tests y contratos de API.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';
import { configuracion } from '../../configuracion';

export const esquemaCrearOmrScanJob = z
  .object({
    generatedAssessmentId: esquemaObjectId,
    sourceType: z.enum(['pdf', 'image_batch', 'camera_capture']),
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
  })
  .strict();

export const esquemaCrearOmrSheetFamily = z
  .object({
    familyCode: z.string().trim().min(3).max(64),
    displayName: z.string().trim().min(3).max(120),
    status: z.enum(['draft', 'active', 'retired']).default('draft'),
    pageFormat: z.literal('letter').default('letter'),
    questionCapacity: z.number().int().min(1).max(200),
    choiceCountMax: z.number().int().min(2).max(10),
    studentIdDigits: z.number().int().min(0).max(12),
    versionBubbleCount: z.number().int().min(1).max(12),
    supportsPrefill: z.boolean().default(true),
    supportsBlankGeneric: z.boolean().default(true),
    geometryDefaults: z.record(z.string(), z.unknown()),
    printSpec: z.record(z.string(), z.unknown()),
    scanSpec: z.record(z.string(), z.unknown())
  })
  .strict();

export const esquemaCrearOmrSheetRevision = z
  .object({
    revision: z.number().int().positive(),
    geometry: z.record(z.string(), z.unknown()),
    qualityThresholds: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean().optional()
  })
  .strict();

export const esquemaResolverOmrException = z
  .object({
    resolutionReason: z.string().trim().min(3).max(240),
    overrides: z.record(z.string(), z.unknown()).optional(),
    finalResponses: z.array(z.object({ numeroPregunta: z.number().int().positive(), opcion: z.string().trim().max(4).nullable() })).optional(),
    finalIdentity: z.record(z.string(), z.unknown()).optional()
  })
  .strict();
