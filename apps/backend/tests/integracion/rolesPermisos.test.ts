/**
 * rolesPermisos.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../../src/app';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite';

describe('roles y permisos', () => {
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
    return await Docente.create({
      nombreCompleto: 'Docente Prueba',
      correo,
      roles,
      activo: true
    });
  }

  function authPara(docente: { _id: unknown }, roles: string[]) {
    const token = crearTokenDocente({ docenteId: String(docente._id), roles });
    return { Authorization: `Bearer ${token}` };
  }

  it('permite lectura pero bloquea escritura cuando el rol es lector', async () => {
    const docente = await crearDocenteConRoles('lector@local.test', ['lector']);
    const auth = authPara(docente, ['lector']);

    await request(app).get('/api/periodos').set(auth).expect(200);
    await request(app).post('/api/periodos').set(auth).send({}).expect(403);
  });

  it('permite calificar a auxiliar y bloquea a lector', async () => {
    const docenteAux = await crearDocenteConRoles('aux@local.test', ['auxiliar']);
    const docenteLector = await crearDocenteConRoles('lector2@local.test', ['lector']);

    const authAux = authPara(docenteAux, ['auxiliar']);
    const authLector = authPara(docenteLector, ['lector']);

    const respAux = await request(app).post('/api/calificaciones/calificar').set(authAux).send({}).expect(400);
    expect(respAux.body?.error?.codigo || respAux.body?.codigo).toBeTruthy();

    await request(app).post('/api/calificaciones/calificar').set(authLector).send({}).expect(403);
  });

  it('restringe los endpoints admin a usuarios con rol admin', async () => {
    const docente = await crearDocenteConRoles('docente@local.test', ['docente']);
    const admin = await crearDocenteConRoles('admin@local.test', ['admin']);

    const authDocente = authPara(docente, ['docente']);
    const authAdmin = authPara(admin, ['admin']);

    await request(app).get('/api/admin/docentes').set(authDocente).expect(403);

    const respuesta = await request(app).get('/api/admin/docentes').set(authAdmin).expect(200);
    expect(respuesta.body?.docentes?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('bloquea access token vigente cuando el docente queda inactivo', async () => {
    const docente = await crearDocenteConRoles('inactivo@local.test', ['docente']);
    const auth = authPara(docente, ['docente']);

    await request(app).get('/api/autenticacion/perfil').set(auth).expect(200);
    await Docente.updateOne({ _id: docente._id }, { $set: { activo: false } });

    const respuesta = await request(app).get('/api/autenticacion/perfil').set(auth).expect(403);
    expect(respuesta.body?.error?.codigo).toBe('DOCENTE_INACTIVO');
  });

  it('bloquea access token vigente cuando el docente ya no existe', async () => {
    const docente = await crearDocenteConRoles('eliminado@local.test', ['docente']);
    const auth = authPara(docente, ['docente']);

    await Docente.deleteOne({ _id: docente._id });

    const respuesta = await request(app).get('/api/autenticacion/perfil').set(auth).expect(401);
    expect(respuesta.body?.error?.codigo).toBe('NO_AUTORIZADO');
  });

  it('usa roles persistidos y no privilegios admin obsoletos del JWT', async () => {
    const admin = await crearDocenteConRoles('admin-reducido@local.test', ['admin']);
    const authAdmin = authPara(admin, ['admin']);

    await request(app).get('/api/admin/docentes').set(authAdmin).expect(200);
    await Docente.updateOne({ _id: admin._id }, { $set: { roles: ['docente'] } });

    await request(app).get('/api/admin/docentes').set(authAdmin).expect(403);
  });

  it('propaga error de lectura del docente al manejador de errores', async () => {
    const docente = await crearDocenteConRoles('lectura-fallida@local.test', ['docente']);
    const auth = authPara(docente, ['docente']);
    const error = new Error('consulta docente no disponible');

    const originalFindUnique = prisma.docente.findUnique;
    prisma.docente.findUnique = vi.fn().mockRejectedValueOnce(error);

    const respuesta = await request(app).get('/api/autenticacion/perfil').set(auth).expect(500);
    expect(respuesta.body?.error?.codigo).toBe('ERROR_INTERNO');

    prisma.docente.findUnique = originalFindUnique;
  });

  it('permite leer evaluaciones a lector pero bloquea gestión', async () => {
    const lector = await crearDocenteConRoles('lector-eval@local.test', ['lector']);
    const authLector = authPara(lector, ['lector']);

    await request(app).get('/api/evaluaciones/politicas').set(authLector).expect(200);
    await request(app)
      .post('/api/evaluaciones/configuracion-periodo')
      .set(authLector)
      .send({
        periodoId: '507f1f77bcf86cd799439011',
        politicaCodigo: 'POLICY_LISC_ENCUADRE_2026'
      })
      .expect(403);
  });

  it('permite classroom a docente y bloquea a lector por permisos', async () => {
    const docente = await crearDocenteConRoles('docente-classroom@local.test', ['docente']);
    const lector = await crearDocenteConRoles('lector-classroom@local.test', ['lector']);
    const authDocente = authPara(docente, ['docente']);
    const authLector = authPara(lector, ['lector']);

    await request(app)
      .get('/api/integraciones/classroom/oauth/iniciar')
      .set(authDocente)
      .expect((res) => {
        expect([200, 503]).toContain(res.status);
      });

    await request(app).get('/api/integraciones/classroom/oauth/iniciar').set(authLector).expect(403);
  });

  it('bloquea purge de compliance para docente y permite status a lector', async () => {
    const docente = await crearDocenteConRoles('docente-compliance@local.test', ['docente']);
    const lector = await crearDocenteConRoles('lector-compliance@local.test', ['lector']);
    const authDocente = authPara(docente, ['docente']);
    const authLector = authPara(lector, ['lector']);

    await request(app).get('/api/compliance/status').set(authLector).expect(200);
    await request(app).post('/api/compliance/purge').set(authDocente).send({ dryRun: true }).expect(403);
  });
});
