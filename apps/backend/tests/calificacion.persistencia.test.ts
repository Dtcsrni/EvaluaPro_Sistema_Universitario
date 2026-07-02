/**
 * calificacion.persistencia.test
 *
 * Responsabilidad: Verificar la persistencia de calificaciones usando Prisma y SQLite.
 */
import type { Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { conectarMongoTest, cerrarMongoTest, limpiarMongoTest } from './utils/mongo';
import { prisma } from '../src/infraestructura/baseDatos/sqlite';
import { calificarExamen, obtenerCalificacionPorExamen } from '../src/modulos/modulo_calificacion/controladorCalificacion';
import type { SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion';

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

function crearAnalisisOmrOk() {
  return {
    estadoAnalisis: 'ok' as const,
    calidadPagina: 0.95,
    confianzaPromedioPagina: 0.93,
    ratioAmbiguas: 0,
    templateVersionDetectada: 3 as const,
    motivosRevision: [],
    engineVersion: 'omr-v3-cv',
    geomQuality: 0.91,
    photoQuality: 0.92,
    decisionPolicy: 'conservadora_v1'
  };
}

describe('calificaciones persistencia', () => {
  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  async function seedDocentePeriodoAlumno(docenteId: string, periodoId: string, alumnoId: string) {
    await prisma.docente.create({
      data: {
        id: docenteId,
        nombreCompleto: 'Docente Prueba',
        correo: `docente-${docenteId}@evaluapro.local`
      }
    });

    await prisma.periodo.create({
      data: {
        id: periodoId,
        docenteId,
        nombre: 'Periodo 1',
        nombreNormalizado: 'periodo 1',
        fechaInicio: new Date(),
        fechaFin: new Date(),
        grupos: '["A"]'
      }
    });

    await prisma.alumno.create({
      data: {
        id: alumnoId,
        periodoId,
        matricula: `MAT-${alumnoId}`,
        nombreCompleto: 'Alumno Prueba',
        correo: 'alumno@evaluapro.local',
        grupo: 'A'
      }
    });
  }

  it('guarda calificación y luego la recupera por examen', async () => {
    const docenteId = 'docente-1';
    const periodoId = 'periodo-1';
    const alumnoId = 'alumno-1';

    await seedDocentePeriodoAlumno(docenteId, periodoId, alumnoId);

    const pregunta = await prisma.bancoPregunta.create({
      data: {
        id: 'preg-1',
        docenteId,
        periodoId,
        tema: 'Álgebra',
        versionActual: 1,
        versiones: {
          create: [
            {
              id: 'preg-ver-1',
              numeroVersion: 1,
              enunciado: '2 + 2 = ?',
              opciones: {
                create: [
                  { texto: '4', esCorrecta: true },
                  { texto: '3', esCorrecta: false },
                  { texto: '2', esCorrecta: false },
                  { texto: '1', esCorrecta: false },
                  { texto: '0', esCorrecta: false }
                ]
              }
            }
          ]
        }
      }
    });

    const plantilla = await prisma.examenPlantilla.create({
      data: {
        id: 'plantilla-1',
        docenteId,
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial de prueba',
        tituloNormalizado: 'parcial de prueba',
        numeroPaginas: 1,
        bookletConfig: '{}',
        omrConfig: '{}',
        configuracionPdf: '{}',
        preguntas: {
          create: [
            {
              preguntaId: pregunta.id,
              orden: 0
            }
          ]
        }
      }
    });

    const examen = await prisma.examenGenerado.create({
      data: {
        id: 'examen-1',
        docenteId,
        periodoId,
        plantillaId: plantilla.id,
        alumnoId,
        folio: 'FOL-PERSIST-001',
        estado: 'entregado',
        mapaVariante: JSON.stringify({
          ordenPreguntas: [pregunta.id],
          ordenOpcionesPorPregunta: {
            [pregunta.id]: [0, 1, 2, 3, 4]
          }
        }),
        mapaOmr: JSON.stringify({
          templateVersion: 3,
          paginas: []
        })
      }
    });

    const reqGuardar = {
      docenteId,
      body: {
        examenGeneradoId: examen.id,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' }],
        omrAnalisis: crearAnalisisOmrOk(),
        bonoSolicitado: 0,
        retroalimentacion: 'Correcto',
        versionPolitica: 1,
        bloqueContinuaDecimal: 8.75,
        bloqueExamenesDecimal: 9.25,
        finalDecimal: 9,
        finalRedondeada: 9
      }
    } as unknown as SolicitudDocente;
    const resGuardar = crearRespuesta();

    await calificarExamen(reqGuardar, resGuardar);

    expect((resGuardar.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(201);
    const calificacionGuardada = await prisma.calificacion.findFirst({
      where: {
        docenteId,
        examenGeneradoId: examen.id
      }
    });
    expect(calificacionGuardada).toBeTruthy();
    expect(calificacionGuardada?.aciertos).toBe(1);
    expect(JSON.parse(calificacionGuardada?.respuestasDetectadas ?? '[]')).toEqual([{ numeroPregunta: 1, opcion: 'A' }]);
    expect(calificacionGuardada?.versionPolitica).toBe(1);
    expect(calificacionGuardada?.bloqueContinuaDecimal).toBe(8.75);
    expect(calificacionGuardada?.bloqueExamenesDecimal).toBe(9.25);
    expect(calificacionGuardada?.finalDecimal).toBe(9);
    expect(calificacionGuardada?.finalRedondeada).toBe(9);

    const examenActualizado = await prisma.examenGenerado.findUnique({
      where: { id: examen.id }
    });
    expect(examenActualizado?.estado).toBe('calificado');

    const reqRecuperar = {
      docenteId,
      params: { examenGeneradoId: examen.id }
    } as unknown as SolicitudDocente;
    const resRecuperar = crearRespuesta();

    await obtenerCalificacionPorExamen(reqRecuperar, resRecuperar);

    const payloadRecuperado = (resRecuperar.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      calificacion: { examenGeneradoId: string; respuestasDetectadas: Array<{ numeroPregunta: number; opcion: string }> };
    };
    expect(payloadRecuperado.calificacion.examenGeneradoId).toBe(examen.id);
    expect(payloadRecuperado.calificacion.respuestasDetectadas).toEqual([{ numeroPregunta: 1, opcion: 'A' }]);
  });

  it('guarda imágenes OMR por página al calificar y las recupera en paginasOmr', async () => {
    const docenteId = 'docente-2';
    const periodoId = 'periodo-2';
    const alumnoId = 'alumno-2';

    await seedDocentePeriodoAlumno(docenteId, periodoId, alumnoId);

    const pregunta = await prisma.bancoPregunta.create({
      data: {
        id: 'preg-2',
        docenteId,
        periodoId,
        tema: 'Álgebra',
        versionActual: 1,
        versiones: {
          create: [
            {
              id: 'preg-ver-2',
              numeroVersion: 1,
              enunciado: '3 + 2 = ?',
              opciones: {
                create: [
                  { texto: '5', esCorrecta: true },
                  { texto: '4', esCorrecta: false },
                  { texto: '3', esCorrecta: false },
                  { texto: '2', esCorrecta: false },
                  { texto: '1', esCorrecta: false }
                ]
              }
            }
          ]
        }
      }
    });

    const plantilla = await prisma.examenPlantilla.create({
      data: {
        id: 'plantilla-2',
        docenteId,
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial OMR 2 páginas',
        tituloNormalizado: 'parcial omr 2 paginas',
        numeroPaginas: 2,
        bookletConfig: '{}',
        omrConfig: '{}',
        configuracionPdf: '{}',
        preguntas: {
          create: [
            {
              preguntaId: pregunta.id,
              orden: 0
            }
          ]
        }
      }
    });

    const examen = await prisma.examenGenerado.create({
      data: {
        id: 'examen-2',
        docenteId,
        periodoId,
        plantillaId: plantilla.id,
        alumnoId,
        folio: 'FOL-PERSIST-OMR-002',
        estado: 'entregado',
        mapaVariante: JSON.stringify({
          ordenPreguntas: [pregunta.id],
          ordenOpcionesPorPregunta: {
            [pregunta.id]: [0, 1, 2, 3, 4]
          }
        }),
        mapaOmr: JSON.stringify({
          templateVersion: 3,
          paginas: []
        })
      }
    });

    const reqGuardar = {
      docenteId,
      body: {
        examenGeneradoId: examen.id,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' }],
        omrAnalisis: crearAnalisisOmrOk(),
        paginasOmr: [
          {
            numeroPagina: 1,
            imagenBase64: 'data:image/png;base64,AQIDBA=='
          },
          {
            numeroPagina: 2,
            imagenBase64: 'data:image/jpeg;base64,BQYHCA=='
          }
        ]
      }
    } as unknown as SolicitudDocente;
    const resGuardar = crearRespuesta();

    await calificarExamen(reqGuardar, resGuardar);

    expect((resGuardar.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(201);

    const capturas = await prisma.escaneoOmrArchivado.findMany({
      where: {
        docenteId,
        examenGeneradoId: examen.id
      },
      orderBy: { numeroPagina: 'asc' }
    });
    expect(capturas).toHaveLength(2);
    expect(capturas[0]?.numeroPagina).toBe(1);
    expect(capturas[1]?.numeroPagina).toBe(2);
    expect(capturas[0]?.tamanoComprimidoBytes).toBeGreaterThan(0);
    expect(capturas[1]?.tamanoComprimidoBytes).toBeGreaterThan(0);

    const reqRecuperar = {
      docenteId,
      params: { examenGeneradoId: examen.id }
    } as unknown as SolicitudDocente;
    const resRecuperar = crearRespuesta();

    await obtenerCalificacionPorExamen(reqRecuperar, resRecuperar);

    const payloadRecuperado = (resRecuperar.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      calificacion: {
        paginasOmr: Array<{ numeroPagina: number; imagenBase64: string }>;
      };
    };
    expect(Array.isArray(payloadRecuperado.calificacion.paginasOmr)).toBe(true);
    expect(payloadRecuperado.calificacion.paginasOmr).toHaveLength(2);
    expect(payloadRecuperado.calificacion.paginasOmr[0]?.numeroPagina).toBe(1);
    expect(payloadRecuperado.calificacion.paginasOmr[1]?.numeroPagina).toBe(2);
    expect(payloadRecuperado.calificacion.paginasOmr[0]?.imagenBase64.startsWith('data:image/png;base64,')).toBe(true);
    expect(payloadRecuperado.calificacion.paginasOmr[1]?.imagenBase64.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('conserva historial por intento y expone solo la última captura por página', async () => {
    const docenteId = 'docente-3';
    const periodoId = 'periodo-3';
    const alumnoId = 'alumno-3';

    await seedDocentePeriodoAlumno(docenteId, periodoId, alumnoId);

    const pregunta = await prisma.bancoPregunta.create({
      data: {
        id: 'preg-3',
        docenteId,
        periodoId,
        tema: 'Historia',
        versionActual: 1,
        versiones: {
          create: [
            {
              id: 'preg-ver-3',
              numeroVersion: 1,
              enunciado: 'Capital de Francia',
              opciones: {
                create: [
                  { texto: 'Paris', esCorrecta: true },
                  { texto: 'Roma', esCorrecta: false },
                  { texto: 'Madrid', esCorrecta: false },
                  { texto: 'Berlin', esCorrecta: false },
                  { texto: 'Lisboa', esCorrecta: false }
                ]
              }
            }
          ]
        }
      }
    });

    const plantilla = await prisma.examenPlantilla.create({
      data: {
        id: 'plantilla-3',
        docenteId,
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial intentos OMR',
        tituloNormalizado: 'parcial intentos omr',
        numeroPaginas: 1,
        bookletConfig: '{}',
        omrConfig: '{}',
        configuracionPdf: '{}',
        preguntas: {
          create: [
            {
              preguntaId: pregunta.id,
              orden: 0
            }
          ]
        }
      }
    });

    const examen = await prisma.examenGenerado.create({
      data: {
        id: 'examen-3',
        docenteId,
        periodoId,
        plantillaId: plantilla.id,
        alumnoId,
        folio: 'FOL-PERSIST-OMR-ATTEMPT',
        estado: 'entregado',
        mapaVariante: JSON.stringify({
          ordenPreguntas: [pregunta.id],
          ordenOpcionesPorPregunta: {
            [pregunta.id]: [0, 1, 2, 3, 4]
          }
        }),
        mapaOmr: JSON.stringify({
          templateVersion: 3,
          paginas: []
        })
      }
    });

    const cuerpoBase = {
      examenGeneradoId: examen.id,
      respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' }],
      omrAnalisis: crearAnalisisOmrOk()
    };

    await calificarExamen(
      {
        docenteId,
        body: {
          ...cuerpoBase,
          paginasOmr: [{ numeroPagina: 1, imagenBase64: 'data:image/png;base64,AQIDBA==' }]
        }
      } as unknown as SolicitudDocente,
      crearRespuesta()
    );

    await calificarExamen(
      {
        docenteId,
        body: {
          ...cuerpoBase,
          paginasOmr: [{ numeroPagina: 1, imagenBase64: 'data:image/png;base64,BQYHCA==' }]
        }
      } as unknown as SolicitudDocente,
      crearRespuesta()
    );

    const capturas = await prisma.escaneoOmrArchivado.findMany({
      where: { docenteId, examenGeneradoId: examen.id },
      orderBy: [{ numeroPagina: 'asc' }, { intento: 'asc' }]
    });
    expect(capturas).toHaveLength(2);
    expect(capturas[0]?.intento).toBe(1);
    expect(capturas[1]?.intento).toBe(2);

    const resRecuperar = crearRespuesta();
    await obtenerCalificacionPorExamen(
      {
        docenteId,
        params: { examenGeneradoId: examen.id }
      } as unknown as SolicitudDocente,
      resRecuperar
    );
    const payload = (resRecuperar.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      calificacion: { paginasOmr: Array<{ numeroPagina: number; imagenBase64: string }> };
    };
    expect(payload.calificacion.paginasOmr).toHaveLength(1);
    expect(payload.calificacion.paginasOmr[0]?.numeroPagina).toBe(1);
    expect(payload.calificacion.paginasOmr[0]?.imagenBase64).toContain('data:image/png;base64,');
  });

  it('maneja fallos de conexión a la base de datos de manera controlada (resiliencia)', async () => {
    const docenteId = 'docente-fallo-db';
    const periodoId = 'periodo-fallo-db';
    const alumnoId = 'alumno-fallo-db';

    await seedDocentePeriodoAlumno(docenteId, periodoId, alumnoId);

    const pregunta = await prisma.bancoPregunta.create({
      data: {
        id: 'preg-fallo',
        docenteId,
        periodoId,
        tema: 'Fallo DB',
        versionActual: 1,
        versiones: { create: [{ id: 'preg-ver-fallo', numeroVersion: 1, enunciado: 'Q', opciones: { create: [{ texto: 'A', esCorrecta: true }] } }] }
      }
    });

    const plantilla = await prisma.examenPlantilla.create({
      data: {
        id: 'plantilla-fallo',
        docenteId,
        periodoId,
        tipo: 'parcial',
        titulo: 'Fallo',
        tituloNormalizado: 'fallo',
        numeroPaginas: 1,
        bookletConfig: '{}',
        omrConfig: '{}',
        configuracionPdf: '{}',
        preguntas: { create: [{ preguntaId: pregunta.id, orden: 0 }] }
      }
    });

    const examen = await prisma.examenGenerado.create({
      data: {
        id: 'examen-fallo',
        docenteId,
        periodoId,
        plantillaId: plantilla.id,
        alumnoId,
        folio: 'FOL-FALLO',
        estado: 'entregado',
        mapaVariante: '{}',
        mapaOmr: '{}'
      }
    });

    const reqGuardar = {
      docenteId,
      body: {
        examenGeneradoId: examen.id,
        respuestasDetectadas: [],
        omrAnalisis: crearAnalisisOmrOk()
      }
    } as unknown as SolicitudDocente;
    const resGuardar = crearRespuesta();

    // Simulamos un fallo forzado espiando a Prisma y lanzando error
    const spy = vi.spyOn(prisma.calificacion, 'create').mockRejectedValueOnce(new Error('DB Timeout Connection'));

    await expect(calificarExamen(reqGuardar, resGuardar)).rejects.toThrow('DB Timeout Connection');

    spy.mockRestore();
  });
});
