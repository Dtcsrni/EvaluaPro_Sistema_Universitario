/**
 * examenesRetention.test
 *
 * Valida la política de retención de exámenes generados:
 * - dry-run no modifica documentos ni archivos,
 * - purge real elimina artefactos y deja metadata mínima,
 * - descargas posteriores responden 410 por retención.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { ejecutarPurgeExamenesGenerados } from '../../src/modulos/modulo_generacion_pdf/servicioRetencionExamenes.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

describe('retención de exámenes generados', () => {
  const app = crearApp();
  // El almacenamiento de archivos se aísla en tests/setup.ts. No apuntar a
  // la carpeta de artefactos del repositorio evita borrar o bloquear datos
  // del checkout cuando la suite se ejecuta en paralelo con otras tareas.
  const dataDir = path.resolve(String(process.env.EVALUAPRO_ARCHIVOS_DIR));

  beforeAll(async () => {
    await conectarSqliteTest();
    await fs.mkdir(dataDir, { recursive: true });
  });

  beforeEach(async () => {
    await limpiarSqliteTest();
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.mkdir(dataDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
    await cerrarSqliteTest();
  });

  async function registrarDocente() {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Retencion',
        correo: 'retencion@prueba.test',
        contrasena: 'Secreto123!'
      })
      .expect(201);
    return respuesta.body.token as string;
  }

  async function crearPreguntasCanonicas(auth: { Authorization: string }, periodoId: string) {
    const temaResp = await request(app)
      .post('/api/banco-preguntas/temas')
      .set(auth)
      .send({ periodoId, nombre: 'Retencion' })
      .expect(201);
    const temaId = String(temaResp.body.tema._id);
    const sufijo = Date.now();
    const lote = {
      contract: 'evaluapro.reactivos.batch',
      schemaVersion: 1,
      batchId: `retencion-${sufijo}`,
      target: { periodoId, temaIds: [temaId] },
      source: {
        kind: 'ai_generated',
        generator: 'EvaluaPro',
        generatorModel: 'vitest',
        generatedAt: '2026-09-24T00:00:00Z',
        sourceDocumentSha256: null
      },
      items: Array.from({ length: 8 }, (_, index) => ({
        externalKey: `retencion-${sufijo}-${index + 1}`,
        itemId: null,
        expectedVersion: null,
        format: 'omr.mcq5',
        stem: { format: 'richtext', value: `Pregunta retencion ${index + 1}` },
        options: ['A', 'B', 'C', 'D', 'E'].map((key, optionIndex) => ({
          key,
          value: key,
          isCorrect: optionIndex === 0
        })),
        metadata: { difficultyHypothesis: 'medium' },
        provenance: { origin: 'generated', confidence: 1, notes: 'fixture de retencion' }
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

  async function crearEscenario(auth: { Authorization: string }) {
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: `Periodo Retencion ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fechaInicio: '2025-01-01',
        fechaFin: '2025-06-01',
        grupos: ['A']
      })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;

    const preguntasIds = await crearPreguntasCanonicas(auth, periodoId);

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Plantilla Retencion',
        numeroPaginas: 1,
        preguntasIds
      })
      .expect(201);

    await request(app)
      .get(`/api/examenes/plantillas/${plantillaResp.body.plantilla._id}/previsualizar/pdf`)
      .set(auth)
      .expect(200);

    const examenResp = await request(app)
      .post('/api/examenes/generados')
      .set(auth)
      .send({ plantillaId: plantillaResp.body.plantilla._id })
      .expect(201);

    return {
      periodoId,
      plantillaId: plantillaResp.body.plantilla._id as string,
      examenId: examenResp.body.examenGenerado._id as string,
      folio: examenResp.body.examenGenerado.folio as string,
      rutaPdf: examenResp.body.examenGenerado.rutaPdf as string
    };
  }

  async function descargarPdfLote(auth: { Authorization: string }, loteId: string) {
    return request(app)
      .get(`/api/examenes/generados/lote/${encodeURIComponent(loteId)}/pdf`)
      .set(auth)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  }

  it('ejecuta purge dry-run y real, conservando metadata y devolviendo 410 al descargar', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    const escenario = await crearEscenario(auth);

    await fs.access(escenario.rutaPdf);

    const dryRun = await request(app)
      .post('/api/examenes/generados/purge')
      .set(auth)
      .send({ dryRun: true, scope: 'all', olderThanDays: 40 })
      .expect(200);

    expect(dryRun.body?.data?.candidatos).toBe(1);
    expect(dryRun.body?.data?.documentosActualizados).toBe(0);
    await fs.access(escenario.rutaPdf);

    const purgeReal = await request(app)
      .post('/api/examenes/generados/purge')
      .set(auth)
      .send({ dryRun: false, scope: 'all', olderThanDays: 40 })
      .expect(200);

    expect(purgeReal.body?.data?.candidatos).toBe(1);
    expect(purgeReal.body?.data?.documentosActualizados).toBe(1);

    const examen = await prisma.examenGenerado.findUnique({ where: { id: escenario.examenId } });
    expect(examen?.retentionStatus).toBe('artifacts_purged');
    expect(examen?.rutaPdf ?? null).toBeNull();
    await expect(fs.access(escenario.rutaPdf)).rejects.toThrow();

    const detalle = await request(app)
      .get(`/api/examenes/generados/folio/${encodeURIComponent(escenario.folio)}`)
      .set(auth)
      .expect(200);
    expect(detalle.body?.examen?.downloadAvailable).toBe(false);
    expect(detalle.body?.examen?.retentionStatus).toBe('artifacts_purged');

    const descarga = await request(app).get(`/api/examenes/generados/${escenario.examenId}/pdf`).set(auth).expect(410);
    expect(descarga.body?.error?.codigo).toBe('EXAMEN_ARTIFACTOS_EXPURGADOS');
  });

  it('conserva por defecto y solo purga archivos de parciales archivados al plazo elegido', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    const perfilInicial = await request(app).get('/api/autenticacion/perfil').set(auth).expect(200);
    expect(perfilInicial.body.docente.retencionParcialesArchivadosMeses).toBeNull();

    await request(app)
      .post('/api/autenticacion/preferencias/retencion-parciales')
      .set(auth)
      .send({ meses: 4 })
      .expect(400);
    await request(app)
      .post('/api/autenticacion/preferencias/retencion-parciales')
      .set(auth)
      .send({ meses: 6 })
      .expect(200)
      .then((response) => expect(response.body.retencionParcialesArchivadosMeses).toBe(6));

    const archivado = await crearEscenario(auth);
    const vigente = await crearEscenario(auth);
    await request(app).post(`/api/periodos/${archivado.periodoId}/archivar`).set(auth).send({}).expect(200);
    await request(app).post(`/api/examenes/plantillas/${archivado.plantillaId}/archivar`).set(auth).send({}).expect(200);
    const fechaAntigua = new Date();
    fechaAntigua.setMonth(fechaAntigua.getMonth() - 8);
    await prisma.examenGenerado.updateMany({
      where: { id: { in: [archivado.examenId, vigente.examenId] } },
      data: { generadoEn: fechaAntigua }
    });

    const docente = await prisma.docente.findUniqueOrThrow({ where: { correo: 'retencion@prueba.test' } });
    const resumen = await ejecutarPurgeExamenesGenerados({
      docenteId: docente.id,
      scope: 'archived-partials',
      retentionMonths: 6,
      olderThanDays: 1,
      dryRun: false,
      reason: 'ttl'
    });

    expect(resumen.candidatos).toBe(1);
    expect(resumen.documentosActualizados).toBe(1);
    await expect(fs.access(archivado.rutaPdf)).rejects.toThrow();
    await fs.access(vigente.rutaPdf);
    expect((await prisma.examenGenerado.findUniqueOrThrow({ where: { id: archivado.examenId } })).retentionStatus).toBe('artifacts_purged');
    expect((await prisma.examenGenerado.findUniqueOrThrow({ where: { id: vigente.examenId } })).retentionStatus).toBe('active');
    const perfilGuardado = await request(app).get('/api/autenticacion/perfil').set(auth).expect(200);
    expect(perfilGuardado.body.docente.retencionParcialesArchivadosMeses).toBe(6);
  });

  it('devuelve 410 al descargar el PDF de lote despues de expurgar sus artefactos', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };
    const base = await crearEscenario(auth);

    await request(app)
      .post('/api/alumnos')
      .set(auth)
      .send({
        periodoId: base.periodoId,
        matricula: 'CUH512410170',
        nombreCompleto: 'Alumno Lote Uno',
        correo: 'lote-ret-uno@prueba.test',
        grupo: 'A'
      })
      .expect(201);
    await request(app)
      .post('/api/alumnos')
      .set(auth)
      .send({
        periodoId: base.periodoId,
        matricula: 'CUH512410171',
        nombreCompleto: 'Alumno Lote Dos',
        correo: 'lote-ret-dos@prueba.test',
        grupo: 'A'
      })
      .expect(201);

    const loteId = 'LOTPURGE01';
    const lote = await request(app)
      .post('/api/examenes/generados/lote')
      .set(auth)
      .send({ plantillaId: base.plantillaId, loteId })
      .expect(201);
    expect(lote.body?.loteId).toBe(loteId);
    expect(Array.isArray(lote.body?.examenesGenerados)).toBe(true);
    expect(lote.body?.examenesGenerados).toHaveLength(2);

    // Simula respuesta perdida: repetir el mismo loteId debe recuperar/reanudar
    // esos exámenes y no crear filas nuevas.
    const reintentoLote = await request(app)
      .post('/api/examenes/generados/lote')
      .set(auth)
      .send({ plantillaId: base.plantillaId, loteId })
      .expect(201);
    expect(reintentoLote.body?.loteId).toBe(loteId);
    expect(reintentoLote.body?.examenesGenerados.map((item: { _id: string }) => item._id).sort())
      .toEqual(lote.body.examenesGenerados.map((item: { _id: string }) => item._id).sort());
    expect(await prisma.examenGenerado.count({ where: { loteId } })).toBe(2);

    const descargaAntes = await descargarPdfLote(auth, loteId);
    expect(descargaAntes.status).toBe(200);
    expect(String(descargaAntes.headers['content-type'] || '')).toContain('application/pdf');

    const purge = await request(app)
      .post('/api/examenes/generados/purge')
      .set(auth)
      .send({ dryRun: false, scope: 'all', olderThanDays: 40 })
      .expect(200);
    expect(purge.body?.data?.documentosActualizados).toBeGreaterThanOrEqual(3);

    const descargaDespues = await request(app)
      .get(`/api/examenes/generados/lote/${encodeURIComponent(loteId.toLowerCase())}/pdf`)
      .set(auth)
      .expect(410);
    expect(descargaDespues.body?.error?.codigo).toBe('EXAMEN_ARTIFACTOS_EXPURGADOS');

    const examenesLote = await prisma.examenGenerado.findMany({ where: { loteId } });
    expect(examenesLote).toHaveLength(2);
    for (const examen of examenesLote) {
      expect(examen.retentionStatus).toBe('artifacts_purged');
      expect(examen.rutaPdf ?? null).toBeNull();
    }
  });
});
