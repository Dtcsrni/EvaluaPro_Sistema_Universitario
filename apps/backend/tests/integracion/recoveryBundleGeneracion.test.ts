import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { ExamenGenerado } from '../../src/modulos/modulo_generacion_pdf/modeloExamenGenerado';
import { ExamenPlantilla } from '../../src/modulos/modulo_generacion_pdf/modeloExamenPlantilla';
import { ExamenRecoveryBundle } from '../../src/modulos/modulo_generacion_pdf/modeloExamenRecoveryBundle';
import { extraerResumenQrExamen } from '../../src/modulos/modulo_generacion_pdf/domain/qrExamen';
import { verificarRecoveryBundle, verificarRecoveryManifest } from '../../src/modulos/modulo_generacion_pdf/domain/recoveryManifest';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

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

    const preguntasIds: string[] = [];
    for (let i = 0; i < 20; i += 1) {
      const pregunta = await request(app)
        .post('/api/banco-preguntas')
        .set(auth)
        .send({
          periodoId,
          enunciado: `Pregunta recovery ${i + 1}`,
          opciones: [
            { texto: 'A', esCorrecta: i % 5 === 0 },
            { texto: 'B', esCorrecta: i % 5 === 1 },
            { texto: 'C', esCorrecta: i % 5 === 2 },
            { texto: 'D', esCorrecta: i % 5 === 3 },
            { texto: 'E', esCorrecta: i % 5 === 4 }
          ]
        })
        .expect(201);
      preguntasIds.push(String(pregunta.body.pregunta._id));
    }

    const plantilla = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Plantilla Recovery',
        numeroPaginas: 3,
        preguntasIds
      })
      .expect(201);

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
  });

  it('reporta progreso de lote en estados iniciando, generando y completado', async () => {
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
  });
});
