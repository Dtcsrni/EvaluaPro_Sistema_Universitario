import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

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
});

