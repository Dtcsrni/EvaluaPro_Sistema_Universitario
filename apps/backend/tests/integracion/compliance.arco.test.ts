/**
 * Pruebas de integracion para modulo compliance (ARCO/retencion/auditoria).
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('modulo compliance', () => {
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

  async function crearDocenteConRoles(correo: string, roles: string[]) {
    const docente = await Docente.create({
      nombreCompleto: 'Docente Compliance',
      correo,
      passwordHash: 'hash-temp',
      roles,
      activo: true
    });
    const token = crearTokenDocente({ docenteId: String(docente._id), roles });
    return { docenteId: String(docente._id), auth: { Authorization: `Bearer ${token}` } };
  }

  it('expone status y permite registrar solicitud DSR', async () => {
    const { auth } = await crearDocenteConRoles('compliance-docente@local.test', ['docente']);

    const statusInicial = await request(app).get('/api/compliance/status').set(auth).expect(200);
    expect(statusInicial.body?.data?.pendingDsr).toBe(0);

    const crear = await request(app)
      .post('/api/compliance/dsr')
      .set(auth)
      .send({
        tipo: 'acceso',
        titularRef: 'alumno-001',
        scope: 'historial-academico'
      })
      .expect(201);

    expect(crear.body?.data?.id).toBeTruthy();

    const statusPosterior = await request(app).get('/api/compliance/status').set(auth).expect(200);
    expect(statusPosterior.body?.data?.pendingDsr).toBe(1);

    const audit = await request(app).get('/api/compliance/audit-log').set(auth).expect(200);
    expect(Array.isArray(audit.body?.data?.eventos)).toBe(true);
    expect((audit.body?.data?.eventos?.length ?? 0) >= 1).toBe(true);
  });

  it('permite purge a admin y bloquea a docente sin permiso expurgar', async () => {
    const docente = await crearDocenteConRoles('docente-nopurge@local.test', ['docente']);
    const admin = await crearDocenteConRoles('admin-purge@local.test', ['admin']);

    await request(app)
      .post('/api/compliance/dsr')
      .set(admin.auth)
      .send({
        tipo: 'cancelacion',
        titularRef: 'alumno-002',
        scope: 'calificaciones'
      })
      .expect(201);

    await request(app).post('/api/compliance/purge').set(docente.auth).send({ dryRun: true }).expect(403);

    const purge = await request(app)
      .post('/api/compliance/purge')
      .set(admin.auth)
      .send({ dryRun: true, olderThanDays: 1 })
      .expect(200);

    expect(typeof purge.body?.data?.dsrCandidatos).toBe('number');
  });
});
