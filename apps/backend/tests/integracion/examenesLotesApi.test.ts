import request from 'supertest';
import { createHash, randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { eliminarArchivoExamen, guardarPdfExamen } from '../../src/infraestructura/archivos/almacenLocal.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

describe('consulta API de paquetes de examen por lote', () => {
  const app = crearApp();

  beforeAll(async () => { await conectarSqliteTest(); });
  beforeEach(async () => { await limpiarSqliteTest(); });
  afterAll(async () => { await cerrarSqliteTest(); });

  async function prepararDocente(correo: string) {
    const registro = await request(app).post('/api/autenticacion/registrar').send({
      nombreCompleto: 'Docente de lotes', correo, contrasena: 'Secreto123!'
    }).expect(201);
    const auth = { Authorization: `Bearer ${registro.body.token}` };
    const periodoResp = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Periodo lotes', fechaInicio: '2026-01-01', fechaFin: '2026-06-01'
    }).expect(201);
    const periodoId = String(periodoResp.body.periodo._id);
    const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId }, select: { docenteId: true } });
    const plantilla = await prisma.examenPlantilla.create({
      data: {
        docenteId: periodo.docenteId, periodoId, tipo: 'parcial', titulo: 'Plantilla lotes',
        tituloNormalizado: 'plantilla lotes', bookletConfig: '{}', omrConfig: '{}', configuracionPdf: '{}'
      }
    });
    return { auth, docenteId: periodo.docenteId, periodoId, plantillaId: plantilla.id };
  }

  async function crearPaquete(docenteId: string, plantillaId: string, loteId: string, actualizado: Date) {
    return prisma.examenLoteArtefactoPdf.create({
      data: {
        docenteId, loteId, plantillaId, archivoNombre: `bundle-${loteId}.pdf`,
        sha256: 'a'.repeat(64), totalPaginas: 12, totalExamenes: 6, updatedAt: actualizado
      }
    });
  }

  it('pagina paquetes completos, filtra por plantilla y aísla docentes', async () => {
    const owner = await prepararDocente('lotes-owner@prueba.test');
    const base = new Date('2026-01-01T00:00:00.000Z');
    await crearPaquete(owner.docenteId, owner.plantillaId, 'LOT_0001', new Date(base.getTime() + 1_000));
    await crearPaquete(owner.docenteId, owner.plantillaId, 'LOT_0002', new Date(base.getTime() + 2_000));
    await crearPaquete(owner.docenteId, owner.plantillaId, 'LOT_0003', new Date(base.getTime() + 3_000));

    const other = await prepararDocente('lotes-other@prueba.test');
    await crearPaquete(other.docenteId, other.plantillaId, 'OTHER_01', new Date(base.getTime() + 4_000));

    const first = await request(app).get('/api/examenes/generados/lotes?limite=2').set(owner.auth).expect(200);
    expect(first.body.lotes.map((row: { loteId: string }) => row.loteId)).toEqual(['LOT_0003', 'LOT_0002']);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    expect(first.body.lotes[0]).toMatchObject({ plantillaId: owner.plantillaId, totalPaginas: 12, totalExamenes: 6 });
    expect(first.body.lotes[0].pdfUrl).toBe('/examenes/generados/lote/LOT_0003/pdf');
    expect(JSON.stringify(first.body)).not.toContain('bundle-LOT_0003.pdf');

    const second = await request(app)
      .get(`/api/examenes/generados/lotes?limite=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set(owner.auth)
      .expect(200);
    expect(second.body.lotes.map((row: { loteId: string }) => row.loteId)).toEqual(['LOT_0001']);
    expect(second.body.nextCursor).toBeNull();
    await request(app).get(`/api/examenes/generados/lotes?plantillaId=${owner.plantillaId}`).set(owner.auth).expect(200).expect(({ body }) => {
      expect(body.lotes).toHaveLength(3);
    });
    await request(app).get('/api/examenes/generados/lotes?limite=101').set(owner.auth).expect(400);
    await request(app).get('/api/examenes/generados/lotes?cursor=e30').set(owner.auth).expect(400);
    const isolated = await request(app).get('/api/examenes/generados/lotes').set(other.auth).expect(200);
    expect(isolated.body.lotes.map((row: { loteId: string }) => row.loteId)).toEqual(['OTHER_01']);
  });

  it('archiva y restaura un paquete de forma atómica, idempotente y auditable sin borrar sus referencias', async () => {
    const owner = await prepararDocente('lotes-lifecycle@prueba.test');
    const alumno = await prisma.alumno.create({
      data: {
        periodoId: owner.periodoId,
        matricula: `MAT-${randomUUID()}`,
        nombreCompleto: 'Alumno de prueba',
        correo: `alumno-${randomUUID()}@prueba.test`
      }
    });
    const loteId = 'LOT_LIFECYCLE';
    const archivoNombre = `lote-lifecycle-${randomUUID()}.pdf`;
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    const pdfBytes = Buffer.from(await pdf.save());
    const sha256 = createHash('sha256').update(pdfBytes).digest('hex');
    await guardarPdfExamen(archivoNombre, pdfBytes);
    try {
      const examen = await prisma.examenGenerado.create({
        data: {
          docenteId: owner.docenteId,
          plantillaId: owner.plantillaId,
          periodoId: owner.periodoId,
          alumnoId: alumno.id,
          loteId,
          folio: `LIFECYCLE-${randomUUID()}`,
          estado: 'generado',
          mapaVariante: JSON.stringify({ ordenPreguntas: [] }),
          mapaOmr: JSON.stringify({ paginas: [{ numero: 1 }] }),
          retentionStatus: 'active'
        }
      });
      const artefacto = await prisma.examenLoteArtefactoPdf.create({
        data: {
          docenteId: owner.docenteId,
          loteId,
          plantillaId: owner.plantillaId,
          archivoNombre,
          sha256,
          totalPaginas: 1,
          totalExamenes: 1
        }
      });
      await prisma.entrega.create({
        data: {
          examenGeneradoId: examen.id,
          alumnoId: alumno.id,
          docenteId: owner.docenteId,
          estado: 'entregado'
        }
      });
      await prisma.calificacion.create({
        data: {
          docenteId: owner.docenteId,
          examenGeneradoId: examen.id,
          alumnoId: alumno.id,
          periodoId: owner.periodoId,
          tipoExamen: 'parcial',
          totalReactivos: 1,
          aciertos: 1,
          fraccion: '{}',
          calificacionExamenTexto: '10',
          bonoTexto: '0',
          calificacionExamenFinalTexto: '10'
        }
      });
      const escaneoOmr = await prisma.escaneoOmrArchivado.create({
        data: {
          docenteId: owner.docenteId,
          alumnoId: alumno.id,
          periodoId: owner.periodoId,
          plantillaId: owner.plantillaId,
          examenGeneradoId: examen.id,
          folio: examen.folio,
          numeroPagina: 1,
          mimeType: 'application/pdf',
          tamanoOriginalBytes: 7,
          tamanoComprimidoBytes: 7,
          sha256Original: createHash('sha256').update('fixture').digest('hex'),
          estadoAnalisis: 'needs_review',
          payloadComprimido: Buffer.from('fixture')
        }
      });
      const archiveRequestId = randomUUID();
      const restoreRequestId = randomUUID();

      await request(app).post(`/api/examenes/generados/lote/${loteId}/archivar`).set(owner.auth).send({ clientRequestId: archiveRequestId }).expect(200).expect(({ body }) => {
        expect(body).toMatchObject({ ok: true, loteId, archivado: true, repetida: false });
        expect(body.archivadoEn).toEqual(expect.any(String));
      });
      const archivado = await prisma.examenGenerado.findUniqueOrThrow({ where: { id: examen.id } });
      expect(archivado.archivadoEn).not.toBeNull();
      expect(await prisma.calificacion.count({ where: { docenteId: owner.docenteId, examenGeneradoId: examen.id } })).toBe(1);
      expect(await prisma.entrega.count({ where: { docenteId: owner.docenteId, examenGeneradoId: examen.id } })).toBe(1);
      expect(await prisma.escaneoOmrArchivado.count({ where: { id: escaneoOmr.id, examenGeneradoId: examen.id } })).toBe(1);
      await request(app).get(`/api/examenes/generados/lote/${loteId}/pdf`).set(owner.auth).expect(410);
      await request(app).get('/api/examenes/generados/lotes').set(owner.auth).expect(200).expect(({ body }) => {
        expect(body.lotes).toHaveLength(0);
      });
      await request(app).get('/api/examenes/generados/lotes?archivado=true').set(owner.auth).expect(200).expect(({ body }) => {
        expect(body.lotes).toMatchObject([{
          loteId,
          archivado: true,
          archivadoEn: expect.any(String)
        }]);
      });

      await request(app).post(`/api/examenes/generados/lote/${loteId}/archivar`).set(owner.auth).send({ clientRequestId: archiveRequestId }).expect(200).expect(({ body }) => {
        expect(body.repetida).toBe(true);
      });
      await request(app).post(`/api/examenes/generados/lote/${loteId}/restaurar`).set(owner.auth).send({ clientRequestId: archiveRequestId }).expect(409);
      const auditoria = await request(app).get(`/api/examenes/generados/lote/${loteId}/auditoria?limite=1`).set(owner.auth).expect(200);
      expect(auditoria.body.eventos).toMatchObject([{ accion: 'archivar', actorDocenteId: owner.docenteId }]);
      expect(auditoria.body.nextCursor).toBeNull();

      await request(app).post(`/api/examenes/generados/lote/${loteId}/restaurar`).set(owner.auth).send({ clientRequestId: restoreRequestId }).expect(200).expect(({ body }) => {
        expect(body).toMatchObject({ ok: true, loteId, archivado: false, repetida: false, archivadoEn: null });
      });
      await request(app).post(`/api/examenes/generados/lote/${loteId}/restaurar`).set(owner.auth).send({ clientRequestId: restoreRequestId }).expect(200).expect(({ body }) => {
        expect(body.repetida).toBe(true);
      });
      expect((await prisma.examenGenerado.findUniqueOrThrow({ where: { id: examen.id } })).archivadoEn).toBeNull();
      expect((await prisma.examenLoteArtefactoPdf.findUniqueOrThrow({ where: { id: artefacto.id } })).archivadoEn).toBeNull();
      expect(await prisma.calificacion.count({ where: { docenteId: owner.docenteId, examenGeneradoId: examen.id } })).toBe(1);
      expect(await prisma.entrega.count({ where: { docenteId: owner.docenteId, examenGeneradoId: examen.id } })).toBe(1);
      expect(await prisma.escaneoOmrArchivado.count({ where: { id: escaneoOmr.id, examenGeneradoId: examen.id } })).toBe(1);
      await request(app).get(`/api/examenes/generados/lote/${loteId}/pdf`).set(owner.auth).expect(200).expect('X-EvaluaPro-PDF-SHA256', sha256);
      await request(app).get(`/api/examenes/generados/lote/${loteId}/auditoria?limite=100`).set(owner.auth).expect(200).expect(({ body }) => {
        expect(body.eventos.map((evento: { accion: string }) => evento.accion)).toEqual(['restaurar', 'archivar']);
        expect(body.nextCursor).toBeNull();
      });
    } finally {
      await eliminarArchivoExamen(archivoNombre);
    }
  });
});
