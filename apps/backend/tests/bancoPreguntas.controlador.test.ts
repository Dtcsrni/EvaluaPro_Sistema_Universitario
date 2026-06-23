/**
 * bancoPreguntas.controlador.test
 *
 * Responsabilidad: Cubrir reglas del controlador de banco de preguntas con
 * mocks directos del cliente Prisma, preservando contratos de duplicados y de tema.
 */
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockObtenerDocenteId,
  mockBancoFindMany,
  mockBancoFindUnique,
  mockBancoFindFirst,
  mockBancoCreate,
  mockBancoUpdate,
  mockBancoUpdateMany,
  mockBancoDelete,
  mockTemaFindFirst,
  mockTemaFindMany,
  mockTemaCreate,
  mockTemaUpdate,
  mockVersionCreate,
  mockOpcionCreateMany,
  mockPeriodoFindFirst,
  mockPlantillaFindMany,
  mockPlantillaUpdate
} = vi.hoisted(() => ({
  mockObtenerDocenteId: vi.fn(),
  mockBancoFindMany: vi.fn(),
  mockBancoFindUnique: vi.fn(),
  mockBancoFindFirst: vi.fn(),
  mockBancoCreate: vi.fn(),
  mockBancoUpdate: vi.fn(),
  mockBancoUpdateMany: vi.fn(),
  mockBancoDelete: vi.fn(),
  mockTemaFindFirst: vi.fn(),
  mockTemaFindMany: vi.fn(),
  mockTemaCreate: vi.fn(),
  mockTemaUpdate: vi.fn(),
  mockVersionCreate: vi.fn(),
  mockOpcionCreateMany: vi.fn(),
  mockPeriodoFindFirst: vi.fn(),
  mockPlantillaFindMany: vi.fn(),
  mockPlantillaUpdate: vi.fn()
}));

vi.mock('../src/modulos/modulo_autenticacion/middlewareAutenticacion', () => ({
  obtenerDocenteId: mockObtenerDocenteId
}));

vi.mock('../src/infraestructura/baseDatos/sqlite', () => ({
  prisma: {
    bancoPregunta: {
      findMany: mockBancoFindMany,
      findUnique: mockBancoFindUnique,
      findFirst: mockBancoFindFirst,
      create: mockBancoCreate,
      update: mockBancoUpdate,
      updateMany: mockBancoUpdateMany,
      delete: mockBancoDelete
    },
    temaBanco: {
      findFirst: mockTemaFindFirst,
      findMany: mockTemaFindMany,
      create: mockTemaCreate,
      update: mockTemaUpdate
    },
    versionPregunta: {
      create: mockVersionCreate
    },
    opcionPregunta: {
      createMany: mockOpcionCreateMany
    },
    periodo: {
      findFirst: mockPeriodoFindFirst
    },
    examenPlantilla: {
      findMany: mockPlantillaFindMany,
      update: mockPlantillaUpdate
    }
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

function crearPreguntaRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: 'preg-1',
    docenteId: 'docente-1',
    periodoId: 'periodo-1',
    tema: 'Tema Base',
    activo: true,
    versionActual: 1,
    versiones: [crearVersion()],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe('controladorBancoPreguntas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockObtenerDocenteId.mockReturnValue('docente-1');
    mockPeriodoFindFirst.mockResolvedValue({ id: 'periodo-1', nombre: 'Materia 1' });
    mockTemaFindFirst.mockResolvedValue({ id: 'tema-1', nombre: 'Tema Base', clave: 'tema base', activo: true });
    mockTemaFindMany.mockResolvedValue([{ id: 'tema-1', nombre: 'Tema Base' }]);
    mockBancoFindMany.mockResolvedValue([]);
    mockBancoCreate.mockResolvedValue({ id: 'preg-1' });
    mockBancoUpdateMany.mockResolvedValue({ count: 2 });
    mockPlantillaUpdate.mockResolvedValue({ count: 1 });
    mockTemaCreate.mockResolvedValue({ id: 'tema-1', nombre: 'Tema Base' });
  });

  it('lista preguntas activas por docente con limite', async () => {
    const rawPreguntas = [crearPreguntaRaw({ id: 'preg-1' })];
    mockBancoFindMany.mockResolvedValue(rawPreguntas);
    const res = crearRespuesta();

    await listarBancoPreguntas(
      {
        query: { periodoId: 'periodo-1', limite: '3' }
      } as never,
      res
    );

    expect(res.json).toHaveBeenCalledWith({
      preguntas: [
        {
          _id: 'preg-1',
          id: 'preg-1',
          docenteId: 'docente-1',
          periodoId: 'periodo-1',
          tema: 'Tema Base',
          activo: true,
          versionActual: 1,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          versiones: [
            {
              numeroVersion: 1,
              enunciado: 'Pregunta ejemplo',
              opciones: [
                { texto: 'A', esCorrecta: true },
                { texto: 'B', esCorrecta: false },
                { texto: 'C', esCorrecta: false },
                { texto: 'D', esCorrecta: false },
                { texto: 'E', esCorrecta: false }
              ]
            }
          ]
        }
      ]
    });
  });

  it('rechaza crear pregunta si el tema no existe', async () => {
    mockTemaFindFirst.mockResolvedValue(null);

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
    mockBancoFindMany.mockResolvedValue([
      crearPreguntaRaw({
        versionActual: 1,
        versiones: [crearVersion('  Pregunta   ejemplo  ')]
      })
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
    const rawPregunta = crearPreguntaRaw({
      id: 'preg-1',
      versionActual: 1,
      versiones: [crearVersion('Pregunta anterior')]
    });
    mockBancoFindFirst.mockResolvedValue(rawPregunta);

    const updatedRaw = {
      ...rawPregunta,
      versionActual: 2,
      versiones: [
        crearVersion('Pregunta anterior'),
        {
          numeroVersion: 2,
          enunciado: 'Pregunta editada',
          opciones: crearVersion().opciones
        }
      ]
    };
    mockBancoUpdate.mockResolvedValue(updatedRaw);
    mockVersionCreate.mockResolvedValue({ id: 'v2' });

    const res = crearRespuesta();

    await actualizarPregunta(
      {
        params: { preguntaId: 'preg-1' },
        body: { enunciado: 'Pregunta editada' }
      } as never,
      res
    );

    expect(mockVersionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        preguntaId: 'preg-1',
        numeroVersion: 2,
        enunciado: 'Pregunta editada'
      })
    });
    expect(mockBancoUpdate).toHaveBeenCalledWith({
      where: { id: 'preg-1' },
      data: {
        versionActual: 2,
        tema: 'Tema Base'
      },
      include: { versiones: { include: { opciones: true } } }
    });
    expect(res.json).toHaveBeenCalledWith({
      pregunta: expect.objectContaining({
        id: 'preg-1',
        versionActual: 2
      })
    });
  });

  it('rechaza mover preguntas si el destino ya contiene el mismo enunciado', async () => {
    mockBancoFindMany
      .mockResolvedValueOnce([
        crearPreguntaRaw({
          id: 'preg-1',
          versionActual: 1,
          versiones: [crearVersion('Pregunta repetida')]
        })
      ])
      .mockResolvedValueOnce([
        crearPreguntaRaw({
          versionActual: 1,
          versiones: [crearVersion('pregunta repetida')]
        })
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
    mockTemaFindFirst.mockResolvedValue({ id: 'tema-1', nombre: ' Tema Destino ', activo: true });
    mockBancoFindMany
      .mockResolvedValueOnce([
        crearPreguntaRaw({
          id: 'preg-1',
          versionActual: 1,
          versiones: [crearVersion('Pregunta 1')]
        }),
        crearPreguntaRaw({
          id: 'preg-2',
          versionActual: 1,
          versiones: [
            crearVersion('Pregunta 2', [
              { texto: 'Opcion A2', esCorrecta: true },
              { texto: 'Opcion B2', esCorrecta: false }
            ])
          ]
        })
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

    expect(mockBancoUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['preg-1', 'preg-2'] },
        docenteId: 'docente-1',
        periodoId: 'periodo-1',
        activo: true
      },
      data: { tema: 'Tema Destino' }
    });
    expect(res.json).toHaveBeenCalledWith({ movidas: 2 });
  });

  it('quita tema a preguntas validadas por materia', async () => {
    mockBancoFindMany.mockResolvedValue([
      crearPreguntaRaw({ id: 'preg-1' }),
      crearPreguntaRaw({ id: 'preg-2' })
    ]);
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

    expect(mockBancoUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['preg-1', 'preg-2'] },
        docenteId: 'docente-1',
        periodoId: 'periodo-1',
        activo: true
      },
      data: { tema: null }
    });
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
    const temaArchivado = {
      id: 'tema-1',
      activo: false,
      nombre: 'Tema Base',
      clave: 'tema base'
    };
    mockTemaFindFirst.mockResolvedValue(temaArchivado);
    mockTemaUpdate.mockResolvedValue({ ...temaArchivado, activo: true });
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

    expect(mockTemaUpdate).toHaveBeenCalledWith({
      where: { id: 'tema-1' },
      data: {
        activo: true,
        nombre: 'Tema Base',
        clave: 'tema base'
      }
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('actualiza tema y propaga el rename a preguntas y plantillas', async () => {
    const tema = {
      id: 'tema-1',
      periodoId: 'periodo-1',
      nombre: 'Tema Viejo',
      clave: 'tema viejo',
      activo: true
    };
    mockTemaFindFirst.mockResolvedValueOnce(tema).mockResolvedValueOnce(null);
    mockTemaUpdate.mockResolvedValue({ ...tema, nombre: 'Tema Nuevo', clave: 'tema nuevo' });
    mockPlantillaFindMany.mockResolvedValue([{ id: 'plantilla-1', temas: '["Tema Viejo"]' }]);

    const res = crearRespuesta();

    await actualizarTemaBanco(
      {
        params: { temaId: 'tema-1' },
        body: { nombre: 'Tema Nuevo' }
      } as never,
      res
    );

    expect(mockTemaUpdate).toHaveBeenCalledWith({
      where: { id: 'tema-1' },
      data: {
        nombre: 'Tema Nuevo',
        clave: 'tema nuevo',
        activo: true
      }
    });
    expect(mockBancoUpdateMany).toHaveBeenCalledWith({
      where: { docenteId: 'docente-1', periodoId: 'periodo-1', tema: 'Tema Viejo' },
      data: { tema: 'Tema Nuevo' }
    });
    expect(mockPlantillaUpdate).toHaveBeenCalledWith({
      where: { id: 'plantilla-1' },
      data: { temas: '["Tema Nuevo"]' }
    });
    expect(res.json).toHaveBeenCalledWith({
      tema: expect.objectContaining({
        nombre: 'Tema Nuevo'
      })
    });
  });

  it('archiva pregunta marcandola inactiva', async () => {
    const rawPregunta = crearPreguntaRaw({ id: 'preg-1', activo: true });
    mockBancoFindFirst.mockResolvedValue(rawPregunta);
    mockBancoUpdate.mockResolvedValue({ ...rawPregunta, activo: false });
    const res = crearRespuesta();

    await archivarPregunta(
      {
        params: { preguntaId: 'preg-1' }
      } as never,
      res
    );

    expect(mockBancoUpdate).toHaveBeenCalledWith({
      where: { id: 'preg-1' },
      data: expect.objectContaining({
        activo: false,
        archivadoEn: expect.any(Date)
      }),
      include: { versiones: { include: { opciones: true } } }
    });
    expect(res.json).toHaveBeenCalledWith({
      pregunta: expect.objectContaining({
        activo: false
      })
    });
  });

  it('elimina pregunta y limpia referencias en plantillas', async () => {
    const rawPregunta = crearPreguntaRaw({ id: 'preg-1', periodoId: 'periodo-1' });
    mockBancoFindFirst.mockResolvedValue(rawPregunta);

    const res = crearRespuesta();

    await eliminarPregunta(
      {
        params: { preguntaId: 'preg-1' }
      } as never,
      res
    );

    expect(mockBancoDelete).toHaveBeenCalledWith({
      where: { id: 'preg-1' }
    });
    expect(res.json).toHaveBeenCalledWith({ ok: true, preguntaId: 'preg-1' });
  });

  it('archiva tema y remueve referencias asociadas', async () => {
    const tema = {
      id: 'tema-1',
      periodoId: 'periodo-1',
      nombre: 'Tema Base',
      activo: true
    };
    mockTemaFindFirst.mockResolvedValue(tema);
    mockTemaUpdate.mockResolvedValue({ ...tema, activo: false });
    mockPlantillaFindMany.mockResolvedValue([{ id: 'plantilla-1', temas: '["Tema Base"]' }]);

    const res = crearRespuesta();

    await archivarTemaBanco(
      {
        params: { temaId: 'tema-1' }
      } as never,
      res
    );

    expect(mockTemaUpdate).toHaveBeenCalledWith({
      where: { id: 'tema-1' },
      data: expect.objectContaining({
        activo: false,
        archivadoEn: expect.any(Date)
      })
    });
    expect(mockBancoUpdateMany).toHaveBeenCalledWith({
      where: { docenteId: 'docente-1', periodoId: 'periodo-1', tema: 'Tema Base' },
      data: { tema: null }
    });
    expect(mockPlantillaUpdate).toHaveBeenCalledWith({
      where: { id: 'plantilla-1' },
      data: { temas: '[]' }
    });
    expect(res.json).toHaveBeenCalledWith({
      tema: expect.objectContaining({
        activo: false
      })
    });
  });
});
