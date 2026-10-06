/**
 * calificacion.omr.payload.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { configuracion } from '../src/configuracion.js';
import { prisma } from '../src/infraestructura/baseDatos/sqlite.js';
import { construirTextoQrExamenPagina, extraerResumenQrExamen } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen.js';

function refirmarQr(textoQr: string) {
  const limpio = String(textoQr ?? '').trim();
  const firmaCorta = /:S:[A-Z0-9_-]{16}$/i.test(limpio);
  const sinFirma = limpio.replace(/:(?:SG:[A-Z0-9]+|S:[A-Z0-9_-]{16})$/i, '');
  const qrResumen = extraerResumenQrExamen(limpio);
  const keyId = String(qrResumen?.keyId ?? '').trim();
  const secreto =
    (keyId
      ? configuracion.omrQrHmacSecrets[keyId] ??
        configuracion.omrQrHmacSecrets[keyId.toLowerCase()] ??
        configuracion.omrQrHmacSecrets[keyId.toUpperCase()]
      : null) ?? configuracion.omrQrHmacSecret;
  const hmac = createHmac('sha256', secreto).update(sinFirma).digest();
  if (firmaCorta) return `${sinFirma}:S:${hmac.subarray(0, 12).toString('base64url')}`;
  const firma = `H1${hmac.toString('hex').slice(0, 24).toUpperCase()}`;
  return `${sinFirma}:SG:${firma}`;
}

async function crearPreguntaCanonica(
  app: ReturnType<typeof crearApp>,
  auth: { Authorization: string },
  periodoId: string
) {
  const tema = await request(app)
    .post('/api/banco-preguntas/temas')
    .set(auth)
    .send({ periodoId, nombre: 'Payload OMR' })
    .expect(201);
  const temaId = String(tema.body.tema._id);
  const lote = {
    contract: 'evaluapro.reactivos.batch',
    schemaVersion: 1,
    batchId: `omr-payload-${Date.now()}`,
    target: { periodoId, temaIds: [temaId] },
    source: {
      kind: 'ai_generated',
      generator: 'EvaluaPro',
      generatorModel: 'vitest',
      generatedAt: '2026-09-24T00:00:00Z',
      sourceDocumentSha256: null
    },
    items: [{
      externalKey: `omr-payload-${Date.now()}`,
      itemId: null,
      expectedVersion: null,
      format: 'omr.mcq5',
      stem: { format: 'richtext', value: 'Pregunta payload' },
      options: ['A', 'B', 'C', 'D', 'E'].map((key, index) => ({
        key,
        value: key,
        isCorrect: index === 0
      })),
      metadata: { difficultyHypothesis: 'medium' },
      provenance: { origin: 'generated', confidence: 1, notes: 'fixture OMR payload' }
    }]
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
  const reactivoId = String(confirmado.body.reactivoIds[0]);

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

  return String(publicado.body.legacyPreguntaId);
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

  const preguntaId = await crearPreguntaCanonica(app, auth, periodoId);

  const plantilla = await request(app)
    .post('/api/examenes/plantillas')
    .set(auth)
    .send({
      periodoId,
      tipo: 'parcial',
      titulo: 'Plantilla payload',
      numeroPaginas: 1,
      preguntasIds: [preguntaId]
    })
    .expect(201);
  const plantillaId = String(plantilla.body.plantilla._id);
  await request(app)
    .get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`)
    .set(auth)
    .expect(200);

  const examen = await request(app)
    .post('/api/examenes/generados')
    .set(auth)
    .send({ plantillaId })
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
    templateVersion: Number(examen.body.examenGenerado.mapaOmr?.templateVersion ?? 4) as 4
  };
}

async function prepararPlantillaInline(base: Awaited<ReturnType<typeof crearEscenarioBase>>) {
  const examen = await prisma.examenGenerado.findUnique({ where: { id: base.examenGeneradoId } });
  if (!examen) throw new Error('No se encontró el examen de prueba para configurar la plantilla inline');

  const mapaOmr = JSON.parse(String(examen.mapaOmr ?? '{}')) as Record<string, any>;
  const paginas = JSON.parse(String(examen.paginas ?? '[]')) as Array<Record<string, any>>;
  const qrTexto = construirTextoQrExamenPagina({
    folio: base.folio,
    numeroPagina: 1,
    templateVersion: 4,
    templateId: 'omr-inline-exam-v1',
    compacto: true,
    examId: base.examenGeneradoId
  });

  mapaOmr.templateId = 'omr-inline-exam-v1';
  for (const pagina of Array.isArray(mapaOmr.paginas) ? mapaOmr.paginas : []) {
    pagina.templateId = 'omr-inline-exam-v1';
  }
  if (paginas[0]) paginas[0].qrTexto = qrTexto;

  await prisma.examenGenerado.update({
    where: { id: base.examenGeneradoId },
    data: { mapaOmr: JSON.stringify(mapaOmr), paginas: JSON.stringify(paginas) }
  });
  return qrTexto;
}

describe('calificación OMR payload estricto', () => {
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
          engineVersion: 'omr-cv',
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

  it('exige revisión si una respuesta individual es ambigua aunque el promedio de página pase', async () => {
    const base = await crearEscenarioBase(app);

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: null, confianza: 0.99, estadoRespuesta: 'ambigua' }],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.99,
          confianzaPromedioPagina: 0.99,
          ratioAmbiguas: 0,
          templateVersionDetectada: base.templateVersion,
          engineVersion: 'omr-cv',
          geomQuality: 0.99,
          photoQuality: 0.99,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto: base.qrTexto
        }
      })
      .expect(422);

    expect(respuesta.body.error.codigo).toBe('OMR_REQUIERE_REVISION_MANUAL');
  }, 60_000);

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
          engineVersion: 'omr-cv',
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
          engineVersion: 'omr-cv',
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
          engineVersion: 'omr-cv',
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

  it('permite calificar la plantilla inline solo después de confirmar la revisión humana', async () => {
    const base = await crearEscenarioBase(app);
    const qrTexto = await prepararPlantillaInline(base);
    const payload = {
      examenGeneradoId: base.examenGeneradoId,
      folio: base.folio,
      alumnoId: base.alumnoId,
      respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.97 }],
      omrAnalisis: {
        estadoAnalisis: 'requiere_revision' as const,
        calidadPagina: 0.48,
        confianzaPromedioPagina: 0.41,
        ratioAmbiguas: 0,
        templateVersionDetectada: base.templateVersion,
        engineVersion: 'omr-cv',
        geomQuality: 0.96,
        photoQuality: 0.96,
        decisionPolicy: 'conservadora_v1',
        motivosRevision: [],
        qrTexto
      }
    };

    const sinRevision = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send(payload)
      .expect(422);
    expect(sinRevision.body.error.codigo).toBe('OMR_REQUIERE_REVISION_MANUAL');

    const revisada = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({ ...payload, omrAnalisis: { ...payload.omrAnalisis, revisionConfirmada: true } })
      .expect(201);
    expect(revisada.body.calificacion.respuestasDetectadas[0].opcion).toBe('A');
    expect(revisada.body.calificacion.omrAuditoria.revisionConfirmada).toBe(true);
    expect(revisada.body.calificacion.omrAuditoria.autoCalificableOmr).toBe(false);
    expect(revisada.body.calificacion.omrAuditoria.usuarioRevisor).toBeTruthy();
    expect(revisada.body.calificacion.omrAuditoria.revisionTimestamp).toBeTruthy();
    expect(revisada.body.calificacion.omrAuditoria.qrValidationMode).toBe('manifest-exact');
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

  it('rechaza un QR corto firmado cuya página no existe en el manifiesto local', async () => {
    const base = await crearEscenarioBase(app);
    const qrMutado = refirmarQr(String(base.qrTexto).replace(':P1:', ':P2:'));

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.97, estadoRespuesta: 'respondida' }],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.98,
          confianzaPromedioPagina: 0.97,
          ratioAmbiguas: 0,
          templateVersionDetectada: base.templateVersion,
          engineVersion: 'omr-cv',
          geomQuality: 0.96,
          photoQuality: 0.96,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto: qrMutado
        }
      })
      .expect(409);

    expect(respuesta.body.error.codigo).toBe('OMR_QR_NO_COINCIDE_MANIFIESTO');
  });

  it('rechaza QR corto cuando el examen no conserva páginas/manifiesto locales', async () => {
    const base = await crearEscenarioBase(app);
    await prisma.examenGenerado.update({
      where: { id: base.examenGeneradoId },
      data: { paginas: '[]' }
    });

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
          engineVersion: 'omr-cv',
          geomQuality: 0.96,
          photoQuality: 0.96,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto: base.qrTexto
        }
      })
      .expect(409);

    expect(respuesta.body.error.codigo).toBe('OMR_QR_MANIFIESTO_REQUERIDO');
  });

  it('rechaza un QR corto cuya identidad no coincide byte a byte con el manifiesto', async () => {
    const base = await crearEscenarioBase(app);
    const qrMutado = String(base.qrTexto).replace('EXAMEN:', 'examen:');

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
          engineVersion: 'omr-cv',
          geomQuality: 0.96,
          photoQuality: 0.96,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto: qrMutado
        }
      })
      .expect(409);

    expect(respuesta.body.error.codigo).toBe('OMR_QR_NO_COINCIDE_MANIFIESTO');
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
          engineVersion: 'omr-cv',
          geomQuality: 0.96,
          photoQuality: 0.96,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto: String(base.qrTexto).replace(/:S:[A-Z0-9_-]{16}$/i, ':S:AAAAAAAAAAAAAAAA')
        }
      })
      .expect(409);

    expect(respuesta.body.error.codigo).toBe('OMR_QR_FIRMA_INVALIDA');
  });

  it('acepta calificación cuando el QR corto coincide exactamente con el manifiesto local', async () => {
    const base = await crearEscenarioBase(app);

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.97, estadoRespuesta: 'respondida' }],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.98,
          confianzaPromedioPagina: 0.97,
          ratioAmbiguas: 0,
          templateVersionDetectada: base.templateVersion,
          engineVersion: 'omr-cv',
          geomQuality: 0.96,
          photoQuality: 0.96,
          decisionPolicy: 'conservadora_v1',
          motivosRevision: [],
          qrTexto: base.qrTexto
        }
      })
      .expect(201);

    expect(respuesta.body.calificacion?.omrAuditoria?.qrValidationMode).toBe('manifest-exact');
    expect(respuesta.body.calificacion?.omrAuditoria?.variantHash).toBeNull();
    expect(respuesta.body.calificacion?.omrAuditoria?.answerKeyHash).toBeNull();
  });
});

