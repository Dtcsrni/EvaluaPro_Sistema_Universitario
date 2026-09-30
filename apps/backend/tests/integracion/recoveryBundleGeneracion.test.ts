/**
 * recoveryBundleGeneracion.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { ExamenGenerado } from '../../src/modulos/modulo_generacion_pdf/modeloExamenGenerado.js';
import { ExamenPlantilla } from '../../src/modulos/modulo_generacion_pdf/modeloExamenPlantilla.js';
import { ExamenRecoveryBundle } from '../../src/modulos/modulo_generacion_pdf/modeloExamenRecoveryBundle.js';
import { extraerResumenQrExamen } from '../../src/modulos/modulo_generacion_pdf/domain/qrExamen.js';
import { verificarRecoveryBundle, verificarRecoveryManifest } from '../../src/modulos/modulo_generacion_pdf/domain/recoveryManifest.js';
import { resolverRutaPdfExamen } from '../../src/infraestructura/archivos/almacenLocal.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

describe('generación PDF: recovery manifest y bundle', () => {
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

  async function prepararEscenarioBase() {
    const registro = await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Recovery',
        correo: 'docente-recovery@cuh.mx',
        contrasena: 'Secreto123!'
      })
      .expect(201);
    const auth = { Authorization: `Bearer ${registro.body.token as string}` };

    const periodo = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Periodo Recovery',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-06-01',
        grupos: ['A']
      })
      .expect(201);

    const periodoId = periodo.body.periodo._id as string;
    await request(app)
      .post('/api/alumnos')
      .set(auth)
      .send({
        periodoId,
        matricula: 'CUH512410168',
        nombreCompleto: 'Alumno Recovery Uno',
        correo: 'alumno-recovery-uno@cuh.mx',
        grupo: 'A'
      })
      .expect(201);
    await request(app)
      .post('/api/alumnos')
      .set(auth)
      .send({
        periodoId,
        matricula: 'CUH512410169',
        nombreCompleto: 'Alumno Recovery Dos',
        correo: 'alumno-recovery-dos@cuh.mx',
        grupo: 'A'
      })
      .expect(201);

    const tema = await request(app)
      .post('/api/banco-preguntas/temas')
      .set(auth)
      .send({ periodoId, nombre: 'Recovery PDF' })
      .expect(201);
    const temaId = String(tema.body.tema._id);
    const batchId = `recovery-${Date.now()}`;
    const batch = {
      contract: 'evaluapro.reactivos.batch',
      schemaVersion: 1,
      batchId,
      target: { periodoId, temaIds: [temaId] },
      source: { kind: 'manual', generator: 'recoveryBundleGeneracion.test', generatedAt: new Date().toISOString() },
      items: Array.from({ length: 40 }, (_, index) => ({
        externalKey: `${batchId}-${index + 1}`,
        itemId: null,
        expectedVersion: null,
        format: 'omr.mcq5',
        stem: { format: 'richtext', value: `Pregunta recovery ${index + 1}` },
        options: ['A', 'B', 'C', 'D', 'E'].map((key, optionIndex) => ({ key, value: `Opción ${key}`, isCorrect: optionIndex === index % 5 })),
        metadata: { difficultyHypothesis: 'medium' },
        provenance: { origin: 'authored', confidence: 1, notes: 'Fixture de regresión recuperación de lote.' }
      }))
    };
    const preview = await request(app).post('/api/banco-preguntas/importaciones/preview').set(auth).send(batch).expect(200);
    const confirmado = await request(app)
      .post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`)
      .set(auth)
      .send({ planHash: preview.body.planHash, payload: batch })
      .expect(200);
    const preguntasIds: string[] = [];
    for (const reactivoId of confirmado.body.reactivoIds as string[]) {
      await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/revisar`).set(auth).send({}).expect(200);
      const publicado = await request(app).post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`).set(auth).send({}).expect(200);
      preguntasIds.push(String(publicado.body.legacyPreguntaId));
    }

    const plantilla = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Plantilla Recovery',
        numeroPaginas: 4,
        preguntasIds
      })
      .expect(201);

    await request(app)
      .get(`/api/examenes/plantillas/${plantilla.body.plantilla._id}/previsualizar/pdf`)
      .set(auth)
      .expect(200);

    return { auth, periodoId, plantillaId: String(plantilla.body.plantilla._id) };
  }

  async function descargarPdfLote(auth: Record<string, string>, loteId: string) {
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

  async function consultarProgresoLote(auth: Record<string, string>, loteId: string, plantillaId?: string) {
    const req = request(app)
      .get(`/api/examenes/generados/lote/${encodeURIComponent(loteId)}/progreso`)
      .set(auth);
    if (plantillaId) req.query({ plantillaId });
    return req.expect(200);
  }

  it('persiste manifiesto firmado y keyId de QR en examen individual', async () => {
    const base = await prepararEscenarioBase();
    const respuesta = await request(app)
      .post('/api/examenes/generados')
      .set(base.auth)
      .send({ plantillaId: base.plantillaId })
      .expect(201);

    const examenId = String(respuesta.body.examenGenerado._id);
    const examen = await ExamenGenerado.findById(examenId).lean();
    expect(examen).toBeTruthy();
    const manifest = (examen as { recoveryManifest?: unknown })?.recoveryManifest;
    expect(manifest).toBeTruthy();
    expect(verificarRecoveryManifest(manifest as never)).toBe(true);
    expect((examen as { recoveryManifestHash?: unknown })?.recoveryManifestHash).toBe(
      (manifest as { manifestHash?: string }).manifestHash
    );
    const qr = String((examen as { paginas?: Array<{ qrTexto?: string }> })?.paginas?.[0]?.qrTexto ?? '');
    const qrResumen = extraerResumenQrExamen(qr);
    expect(qrResumen?.keyId).toBeTruthy();
    expect((manifest as { qrKeyId?: string }).qrKeyId).toBe(qrResumen?.keyId);
  });

  it('persiste bundle firmado por lote y lo referencia desde los exámenes', async () => {
    const base = await prepararEscenarioBase();
    const lote = await request(app)
      .post('/api/examenes/generados/lote')
      .set(base.auth)
      .send({ plantillaId: base.plantillaId, loteId: 'LOTREC01' })
      .expect(201);

    expect(Array.isArray(lote.body.examenesGenerados)).toBe(true);
    expect(lote.body.examenesGenerados.length).toBe(2);
    const paginasPorExamen = lote.body.paginasPorExamen as number;
    const totalPaginas = lote.body.totalPaginas as number;
    expect(paginasPorExamen).toBeGreaterThan(0);
    expect(totalPaginas).toBe(paginasPorExamen * lote.body.examenesGenerados.length);
    expect(lote.body.pdfSha256).toMatch(/^[a-f0-9]{64}$/i);
    const artefactoPersistido = await prisma.$queryRaw<Array<{ archivoNombre: string; sha256: string; totalPaginas: number; totalExamenes: number }>>`
      SELECT archivoNombre, sha256, totalPaginas, totalExamenes
      FROM examen_lote_artefactos_pdf
      WHERE loteId = 'LOTREC01'
    `;
    expect(artefactoPersistido[0]).toMatchObject({
      sha256: lote.body.pdfSha256,
      totalPaginas,
      totalExamenes: 2
    });
    const bundleDoc = await ExamenRecoveryBundle.findOne({ loteId: 'LOTREC01' }).lean();
    expect(bundleDoc).toBeTruthy();
    expect(verificarRecoveryBundle((bundleDoc as { bundle?: unknown }).bundle as never)).toBe(true);
    const examenes = await ExamenGenerado.find({ loteId: 'LOTREC01' }).lean();
    expect(examenes).toHaveLength(2);
    for (const examen of examenes as Array<{ recoveryBundleId?: unknown; recoveryBundleHash?: string; recoveryManifest?: unknown }>) {
      expect(examen.recoveryBundleId).toBeTruthy();
      expect(examen.recoveryBundleHash).toBe((bundleDoc as { bundleHash?: string }).bundleHash);
      expect(verificarRecoveryManifest(examen.recoveryManifest as never)).toBe(true);
    }

    const descargaUpper = await descargarPdfLote(base.auth, 'LOTREC01');
    const descargaLower = await descargarPdfLote(base.auth, 'lotrec01');
    expect(descargaUpper.status).toBe(200);
    expect(descargaLower.status).toBe(200);
    expect(String(descargaUpper.headers['content-type'] || '')).toContain('application/pdf');
    expect(String(descargaLower.headers['content-type'] || '')).toContain('application/pdf');
    expect(Buffer.compare(descargaUpper.body as Buffer, descargaLower.body as Buffer)).toBe(0);
    const pdfBytes = descargaUpper.body as Buffer;
    expect(descargaUpper.headers['x-evaluapro-pdf-sha256']).toBe(createHash('sha256').update(pdfBytes).digest('hex'));
    expect(descargaUpper.headers['x-evaluapro-pdf-pages']).toBe(String(totalPaginas));
    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBe(totalPaginas);

    const foliosOriginales = (examenes as Array<{ _id: unknown; folio: string }>).map(({ _id, folio }) => [String(_id), folio]).sort();
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER inyectar_fallo_persistencia_pdf_lote
      BEFORE INSERT ON examen_lote_artefactos_pdf
      WHEN NEW.loteId = 'LOTREC01'
      BEGIN SELECT RAISE(ABORT, 'fallo de persistencia inyectado por regresión'); END;
    `);
    try {
      await request(app)
        .post('/api/examenes/generados/lote')
        .set(base.auth)
        .send({ plantillaId: base.plantillaId, loteId: 'LOTREC01' })
        .expect(500);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS inyectar_fallo_persistencia_pdf_lote');
    }
    const progresoTrasFallo = await consultarProgresoLote(base.auth, 'LOTREC01', base.plantillaId);
    expect(progresoTrasFallo.body).toMatchObject({ fallidos: 2, completado: false, estado: 'fallido' });
    const descargaDuranteFallo = await descargarPdfLote(base.auth, 'LOTREC01');
    expect(descargaDuranteFallo.status).toBe(409);

    const reanudado = await request(app)
      .post('/api/examenes/generados/lote')
      .set(base.auth)
      .send({ plantillaId: base.plantillaId, loteId: 'LOTREC01' })
      .expect(201);
    const examenesReanudados = await ExamenGenerado.find({ loteId: 'LOTREC01' }).lean();
    expect(examenesReanudados).toHaveLength(2);
    expect((examenesReanudados as Array<{ estado: string }>).every(({ estado }) => estado === 'generado')).toBe(true);
    expect((examenesReanudados as Array<{ _id: unknown; folio: string }>).map(({ _id, folio }) => [String(_id), folio]).sort()).toEqual(foliosOriginales);
    expect(reanudado.body.pdfSha256).toMatch(/^[a-f0-9]{64}$/i);
    const descargaReanudada = await descargarPdfLote(base.auth, 'LOTREC01');
    expect(descargaReanudada.status).toBe(200);
    expect(descargaReanudada.headers['x-evaluapro-pdf-sha256']).toBe(reanudado.body.pdfSha256);

    const rutaPaquete = resolverRutaPdfExamen(artefactoPersistido[0]!.archivoNombre);
    const paqueteOriginal = await readFile(rutaPaquete);
    const pdfAlterado = await PDFDocument.create();
    for (let pagina = 0; pagina < totalPaginas; pagina += 1) pdfAlterado.addPage([612, 792]);
    await writeFile(rutaPaquete, await pdfAlterado.save());
    try {
      const descargaCorrupta = await descargarPdfLote(base.auth, 'LOTREC01');
      expect(descargaCorrupta.status).toBe(409);
      expect(JSON.parse((descargaCorrupta.body as Buffer).toString('utf8')).error.codigo).toBe('LOTE_PDF_INTEGRIDAD_INVALIDA');
    } finally {
      await writeFile(rutaPaquete, paqueteOriginal);
    }
  });

  it('reporta progreso de lote en estados iniciando, generando, fallido y completado', async () => {
    const base = await prepararEscenarioBase();
    const plantilla = await ExamenPlantilla.findById(base.plantillaId).lean();
    expect(plantilla).toBeTruthy();

    const loteId = 'LOTPROG01';
    const progresoInicial = await consultarProgresoLote(base.auth, loteId, base.plantillaId);
    expect(progresoInicial.body).toMatchObject({
      loteId,
      totalEsperado: 2,
      generados: 0,
      porcentaje: 0,
      completado: false,
      estado: 'iniciando'
    });

    await ExamenGenerado.create({
      docenteId: plantilla?.docenteId,
      periodoId: plantilla?.periodoId,
      plantillaId: plantilla?._id,
      loteId,
      origenGeneracion: 'lote',
      folio: 'LOTGEN01',
      mapaVariante: { ordenPreguntas: [] },
      paginas: []
    });

    const progresoParcial = await consultarProgresoLote(base.auth, loteId, base.plantillaId);
    expect(progresoParcial.body).toMatchObject({
      loteId,
      totalEsperado: 2,
      generados: 1,
      porcentaje: 50,
      completado: false,
      estado: 'generando'
    });
    const progresoParcialLower = await consultarProgresoLote(base.auth, loteId.toLowerCase(), base.plantillaId);
    expect(progresoParcialLower.body).toMatchObject({
      loteId,
      totalEsperado: 2,
      generados: 1,
      porcentaje: 50,
      completado: false,
      estado: 'generando'
    });

    await ExamenGenerado.create({
      docenteId: plantilla?.docenteId,
      periodoId: plantilla?.periodoId,
      plantillaId: plantilla?._id,
      loteId,
      origenGeneracion: 'lote',
      folio: 'LOTGEN02',
      mapaVariante: { ordenPreguntas: [] },
      paginas: []
    });

    const progresoCompleto = await consultarProgresoLote(base.auth, loteId, base.plantillaId);
    expect(progresoCompleto.body).toMatchObject({
      loteId,
      totalEsperado: 2,
      generados: 2,
      porcentaje: 100,
      completado: true,
      estado: 'completado'
    });

    await ExamenGenerado.updateOne({ loteId, folio: 'LOTGEN01' }, { $set: { estado: 'fallido' } });
    const progresoFallido = await consultarProgresoLote(base.auth, loteId, base.plantillaId);
    expect(progresoFallido.body).toMatchObject({ fallidos: 1, completado: false, estado: 'fallido' });
  });
});
