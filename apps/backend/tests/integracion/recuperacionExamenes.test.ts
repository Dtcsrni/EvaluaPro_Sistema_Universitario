/**
 * recuperacionExamenes.test
 *
 * Responsabilidad: Verificar la recuperacion de examenes usando Prisma y SQLite.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite';
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
    const docente = await prisma.docente.findFirst({
      where: { correo: 'docente-recovery-service@cuh.mx' }
    });
    const docenteId = String(docente?.id ?? '');
    const auth = { Authorization: `Bearer ${token}` };

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
    for (let i = 0; i < 5; i += 1) {
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
    const examenOriginal = await prisma.examenGenerado.findUnique({
      where: { id: examenOriginalId }
    });
    const manifestHash = String(examenOriginal?.recoveryManifestHash ?? '');

    const verificacion = await verificarArtifactsRecuperacion({
      actorDocenteId: base.docenteId,
      actorRoles: ['docente'],
      manifestHash
    });
    expect(verificacion.signatureValid).toBe(true);
    expect(verificacion.recoverable).toBe(true);

    await prisma.examenGenerado.delete({
      where: { id: examenOriginalId }
    });

    const reconstruccion = await reconstruirDesdeManifest({
      actorDocenteId: base.docenteId,
      actorRoles: ['docente'],
      manifestHash
    });
    expect(reconstruccion.status).toBe('reconstruida');
    expect(reconstruccion.reconstructedExamIds).toHaveLength(1);

    const reconstruido = await prisma.examenGenerado.findUnique({
      where: { id: reconstruccion.reconstructedExamIds[0] }
    });
    expect(reconstruido).toBeTruthy();
    expect(reconstruido?.recoveryManifestHash).toBe(manifestHash);
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

    const bundleDoc = await prisma.examenRecoveryBundle.findFirst({
      where: { nombre: { contains: 'LOTRECOVERYSVC' } }
    });
    const bundleHash = String(bundleDoc?.bundleHash ?? '');
    const originalCount = await prisma.examenGenerado.count({
      where: { loteId: 'LOTRECOVERYSVC' }
    });
    await prisma.examenGenerado.deleteMany({
      where: { loteId: 'LOTRECOVERYSVC' }
    });

    const reconstruccion = await reconstruirDesdeBundle({
      actorDocenteId: base.docenteId,
      actorRoles: ['docente'],
      bundleHash
    });
    expect(reconstruccion.status).toBe('reconstruida');
    expect(reconstruccion.reconstructedExamIds).toHaveLength(originalCount);

    const reconstruidos = await prisma.examenGenerado.count({
      where: { loteId: 'LOTRECOVERYSVC' }
    });
    expect(reconstruidos).toBe(originalCount);
  });
});
