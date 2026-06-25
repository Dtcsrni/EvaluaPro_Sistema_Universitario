/**
 * vinculacionEntrega.controlador.test
 *
 * Responsabilidad: Cubrir reglas del controlador de vinculacion de entregas
 * sin depender de Mongo real, preservando contratos de errores y mutaciones.
 */
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockObtenerDocenteId,
  mockExamenFindUnique,
  mockExamenFindFirst,
  mockExamenUpdate,
  mockEntregaCreate,
  mockEntregaFindMany,
  mockEntregaUpdate
} = vi.hoisted(() => ({
  mockObtenerDocenteId: vi.fn(),
  mockExamenFindUnique: vi.fn(),
  mockExamenFindFirst: vi.fn(),
  mockExamenUpdate: vi.fn(),
  mockEntregaCreate: vi.fn(),
  mockEntregaFindMany: vi.fn(),
  mockEntregaUpdate: vi.fn()
}));

vi.mock('../src/modulos/modulo_autenticacion/middlewareAutenticacion', () => ({
  obtenerDocenteId: mockObtenerDocenteId
}));

vi.mock('../src/infraestructura/baseDatos/sqlite', () => ({
  prisma: {
    examenGenerado: {
      findUnique: mockExamenFindUnique,
      findFirst: mockExamenFindFirst,
      update: mockExamenUpdate
    },
    entrega: {
      create: mockEntregaCreate,
      findMany: mockEntregaFindMany,
      update: mockEntregaUpdate
    }
  }
}));

import { ErrorAplicacion } from '../src/compartido/errores/errorAplicacion';
import {
  deshacerEntregaPorFolio,
  vincularEntrega,
  vincularEntregaPorFolio
} from '../src/modulos/modulo_vinculacion_entrega/controladorVinculacionEntrega';

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

function crearExamen(overrides: Record<string, unknown> = {}) {
  return {
    id: 'examen-1',
    docenteId: 'docente-1',
    alumnoId: null,
    estado: 'generado',
    entregadoEn: null,
    ...overrides
  };
}

describe('controladorVinculacionEntrega', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockObtenerDocenteId.mockReturnValue('docente-1');
  });

  it('rechaza vincular por id cuando el examen no existe', async () => {
    mockExamenFindUnique.mockResolvedValue(null);

    await expect(
      vincularEntrega(
        {
          body: {
            examenGeneradoId: 'examen-404',
            alumnoId: 'alumno-1'
          }
        } as never,
        crearRespuesta()
      )
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'EXAMEN_NO_ENCONTRADO',
      estadoHttp: 404
    });
  });

  it('rechaza vincular por id cuando el docente no tiene acceso', async () => {
    mockExamenFindUnique.mockResolvedValue(crearExamen({ docenteId: 'docente-ajeno' }));

    await expect(
      vincularEntrega(
        {
          body: {
            examenGeneradoId: 'examen-1',
            alumnoId: 'alumno-1'
          }
        } as never,
        crearRespuesta()
      )
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'NO_AUTORIZADO',
      estadoHttp: 403
    });
  });

  it('vincula por id y acota el bono de acordeon al maximo permitido', async () => {
    const examen = crearExamen();
    const res = crearRespuesta();
    const entrega = { id: 'entrega-1', estado: 'entregado' };

    mockExamenFindUnique.mockResolvedValue(examen);
    mockEntregaCreate.mockResolvedValue(entrega);

    await vincularEntrega(
      {
        body: {
          examenGeneradoId: 'examen-1',
          alumnoId: 'alumno-1',
          acordeonEntregado: true,
          bonoAcordeon: 0.9
        }
      } as never,
      res
    );

    expect(mockExamenUpdate).toHaveBeenCalledWith({
      where: { id: 'examen-1' },
      data: expect.objectContaining({
        alumnoId: 'alumno-1',
        estado: 'entregado',
        entregadoEn: expect.any(Date)
      })
    });
    expect(mockEntregaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        examenGeneradoId: 'examen-1',
        alumnoId: 'alumno-1',
        docenteId: 'docente-1',
        acordeonEntregado: true,
        bonoAcordeon: 0.5
      })
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ entrega });
  });

  it('rechaza vincular por folio si el examen ya fue entregado', async () => {
    mockExamenFindFirst.mockResolvedValue(crearExamen({ estado: 'entregado' }));

    await expect(
      vincularEntregaPorFolio(
        {
          body: {
            folio: 'fol-001',
            alumnoId: 'alumno-1'
          }
        } as never,
        crearRespuesta()
      )
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'EXAMEN_YA_ENTREGADO',
      estadoHttp: 409
    });
  });

  it('vincula por folio usando mayusculas y aplica bono por defecto cuando hay acordeon', async () => {
    const examen = crearExamen({ id: 'examen-folio-1' });
    const res = crearRespuesta();
    const entrega = { id: 'entrega-folio-1', estado: 'entregado' };

    mockExamenFindFirst.mockResolvedValue(examen);
    mockEntregaCreate.mockResolvedValue(entrega);

    await vincularEntregaPorFolio(
      {
        body: {
          folio: 'fol-001',
          alumnoId: 'alumno-1',
          acordeonEntregado: true
        }
      } as never,
      res
    );

    expect(mockExamenFindFirst).toHaveBeenCalledWith({
      where: { folio: 'FOL-001', docenteId: 'docente-1' }
    });
    expect(mockExamenUpdate).toHaveBeenCalledWith({
      where: { id: 'examen-folio-1' },
      data: expect.objectContaining({
        alumnoId: 'alumno-1',
        estado: 'entregado',
        entregadoEn: expect.any(Date)
      })
    });
    expect(mockEntregaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        examenGeneradoId: 'examen-folio-1',
        alumnoId: 'alumno-1',
        docenteId: 'docente-1',
        acordeonEntregado: true,
        bonoAcordeon: 0.25
      })
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ entrega });
  });

  it('deshacer por folio responde sin cambios cuando el examen aun no esta entregado', async () => {
    const examen = crearExamen({ estado: 'generado' });
    const res = crearRespuesta();

    mockExamenFindFirst.mockResolvedValue(examen);

    await deshacerEntregaPorFolio(
      {
        body: { folio: 'fol-001' }
      } as never,
      res
    );

    expect(mockExamenUpdate).not.toHaveBeenCalled();
    expect(mockEntregaFindMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ actualizado: false, estado: 'generado' });
  });

  it('rechaza deshacer por folio cuando el examen ya esta calificado', async () => {
    mockExamenFindFirst.mockResolvedValue(crearExamen({ estado: 'calificado' }));

    await expect(
      deshacerEntregaPorFolio(
        {
          body: { folio: 'fol-001' }
        } as never,
        crearRespuesta()
      )
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'ENTREGA_NO_REVERSIBLE',
      estadoHttp: 409
    });
  });

  it('deshace la ultima entrega registrada y conserva el motivo', async () => {
    const res = crearRespuesta();
    const examen = crearExamen({
      id: 'examen-entregado-1',
      docenteId: 'docente-1',
      alumnoId: 'alumno-1',
      estado: 'entregado',
      entregadoEn: new Date('2026-03-24T00:00:00.000Z')
    });
    const entrega = {
      id: 'entrega-1',
      estado: 'entregado',
      fechaEntrega: new Date('2026-03-24T00:00:00.000Z'),
      motivoDeshacer: null
    };

    mockExamenFindFirst.mockResolvedValue(examen);
    mockExamenUpdate.mockResolvedValue({ estado: 'generado' });
    mockEntregaFindMany.mockResolvedValue([entrega]);

    await deshacerEntregaPorFolio(
      {
        body: { folio: 'fol-001', motivo: 'captura duplicada' }
      } as never,
      res
    );

    expect(mockExamenUpdate).toHaveBeenCalledWith({
      where: { id: 'examen-entregado-1' },
      data: {
        alumnoId: null,
        estado: 'generado',
        entregadoEn: null
      }
    });
    expect(mockEntregaFindMany).toHaveBeenCalledWith({
      where: { examenGeneradoId: 'examen-entregado-1', docenteId: 'docente-1' },
      orderBy: { createdAt: 'desc' },
      take: 1
    });
    expect(mockEntregaUpdate).toHaveBeenCalledWith({
      where: { id: 'entrega-1' },
      data: {
        estado: 'pendiente',
        fechaEntrega: null,
        motivoDeshacer: 'captura duplicada'
      }
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ actualizado: true, estado: 'generado' });
  });
});
