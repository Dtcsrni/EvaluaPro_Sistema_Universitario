/**
 * calificacionOmrPrioridad.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('calificacion OMR prioriza respuestas detectadas', () => {
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
        correo: 'docente-prioridad-omr@cuh.mx',
        contrasena: 'Secreto123!'
      })
      .expect(201);
    return respuesta.body.token as string;
  }

  it('ignora aciertos manuales cuando existen respuestasDetectadas', async () => {
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

    const preguntaResp = await request(app)
      .post('/api/banco-preguntas')
      .set(auth)
      .send({
        periodoId,
        enunciado: 'Pregunta unica',
        opciones: [
          { texto: 'Opcion A', esCorrecta: true },
          { texto: 'Opcion B', esCorrecta: false },
          { texto: 'Opcion C', esCorrecta: false },
          { texto: 'Opcion D', esCorrecta: false },
          { texto: 'Opcion E', esCorrecta: false }
        ]
      })
      .expect(201);

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial 1',
        numeroPaginas: 1,
        preguntasIds: [preguntaResp.body.pregunta._id]
      })
      .expect(201);

    const examenResp = await request(app)
      .post('/api/examenes/generados')
      .set(auth)
      .send({ plantillaId: plantillaResp.body.plantilla._id })
      .expect(201);

    const examenId = examenResp.body.examenGenerado._id as string;
    const folio = examenResp.body.examenGenerado.folio as string;
    const qrTexto = String(examenResp.body.examenGenerado.paginas?.[0]?.qrTexto ?? '');
    const templateVersion = Number(examenResp.body.examenGenerado.mapaOmr?.templateVersion ?? 3) as 3 | 4;

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
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: null, confianza: 0.92 }],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.95,
          confianzaPromedioPagina: 0.92,
          ratioAmbiguas: 0,
          templateVersionDetectada: templateVersion,
          engineVersion: 'omr-v3-cv',
          geomQuality: 0.9,
          photoQuality: 0.9,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto
        }
      })
      .expect(201);

    expect(calificacionResp.body.calificacion.aciertos).toBe(0);
    expect(calificacionResp.body.calificacion.totalReactivos).toBe(1);
    expect(calificacionResp.body.calificacion.calificacionExamenFinalTexto).toBe('0');
  });
});

