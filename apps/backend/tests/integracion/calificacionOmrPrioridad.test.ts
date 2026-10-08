/**
 * calificacionOmrPrioridad.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

describe('calificacion OMR prioriza respuestas detectadas', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarSqliteTest();
  });

  beforeEach(async () => {
    await limpiarSqliteTest();
  });

  afterAll(async () => {
    await cerrarSqliteTest();
  });

  async function registrarDocente() {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Prueba',
        correo: 'docente-prioridad-omr@cuh.mx',
        contrasena: 'Secreto123!'
      })
      .expect(201);
    return respuesta.body.token as string;
  }

  it.each(['sin_marca', 'doble_marca'] as const)(
    'califica una marca vacía legible y bloquea %s hasta revisión humana',
    async (estadoRespuesta) => {
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
        correo: 'alumno-prioridad-omr@cuh.mx',
        grupo: 'A'
      })
      .expect(201);
    const alumnoId = alumnoResp.body.alumno._id as string;

    const temaResp = await request(app)
      .post('/api/banco-preguntas/temas')
      .set(auth)
      .send({ periodoId, nombre: 'Tema OMR prioridad' })
      .expect(201);
    const temaId = temaResp.body.tema._id as string;
    const loteReactivos = {
      contract: 'evaluapro.reactivos.batch',
      schemaVersion: 1,
      batchId: 'calificacion-omr-prioridad',
      target: { periodoId, temaIds: [temaId] },
      source: { kind: 'manual', generator: 'integracion-backend', generatedAt: new Date().toISOString() },
      items: Array.from({ length: 5 }, (_, indice) => ({
        externalKey: `omr-prioridad-${indice + 1}`,
        itemId: null,
        expectedVersion: null,
        format: 'omr.mcq5',
        stem: { format: 'richtext', value: `En una lectura OMR, ¿qué acción conserva la trazabilidad de la respuesta ${indice + 1}?` },
        options: ['Conservar la confianza y el estado de lectura', 'Convertir toda lectura dudosa en acierto', 'Eliminar el registro de confianza', 'Aceptar una doble marca como correcta', 'Omitir la revisión manual'].map((value, index) => ({
          key: String.fromCharCode(65 + index), value, isCorrect: index === 0
        })),
        metadata: { difficultyHypothesis: 'medium' },
        provenance: { origin: 'authored', confidence: 1, notes: 'fixture de prioridad OMR' }
      }))
    };
    const previewReactivos = await request(app)
      .post('/api/banco-preguntas/importaciones/preview')
      .set(auth)
      .send(loteReactivos)
      .expect(200);
    const confirmacionReactivos = await request(app)
      .post(`/api/banco-preguntas/importaciones/${previewReactivos.body.importId}/confirmar`)
      .set(auth)
      .send({ planHash: previewReactivos.body.planHash, payload: loteReactivos })
      .expect(200);
    const reactivoId = String(confirmacionReactivos.body.reactivoIds[0]);
    await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/revisar`).set(auth).send({}).expect(200);
    const publicacionReactivo = await request(app)
      .post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`)
      .set(auth)
      .send({})
      .expect(200);
    const preguntaId = publicacionReactivo.body.legacyPreguntaId as string;

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial 1',
        numeroPaginas: 1,
        preguntasIds: [preguntaId]
      })
      .expect(201);

    await request(app)
      .get(`/api/examenes/plantillas/${plantillaResp.body.plantilla._id}/previsualizar/pdf/visual`)
      .set(auth)
      .expect(200);

    const examenResp = await request(app)
      .post('/api/examenes/generados')
      .set(auth)
      .send({ plantillaId: plantillaResp.body.plantilla._id })
      .expect(201);

    const examenId = examenResp.body.examenGenerado._id as string;
    const folio = examenResp.body.examenGenerado.folio as string;
    const qrTexto = String(examenResp.body.examenGenerado.paginas?.[0]?.qrTexto ?? '');
    const templateVersion = Number(examenResp.body.examenGenerado.mapaOmr?.templateVersion ?? 4) as 4;

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
        aciertos: 1,
        totalReactivos: 1,
        bonoSolicitado: 0,
        evaluacionContinua: 0,
        respuestasDetectadas: [{
          numeroPregunta: 1,
          opcion: null,
          confianza: estadoRespuesta === 'sin_marca' ? 0.92 : 0.55,
          estadoRespuesta,
          ...(estadoRespuesta === 'doble_marca' ? { flags: ['doble_marca' as const] } : {})
        }],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.95,
          confianzaPromedioPagina: 0.92,
          ratioAmbiguas: 0,
          templateVersionDetectada: templateVersion,
          engineVersion: 'omr-cv',
          geomQuality: 0.9,
          photoQuality: 0.9,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto
        }
      })
      .expect(estadoRespuesta === 'sin_marca' ? 201 : 422);

    if (estadoRespuesta === 'doble_marca') {
      expect(calificacionResp.body.error.codigo).toBe('OMR_REQUIERE_REVISION_MANUAL');
      return;
    }

    expect(calificacionResp.body.calificacion.aciertos).toBe(0);
    expect(calificacionResp.body.calificacion.totalReactivos).toBe(1);
    expect(calificacionResp.body.calificacion.calificacionExamenFinalTexto).toBe('0');
    expect(calificacionResp.body.calificacion.respuestasDetectadas).toEqual([
      expect.objectContaining({
        opcion: null,
        estadoRespuesta,
        ...(estadoRespuesta === 'doble_marca' ? { flags: ['doble_marca'] } : {})
      })
    ]);
    }
  );
});

