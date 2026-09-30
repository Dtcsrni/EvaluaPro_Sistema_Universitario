import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';

export async function crearPreguntasPublicadas(params: {
  app: Express;
  auth: { Authorization: string };
  periodoId: string;
  externalPrefix: string;
  preguntas: string[];
}) {
  const loteId = randomUUID();
  const temaResp = await request(params.app)
    .post('/api/banco-preguntas/temas')
    .set(params.auth)
    .send({ periodoId: params.periodoId, nombre: `Tema ${params.externalPrefix}` })
    .expect(201);
  const temaId = String(temaResp.body.tema._id);
  const lote = {
    contract: 'evaluapro.reactivos.batch',
    schemaVersion: 1,
    batchId: loteId,
    target: { periodoId: params.periodoId, temaIds: [temaId] },
    source: { kind: 'manual', generator: 'backend-integration-test', generatedAt: new Date().toISOString() },
    items: params.preguntas.map((enunciado, indice) => ({
      externalKey: `${params.externalPrefix}-${indice + 1}`,
      itemId: null,
      expectedVersion: null,
      format: 'omr.mcq5',
      stem: { format: 'richtext', value: enunciado },
      options: ['A', 'B', 'C', 'D', 'E'].map((key, optionIndex) => ({
        key,
        value: `Opción ${key}`,
        isCorrect: optionIndex === 0
      })),
      metadata: { difficultyHypothesis: 'medium' },
      provenance: { origin: 'authored', confidence: 1, notes: 'Fixture de integración' }
    }))
  };

  const preview = await request(params.app)
    .post('/api/banco-preguntas/importaciones/preview')
    .set(params.auth)
    .send(lote)
    .expect(200);
  const confirmacion = await request(params.app)
    .post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`)
    .set(params.auth)
    .send({ planHash: preview.body.planHash, payload: lote })
    .expect(200);

  const preguntasIds: string[] = [];
  for (const reactivoId of confirmacion.body.reactivoIds as string[]) {
    await request(params.app)
      .post(`/api/banco-preguntas/reactivos/${reactivoId}/revisar`)
      .set(params.auth)
      .send({})
      .expect(200);
    const publicado = await request(params.app)
      .post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`)
      .set(params.auth)
      .send({})
      .expect(200);
    preguntasIds.push(String(publicado.body.legacyPreguntaId));
  }
  return preguntasIds;
}
