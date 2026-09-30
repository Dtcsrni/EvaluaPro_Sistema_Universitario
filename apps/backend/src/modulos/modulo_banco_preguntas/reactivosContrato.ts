import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';

const CLAVES_OMR = ['A', 'B', 'C', 'D', 'E'] as const;

const esquemaMetadata = z.object({
  difficultyHypothesis: z.enum(['easy', 'medium', 'hard']).optional(),
  cognitiveLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']).optional(),
  competencies: z.array(z.string().trim().min(1).max(128)).max(32).optional(),
  tags: z.array(z.string().trim().min(1).max(128)).max(32).optional(),
  imageDataUrl: z.string().max(2_000_000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).optional()
}).strict();

const esquemaProcedencia = z.object({
  origin: z.enum(['generated', 'authored', 'imported']),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(2000)
}).strict();

const esquemaOpcionReactivo = z.object({
  key: z.enum(CLAVES_OMR),
  value: z.string().trim().min(1).max(10000),
  isCorrect: z.boolean()
}).strict();

const esquemaItemReactivo = z.object({
  externalKey: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  itemId: z.string().trim().min(1).max(128).nullable(),
  expectedVersion: z.number().int().min(1).nullable(),
  format: z.literal('omr.mcq5'),
  temaId: z.string().trim().min(1).max(128).optional(),
  stem: z.object({
    format: z.literal('richtext'),
    value: z.string().trim().min(1).max(20000)
  }).strict(),
  options: z.array(esquemaOpcionReactivo).length(5),
  metadata: esquemaMetadata,
  provenance: esquemaProcedencia
}).strict();

export const esquemaReactivosBatch = z.object({
  contract: z.literal('evaluapro.reactivos.batch'),
  schemaVersion: z.literal(1),
  batchId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  target: z.object({
    periodoId: z.string().trim().min(1).max(128),
    temaIds: z.array(z.string().trim().min(1).max(128)).min(1).max(32).refine((ids) => new Set(ids).size === ids.length, 'temaIds no debe contener duplicados')
  }).strict(),
  source: z.object({
    kind: z.enum(['ai_generated', 'manual', 'imported']),
    generator: z.string().trim().min(1).max(128),
    generatorModel: z.string().trim().max(128).optional(),
    generatedAt: z.string().datetime({ offset: true }),
    sourceDocumentSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).nullable().optional()
  }).strict(),
  items: z.array(esquemaItemReactivo).min(1).max(500)
}).strict().superRefine((batch, ctx) => {
  const keys = new Set<string>();
  batch.items.forEach((item, index) => {
    if (keys.has(item.externalKey)) {
      ctx.addIssue({ code: 'custom', path: ['items', index, 'externalKey'], message: 'externalKey duplicado en el lote' });
    }
    keys.add(item.externalKey);

    if ((item.itemId === null) !== (item.expectedVersion === null)) {
      ctx.addIssue({ code: 'custom', path: ['items', index], message: 'itemId y expectedVersion deben ser ambos nulos o ambos estar definidos' });
    }

    if (batch.target.temaIds.length > 1 && !item.temaId) {
      ctx.addIssue({ code: 'custom', path: ['items', index, 'temaId'], message: 'Indica un tema por reactivo cuando el lote contiene varios temas' });
    }
    if (item.temaId && !batch.target.temaIds.includes(item.temaId)) {
      ctx.addIssue({ code: 'custom', path: ['items', index, 'temaId'], message: 'El tema del reactivo debe estar incluido en target.temaIds' });
    }


    const optionKeys = item.options.map((option) => option.key);
    if (JSON.stringify(optionKeys) !== JSON.stringify([...CLAVES_OMR])) {
      ctx.addIssue({ code: 'custom', path: ['items', index, 'options'], message: 'Las opciones deben aparecer exactamente en orden A, B, C, D, E' });
    }
    if (item.options.filter((option) => option.isCorrect).length !== 1) {
      ctx.addIssue({ code: 'custom', path: ['items', index, 'options'], message: 'Debe existir exactamente una respuesta correcta' });
    }
    for (const campo of [item.stem.value, ...item.options.map((option) => option.value), item.provenance.notes]) {
      if (/<\s*script\b|<\s*style\b|\bon[a-z]+\s*=|javascript:|https?:\/\//i.test(campo)) {
        ctx.addIssue({ code: 'custom', path: ['items', index], message: 'El contenido contiene HTML o URL externa/insegura' });
        break;
      }
    }
  });
});

export type ReactivosBatch = z.infer<typeof esquemaReactivosBatch>;
export type ReactivoBatchItem = ReactivosBatch['items'][number];

function ordenarClaves(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordenarClaves);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordenarClaves(item)]));
}

export function serializarCanonico(value: unknown): string {
  return JSON.stringify(ordenarClaves(value));
}

export function sha256Texto(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function contentHashReactivo(item: ReactivoBatchItem, temaId?: string): string {
  return sha256Texto(serializarCanonico({
    format: item.format,
    stem: item.stem,
    options: item.options,
    metadata: item.metadata,
    ...(temaId ? { temaId } : {})
  }));
}

export function planHashReactivos(plan: unknown): string {
  return sha256Texto(serializarCanonico(plan));
}

export function validarReactivosBatch(input: unknown): ReactivosBatch {
  const result = esquemaReactivosBatch.safeParse(input);
  if (!result.success) {
    throw new ErrorAplicacion('REACTIVOS_PAYLOAD_INVALIDO', 'El lote de reactivos no cumple el contrato v1', 400, result.error.flatten());
  }
  return result.data;
}

export function parsearJsonlReactivos(texto: string): ReactivosBatch {
  const lineas = texto.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean);
  if (lineas.length === 0) throw new ErrorAplicacion('REACTIVOS_ARCHIVO_VACIO', 'El archivo JSONL no contiene filas', 400);

  const lotes = lineas.map((linea, index) => {
    try {
      return validarReactivosBatch(JSON.parse(linea));
    } catch (error) {
      if (error instanceof ErrorAplicacion) {
        throw new ErrorAplicacion(error.codigo, `JSONL línea ${index + 1}: ${error.message}`, error.estadoHttp, error.detalles);
      }
      throw error;
    }
  });
  const primero = lotes[0];
  for (const lote of lotes.slice(1)) {
    if (lote.batchId !== primero.batchId || serializarCanonico(lote.target) !== serializarCanonico(primero.target) || serializarCanonico(lote.source) !== serializarCanonico(primero.source)) {
      throw new ErrorAplicacion('REACTIVOS_JSONL_MEZCLADO', 'Todas las líneas JSONL deben compartir batchId, target y source', 400);
    }
  }
  const combinado = { ...primero, items: lotes.flatMap((lote) => lote.items) };
  return validarReactivosBatch(combinado);
}

export function parsearArchivoReactivos(buffer: Buffer, nombreArchivo: string): ReactivosBatch {
  const texto = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  if (!texto) throw new ErrorAplicacion('REACTIVOS_ARCHIVO_VACIO', 'El archivo no contiene datos', 400);
  const esJsonl = String(nombreArchivo).toLowerCase().endsWith('.jsonl');
  if (esJsonl) return parsearJsonlReactivos(texto);
  try {
    return validarReactivosBatch(JSON.parse(texto));
  } catch (error) {
    if (error instanceof SyntaxError) throw new ErrorAplicacion('REACTIVOS_JSON_INVALIDO', 'El archivo JSON no es válido', 400);
    throw error;
  }
}

export const esquemaReactivosBatchJson = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://evaluapro.local/contracts/reactivos-batch.v1.schema.json',
  title: 'EvaluaPro Reactivos Batch v1',
  type: 'object',
  additionalProperties: false,
  required: ['contract', 'schemaVersion', 'batchId', 'target', 'source', 'items'],
  properties: {
    contract: { const: 'evaluapro.reactivos.batch' },
    schemaVersion: { const: 1 },
    batchId: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9._:-]+$' },
    target: {
      type: 'object',
      required: ['periodoId', 'temaIds'],
      additionalProperties: false,
      properties: {
        periodoId: { type: 'string', minLength: 1, maxLength: 128 },
        temaIds: { type: 'array', minItems: 1, maxItems: 32, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 128 } }
      }
    },
    source: {
      type: 'object',
      required: ['kind', 'generator', 'generatedAt'],
      additionalProperties: false,
      properties: {
        kind: { enum: ['ai_generated', 'manual', 'imported'] },
        generator: { type: 'string', minLength: 1, maxLength: 128 },
        generatorModel: { type: 'string', maxLength: 128 },
        generatedAt: { type: 'string', format: 'date-time' },
        sourceDocumentSha256: { type: ['string', 'null'], pattern: '^[a-fA-F0-9]{64}$' }
      }
    },
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 500,
      items: {
        type: 'object',
        required: ['externalKey', 'itemId', 'expectedVersion', 'format', 'stem', 'options', 'metadata', 'provenance'],
        additionalProperties: false,
        properties: {
          externalKey: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9._:-]+$' },
          itemId: { type: ['string', 'null'], minLength: 1, maxLength: 128 },
          expectedVersion: { type: ['integer', 'null'], minimum: 1 },
          format: { const: 'omr.mcq5' },
          temaId: { type: 'string', minLength: 1, maxLength: 128 },
          stem: {
            type: 'object',
            required: ['format', 'value'],
            additionalProperties: false,
            properties: { format: { const: 'richtext' }, value: { type: 'string', minLength: 1, maxLength: 20000, pattern: '^(?!.*(?:https?:\\/\\/|javascript:)).*$' } }
          },
          options: {
            type: 'array',
            minItems: 5,
            maxItems: 5,
            prefixItems: [
              { $ref: '#/$defs/optionA' },
              { $ref: '#/$defs/optionB' },
              { $ref: '#/$defs/optionC' },
              { $ref: '#/$defs/optionD' },
              { $ref: '#/$defs/optionE' }
            ],
            items: false,
            contains: { type: 'object', properties: { isCorrect: { const: true } } },
            minContains: 1,
            maxContains: 1
          },
          metadata: {
            type: 'object',
            additionalProperties: false,
            properties: {
              difficultyHypothesis: { enum: ['easy', 'medium', 'hard'] },
              cognitiveLevel: { enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] },
              competencies: { type: 'array', maxItems: 32, items: { type: 'string', minLength: 1, maxLength: 128 } },
              tags: { type: 'array', maxItems: 32, items: { type: 'string', minLength: 1, maxLength: 128 } },
              imageDataUrl: { type: 'string', maxLength: 2000000, pattern: '^data:image\\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' }
            }
          },
          provenance: {
            type: 'object',
            required: ['origin', 'confidence', 'notes'],
            additionalProperties: false,
            properties: {
              origin: { enum: ['generated', 'authored', 'imported'] },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
      notes: { type: 'string', maxLength: 2000, pattern: '^(?!.*(?:https?:\\/\\/|javascript:)).*$' }
            }
          }
        }
      }
    },
    allOf: [{
      if: { properties: { target: { properties: { temaIds: { minItems: 2 } }, required: ['temaIds'] } }, required: ['target'] },
      then: { properties: { items: { items: { required: ['temaId'] } } } }
    }]
  },
  $defs: {
    optionBase: {
      type: 'object',
      additionalProperties: false,
      required: ['key', 'value', 'isCorrect'],
      properties: { key: { type: 'string' }, value: { type: 'string', minLength: 1, maxLength: 10000, pattern: '^(?!.*(?:https?:\\/\\/|javascript:)).*$' }, isCorrect: { type: 'boolean' } }
    },
    optionA: { allOf: [{ $ref: '#/$defs/optionBase' }, { properties: { key: { const: 'A' } } }] },
    optionB: { allOf: [{ $ref: '#/$defs/optionBase' }, { properties: { key: { const: 'B' } } }] },
    optionC: { allOf: [{ $ref: '#/$defs/optionBase' }, { properties: { key: { const: 'C' } } }] },
    optionD: { allOf: [{ $ref: '#/$defs/optionBase' }, { properties: { key: { const: 'D' } } }] },
    optionE: { allOf: [{ $ref: '#/$defs/optionBase' }, { properties: { key: { const: 'E' } } }] }
  }
} as const;
