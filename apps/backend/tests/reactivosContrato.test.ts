import { describe, expect, it } from 'vitest';
import {
  contentHashReactivo,
  esquemaReactivosBatch,
  parsearJsonlReactivos,
  planHashReactivos,
  validarReactivosBatch
} from '../src/modulos/modulo_banco_preguntas/reactivosContrato.js';

function crearLote() {
  return {
    contract: 'evaluapro.reactivos.batch',
    schemaVersion: 1,
    batchId: 'test-batch-001',
    target: { periodoId: 'periodo-1', temaIds: ['tema-1'] },
    source: {
      kind: 'ai_generated',
      generator: 'ChatGPT',
      generatorModel: 'test',
      generatedAt: '2026-09-19T18:00:00Z',
      sourceDocumentSha256: null
    },
    items: [{
      externalKey: 'reactivo-001',
      itemId: null,
      expectedVersion: null,
      format: 'omr.mcq5',
      stem: { format: 'richtext', value: '¿Cuál es la respuesta?' },
      options: ['A', 'B', 'C', 'D', 'E'].map((key, index) => ({ key, value: `Opción ${key}`, isCorrect: index === 0 })),
      metadata: { difficultyHypothesis: 'medium', tags: ['contrato'] },
      provenance: { origin: 'generated', confidence: 0.9, notes: 'fixture' }
    }]
  };
}

describe('contrato de reactivos IA v1', () => {
  it('valida el lote OMR canónico y produce hashes estables', () => {
    const lote = validarReactivosBatch(crearLote());
    expect(lote.items).toHaveLength(1);
    expect(contentHashReactivo(lote.items[0])).toMatch(/^[a-f0-9]{64}$/);
    expect(planHashReactivos(lote)).toBe(planHashReactivos(JSON.parse(JSON.stringify(lote))));
  });

  it('rechaza opciones no canónicas o más de una respuesta correcta', () => {
    const invalido = crearLote() as any;
    invalido.items[0].options[0].key = 'B';
    invalido.items[0].options[1].isCorrect = true;
    expect(() => validarReactivosBatch(invalido)).toThrowError(/contrato v1/);
  });

  it('rechaza sustitución por nombres y contenido inseguro', () => {
    const invalido = crearLote() as any;
    delete invalido.target.temaIds;
    invalido.items[0].stem.value = '<script>alert(1)</script>';
    expect(() => validarReactivosBatch(invalido)).toThrowError();
  });

  it('rechaza URL remotas en contenido antes de llegar al importador', () => {
    const invalido = crearLote() as any;
    invalido.items[0].options[2].value = 'Consulta https://example.invalid/recurso';
    expect(() => validarReactivosBatch(invalido)).toThrowError(/contrato v1/);
  });

  it('requiere un tema canónico por reactivo cuando un lote combina temas', () => {
    const lote = crearLote() as any;
    lote.target.temaIds = ['tema-1', 'tema-2'];
    expect(esquemaReactivosBatch.safeParse(lote).error?.issues.some((issue) => issue.message.includes('Indica un tema por reactivo'))).toBe(true);
    lote.items[0].temaId = 'tema-ajeno';
    expect(esquemaReactivosBatch.safeParse(lote).error?.issues.some((issue) => issue.message.includes('incluido en target.temaIds'))).toBe(true);
    lote.items[0].temaId = 'tema-2';
    expect(validarReactivosBatch(lote).items[0]?.temaId).toBe('tema-2');
  });

  it('combina JSONL homogéneo y rechaza lotes mezclados', () => {
    const lote = crearLote();
    const linea = JSON.stringify(lote);
    const segundo = crearLote() as any;
    segundo.items[0].externalKey = 'reactivo-002';
    expect(parsearJsonlReactivos(`${linea}\n${JSON.stringify(segundo)}`)).toMatchObject({ batchId: lote.batchId, items: [{ externalKey: 'reactivo-001' }, { externalKey: 'reactivo-002' }] });
    const distinto = { ...lote, batchId: 'otro-batch' };
    expect(() => parsearJsonlReactivos(`${linea}\n${JSON.stringify(distinto)}`)).toThrowError(/compartir batchId/);
  });
});
