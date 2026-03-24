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
  mockFindById,
  mockFindOneExamen,
  mockEntregaCreate,
  mockEntregaFindOne
} = vi.hoisted(() => ({
  mockObtenerDocenteId: vi.fn(),
  mockFindById: vi.fn(),
  mockFindOneExamen: vi.fn(),
  mockEntregaCreate: vi.fn(),
  mockEntregaFindOne: vi.fn()
}));

vi.mock('../src/modulos/modulo_autenticacion/middlewareAutenticacion', () => ({
  obtenerDocenteId: mockObtenerDocenteId
}));

vi.mock('../src/modulos/modulo_generacion_pdf/modeloExamenGenerado', () => ({
  ExamenGenerado: {
    findById: mockFindById,
    findOne: mockFindOneExamen
  }
}));

vi.mock('../src/modulos/modulo_vinculacion_entrega/modeloEntrega', () => ({
  Entrega: {
    create: mockEntregaCreate,
    findOne: mockEntregaFindOne
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
    _id: 'examen-1',
    docenteId: 'docente-1',
    alumnoId: null,
    estado: 'generado',
    entregadoEn: undefined,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('controladorVinculacionEntrega', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockObtenerDocenteId.mockReturnValue('docente-1');
  });

  it('rechaza vincular por id cuando el examen no existe', async () => {
    mockFindById.mockResolvedValue(null);

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
    mockFindById.mockResolvedValue(crearExamen({ docenteId: 'docente-ajeno' }));

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
    const entrega = { _id: 'entrega-1', estado: 'entregado' };

    mockFindById.mockResolvedValue(examen);
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

    expect(examen.alumnoId).toBe('alumno-1');
    expect(examen.estado).toBe('entregado');
    expect(examen.entregadoEn).toBeInstanceOf(Date);
    expect(examen.save).toHaveBeenCalledTimes(1);
    expect(mockEntregaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        examenGeneradoId: 'examen-1',
        alumnoId: 'alumno-1',
        docenteId: 'docente-1',
        acordeonEntregado: true,
        bonoAcordeon: 0.5
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ entrega });
  });

  it('rechaza vincular por folio si el examen ya fue entregado', async () => {
    mockFindOneExamen.mockResolvedValue(crearExamen({ estado: 'entregado' }));

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
    const examen = crearExamen({ _id: 'examen-folio-1' });
    const res = crearRespuesta();
    const entrega = { _id: 'entrega-folio-1', estado: 'entregado' };

    mockFindOneExamen.mockResolvedValue(examen);
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

    expect(mockFindOneExamen).toHaveBeenCalledWith({ folio: 'FOL-001', docenteId: 'docente-1' });
    expect(mockEntregaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        examenGeneradoId: 'examen-folio-1',
        alumnoId: 'alumno-1',
        docenteId: 'docente-1',
        acordeonEntregado: true,
        bonoAcordeon: 0.25
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ entrega });
  });

  it('deshacer por folio responde sin cambios cuando el examen aun no esta entregado', async () => {
    const examen = crearExamen({ estado: 'generado' });
    const res = crearRespuesta();

    mockFindOneExamen.mockResolvedValue(examen);

    await deshacerEntregaPorFolio(
      {
        body: { folio: 'fol-001' }
      } as never,
      res
    );

    expect(examen.save).not.toHaveBeenCalled();
    expect(mockEntregaFindOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ actualizado: false, estado: 'generado' });
  });

  it('rechaza deshacer por folio cuando el examen ya esta calificado', async () => {
    mockFindOneExamen.mockResolvedValue(crearExamen({ estado: 'calificado' }));

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
    const examen = crearExamen({
      _id: 'examen-entregado-1',
      alumnoId: 'alumno-1',
      estado: 'entregado',
      entregadoEn: new Date('2026-03-24T00:00:00.000Z')
    });
    const entrega = {
      estado: 'entregado',
      fechaEntrega: new Date('2026-03-24T00:00:00.000Z'),
      motivoDeshacer: undefined,
      save: vi.fn().mockResolvedValue(undefined)
    };
    const res = crearRespuesta();

    mockFindOneExamen.mockResolvedValue(examen);
    mockEntregaFindOne.mockReturnValue({
      sort: vi.fn().mockResolvedValue(entrega)
    });

    await deshacerEntregaPorFolio(
      {
        body: { folio: 'fol-001', motivo: 'captura duplicada' }
      } as never,
      res
    );

    expect(examen.alumnoId).toBeNull();
    expect(examen.estado).toBe('generado');
    expect(examen.entregadoEn).toBeUndefined();
    expect(examen.save).toHaveBeenCalledTimes(1);
    expect(mockEntregaFindOne).toHaveBeenCalledWith({
      examenGeneradoId: 'examen-entregado-1',
      docenteId: 'docente-1'
    });
    expect(entrega.estado).toBe('pendiente');
    expect(entrega.fechaEntrega).toBeUndefined();
    expect(entrega.motivoDeshacer).toBe('captura duplicada');
    expect(entrega.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ actualizado: true, estado: 'generado' });
  });
});
