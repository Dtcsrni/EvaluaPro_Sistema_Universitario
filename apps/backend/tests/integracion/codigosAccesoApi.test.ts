import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

describe('consulta segura de códigos de acceso por API', () => {
  const app = crearApp();

  beforeAll(async () => { await conectarSqliteTest(); });
  beforeEach(async () => { await limpiarSqliteTest(); });
  afterAll(async () => { await cerrarSqliteTest(); });

  async function registrar(correo: string) {
    const respuesta = await request(app).post('/api/autenticacion/registrar')
      .send({ nombreCompleto: 'Docente Acceso', correo, contrasena: 'Secreto123!' }).expect(201);
    return respuesta.body.token as string;
  }

  it('pagina y filtra metadatos propios sin revelar los códigos secretos', async () => {
    const token = await registrar('codigos-owner@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const periodoResp = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Periodo acceso', fechaInicio: '2026-01-01', fechaFin: '2026-06-01'
    }).expect(201);
    const periodoId = String(periodoResp.body.periodo._id);
    const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId }, select: { docenteId: true } });
    const ahora = Date.now();
    const codigos = await Promise.all([
      prisma.codigoAcceso.create({ data: { docenteId: periodo.docenteId, periodoId, codigo: 'SECRET-LIVE-01', expiraEn: new Date(ahora + 60_000) } }),
      prisma.codigoAcceso.create({ data: { docenteId: periodo.docenteId, periodoId, codigo: 'SECRET-OLD-02', expiraEn: new Date(ahora - 60_000) } }),
      prisma.codigoAcceso.create({ data: { docenteId: periodo.docenteId, periodoId, codigo: 'SECRET-USED-03', expiraEn: new Date(ahora + 60_000), usado: true } })
    ]);

    const primera = await request(app).get(`/api/sincronizaciones/codigo-acceso?periodoId=${periodoId}&limite=1`).set(auth).expect(200);
    expect(primera.body.codigosAcceso).toHaveLength(1);
    expect(primera.body.nextCursor).toEqual(expect.any(String));
    const serializada = JSON.stringify(primera.body);
    for (const codigo of codigos) expect(serializada).not.toContain(codigo.codigo);

    const pagina = new URLSearchParams({ periodoId, limite: '1', cursor: primera.body.nextCursor });
    const segunda = await request(app).get(`/api/sincronizaciones/codigo-acceso?${pagina}`).set(auth).expect(200);
    expect(segunda.body.codigosAcceso[0].id).not.toBe(primera.body.codigosAcceso[0].id);
    const estados = await Promise.all(['vigente', 'expirado', 'usado'].map(async (estado) => {
      const respuesta = await request(app).get(`/api/sincronizaciones/codigo-acceso?periodoId=${periodoId}&estado=${estado}`).set(auth).expect(200);
      return respuesta.body.codigosAcceso.map((item: { estado: string }) => item.estado);
    }));
    expect(estados).toEqual([['vigente'], ['expirado'], ['usado']]);

    const detalle = await request(app).get(`/api/sincronizaciones/codigo-acceso/${codigos[0].id}`).set(auth).expect(200);
    expect(detalle.body.codigoAcceso.id).toBe(codigos[0].id);
    expect(detalle.body.codigoAcceso).not.toHaveProperty('codigo');
    const expiracion = await request(app).post(`/api/sincronizaciones/codigo-acceso/${codigos[0].id}/expirar`).set(auth).send({}).expect(200);
    expect(expiracion.body.expirado).toBe(true);
    const detalleExpirado = await request(app).get(`/api/sincronizaciones/codigo-acceso/${codigos[0].id}`).set(auth).expect(200);
    expect(detalleExpirado.body.codigoAcceso.estado).toBe('expirado');
    expect(detalleExpirado.body.codigoAcceso).not.toHaveProperty('codigo');
    const tokenAjeno = await registrar('codigos-foreign@prueba.test');
    const authAjeno = { Authorization: `Bearer ${tokenAjeno}` };
    expect((await request(app).get('/api/sincronizaciones/codigo-acceso').set(authAjeno).expect(200)).body.codigosAcceso).toEqual([]);
    await request(app).get(`/api/sincronizaciones/codigo-acceso/${codigos[0].id}`).set(authAjeno).expect(404);
    await request(app).post(`/api/sincronizaciones/codigo-acceso/${codigos[1].id}/expirar`).set(authAjeno).send({}).expect(404);
    await request(app).get('/api/sincronizaciones/codigo-acceso?estado=invalid').set(auth).expect(400);
  });

  it('recupera la misma generacion tras timeout y rechaza reutilizar la clave fuera de alcance', async () => {
    const token = await registrar('codigos-idempotencia@prueba.test');
    const auth = { Authorization: 'Bearer ' + token };
    const periodoResp = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Periodo idempotencia', fechaInicio: '2026-01-01', fechaFin: '2026-06-01'
    }).expect(201);
    const periodoId = String(periodoResp.body.periodo._id);
    const clientRequestId = 'b1f58e45-84b3-4bd7-8313-a824c6e83ee7';
    const payload = { periodoId, clientRequestId };
    const primera = await request(app).post('/api/sincronizaciones/codigo-acceso').set(auth).send(payload).expect(201);
    const reintento = await request(app).post('/api/sincronizaciones/codigo-acceso').set(auth).send(payload).expect(201);
    expect(reintento.body).toEqual(primera.body);
    expect(await prisma.codigoAcceso.count({ where: { id: clientRequestId } })).toBe(1);

    const otroPeriodoResp = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Otro periodo idempotencia', fechaInicio: '2026-01-01', fechaFin: '2026-06-01'
    }).expect(201);
    await request(app).post('/api/sincronizaciones/codigo-acceso').set(auth).send({
      periodoId: String(otroPeriodoResp.body.periodo._id), clientRequestId
    }).expect(409);
    const tokenAjeno = await registrar('codigos-idempotencia-ajeno@prueba.test');
    const periodoAjeno = await request(app).post('/api/periodos').set({ Authorization: 'Bearer ' + tokenAjeno }).send({
      nombre: 'Periodo ajeno', fechaInicio: '2026-01-01', fechaFin: '2026-06-01'
    }).expect(201);
    await request(app).post('/api/sincronizaciones/codigo-acceso').set(auth).send({
      periodoId: String(periodoAjeno.body.periodo._id), clientRequestId: '3e54cf4c-d2b0-4bec-92e6-dc5adac5d95d'
    }).expect(404);
    await request(app).post('/api/sincronizaciones/codigo-acceso').set(auth).send({
      periodoId, clientRequestId: 'not-a-uuid'
    }).expect(400);
  });

});
