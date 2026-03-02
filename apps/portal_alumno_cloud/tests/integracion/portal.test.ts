/**
 * portal.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas de integracion del portal alumno.
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gzipSync } from 'zlib';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

function validarResultadosBasicos(resultadosBody: Record<string, unknown>, folio: string) {
  const resultados = (resultadosBody as { resultados?: Array<Record<string, unknown>> }).resultados ?? [];
  expect(resultados).toHaveLength(1);
  expect(resultados[0]?.folio).toBe(folio);
  expect(resultados[0]?.aciertos).toBe(2);
  expect((resultados[0]?.comparativaRespuestas as unknown[] | undefined) ?? []).toHaveLength(3);
  expect((resultados[0]?.omrAuditoria as { revisionConfirmada?: unknown } | undefined)?.revisionConfirmada).toBe(true);
}

async function validarVistasPortal(app: ReturnType<typeof crearApp>, token: string, folio: string) {
  const pdf = await request(app)
    .get(`/api/portal/examen/${folio}`)
    .set({ Authorization: `Bearer ${token}` })
    .expect(200);
  expect(pdf.header['content-type']).toContain('application/pdf');

  const perfil = await request(app).get('/api/portal/perfil').set({ Authorization: `Bearer ${token}` }).expect(200);
  expect(perfil.body?.ok).toBe(true);
  expect(perfil.body?.data?.perfil?.matricula).toBe('CUH512410168');

  const materias = await request(app).get('/api/portal/materias').set({ Authorization: `Bearer ${token}` }).expect(200);
  expect(Array.isArray(materias.body?.data?.materias)).toBe(true);
  expect(materias.body?.data?.materias?.[0]?.nombre).toBe('Lógica de Programación');

  const agenda = await request(app).get('/api/portal/agenda').set({ Authorization: `Bearer ${token}` }).expect(200);
  expect(Array.isArray(agenda.body?.data?.agenda)).toBe(true);

  const avisos = await request(app).get('/api/portal/avisos').set({ Authorization: `Bearer ${token}` }).expect(200);
  expect(Array.isArray(avisos.body?.data?.avisos)).toBe(true);

  const historial = await request(app).get('/api/portal/historial').set({ Authorization: `Bearer ${token}` }).expect(200);
  expect(Array.isArray(historial.body?.data?.historial)).toBe(true);
}

function crearPayloadDesgloseEvaluacion(params: {
  periodoId: string;
  alumnoId: string;
  docenteId: string;
  examenId: string;
  folio: string;
}) {
  return {
    schemaVersion: 3,
    periodo: { _id: params.periodoId },
    alumnos: [{ _id: params.alumnoId, matricula: 'CUH512410170', nombreCompleto: 'Alumno Evaluaciones', grupo: 'A' }],
    calificaciones: [
      {
        docenteId: params.docenteId,
        alumnoId: params.alumnoId,
        examenGeneradoId: params.examenId,
        tipoExamen: 'global',
        totalReactivos: 10,
        aciertos: 8,
        calificacionExamenFinalTexto: '8',
        versionPolitica: 1,
        bloqueContinuaDecimal: 8.75,
        bloqueExamenesDecimal: 9.25,
        finalDecimal: 9,
        finalRedondeada: 9,
        componentesExamen: {
          politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
          examenesPorCorte: { parcial1: 8, parcial2: 9, global: 10 }
        }
      }
    ],
    examenes: [{ examenGeneradoId: params.examenId, folio: params.folio }],
    banderas: [],
    codigoAcceso: { codigo: 'EVAL001', expiraEn: new Date(Date.now() + 60 * 60 * 1000).toISOString() }
  };
}

function validarDesgloseEvaluacion(resultadosBody: Record<string, unknown>) {
  const primerResultado = ((resultadosBody?.resultados as Array<Record<string, unknown>> | undefined) ?? [])[0] ?? {};
  expect(primerResultado.versionPolitica).toBe(1);
  expect(Number(primerResultado.bloqueContinuaDecimal)).toBeCloseTo(8.75, 4);
  expect(Number(primerResultado.bloqueExamenesDecimal)).toBeCloseTo(9.25, 4);
  expect(Number(primerResultado.finalDecimal)).toBeCloseTo(9, 4);
  expect(Number(primerResultado.finalRedondeada)).toBe(9);
  expect((primerResultado.componentesExamen as { politicaCodigo?: unknown } | undefined)?.politicaCodigo).toBe('POLICY_LISC_ENCUADRE_2026');
}

describe('portal alumno', () => {
  const app = crearApp();
  const apiKey = process.env.PORTAL_API_KEY ?? 'TEST_PORTAL_KEY';

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('sincroniza y permite consultar resultados', async () => {
    const periodoId = '507f1f77bcf86cd799439011';
    const alumnoId = '507f1f77bcf86cd799439012';
    const docenteId = '507f1f77bcf86cd799439013';
    const examenId = '507f1f77bcf86cd799439014';
    const folio = 'FOLIO01';
    const pdfComprimidoBase64 = gzipSync(Buffer.from('%PDF-1.4 prueba')).toString('base64');

    await request(app)
      .post('/api/portal/sincronizar')
      .set({ 'x-api-key': apiKey })
      .send({
        schemaVersion: 3,
        periodo: { _id: periodoId },
        alumnos: [{ _id: alumnoId, matricula: 'CUH512410168', nombreCompleto: 'Alumno Uno', grupo: 'A' }],
        calificaciones: [
          {
            docenteId,
            alumnoId,
            examenGeneradoId: examenId,
            tipoExamen: 'parcial',
            totalReactivos: 3,
            aciertos: 2,
            calificacionExamenFinalTexto: '4',
            calificacionParcialTexto: '9',
            respuestasDetectadas: [
              { numeroPregunta: 1, opcion: 'A', confianza: 0.95 },
              { numeroPregunta: 2, opcion: 'C', confianza: 0.88 },
              { numeroPregunta: 3, opcion: 'D', confianza: 0.9 }
            ],
            comparativaRespuestas: [
              { numeroPregunta: 1, correcta: 'A', detectada: 'A', coincide: true, confianza: 0.95 },
              { numeroPregunta: 2, correcta: 'B', detectada: 'C', coincide: false, confianza: 0.88 },
              { numeroPregunta: 3, correcta: 'D', detectada: 'D', coincide: true, confianza: 0.9 }
            ],
            omrAuditoria: { estadoAnalisis: 'requiere_revision', revisionConfirmada: true, calidadPagina: 0.84 }
          }
        ],
        examenes: [{ examenGeneradoId: examenId, folio, pdfComprimidoBase64 }],
        banderas: [{ examenGeneradoId: examenId, tipo: 'similitud' }],
        codigoAcceso: { codigo: 'ABC123', expiraEn: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
        perfilAlumno: [{ alumnoId, matricula: 'CUH512410168', nombreCompleto: 'Alumno Uno', grupo: 'A' }],
        materiasAlumno: [{ alumnoId, materiaId: periodoId, nombre: 'Lógica de Programación', estado: 'activa' }],
        agendaAlumno: [{ alumnoId, agendaId: `ag-${periodoId}`, titulo: 'Publicación', fecha: new Date().toISOString(), tipo: 'publicacion' }],
        avisosAlumno: [{ alumnoId, avisoId: `av-${periodoId}`, titulo: 'Aviso', mensaje: 'Resultados publicados', severidad: 'info' }],
        historialAlumno: [{ alumnoId, historialId: `hist-${folio}`, folio, tipoExamen: 'parcial', calificacionTexto: '4', fecha: new Date().toISOString() }]
      })
      .expect(200);

    const ingreso = await request(app)
      .post('/api/portal/ingresar')
      .send({ codigo: 'ABC123', matricula: 'CUH512410168' })
      .expect(200);

    const token = ingreso.body.token as string;
    expect(token).toBeTruthy();

    const resultados = await request(app)
      .get('/api/portal/resultados')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    validarResultadosBasicos(resultados.body as Record<string, unknown>, folio);
    await validarVistasPortal(app, token, folio);
  });

  it('acepta y expone desglose de evaluación (final decimal/redondeada)', async () => {
    const periodoId = '507f1f77bcf86cd799439031';
    const alumnoId = '507f1f77bcf86cd799439032';
    const docenteId = '507f1f77bcf86cd799439033';
    const examenId = '507f1f77bcf86cd799439034';
    const folio = 'FOLIO-EVAL-1';

    await request(app)
      .post('/api/portal/sincronizar')
      .set({ 'x-api-key': apiKey })
      .send(crearPayloadDesgloseEvaluacion({ periodoId, alumnoId, docenteId, examenId, folio }))
      .expect(200);

    const ingreso = await request(app)
      .post('/api/portal/ingresar')
      .send({ codigo: 'EVAL001', matricula: 'CUH512410170' })
      .expect(200);
    const token = ingreso.body.token as string;

    const resultados = await request(app)
      .get('/api/portal/resultados')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    validarDesgloseEvaluacion(resultados.body as Record<string, unknown>);
  });

  it('requiere api key para sincronizar', async () => {
    const respuesta = await request(app)
      .post('/api/portal/sincronizar')
      .send({ periodo: {}, alumnos: [], calificaciones: [] })
      .expect(401);

    expect(respuesta.body.error.codigo).toBe('NO_AUTORIZADO');
  });

  it('permite solicitar revision por pregunta y sincronizarla para docente', async () => {
    const periodoId = '507f1f77bcf86cd799439021';
    const alumnoId = '507f1f77bcf86cd799439022';
    const docenteId = '507f1f77bcf86cd799439023';
    const examenId = '507f1f77bcf86cd799439024';
    const folio = 'FOLIO-REV-1';

    await request(app)
      .post('/api/portal/sincronizar')
      .set({ 'x-api-key': apiKey })
      .send({
        periodo: { _id: periodoId },
        alumnos: [{ _id: alumnoId, matricula: 'CUH512410169', nombreCompleto: 'Alumno Revision', grupo: 'A' }],
        calificaciones: [
          {
            docenteId,
            alumnoId,
            examenGeneradoId: examenId,
            tipoExamen: 'parcial',
            totalReactivos: 2,
            aciertos: 1,
            calificacionExamenFinalTexto: '3',
            comparativaRespuestas: [
              { numeroPregunta: 1, correcta: 'A', detectada: 'B', coincide: false },
              { numeroPregunta: 2, correcta: 'C', detectada: 'C', coincide: true }
            ]
          }
        ],
        examenes: [{ examenGeneradoId: examenId, folio }],
        banderas: [],
        codigoAcceso: { codigo: 'CODREV', expiraEn: new Date(Date.now() + 60 * 60 * 1000).toISOString() }
      })
      .expect(200);

    const ingreso = await request(app)
      .post('/api/portal/ingresar')
      .send({ codigo: 'CODREV', matricula: 'CUH512410169' })
      .expect(200);
    const token = ingreso.body.token as string;

    expect(token).toBeTruthy();

    await request(app)
      .post('/api/portal/solicitudes-revision')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        folio,
        solicitudes: [{ numeroPregunta: 1, comentario: 'Creo que mi marca es correcta' }]
      })
      .expect(201);

    await request(app)
      .post('/api/portal/solicitudes-revision')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        folio,
        solicitudes: [{ numeroPregunta: 1, comentario: 'corto' }]
      })
      .expect(400);

    const pull = await request(app)
      .post('/api/portal/sincronizacion-docente/solicitudes-revision/pull')
      .set({ 'x-api-key': apiKey })
      .send({ docenteId })
      .expect(200);

    expect(Array.isArray(pull.body.solicitudes)).toBe(true);
    expect(pull.body.solicitudes[0].folio).toBe(folio);
    expect(pull.body.solicitudes[0].numeroPregunta).toBe(1);

    await request(app)
      .post('/api/portal/sincronizacion-docente/solicitudes-revision/update')
      .set({ 'x-api-key': apiKey })
      .send({
        externoId: pull.body.solicitudes[0].externoId,
        estado: 'atendida',
        respuestaDocente: 'Revisado por docente'
      })
      .expect(200);
  });
});
