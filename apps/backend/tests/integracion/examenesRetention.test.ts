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
import { crearApp } from '../../src/app';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('retención de exámenes generados', () => {
  const app = crearApp();
  const dataDir = path.join(process.cwd(), 'data', 'examenes');

  beforeAll(async () => {
    await conectarMongoTest();
    await fs.mkdir(dataDir, { recursive: true });
  });

  beforeEach(async () => {
    await limpiarMongoTest();
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.mkdir(dataDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
    await cerrarMongoTest();
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

  async function crearEscenario(auth: { Authorization: string }) {
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Periodo Retencion',
        fechaInicio: '2025-01-01',
        fechaFin: '2025-06-01',
        grupos: ['A']
      })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;

    const preguntasIds: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      const preguntaResp = await request(app)
        .post('/api/banco-preguntas')
        .set(auth)
        .send({
          periodoId,
          enunciado: `Pregunta retencion ${i + 1}`,
          opciones: [
            { texto: 'A', esCorrecta: true },
            { texto: 'B', esCorrecta: false },
            { texto: 'C', esCorrecta: false },
            { texto: 'D', esCorrecta: false },
            { texto: 'E', esCorrecta: false }
          ]
        })
        .expect(201);
      preguntasIds.push(preguntaResp.body.pregunta._id as string);
    }

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
