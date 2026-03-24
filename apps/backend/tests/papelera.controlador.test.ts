/**
 * papelera.controlador.test
 *
 * Responsabilidad: Cubrir reglas de acceso y restauracion del modulo de papelera
 * sin depender de Mongo real ni mutar modelos persistentes.
 */
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockObtenerDocenteId,
  mockPapeleraFind,
  mockPapeleraFindOneLean,
  mockPapeleraDeleteOne,
  mockConfiguracion,
  mockAlumno,
  mockPeriodo,
  mockBancoPregunta,
  mockTemaBanco,
  mockBanderaRevision,
  mockCalificacion,
  mockCodigoAcceso,
  mockEntrega,
  mockExamenGenerado,
  mockExamenPlantilla
} = vi.hoisted(() => ({
  mockObtenerDocenteId: vi.fn(),
  mockPapeleraFind: vi.fn(),
  mockPapeleraFindOneLean: vi.fn(),
  mockPapeleraDeleteOne: vi.fn(),
  mockConfiguracion: {
    entorno: 'development'
  },
  mockAlumno: crearModeloRestaurable(),
  mockPeriodo: crearModeloRestaurable(),
  mockBancoPregunta: crearModeloRestaurable(),
  mockTemaBanco: crearModeloRestaurable(),
  mockBanderaRevision: crearModeloRestaurable(),
  mockCalificacion: crearModeloRestaurable(),
  mockCodigoAcceso: crearModeloRestaurable(),
  mockEntrega: crearModeloRestaurable(),
  mockExamenGenerado: crearModeloRestaurable(),
  mockExamenPlantilla: crearModeloRestaurable()
}));

function crearModeloRestaurable() {
  return {
    findOneAndUpdate: vi.fn().mockResolvedValue(undefined)
  };
}

vi.mock('../src/configuracion', () => ({
  configuracion: mockConfiguracion
}));

vi.mock('../src/modulos/modulo_autenticacion/middlewareAutenticacion', () => ({
  obtenerDocenteId: mockObtenerDocenteId
}));

vi.mock('../src/modulos/modulo_papelera/modeloPapelera', () => ({
  Papelera: {
    find: mockPapeleraFind,
    findOne: vi.fn(() => ({
      lean: mockPapeleraFindOneLean
    })),
    deleteOne: mockPapeleraDeleteOne
  }
}));

vi.mock('../src/modulos/modulo_alumnos/modeloAlumno', () => ({ Alumno: mockAlumno }));
vi.mock('../src/modulos/modulo_alumnos/modeloPeriodo', () => ({ Periodo: mockPeriodo }));
vi.mock('../src/modulos/modulo_banco_preguntas/modeloBancoPregunta', () => ({ BancoPregunta: mockBancoPregunta }));
vi.mock('../src/modulos/modulo_banco_preguntas/modeloTemaBanco', () => ({ TemaBanco: mockTemaBanco }));
vi.mock('../src/modulos/modulo_analiticas/modeloBanderaRevision', () => ({ BanderaRevision: mockBanderaRevision }));
vi.mock('../src/modulos/modulo_calificacion/modeloCalificacion', () => ({ Calificacion: mockCalificacion }));
vi.mock('../src/modulos/modulo_sincronizacion_nube/modeloCodigoAcceso', () => ({ CodigoAcceso: mockCodigoAcceso }));
vi.mock('../src/modulos/modulo_vinculacion_entrega/modeloEntrega', () => ({ Entrega: mockEntrega }));
vi.mock('../src/modulos/modulo_generacion_pdf/modeloExamenGenerado', () => ({ ExamenGenerado: mockExamenGenerado }));
vi.mock('../src/modulos/modulo_generacion_pdf/modeloExamenPlantilla', () => ({ ExamenPlantilla: mockExamenPlantilla }));

import { ErrorAplicacion } from '../src/compartido/errores/errorAplicacion';
import { listarPapelera, restaurarPapelera } from '../src/modulos/modulo_papelera/controladorPapelera';

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

function resetModelMocks() {
  [
    mockAlumno,
    mockPeriodo,
    mockBancoPregunta,
    mockTemaBanco,
    mockBanderaRevision,
    mockCalificacion,
    mockCodigoAcceso,
    mockEntrega,
    mockExamenGenerado,
    mockExamenPlantilla
  ].forEach((model) => {
    model.findOneAndUpdate.mockClear();
  });
}

describe('controladorPapelera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetModelMocks();
    mockConfiguracion.entorno = 'development';
    mockObtenerDocenteId.mockReturnValue('docente-1');
    mockPapeleraDeleteOne.mockResolvedValue({ deletedCount: 1 });
  });

  it('lista items por docente y aplica limite positivo solicitado', async () => {
    const items = [{ _id: 'papelera-1' }, { _id: 'papelera-2' }];
    const lean = vi.fn().mockResolvedValue(items);
    const limit = vi.fn(() => ({ lean }));
    const sort = vi.fn(() => ({ limit }));
    mockPapeleraFind.mockReturnValue({ sort });
    const res = crearRespuesta();

    await listarPapelera(
      {
        query: { limite: '5' }
      } as never,
      res
    );

    expect(mockPapeleraFind).toHaveBeenCalledWith({ docenteId: 'docente-1' });
    expect(sort).toHaveBeenCalledWith({ eliminadoEn: -1 });
    expect(limit).toHaveBeenCalledWith(5);
    expect(lean).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ items });
  });

  it('rechaza listar/restaurar fuera de modo development', async () => {
    mockConfiguracion.entorno = 'production';

    await expect(listarPapelera({ query: {} } as never, crearRespuesta())).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'SOLO_DEV',
      estadoHttp: 403
    });

    await expect(
      restaurarPapelera(
        {
          params: { id: 'papelera-1' }
        } as never,
        crearRespuesta()
      )
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'SOLO_DEV',
      estadoHttp: 403
    });
  });

  it('falla si el item no existe para el docente autenticado', async () => {
    mockPapeleraFindOneLean.mockResolvedValue(null);

    await expect(
      restaurarPapelera(
        {
          params: { id: 'papelera-404' }
        } as never,
        crearRespuesta()
      )
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'PAPELERA_NO_ENCONTRADA',
      estadoHttp: 404
    });
  });

  it('restaura payload de plantilla y elimina el item de la papelera', async () => {
    mockPapeleraFindOneLean.mockResolvedValue({
      _id: 'papelera-plantilla',
      tipo: 'plantilla',
      payload: {
        plantilla: { _id: 'plantilla-1', titulo: 'Parcial 1' },
        examenes: [{ _id: 'examen-1' }],
        entregas: [{ _id: 'entrega-1' }],
        calificaciones: [{ _id: 'calif-1' }],
        banderas: [{ _id: 'bandera-1' }]
      }
    });
    const res = crearRespuesta();

    await restaurarPapelera(
      {
        params: { id: 'papelera-plantilla' }
      } as never,
      res
    );

    expect(mockExamenPlantilla.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'plantilla-1' },
      { _id: 'plantilla-1', titulo: 'Parcial 1' },
      { upsert: true, overwrite: true, setDefaultsOnInsert: true }
    );
    expect(mockExamenGenerado.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockEntrega.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockCalificacion.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockBanderaRevision.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockPapeleraDeleteOne).toHaveBeenCalledWith({ _id: 'papelera-plantilla', docenteId: 'docente-1' });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('restaura payload de alumno con sus relacionados', async () => {
    mockPapeleraFindOneLean.mockResolvedValue({
      _id: 'papelera-alumno',
      tipo: 'alumno',
      payload: {
        alumno: { _id: 'alumno-1', nombre: 'Ana' },
        examenes: [{ _id: 'examen-1' }],
        entregas: [{ _id: 'entrega-1' }],
        calificaciones: [{ _id: 'calif-1' }],
        banderas: [{ _id: 'bandera-1' }]
      }
    });

    await restaurarPapelera(
      {
        params: { id: 'papelera-alumno' }
      } as never,
      crearRespuesta()
    );

    expect(mockAlumno.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'alumno-1' },
      { _id: 'alumno-1', nombre: 'Ana' },
      { upsert: true, overwrite: true, setDefaultsOnInsert: true }
    );
    expect(mockExamenGenerado.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockEntrega.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockCalificacion.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockBanderaRevision.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('restaura payload de periodo incluyendo entidades dependientes', async () => {
    mockPapeleraFindOneLean.mockResolvedValue({
      _id: 'papelera-periodo',
      tipo: 'periodo',
      payload: {
        periodo: { _id: 'periodo-1', nombre: '2026-A' },
        alumnos: [{ _id: 'alumno-1' }],
        bancoPreguntas: [{ _id: 'preg-1' }],
        temas: [{ _id: 'tema-1' }],
        plantillas: [{ _id: 'plantilla-1' }],
        examenes: [{ _id: 'examen-1' }],
        entregas: [{ _id: 'entrega-1' }],
        calificaciones: [{ _id: 'calif-1' }],
        banderas: [{ _id: 'bandera-1' }],
        codigosAcceso: [{ _id: 'codigo-1' }]
      }
    });

    await restaurarPapelera(
      {
        params: { id: 'papelera-periodo' }
      } as never,
      crearRespuesta()
    );

    expect(mockPeriodo.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockAlumno.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockBancoPregunta.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockTemaBanco.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockExamenPlantilla.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockExamenGenerado.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockEntrega.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockCalificacion.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockBanderaRevision.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockCodigoAcceso.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('rechaza tipos de papelera no soportados', async () => {
    mockPapeleraFindOneLean.mockResolvedValue({
      _id: 'papelera-x',
      tipo: 'desconocido',
      payload: {}
    });

    await expect(
      restaurarPapelera(
        {
          params: { id: 'papelera-x' }
        } as never,
        crearRespuesta()
      )
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'PAPELERA_TIPO',
      estadoHttp: 400
    });
  });
});
