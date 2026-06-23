/**
 * calificacion.solicitudes.test
 *
 * Verifica el flujo basico de solicitudes de revision para docente:
 * listar y resolver por estado usando SQLite.
 */
import type { Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { conectarMongoTest, cerrarMongoTest, limpiarMongoTest } from './utils/mongo';
import { prisma } from '../src/infraestructura/baseDatos/sqlite';
import { listarSolicitudesRevision, resolverSolicitudRevision } from '../src/modulos/modulo_calificacion/controladorCalificacion';
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
    const docenteId = 'docente-1';

    // Crear docente requerido por clave foránea
    await prisma.docente.create({
      data: {
        id: docenteId,
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@evaluapro.local'
      }
    });

    const creada = await prisma.solicitudRevisionAlumno.create({
      data: {
        externoId: 'folio-a:alumno-a:1',
        docenteId,
        folio: 'folio-a',
        numeroPregunta: 1,
        comentario: 'Revisar lectura',
        estado: 'pendiente',
        solicitadoEn: new Date()
      }
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
      params: { id: String(creada.id) },
      body: { estado: 'atendida', respuestaDocente: 'Validado por docente' }
    } as unknown as SolicitudDocente;
    const resResolve = crearRespuesta();
    await resolverSolicitudRevision(reqResolve, resResolve);

    const payloadResolve = (resResolve.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { solicitud: { estado: string } };
    expect(payloadResolve.solicitud.estado).toBe('atendida');
    const actualizada = await prisma.solicitudRevisionAlumno.findUnique({
      where: { id: creada.id }
    });
    expect(actualizada?.estado).toBe('atendida');
  });
});
