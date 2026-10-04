import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

describe('paginación de evidencias de evaluación por API', () => {
  const app = crearApp();

  beforeAll(async () => { await conectarMongoTest(); });
  beforeEach(async () => { await limpiarMongoTest(); });
  afterAll(async () => { await cerrarMongoTest(); });

  async function prepararDocente(correo: string) {
    const registro = await request(app).post('/api/autenticacion/registrar').send({
      nombreCompleto: 'Docente evidencias', correo, contrasena: 'Secreto123!'
    }).expect(201);
    const auth = { Authorization: `Bearer ${registro.body.token}` };
    const periodoResp = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Periodo evidencias', fechaInicio: '2026-01-01', fechaFin: '2026-06-01'
    }).expect(201);
    const periodoId = String(periodoResp.body.periodo._id);
    const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId }, select: { docenteId: true } });
    const alumno = await prisma.alumno.create({ data: {
      periodoId, matricula: `MAT-${correo.split('@')[0].replace(/[^A-Za-z0-9]/g, '').slice(0, 12)}`,
      nombreCompleto: 'Alumno evidencia', correo: `alumno-${correo}`
    } });
    return { auth, periodoId, alumnoId: alumno.id, docenteId: periodo.docenteId };
  }

  it('recorre evidencias propias con cursor estable y filtros acotados', async () => {
    const owner = await prepararDocente('evidencias-owner@prueba.test');
    const fechaEvidencia = new Date('2026-03-01T00:00:00.000Z');
    const createdAt = new Date('2026-03-02T00:00:00.000Z');
    for (let index = 1; index <= 5; index += 1) {
      await prisma.evidenciaEvaluacion.create({
        data: {
          docenteId: owner.docenteId,
          periodoId: owner.periodoId,
          alumnoId: owner.alumnoId,
          titulo: `Evidencia ${index}`,
          fechaEvidencia,
          createdAt,
          ...(index === 1 ? {
            fuente: 'classroom',
            classroomData: JSON.stringify({ courseId: 'course-1', courseWorkId: 'work-1' }),
            metadata: JSON.stringify({ alternateLink: 'https://classroom.google.com/c/course-1/a/work-1/details' })
          } : {}),
          calificacionDecimal: index,
          ponderacion: 1
        }
      });
    }
    const expected = await prisma.evidenciaEvaluacion.findMany({
      where: { docenteId: owner.docenteId, periodoId: owner.periodoId, alumnoId: owner.alumnoId },
      orderBy: [{ fechaEvidencia: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true }
    });

    const primera = await request(app)
      .get(`/api/evaluaciones/evidencias?periodoId=${owner.periodoId}&alumnoId=${owner.alumnoId}&limite=2`)
      .set(owner.auth)
      .expect(200);
    expect(primera.body.evidencias.map((item: { id: string }) => item.id)).toEqual(expected.slice(0, 2).map((item) => item.id));
    expect(primera.body.nextCursor).toEqual(expect.any(String));
    const segunda = await request(app)
      .get(`/api/evaluaciones/evidencias?periodoId=${owner.periodoId}&alumnoId=${owner.alumnoId}&limite=2&cursor=${encodeURIComponent(primera.body.nextCursor)}`)
      .set(owner.auth)
      .expect(200);
    const tercera = await request(app)
      .get(`/api/evaluaciones/evidencias?periodoId=${owner.periodoId}&alumnoId=${owner.alumnoId}&limite=2&cursor=${encodeURIComponent(segunda.body.nextCursor)}`)
      .set(owner.auth)
      .expect(200);
    expect(segunda.body.evidencias.map((item: { id: string }) => item.id)).toEqual(expected.slice(2, 4).map((item) => item.id));
    expect(tercera.body.evidencias.map((item: { id: string }) => item.id)).toEqual(expected.slice(4).map((item) => item.id));
    expect(tercera.body.nextCursor).toBeNull();
    const evidenciasPaginadas = [...primera.body.evidencias, ...segunda.body.evidencias, ...tercera.body.evidencias];
    expect(evidenciasPaginadas.find((item: { fuente: string }) => item.fuente === 'classroom')?.metadata).toMatchObject({
      alternateLink: 'https://classroom.google.com/c/course-1/a/work-1/details'
    });
    await request(app).get('/api/evaluaciones/evidencias?limite=401').set(owner.auth).expect(400);
    await request(app).get('/api/evaluaciones/evidencias?cursor=e30').set(owner.auth).expect(400);

    const other = await prepararDocente('evidencias-other@prueba.test');
    const propias = await request(app).get('/api/evaluaciones/evidencias').set(owner.auth).expect(200);
    const ajenas = await request(app).get('/api/evaluaciones/evidencias').set(other.auth).expect(200);
    expect(propias.body.evidencias).toHaveLength(5);
    expect(ajenas.body.evidencias).toHaveLength(0);
  });

  it('recupera la creación de evidencia por clientRequestId y protege el detalle por docente', async () => {
    const owner = await prepararDocente('evidencias-idempotencia@prueba.test');
    const otro = await prepararDocente('evidencias-idempotencia-otro@prueba.test');
    const payload = {
      clientRequestId: '683194ee-a920-4d97-bd13-d2f027323103',
      periodoId: owner.periodoId,
      alumnoId: owner.alumnoId,
      titulo: 'Práctica idempotente',
      calificacionDecimal: 8.5,
      ponderacion: 1
    };
    const primera = await request(app).post('/api/evaluaciones/evidencias').set(owner.auth).send(payload).expect(201);
    const repetida = await request(app).post('/api/evaluaciones/evidencias').set(owner.auth).send(payload).expect(200);
    expect(repetida.body.evidencia.id).toBe(primera.body.evidencia.id);
    expect(await prisma.evidenciaEvaluacion.count({ where: { id: payload.clientRequestId } })).toBe(1);
    await request(app).post('/api/evaluaciones/evidencias').set(owner.auth)
      .send({ ...payload, calificacionDecimal: 9 }).expect(409);
    const detalle = await request(app).get(`/api/evaluaciones/evidencias/${payload.clientRequestId}`).set(owner.auth).expect(200);
    expect(detalle.body.evidencia.id).toBe(payload.clientRequestId);
    await request(app).get(`/api/evaluaciones/evidencias/${payload.clientRequestId}`).set(otro.auth).expect(404);
  });

  it('versiona ediciones manuales y archiva/restaura sin borrar procedencia ni calcular archivadas', async () => {
    const owner = await prepararDocente('evidencias-crud@prueba.test');
    await request(app).post('/api/evaluaciones/configuracion-periodo').set(owner.auth).send({
      periodoId: owner.periodoId,
      politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
      politicaVersion: 1
    }).expect(200);
    const creada = await request(app).post('/api/evaluaciones/evidencias').set(owner.auth).send({
      clientRequestId: 'f84eb41a-5855-4fad-a2ae-1e3e8f00ca11',
      periodoId: owner.periodoId, alumnoId: owner.alumnoId, titulo: 'Evidencia para corregir',
      calificacionDecimal: 8, ponderacion: 1, corte: 1, fechaEvidencia: '2026-01-15T00:00:00.000Z'
    }).expect(201);
    const evidencia = creada.body.evidencia;

    const actualizada = await request(app).put(`/api/evaluaciones/evidencias/${evidencia.id}`).set(owner.auth).send({
      periodoId: owner.periodoId, alumnoId: owner.alumnoId, titulo: 'Evidencia corregida',
      calificacionDecimal: 9, ponderacion: 1, corte: 1, fechaEvidencia: '2026-01-15T00:00:00.000Z',
      expectedUpdatedAt: evidencia.updatedAt, motivoCambio: 'Corrección docente', confirmarEscritura: true
    }).expect(200);
    expect(actualizada.body.evidencia.auditoriaCambios.at(-1)).toMatchObject({ tipo: 'actualizacion', actorDocenteId: owner.docenteId, motivo: 'Corrección docente' });
    await request(app).put(`/api/evaluaciones/evidencias/${evidencia.id}`).set(owner.auth).send({
      periodoId: owner.periodoId, alumnoId: owner.alumnoId, titulo: 'Edición obsoleta', calificacionDecimal: 7,
      expectedUpdatedAt: evidencia.updatedAt, motivoCambio: 'Intento desfasado', confirmarEscritura: true
    }).expect(409);

    const resumenAntes = await request(app)
      .get(`/api/evaluaciones/alumnos/${owner.alumnoId}/resumen?periodoId=${owner.periodoId}`).set(owner.auth).expect(200);
    expect(Number(resumenAntes.body.resumen.continuaPorCorte.c1)).toBe(9);

    await request(app).post(`/api/evaluaciones/evidencias/${evidencia.id}/archivar`).set(owner.auth)
      .send({ motivo: 'Evidencia duplicada', confirmarEscritura: true }).expect(200);
    const resumenArchivado = await request(app)
      .get(`/api/evaluaciones/alumnos/${owner.alumnoId}/resumen?periodoId=${owner.periodoId}`).set(owner.auth).expect(200);
    expect(Number(resumenArchivado.body.resumen.continuaPorCorte.c1)).toBe(0);
    const listadoActivo = await request(app).get(`/api/evaluaciones/evidencias?periodoId=${owner.periodoId}`).set(owner.auth).expect(200);
    expect(listadoActivo.body.evidencias.some((item: { id: string }) => item.id === evidencia.id)).toBe(false);
    const archivadas = await request(app).get(`/api/evaluaciones/evidencias?periodoId=${owner.periodoId}&incluirArchivadas=true`).set(owner.auth).expect(200);
    expect(archivadas.body.evidencias.find((item: { id: string }) => item.id === evidencia.id).archivadaEn).toBeTruthy();

    await request(app).post(`/api/evaluaciones/evidencias/${evidencia.id}/restaurar`).set(owner.auth)
      .send({ motivo: 'Se confirma evidencia válida', confirmarEscritura: true }).expect(200);
    const resumenRestaurado = await request(app)
      .get(`/api/evaluaciones/alumnos/${owner.alumnoId}/resumen?periodoId=${owner.periodoId}`).set(owner.auth).expect(200);
    expect(Number(resumenRestaurado.body.resumen.continuaPorCorte.c1)).toBe(9);
    const detalle = await request(app).get(`/api/evaluaciones/evidencias/${evidencia.id}`).set(owner.auth).expect(200);
    expect(detalle.body.evidencia.auditoriaCambios.map((item: { tipo: string }) => item.tipo)).toEqual(['creacion', 'actualizacion', 'archivo', 'restauracion']);
  });
});
