/**
 * calificacion.solicitudes.test
 *
 * Verifica el flujo basico de solicitudes de revision para docente:
 * listar y resolver por estado.
 */
import type { Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { conectarMongoTest, cerrarMongoTest, limpiarMongoTest } from './utils/mongo';
import { listarSolicitudesRevision, resolverSolicitudRevision } from '../src/modulos/modulo_calificacion/controladorCalificacion';
import { SolicitudRevisionAlumno } from '../src/modulos/modulo_calificacion/modeloSolicitudRevisionAlumno';
import type { SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion';

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

describe('calificaciones solicitudes revision', () => {
  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('lista solicitudes del docente y permite resolverlas', async () => {
    const docenteId = '507f1f77bcf86cd799439012';
    const creada = await SolicitudRevisionAlumno.create({
      externoId: 'folio-a:alumno-a:1',
      docenteId,
      folio: 'folio-a',
      numeroPregunta: 1,
      comentario: 'Revisar lectura',
      estado: 'pendiente',
      solicitadoEn: new Date()
    });

    const reqList = {
      docenteId,
      query: { estado: 'pendiente', limite: '10' }
    } as unknown as SolicitudDocente;
    const resList = crearRespuesta();
    await listarSolicitudesRevision(reqList, resList);

    const payloadList = (resList.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { solicitudes: Array<{ externoId: string }> };
    expect(payloadList.solicitudes.length).toBe(1);
    expect(payloadList.solicitudes[0].externoId).toBe('folio-a:alumno-a:1');

    const reqResolve = {
      docenteId,
      params: { id: String(creada._id) },
      body: { estado: 'atendida', respuestaDocente: 'Validado por docente' }
    } as unknown as SolicitudDocente;
    const resResolve = crearRespuesta();
    await resolverSolicitudRevision(reqResolve, resResolve);

    const payloadResolve = (resResolve.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { solicitud: { estado: string } };
    expect(payloadResolve.solicitud.estado).toBe('atendida');
    const actualizada = await SolicitudRevisionAlumno.findById(creada._id).lean();
    expect(actualizada?.estado).toBe('atendida');
  });
});
