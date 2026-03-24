/**
 * bancoPreguntas.controlador.test
 *
 * Responsabilidad: Cubrir reglas del controlador de banco de preguntas con
 * mocks directos de modelos, preservando contratos de duplicados y de tema.
 */
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockObtenerDocenteId,
  mockPeriodoFindOneLean,
  mockTemaFindOneLean,
  mockTemaFindOneDoc,
  mockTemaFindSortLean,
  mockTemaCreate,
  mockBancoFindLean,
  mockBancoFindDoc,
  mockBancoCreate,
  mockBancoDeleteOne,
  mockBancoUpdateMany,
  mockPlantillaUpdateMany
} = vi.hoisted(() => ({
  mockObtenerDocenteId: vi.fn(),
  mockPeriodoFindOneLean: vi.fn(),
  mockTemaFindOneLean: vi.fn(),
  mockTemaFindOneDoc: vi.fn(),
  mockTemaFindSortLean: vi.fn(),
  mockTemaCreate: vi.fn(),
  mockBancoFindLean: vi.fn(),
  mockBancoFindDoc: vi.fn(),
  mockBancoCreate: vi.fn(),
  mockBancoDeleteOne: vi.fn(),
  mockBancoUpdateMany: vi.fn(),
  mockPlantillaUpdateMany: vi.fn()
}));

vi.mock('../src/modulos/modulo_autenticacion/middlewareAutenticacion', () => ({
  obtenerDocenteId: mockObtenerDocenteId
}));

vi.mock('../src/modulos/modulo_alumnos/modeloPeriodo', () => ({
  Periodo: {
    findOne: vi.fn(() => ({
      lean: mockPeriodoFindOneLean
    }))
  }
}));

vi.mock('../src/modulos/modulo_banco_preguntas/modeloTemaBanco', () => ({
  TemaBanco: {
    findOne: vi.fn((...args) => {
      const query = args[0] as Record<string, unknown>;
      const hasLeanQuery = Object.prototype.hasOwnProperty.call(query, 'activo')
        || (typeof query._id === 'object' && query._id !== null);
      if (hasLeanQuery) {
        return { lean: mockTemaFindOneLean };
      }
      return mockTemaFindOneDoc();
    }),
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        lean: mockTemaFindSortLean
      }))
    })),
    create: mockTemaCreate
  }
}));

vi.mock('../src/modulos/modulo_banco_preguntas/modeloBancoPregunta', () => ({
  BancoPregunta: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        limit: vi.fn(() => ({
          lean: mockBancoFindLean
        })),
        lean: mockBancoFindLean
      })),
      select: vi.fn(() => ({
        lean: mockBancoFindLean
      })),
      lean: mockBancoFindLean
    })),
    findOne: vi.fn((query: Record<string, unknown>) => {
      const isDocQuery = Object.keys(query).includes('_id') && !Object.prototype.hasOwnProperty.call(query, 'activo');
      if (isDocQuery) {
        return mockBancoFindDoc();
      }
      return {
        lean: mockBancoFindDoc.mock.calls.length > 0 ? mockBancoFindLean : mockBancoFindLean
      };
    }),
    create: mockBancoCreate,
    deleteOne: mockBancoDeleteOne,
    updateMany: mockBancoUpdateMany
  }
}));

vi.mock('../src/modulos/modulo_generacion_pdf/modeloExamenPlantilla', () => ({
  ExamenPlantilla: {
    updateMany: mockPlantillaUpdateMany
  }
}));

import { ErrorAplicacion } from '../src/compartido/errores/errorAplicacion';
import {
  actualizarPregunta,
  actualizarTemaBanco,
  archivarPregunta,
  archivarTemaBanco,
  crearPregunta,
  crearTemaBanco,
  eliminarPregunta,
  listarBancoPreguntas,
  listarTemasBanco,
  moverPreguntasTemaBanco,
  quitarTemaBanco
} from '../src/modulos/modulo_banco_preguntas/controladorBancoPreguntas';

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

function crearVersion(enunciado = 'Pregunta ejemplo', opciones?: Array<{ texto: string; esCorrecta: boolean }>) {
  return {
    numeroVersion: 1,
    enunciado,
    opciones: opciones ?? [
      { texto: 'A', esCorrecta: true },
      { texto: 'B', esCorrecta: false },
      { texto: 'C', esCorrecta: false },
      { texto: 'D', esCorrecta: false },
      { texto: 'E', esCorrecta: false }
    ]
  };
}

function crearPreguntaDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'preg-1',
    docenteId: 'docente-1',
    periodoId: 'periodo-1',
    tema: 'Tema Base',
    activo: true,
    versionActual: 1,
    versiones: [crearVersion()],
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('controladorBancoPreguntas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockObtenerDocenteId.mockReturnValue('docente-1');
    mockPeriodoFindOneLean.mockResolvedValue({ _id: 'periodo-1', nombre: 'Materia 1' });
    mockTemaFindOneLean.mockResolvedValue({ _id: 'tema-1', nombre: 'Tema Base', clave: 'tema base', activo: true });
    mockTemaFindSortLean.mockResolvedValue([{ _id: 'tema-1', nombre: 'Tema Base' }]);
    mockBancoFindLean.mockResolvedValue([]);
    mockBancoCreate.mockResolvedValue({ _id: 'preg-1' });
    mockBancoDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mockBancoUpdateMany.mockResolvedValue({ modifiedCount: 2 });
    mockPlantillaUpdateMany.mockResolvedValue({ modifiedCount: 1 });
    mockTemaCreate.mockResolvedValue({ _id: 'tema-1', nombre: 'Tema Base' });
    mockTemaFindOneDoc.mockReturnValue(null);
    mockBancoFindDoc.mockReturnValue(null);
  });

  it('lista preguntas activas por docente con limite', async () => {
    const preguntas = [{ _id: 'preg-1' }];
    mockBancoFindLean.mockResolvedValue(preguntas);
    const res = crearRespuesta();

    await listarBancoPreguntas(
      {
        query: { periodoId: 'periodo-1', limite: '3' }
      } as never,
      res
    );

    expect(res.json).toHaveBeenCalledWith({ preguntas });
  });

  it('rechaza crear pregunta si el tema no existe', async () => {
    mockTemaFindOneLean.mockResolvedValue(null);

    await expect(
      crearPregunta(
        {
          body: {
            periodoId: 'periodo-1',
            tema: 'Tema Base',
            enunciado: 'Nueva',
            opciones: crearVersion().opciones
          }
        } as never,
        crearRespuesta()
      )
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'TEMA_NO_ENCONTRADO',
      estadoHttp: 404
    });
  });

  it('rechaza crear pregunta duplicada por enunciado en el mismo tema', async () => {
    mockBancoFindLean.mockResolvedValue([
      {
        versionActual: 1,
        versiones: [crearVersion('  Pregunta   ejemplo  ')]
      }
    ]);

    await expect(
      crearPregunta(
        {
          body: {
            periodoId: 'periodo-1',
            tema: 'Tema Base',
            enunciado: 'pregunta ejemplo',
            opciones: crearVersion().opciones
          }
        } as never,
        crearRespuesta()
      )
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'PREGUNTA_DUPLICADA',
      estadoHttp: 409
    });
  });

  it('actualiza pregunta agregando nueva version y conserva datos previos faltantes', async () => {
    const pregunta = crearPreguntaDoc();
    mockBancoFindDoc.mockReturnValue(pregunta);
    const res = crearRespuesta();

    await actualizarPregunta(
      {
        params: { preguntaId: 'preg-1' },
        body: { enunciado: 'Pregunta editada' }
      } as never,
      res
    );

    expect(pregunta.versionActual).toBe(2);
    expect(pregunta.versiones).toHaveLength(2);
    expect(pregunta.versiones[1]).toMatchObject({
      numeroVersion: 2,
      enunciado: 'Pregunta editada'
    });
    expect(pregunta.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ pregunta });
  });

  it('rechaza mover preguntas si el destino ya contiene el mismo enunciado', async () => {
    mockBancoFindLean
      .mockResolvedValueOnce([
        {
          _id: 'preg-1',
          versionActual: 1,
          versiones: [crearVersion('Pregunta repetida')]
        }
      ])
      .mockResolvedValueOnce([
        {
          versionActual: 1,
          versiones: [crearVersion('pregunta repetida')]
        }
      ]);

    await expect(
      moverPreguntasTemaBanco(
        {
          body: {
            periodoId: 'periodo-1',
            temaIdDestino: 'tema-1',
            preguntasIds: ['preg-1']
          }
        } as never,
        crearRespuesta()
      )
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'PREGUNTA_DUPLICADA',
      estadoHttp: 409
    });
  });

  it('mueve preguntas al tema destino y reporta el total actualizado', async () => {
    mockTemaFindOneLean.mockResolvedValue({ _id: 'tema-1', nombre: ' Tema Destino ', activo: true });
    mockBancoFindLean
      .mockResolvedValueOnce([
        {
          _id: 'preg-1',
          versionActual: 1,
          versiones: [crearVersion('Pregunta 1')]
        },
        {
          _id: 'preg-2',
          versionActual: 1,
          versiones: [
            crearVersion('Pregunta 2', [
              { texto: 'A2', esCorrecta: true },
              { texto: 'B2', esCorrecta: false },
              { texto: 'C2', esCorrecta: false },
              { texto: 'D2', esCorrecta: false },
              { texto: 'E2', esCorrecta: false }
            ])
          ]
        }
      ])
      .mockResolvedValueOnce([]);
    const res = crearRespuesta();

    await moverPreguntasTemaBanco(
      {
        body: {
          periodoId: 'periodo-1',
          temaIdDestino: 'tema-1',
          preguntasIds: ['preg-1', 'preg-2']
        }
      } as never,
      res
    );

    expect(mockBancoUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: ['preg-1', 'preg-2'] }, docenteId: 'docente-1', periodoId: 'periodo-1', activo: true },
      { $set: { tema: 'Tema Destino' } }
    );
    expect(res.json).toHaveBeenCalledWith({ movidas: 2 });
  });

  it('quita tema a preguntas validadas por materia', async () => {
    mockBancoFindLean.mockResolvedValue([{ _id: 'preg-1' }, { _id: 'preg-2' }]);
    const res = crearRespuesta();

    await quitarTemaBanco(
      {
        body: {
          periodoId: 'periodo-1',
          preguntasIds: ['preg-1', 'preg-2']
        }
      } as never,
      res
    );

    expect(mockBancoUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: ['preg-1', 'preg-2'] }, docenteId: 'docente-1', periodoId: 'periodo-1', activo: true },
      { $unset: { tema: 1 } }
    );
    expect(res.json).toHaveBeenCalledWith({ actualizadas: 2 });
  });

  it('rechaza listar temas sin materia', async () => {
    await expect(
      listarTemasBanco(
        {
          query: {}
        } as never,
        crearRespuesta()
      )
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'PERIODO_REQUERIDO',
      estadoHttp: 400
    });
  });

  it('reactiva tema archivado al crearlo de nuevo', async () => {
    const tema = {
      activo: false,
      nombre: 'Tema Base',
      clave: 'tema base',
      save: vi.fn().mockResolvedValue(undefined)
    };
    mockTemaFindOneDoc.mockReturnValue(tema);
    const res = crearRespuesta();

    await crearTemaBanco(
      {
        body: {
          periodoId: 'periodo-1',
          nombre: ' Tema Base '
        }
      } as never,
      res
    );

    expect(tema.activo).toBe(true);
    expect(tema.nombre).toBe('Tema Base');
    expect(tema.clave).toBe('tema base');
    expect(tema.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('actualiza tema y propaga el rename a preguntas y plantillas', async () => {
    const tema = {
      periodoId: 'periodo-1',
      nombre: 'Tema Viejo',
      clave: 'tema viejo',
      activo: true,
      save: vi.fn().mockResolvedValue(undefined)
    };
    mockTemaFindOneDoc.mockReturnValue(tema);
    mockTemaFindOneLean.mockResolvedValue(null);
    const res = crearRespuesta();

    await actualizarTemaBanco(
      {
        params: { temaId: 'tema-1' },
        body: { nombre: 'Tema Nuevo' }
      } as never,
      res
    );

    expect(mockBancoUpdateMany).toHaveBeenCalledWith(
      { docenteId: 'docente-1', periodoId: 'periodo-1', tema: 'Tema Viejo' },
      { $set: { tema: 'Tema Nuevo' } }
    );
    expect(mockPlantillaUpdateMany).toHaveBeenCalledWith(
      { docenteId: 'docente-1', periodoId: 'periodo-1', temas: 'Tema Viejo' },
      { $set: { 'temas.$[t]': 'Tema Nuevo' } },
      { arrayFilters: [{ t: 'Tema Viejo' }] }
    );
    expect(res.json).toHaveBeenCalledWith({ tema });
  });

  it('archiva pregunta marcandola inactiva', async () => {
    const pregunta = crearPreguntaDoc();
    mockBancoFindDoc.mockReturnValue(pregunta);
    const res = crearRespuesta();

    await archivarPregunta(
      {
        params: { preguntaId: 'preg-1' }
      } as never,
      res
    );

    expect(pregunta.activo).toBe(false);
    expect((pregunta as { archivadoEn?: Date }).archivadoEn).toBeInstanceOf(Date);
    expect(pregunta.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ pregunta });
  });

  it('elimina pregunta y limpia referencias en plantillas', async () => {
    const pregunta = crearPreguntaDoc();
    mockBancoFindDoc.mockReturnValue(pregunta);
    const res = crearRespuesta();

    await eliminarPregunta(
      {
        params: { preguntaId: 'preg-1' }
      } as never,
      res
    );

    expect(mockBancoDeleteOne).toHaveBeenCalledWith({ _id: 'preg-1', docenteId: 'docente-1' });
    expect(mockPlantillaUpdateMany).toHaveBeenCalledWith(
      { docenteId: 'docente-1', periodoId: 'periodo-1', preguntasIds: 'preg-1' },
      { $pull: { preguntasIds: 'preg-1' } }
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, preguntaId: 'preg-1' });
  });

  it('archiva tema y remueve referencias asociadas', async () => {
    const tema = {
      periodoId: 'periodo-1',
      nombre: 'Tema Base',
      activo: true,
      save: vi.fn().mockResolvedValue(undefined)
    };
    mockTemaFindOneDoc.mockReturnValue(tema);
    const res = crearRespuesta();

    await archivarTemaBanco(
      {
        params: { temaId: 'tema-1' }
      } as never,
      res
    );

    expect(tema.activo).toBe(false);
    expect((tema as { archivadoEn?: Date }).archivadoEn).toBeInstanceOf(Date);
    expect(mockBancoUpdateMany).toHaveBeenCalledWith(
      { docenteId: 'docente-1', periodoId: 'periodo-1', tema: 'Tema Base' },
      { $unset: { tema: 1 } }
    );
    expect(mockPlantillaUpdateMany).toHaveBeenCalledWith(
      { docenteId: 'docente-1', periodoId: 'periodo-1', temas: 'Tema Base' },
      { $pull: { temas: 'Tema Base' } }
    );
    expect(res.json).toHaveBeenCalledWith({ tema });
  });
});
