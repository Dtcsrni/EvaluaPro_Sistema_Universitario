/**
 * _flujoDocenteHelper
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import type { Express } from 'express';

export type EscenarioFlujoDocente = {
  token: string;
  auth: { Authorization: string };
  periodoId: string;
  alumnoId: string;
  examenId: string;
  folio: string;
  totalReactivosExamen: number;
};

export async function registrarDocente(app: Express, correo: string) {
  const respuesta = await request(app)
    .post('/api/autenticacion/registrar')
    .send({
      nombreCompleto: 'Docente Flujo',
      correo,
      contrasena: 'Secreto123!'
    })
    .expect(201);
  return respuesta.body.token as string;
}

export async function prepararEscenarioFlujo(
  app: Express,
  tipoExamen: 'parcial' | 'global',
  correoDocente: string
): Promise<EscenarioFlujoDocente> {
  const token = await registrarDocente(app, correoDocente);
  const auth = { Authorization: `Bearer ${token}` };

  const periodoResp = await request(app)
    .post('/api/periodos')
    .set(auth)
    .send({
      nombre: `Periodo ${tipoExamen.toUpperCase()} 2026`,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-06-01',
      grupos: ['A']
    })
    .expect(201);
  const periodoId = periodoResp.body.periodo._id as string;

  const alumnoResp = await request(app)
    .post('/api/alumnos')
    .set(auth)
    .send({
      periodoId,
      matricula: tipoExamen === 'global' ? 'CUH512410169' : 'CUH512410168',
      nombreCompleto: `Alumno ${tipoExamen}`,
      correo: `alumno-${tipoExamen}@prueba.test`,
      grupo: 'A'
    })
    .expect(201);
  const alumnoId = alumnoResp.body.alumno._id as string;

  const temaResp = await request(app)
    .post('/api/banco-preguntas/temas')
    .set(auth)
    .send({ periodoId, nombre: `Tema ${tipoExamen}` })
    .expect(201);
  const temaId = temaResp.body.tema._id as string;
  const batch = {
    contract: 'evaluapro.reactivos.batch',
    schemaVersion: 1,
    batchId: `flujo-${tipoExamen}-${Date.now()}`,
    target: { periodoId, temaIds: [temaId] },
    source: { kind: 'manual', generator: 'integracion-backend', generatedAt: new Date().toISOString() },
    items: Array.from({ length: 5 }, (_, i) => ({
      externalKey: `flujo-${tipoExamen}-${i + 1}`,
      itemId: null,
      expectedVersion: null,
      format: 'omr.mcq5',
      stem: {
        format: 'richtext',
        value: `En una aplicación web, ¿qué práctica ayuda a validar de forma segura los datos recibidos por una función (${tipoExamen} ${i + 1})?`
      },
      options: [
        { key: 'A', value: 'Comprobar tipo, formato y rango antes de usar los datos', isCorrect: true },
        { key: 'B', value: 'Confiar en que la interfaz siempre envía valores válidos', isCorrect: false },
        { key: 'C', value: 'Convertir cualquier dato inválido en una cadena vacía', isCorrect: false },
        { key: 'D', value: 'Omitir la validación cuando la petición usa HTTPS', isCorrect: false },
        { key: 'E', value: 'Guardar el dato recibido antes de revisar sus límites', isCorrect: false }
      ],
      metadata: { difficultyHypothesis: 'medium' },
      provenance: { origin: 'authored', confidence: 1, notes: 'fixture de integración' }
    }))
  };
  const preview = await request(app).post('/api/banco-preguntas/importaciones/preview').set(auth).send(batch).expect(200);
  const confirmacion = await request(app)
    .post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`)
    .set(auth)
    .send({ planHash: preview.body.planHash, payload: batch })
    .expect(200);
  const preguntasIds: string[] = [];
  for (const reactivoId of confirmacion.body.reactivoIds as string[]) {
    await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/revisar`).set(auth).send({}).expect(200);
    const publicado = await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`).set(auth).send({}).expect(200);
    preguntasIds.push(publicado.body.legacyPreguntaId as string);
  }

  const plantillaResp = await request(app)
    .post('/api/examenes/plantillas')
    .set(auth)
    .send({
      periodoId,
      tipo: tipoExamen,
      titulo: `Examen ${tipoExamen}`,
      numeroPaginas: 1,
      preguntasIds
    })
    .expect(201);
  const plantillaId = plantillaResp.body.plantilla._id as string;

  const previewPdf = await request(app)
    .get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`)
    .set(auth);
  if (previewPdf.status !== 200) {
    throw new Error(`Previsualización E2E falló: HTTP ${previewPdf.status}, detalle ${JSON.stringify(previewPdf.body)}`);
  }

  const examenResp = await request(app)
    .post('/api/examenes/generados')
    .set(auth)
    .send({ plantillaId });
  if (examenResp.status !== 201) {
    throw new Error(`Generación E2E falló: HTTP ${examenResp.status}, detalle ${JSON.stringify(examenResp.body)}`);
  }
  const examenId = examenResp.body.examenGenerado._id as string;
  const folio = examenResp.body.examenGenerado.folio as string;
  const totalReactivosExamen = Array.isArray(examenResp.body.examenGenerado.preguntasIds)
    ? examenResp.body.examenGenerado.preguntasIds.length
    : 1;

  await request(app).post('/api/entregas/vincular-folio').set(auth).send({ folio, alumnoId }).expect(201);

  const payloadCalificacion =
    tipoExamen === 'global'
      ? {
          examenGeneradoId: examenId,
          alumnoId,
          aciertos: totalReactivosExamen,
          totalReactivos: totalReactivosExamen,
          bonoSolicitado: 0,
          evaluacionContinua: 5,
          proyecto: 5
        }
      : {
          examenGeneradoId: examenId,
          alumnoId,
          aciertos: totalReactivosExamen,
          totalReactivos: totalReactivosExamen,
          bonoSolicitado: 0.5,
          evaluacionContinua: 5
        };

  await request(app).post('/api/calificaciones/calificar').set(auth).send(payloadCalificacion).expect(201);

  return {
    token,
    auth,
    periodoId,
    alumnoId,
    examenId,
    folio,
    totalReactivosExamen
  };
}
