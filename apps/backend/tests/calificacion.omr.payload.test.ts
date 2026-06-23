/**
 * calificacion.omr.payload.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app';
import { configuracion } from '../src/configuracion';
import { extraerResumenQrExamen } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from './utils/mongo';

function refirmarQr(textoQr: string) {
  const limpio = String(textoQr ?? '').trim();
  const sinFirma = limpio.replace(/:SG:[A-Z0-9]+$/i, '');
  const qrResumen = extraerResumenQrExamen(limpio);
  const keyId = String(qrResumen?.keyId ?? '').trim();
  const secreto =
    (keyId
      ? configuracion.omrQrHmacSecrets[keyId] ??
        configuracion.omrQrHmacSecrets[keyId.toLowerCase()] ??
        configuracion.omrQrHmacSecrets[keyId.toUpperCase()]
      : null) ?? configuracion.omrQrHmacSecret;
  const firma = `H1${createHmac('sha256', secreto)
    .update(sinFirma)
    .digest('hex')
    .slice(0, 24)
    .toUpperCase()}`;
  return `${sinFirma}:SG:${firma}`;
}

async function crearEscenarioBase(app: ReturnType<typeof crearApp>) {
  const registro = await request(app)
    .post('/api/autenticacion/registrar')
    .send({
      nombreCompleto: 'Docente OMR Payload',
      correo: 'docente-omr-payload@cuh.mx',
      contrasena: 'Secreto123!'
    })
    .expect(201);
  const token = registro.body.token as string;
  const auth = { Authorization: `Bearer ${token}` };

  const periodo = await request(app)
    .post('/api/periodos')
    .set(auth)
    .send({
      nombre: 'Periodo Payload',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-06-01',
      grupos: ['A']
    })
    .expect(201);
  const periodoId = periodo.body.periodo._id as string;

  const alumno = await request(app)
    .post('/api/alumnos')
    .set(auth)
    .send({
      periodoId,
      matricula: 'CUH512410168',
      nombreCompleto: 'Alumno Payload',
      correo: 'alumno-omr-payload@cuh.mx',
      grupo: 'A'
    })
    .expect(201);

  const pregunta = await request(app)
    .post('/api/banco-preguntas')
    .set(auth)
    .send({
      periodoId,
      enunciado: 'Pregunta payload',
      opciones: [
        { texto: 'A', esCorrecta: true },
        { texto: 'B', esCorrecta: false },
        { texto: 'C', esCorrecta: false },
        { texto: 'D', esCorrecta: false },
        { texto: 'E', esCorrecta: false }
      ]
    })
    .expect(201);

  const plantilla = await request(app)
    .post('/api/examenes/plantillas')
    .set(auth)
    .send({
      periodoId,
      tipo: 'parcial',
      titulo: 'Plantilla payload',
      numeroPaginas: 1,
      preguntasIds: [pregunta.body.pregunta._id]
    })
    .expect(201);

  const examen = await request(app)
    .post('/api/examenes/generados')
    .set(auth)
    .send({ plantillaId: plantilla.body.plantilla._id })
    .expect(201);

  await request(app)
    .post('/api/entregas/vincular-folio')
    .set(auth)
    .send({
      folio: examen.body.examenGenerado.folio,
      alumnoId: alumno.body.alumno._id
    })
    .expect(201);

  return {
    auth,
    examenGeneradoId: examen.body.examenGenerado._id as string,
    folio: examen.body.examenGenerado.folio as string,
    alumnoId: alumno.body.alumno._id as string,
    qrTexto: String(examen.body.examenGenerado.paginas?.[0]?.qrTexto ?? ''),
    templateVersion: Number(examen.body.examenGenerado.mapaOmr?.templateVersion ?? 3) as 3 | 4
  };
}

describe('calificación OMR payload estricto', () => {
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

  it('rechaza payload OMR con longitud de respuestas inconsistente', async () => {
    const base = await crearEscenarioBase(app);

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        respuestasDetectadas: [
          { numeroPregunta: 1, opcion: 'A', confianza: 0.9 },
          { numeroPregunta: 1, opcion: 'A', confianza: 0.88 }
        ],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.9,
          confianzaPromedioPagina: 0.89,
          ratioAmbiguas: 0,
          templateVersionDetectada: base.templateVersion,
          engineVersion: 'omr-v3-cv',
          geomQuality: 0.91,
          photoQuality: 0.92,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto: base.qrTexto
        }
      })
      .expect(422);

    expect(respuesta.body.error.codigo).toBe('OMR_PAYLOAD_INCOMPLETO');
  });

  it('rechaza folio de payload que no coincide', async () => {
    const base = await crearEscenarioBase(app);

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: 'FOLIO-INCORRECTO',
        alumnoId: base.alumnoId,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.9,
          confianzaPromedioPagina: 0.9,
          ratioAmbiguas: 0,
          templateVersionDetectada: base.templateVersion,
          engineVersion: 'omr-v3-cv',
          geomQuality: 0.91,
          photoQuality: 0.92,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto: base.qrTexto
        }
      })
      .expect(409);

    expect(respuesta.body.error.codigo).toBe('OMR_FOLIO_NO_COINCIDE');
  });

  it('exige metadata de revisión cuando revisionConfirmada=true y estado!=ok', async () => {
    const base = await crearEscenarioBase(app);

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }],
        omrAnalisis: {
          estadoAnalisis: 'requiere_revision',
          calidadPagina: 0.7,
          confianzaPromedioPagina: 0.65,
          ratioAmbiguas: 0.15,
          templateVersionDetectada: base.templateVersion,
          revisionConfirmada: true,
          engineVersion: 'omr-v3-cv',
          geomQuality: 0.71,
          photoQuality: 0.74,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: ['bajo_contraste'],
          qrTexto: base.qrTexto
        }
      })
      .expect(422);

    expect(respuesta.body.error.codigo).toBe('OMR_REVISION_METADATA_OBLIGATORIA');
  });

  it('bloquea guardado automatico cuando estadoAnalisis!=ok y no hay revisionConfirmada', async () => {
    const base = await crearEscenarioBase(app);

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.72 }],
        omrAnalisis: {
          estadoAnalisis: 'requiere_revision',
          calidadPagina: 0.75,
          confianzaPromedioPagina: 0.72,
          ratioAmbiguas: 0.2,
          templateVersionDetectada: base.templateVersion,
          engineVersion: 'omr-v3-cv',
          geomQuality: 0.79,
          photoQuality: 0.73,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: ['bajo_contraste'],
          qrTexto: base.qrTexto
        }
      })
      .expect(422);

    expect(respuesta.body.error.codigo).toBe('OMR_REQUIERE_REVISION_MANUAL');
  });

  it('rechaza paginasOmr sin omrAnalisis completo', async () => {
    const base = await crearEscenarioBase(app);

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        paginasOmr: [
          {
            numeroPagina: 1,
            imagenBase64: 'data:image/png;base64,AQIDBA=='
          }
        ]
      })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza qrTexto con variante distinta a la del examen generado', async () => {
    const base = await crearEscenarioBase(app);
    const qrMutado = refirmarQr(String(base.qrTexto).replace(/:VH:[A-Z0-9]+:/, ':VH:AAAAAAAAAAAA:'));

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.97 }],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.98,
          confianzaPromedioPagina: 0.97,
          ratioAmbiguas: 0,
          templateVersionDetectada: base.templateVersion,
          engineVersion: 'omr-v3-cv',
          geomQuality: 0.96,
          photoQuality: 0.96,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto: qrMutado
        }
      })
      .expect(409);

    expect(respuesta.body.error.codigo).toBe('OMR_QR_VARIANTE_NO_COINCIDE');
  });

  it('rechaza qrTexto con clave correcta distinta a la del examen generado', async () => {
    const base = await crearEscenarioBase(app);
    const qrMutado = refirmarQr(String(base.qrTexto).replace(/:AK:[A-Z0-9]+:/, ':AK:BBBBBBBBBBBB:'));

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.97 }],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.98,
          confianzaPromedioPagina: 0.97,
          ratioAmbiguas: 0,
          templateVersionDetectada: base.templateVersion,
          engineVersion: 'omr-v3-cv',
          geomQuality: 0.96,
          photoQuality: 0.96,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto: qrMutado
        }
      })
      .expect(409);

    expect(respuesta.body.error.codigo).toBe('OMR_QR_CLAVE_NO_COINCIDE');
  });

  it('rechaza qrTexto con firma invalida aunque el resto del payload parezca consistente', async () => {
    const base = await crearEscenarioBase(app);

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.97 }],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.98,
          confianzaPromedioPagina: 0.97,
          ratioAmbiguas: 0,
          templateVersionDetectada: base.templateVersion,
          engineVersion: 'omr-v3-cv',
          geomQuality: 0.96,
          photoQuality: 0.96,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto: String(base.qrTexto).replace(/:SG:[A-Z0-9]+$/i, ':SG:H1AAAAAAAAAAAAAAAAAAAAAAAA')
        }
      })
      .expect(409);

    expect(respuesta.body.error.codigo).toBe('OMR_QR_FIRMA_INVALIDA');
  });

  it('acepta calificación cuando qrTexto enriquecido coincide con la variante y la clave', async () => {
    const base = await crearEscenarioBase(app);

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.97 }],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.98,
          confianzaPromedioPagina: 0.97,
          ratioAmbiguas: 0,
          templateVersionDetectada: base.templateVersion,
          engineVersion: 'omr-v3-cv',
          geomQuality: 0.96,
          photoQuality: 0.96,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto: base.qrTexto
        }
      })
      .expect(201);

    expect(respuesta.body.calificacion?.omrAuditoria?.variantHash).toBeTruthy();
    expect(respuesta.body.calificacion?.omrAuditoria?.answerKeyHash).toBeTruthy();
  });
});

