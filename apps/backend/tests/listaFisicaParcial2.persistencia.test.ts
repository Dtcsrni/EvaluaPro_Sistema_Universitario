import type { Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/infraestructura/baseDatos/sqlite.js';
import { guardarCalificacionLista } from '../src/modulos/modulo_analiticas/controladorAnaliticas.js';
import type { SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from './utils/mongo.js';

const docenteId = '11111111-1111-4111-8111-111111111111';
const otroDocenteId = '33333333-3333-4333-8333-333333333333';
const periodoId = '22222222-2222-4222-8222-222222222222';
const alumnoId = '44444444-4444-4444-8444-444444444444';

function respuestaMock() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
}

function solicitud(payload: Record<string, unknown>, quien = docenteId) {
  return { docenteId: quien, body: payload } as unknown as SolicitudDocente;
}

describe('persistencia de componentes manuales de la lista física', () => {
  beforeAll(async () => { await conectarMongoTest(); });
  beforeEach(async () => {
    await limpiarMongoTest();
    await prisma.docente.createMany({ data: [
      { id: docenteId, correo: 'lista-docente@prueba.test', nombreCompleto: 'Docente Lista' },
      { id: otroDocenteId, correo: 'lista-otro@prueba.test', nombreCompleto: 'Otro Docente' }
    ] });
    await prisma.periodo.create({ data: {
      id: periodoId, docenteId, nombre: 'Periodo prueba', nombreNormalizado: 'periodo prueba',
      fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-12-31'), grupos: '[]'
    } });
    await prisma.alumno.create({ data: {
      id: alumnoId, periodoId, matricula: 'MAT-01', nombreCompleto: 'Alumno Prueba', correo: 'alumno@prueba.test'
    } });
  });
  afterAll(async () => { await cerrarMongoTest(); });

  it('crea, actualiza con versionado, audita y rechaza una escritura obsoleta o ajena', async () => {
    const payload = { periodoId, alumnoId, componente: 'Practica 2do Parcial', calificacion: 8.5 };
    const creada = respuestaMock();
    await guardarCalificacionLista(solicitud(payload), creada);
    expect(creada.status).toHaveBeenCalledWith(201);
    const registro = await prisma.calificacionListaManual.findUniqueOrThrow({
      where: { docenteId_periodoId_alumnoId_componente: { docenteId, periodoId, alumnoId, componente: 'Practica 2do Parcial' } }
    });
    expect(registro.version).toBe(1);

    const actualizada = respuestaMock();
    await guardarCalificacionLista(solicitud({ ...payload, calificacion: 9, version: 1 }), actualizada);
    expect(actualizada.status).toHaveBeenCalledWith(200);
    const despues = await prisma.calificacionListaManual.findUniqueOrThrow({ where: { id: registro.id } });
    expect(despues).toMatchObject({ calificacion: 9, version: 2 });
    expect(JSON.parse(despues.auditoria)).toMatchObject({ eventos: [
      { anterior: null, nueva: 8.5 }, { anterior: 8.5, nueva: 9 }
    ] });

    await expect(guardarCalificacionLista(solicitud({ ...payload, calificacion: 7, version: 1 }), respuestaMock()))
      .rejects.toMatchObject({ estadoHttp: 409, codigo: 'CONFLICTO_VERSION' });
    await expect(guardarCalificacionLista(solicitud({ ...payload, version: 2 }, otroDocenteId), respuestaMock()))
      .rejects.toMatchObject({ estadoHttp: 404 });
  });

  it('recupera la respuesta perdida por clientRequestId y rechaza reutilizarlo con otro payload', async () => {
    const clientRequestId = 'e919a2f1-2de4-4c4a-b21a-d9271a252e3d';
    const payload = {
      periodoId, alumnoId, componente: 'Practica 2do Parcial', calificacion: 8.5,
      clientRequestId
    };
    const primera = respuestaMock();
    await guardarCalificacionLista(solicitud(payload), primera);
    expect(primera.status).toHaveBeenCalledWith(201);

    const repetida = respuestaMock();
    await guardarCalificacionLista(solicitud(payload), repetida);
    expect(repetida.status).toHaveBeenCalledWith(200);
    expect((repetida.json as any).mock.calls[0][0]).toMatchObject({ repetida: true });

    const fila = await prisma.calificacionListaManual.findUniqueOrThrow({
      where: { docenteId_periodoId_alumnoId_componente: { docenteId, periodoId, alumnoId, componente: payload.componente } }
    });
    expect(fila).toMatchObject({ calificacion: 8.5, version: 1 });

    await expect(guardarCalificacionLista(solicitud({ ...payload, calificacion: 7 }), respuestaMock()))
      .rejects.toMatchObject({ estadoHttp: 409, codigo: 'CLAVE_IDEMPOTENCIA_REUTILIZADA' });
    await expect(guardarCalificacionLista(solicitud({ ...payload, componente: 'Exámen 2do Parcial' }), respuestaMock()))
      .rejects.toMatchObject({ estadoHttp: 409, codigo: 'CLAVE_IDEMPOTENCIA_REUTILIZADA' });
  });

  it('recupera un reintento de edición aun cuando la versión enviada ya es obsoleta', async () => {
    const base = { periodoId, alumnoId, componente: 'Practica 2do Parcial' };
    await guardarCalificacionLista(solicitud({ ...base, calificacion: 8 }), respuestaMock());
    const payload = {
      ...base, calificacion: 9, version: 1,
      clientRequestId: 'a359e1ab-bce1-4e3a-95d2-6c0f91c7d7f9'
    };
    await guardarCalificacionLista(solicitud(payload), respuestaMock());
    const repetida = respuestaMock();
    await guardarCalificacionLista(solicitud(payload), repetida);
    expect(repetida.status).toHaveBeenCalledWith(200);
    expect((repetida.json as any).mock.calls[0][0]).toMatchObject({ repetida: true, calificacion: { calificacion: 9, version: 2 } });
    const registros = await prisma.calificacionListaManual.findMany({ where: { docenteId, periodoId, alumnoId } });
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({ calificacion: 9, version: 2 });
  });

  it('serializa solicitudes concurrentes con el mismo UUID sin duplicar ni incrementar versión', async () => {
    const payload = {
      periodoId, alumnoId, componente: 'Practica 2do Parcial', calificacion: 8.5,
      clientRequestId: '8c083164-c9df-4e15-8529-71142e3988c9'
    };
    const respuestas = [respuestaMock(), respuestaMock()];
    await Promise.all(respuestas.map((res) => guardarCalificacionLista(solicitud(payload), res)));

    const fila = await prisma.calificacionListaManual.findUniqueOrThrow({
      where: { docenteId_periodoId_alumnoId_componente: { docenteId, periodoId, alumnoId, componente: payload.componente } }
    });
    const mutaciones = await prisma.calificacionListaMutacion.findMany({ where: { docenteId, clientRequestId: payload.clientRequestId } });
    expect(fila).toMatchObject({ calificacion: 8.5, version: 1 });
    expect(mutaciones).toHaveLength(1);
    expect(respuestas.map((res) => (res.status as any).mock.calls.at(-1)?.[0]).sort()).toEqual([200, 201]);
  });
});
