/**
 * flujoExamen.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas del flujo completo de examen.
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

describe('flujo de examen', () => {
  const preguntasPorEscenario = 20;
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  async function registrarDocente() {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@prueba.test',
        contrasena: 'Secreto123!'
      })
      .expect(201);
    return respuesta.body.token as string;
  }

  async function crearPreguntasCanonicas(auth: { Authorization: string }, periodoId: string) {
    const temaResp = await request(app)
      .post('/api/banco-preguntas/temas')
      .set(auth)
      .send({ periodoId, nombre: 'Flujo de examen' })
      .expect(201);
    const temaId = String(temaResp.body.tema._id);
    const sufijo = Date.now();
    const lote = {
      contract: 'evaluapro.reactivos.batch',
      schemaVersion: 1,
      batchId: `flujo-examen-${sufijo}`,
      target: { periodoId, temaIds: [temaId] },
      source: {
        kind: 'manual',
        generator: 'integracion-backend',
        generatedAt: '2026-09-24T00:00:00Z',
        sourceDocumentSha256: null
      },
      items: Array.from({ length: preguntasPorEscenario }, (_, index) => ({
        externalKey: `flujo-examen-${sufijo}-${index + 1}`,
        itemId: null,
        expectedVersion: null,
        format: 'omr.mcq5',
        stem: { format: 'richtext', value: `Pregunta ${index + 1}` },
        options: ['A', 'B', 'C', 'D', 'E'].map((key, optionIndex) => ({
          key,
          value: `Opcion ${key}`,
          isCorrect: optionIndex === 0
        })),
        metadata: { difficultyHypothesis: 'medium' },
        provenance: { origin: 'authored', confidence: 1, notes: 'fixture de flujo de examen' }
      }))
    };
    const preview = await request(app)
      .post('/api/banco-preguntas/importaciones/preview')
      .set(auth)
      .send(lote)
      .expect(200);
    const confirmado = await request(app)
      .post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`)
      .set(auth)
      .send({ planHash: preview.body.planHash, payload: lote })
      .expect(200);
    const preguntasIds: string[] = [];
    for (const reactivoId of confirmado.body.reactivoIds as string[]) {
      await request(app)
        .post(`/api/banco-preguntas/reactivos/${reactivoId}/revisar`)
        .set(auth)
        .send({})
        .expect(200);
      const publicado = await request(app)
        .post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`)
        .set(auth)
        .send({})
        .expect(200);
      preguntasIds.push(String(publicado.body.legacyPreguntaId));
    }
    return preguntasIds;
  }

  it('crea periodo, alumno, banco, plantilla, examen, vincula y califica', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };

    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Periodo 2025',
        fechaInicio: '2025-01-01',
        fechaFin: '2025-06-01',
        grupos: ['A']
      })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;

    const alumnoResp = await request(app)
      .post('/api/alumnos')
      .set(auth)
      .send({
        periodoId,
        matricula: 'CUH512410168',
        nombreCompleto: 'Alumno Prueba',
        correo: 'alumno@prueba.test',
        grupo: 'A'
      })
      .expect(201);
    const alumnoId = alumnoResp.body.alumno._id as string;

    const preguntasIds = await crearPreguntasCanonicas(auth, periodoId);

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial 1',
        numeroPaginas: 2,
        preguntasIds
      })
      .expect(201);
    const plantillaId = plantillaResp.body.plantilla._id as string;

    await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`)
      .set(auth)
      .expect(200);

    const examenResp = await request(app)
      .post('/api/examenes/generados')
      .set(auth)
      .send({ plantillaId })
      .expect(201);
    const examenId = examenResp.body.examenGenerado._id as string;
    const folio = examenResp.body.examenGenerado.folio as string;
    const totalReactivosExamen = Array.isArray(examenResp.body.examenGenerado.preguntasIds)
      ? examenResp.body.examenGenerado.preguntasIds.length
      : 1;

    await request(app)
      .post('/api/entregas/vincular-folio')
      .set(auth)
      .send({ folio, alumnoId })
      .expect(201);

    const calificacionResp = await request(app)
      .post('/api/calificaciones/calificar')
      .set(auth)
      .send({
        examenGeneradoId: examenId,
        alumnoId,
        aciertos: totalReactivosExamen,
        totalReactivos: totalReactivosExamen,
        bonoSolicitado: 0.5,
        evaluacionContinua: 5
      })
      .expect(201);
    expect(calificacionResp.body.calificacion.calificacionExamenFinalTexto).toBe('5');
    expect(calificacionResp.body.calificacion.calificacionParcialTexto).toBe('10');

    const pdfResp = await request(app)
      .get(`/api/examenes/generados/${examenId}/pdf`)
      .set(auth)
      .expect(200);
    expect(pdfResp.header['content-type']).toContain('application/pdf');

    const csvResp = await request(app)
      .get(`/api/analiticas/calificaciones-csv?periodoId=${periodoId}`)
      .set(auth)
      .expect(200);
    expect(csvResp.text).toContain('matricula,nombre,grupo,parcial1,parcial2,global,final,banderas');

    const xlsxResp = await request(app)
      .get(`/api/analiticas/calificaciones-xlsx?periodoId=${periodoId}`)
      .set(auth)
      .expect(200);
    expect(xlsxResp.header['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(String(xlsxResp.header['content-disposition'] ?? '')).toContain('calificaciones-produccion.xlsx');
  });
});
