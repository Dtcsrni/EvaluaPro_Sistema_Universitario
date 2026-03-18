import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { ExamenGenerado } from '../../src/modulos/modulo_generacion_pdf/modeloExamenGenerado';
import { ExamenRecoveryBundle } from '../../src/modulos/modulo_generacion_pdf/modeloExamenRecoveryBundle';
import { ExamenRecoveryManifest } from '../../src/modulos/modulo_generacion_pdf/modeloExamenRecoveryManifest';
import { Tenant } from '../../src/modulos/modulo_comercial_core/modeloTenant';
import { Suscripcion } from '../../src/modulos/modulo_comercial_core/modeloSuscripcion';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente';
import {
  reconstruirDesdeBundle,
  reconstruirDesdeManifest,
  verificarArtifactsRecuperacion
} from '../../src/modulos/modulo_recuperacion_examenes/servicioRecuperacionExamenes';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('recuperacion de examenes', () => {
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
        nombreCompleto: 'Docente Recovery Service',
        correo: 'docente-recovery-service@cuh.mx',
        contrasena: 'Secreto123!'
      })
      .expect(201);
    const token = String(registro.body.token);
    const docente = await Docente.findOne({ correo: 'docente-recovery-service@cuh.mx' }).lean();
    const docenteId = String((docente as { _id?: unknown })._id ?? '');
    const auth = { Authorization: `Bearer ${token}` };

    await Tenant.create({
      tenantId: 'tenant-recovery-service',
      nombre: 'Tenant Recovery',
      modalidad: 'saas',
      estado: 'activo',
      ownerDocenteId: docenteId
    });
    await Suscripcion.create({
      tenantId: 'tenant-recovery-service',
      planId: 'plan-pro',
      ciclo: 'mensual',
      estado: 'activo'
    });

    const periodo = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Periodo Recovery Service',
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
        matricula: 'CUH512410800',
        nombreCompleto: 'Alumno Recovery Service',
        correo: 'alumno-recovery-service@cuh.mx',
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
          enunciado: `Pregunta recovery service ${i + 1}`,
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
        titulo: 'Plantilla Recovery Service',
        numeroPaginas: 3,
        preguntasIds
      })
      .expect(201);

    return { auth, docenteId, periodoId, plantillaId: String(plantilla.body.plantilla._id) };
  }

  it('verifica y reconstruye un examen desde manifest', async () => {
    const base = await prepararEscenarioBase();
    const generacion = await request(app)
      .post('/api/examenes/generados')
      .set(base.auth)
      .send({ plantillaId: base.plantillaId })
      .expect(201);
    const examenOriginalId = String(generacion.body.examenGenerado._id);
    const examenOriginal = await ExamenGenerado.findById(examenOriginalId).lean();
    const manifestHash = String((examenOriginal as { recoveryManifestHash?: unknown }).recoveryManifestHash ?? '');

    const verificacion = await verificarArtifactsRecuperacion({
      actorDocenteId: base.docenteId,
      actorRoles: ['docente'],
      manifestHash
    });
    expect(verificacion.signatureValid).toBe(true);
    expect(verificacion.recoverable).toBe(true);

    await ExamenGenerado.deleteOne({ _id: examenOriginalId });

    const reconstruccion = await reconstruirDesdeManifest({
      actorDocenteId: base.docenteId,
      actorRoles: ['docente'],
      manifestHash
    });
    expect(reconstruccion.status).toBe('reconstruida');
    expect(reconstruccion.reconstructedExamIds).toHaveLength(1);

    const reconstruido = await ExamenGenerado.findById(reconstruccion.reconstructedExamIds[0]).lean();
    expect(reconstruido).toBeTruthy();
    expect((reconstruido as { recoveryManifestHash?: string }).recoveryManifestHash).toBe(manifestHash);
  });

  it('reconstruye un lote completo desde bundle y conserva idempotencia por manifest', async () => {
    const base = await prepararEscenarioBase();
    await request(app)
      .post('/api/alumnos')
      .set(base.auth)
      .send({
        periodoId: base.periodoId,
        matricula: 'CUH512410801',
        nombreCompleto: 'Alumno Recovery Service Dos',
        correo: 'alumno-recovery-service-dos@cuh.mx',
        grupo: 'A'
      })
      .expect(201);

    await request(app)
      .post('/api/examenes/generados/lote')
      .set(base.auth)
      .send({ plantillaId: base.plantillaId, loteId: 'LOTRECOVERYSVC' })
      .expect(201);

    const bundleDoc = await ExamenRecoveryBundle.findOne({ loteId: 'LOTRECOVERYSVC' }).lean();
    const bundleHash = String((bundleDoc as { bundleHash?: unknown }).bundleHash ?? '');
    const originalCount = await ExamenGenerado.countDocuments({ loteId: 'LOTRECOVERYSVC' });
    await ExamenGenerado.deleteMany({ loteId: 'LOTRECOVERYSVC' });

    const reconstruccion = await reconstruirDesdeBundle({
      actorDocenteId: base.docenteId,
      actorRoles: ['docente'],
      bundleHash
    });
    expect(reconstruccion.status).toBe('reconstruida');
    expect(reconstruccion.reconstructedExamIds).toHaveLength(originalCount);

    const reconstruidos = await ExamenGenerado.countDocuments({ loteId: 'LOTRECOVERYSVC' });
    expect(reconstruidos).toBe(originalCount);
  });

  it('rechaza recuperación si el docente no tiene plan activo', async () => {
    const base = await prepararEscenarioBase();
    await request(app)
      .post('/api/examenes/generados')
      .set(base.auth)
      .send({ plantillaId: base.plantillaId })
      .expect(201);
    const manifestDoc = await ExamenRecoveryManifest.findOne().lean();
    await Suscripcion.deleteMany({ tenantId: 'tenant-recovery-service' });

    await expect(
      verificarArtifactsRecuperacion({
        actorDocenteId: base.docenteId,
        actorRoles: ['docente'],
        manifestHash: String((manifestDoc as { manifestHash?: unknown }).manifestHash ?? '')
      })
    ).rejects.toMatchObject({ codigo: 'NO_AUTORIZADO' });
  });
});
