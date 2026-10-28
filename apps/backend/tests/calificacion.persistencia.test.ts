/**
 * calificacion.persistencia.test
 *
 * Responsabilidad: Verificar la persistencia de calificaciones usando Prisma y SQLite.
 */
import type { Response } from 'express';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { conectarSqliteTest, cerrarSqliteTest, limpiarSqliteTest } from './utils/sqliteTestDatabase.js';
import { prisma } from '../src/infraestructura/baseDatos/sqlite.js';
import { calificarExamen, obtenerCalificacionPorExamen } from '../src/modulos/modulo_calificacion/controladorCalificacion.js';
import type { SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion.js';
import { construirTextoQrExamenPagina } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen.js';
import { hashContenidoPregunta } from '../src/modulos/modulo_generacion_pdf/index.js';

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

function crearAnalisisOmrOk(revisionConfirmada = false, qrTexto?: string) {
  return {
    estadoAnalisis: 'ok' as const,
    calidadPagina: 0.95,
    confianzaPromedioPagina: 0.93,
    ratioAmbiguas: 0,
    ...(revisionConfirmada ? { revisionConfirmada: true, bonoVisibleConfirmado: false } : {}),
    templateVersionDetectada: 4 as const,
    motivosRevision: [],
    engineVersion: 'omr-cv',
    geomQuality: 0.91,
    photoQuality: 0.92,
    decisionPolicy: 'conservadora_v1',
    ...(qrTexto ? { qrTexto } : {})
  };
}

describe('calificaciones persistencia', () => {
  beforeAll(async () => {
    await conectarSqliteTest();
  });

  beforeEach(async () => {
    await limpiarSqliteTest();
  });

  afterAll(async () => {
    await cerrarSqliteTest();
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

  async function crearSnapshotVersionSet(preguntaId: string) {
    const pregunta = await prisma.bancoPregunta.findUnique({
      where: { id: preguntaId },
      include: { versiones: { include: { opciones: true } } }
    });
    if (!pregunta) throw new Error(`No se encontró el reactivo fixture ${preguntaId}.`);
    const version = Number(pregunta.versionActual);
    return JSON.stringify([{
      preguntaId,
      version,
      contentHash: hashContenidoPregunta(pregunta as Parameters<typeof hashContenidoPregunta>[0], version),
      source: 'legacy'
    }]);
  }

  async function prepararQrVerificado(examenId: string, preguntaId: string, numeroPaginas = 1) {
    const examen = await prisma.examenGenerado.findUnique({ where: { id: examenId } });
    const preguntaDb = await prisma.bancoPregunta.findUnique({
      where: { id: preguntaId },
      include: { versiones: { include: { opciones: true } } }
    });
    if (!examen || !preguntaDb) throw new Error('Falta el examen o reactivo fixture para generar el QR verificado.');

    const version = Number(preguntaDb.versionActual);
    const pregunta = {
      id: preguntaDb.id,
      opciones: preguntaDb.versiones.find((item) => item.numeroVersion === version)?.opciones.map((opcion) => ({
        texto: opcion.texto,
        esCorrecta: opcion.esCorrecta
      })) ?? []
    };
    const mapaVariante = JSON.parse(String(examen.mapaVariante ?? '{}')) as {
      ordenPreguntas: string[];
      ordenOpcionesPorPregunta: Record<string, number[]>;
    };
    const preguntas = [pregunta];
    const codigosQr = Array.from({ length: numeroPaginas }, (_item, indice) => {
      const numeroPagina = indice + 1;
      const qrTexto = construirTextoQrExamenPagina({
        folio: String(examen.folio),
        numeroPagina,
        templateVersion: 4,
        templateId: 'omr-canonical-v4',
        examId: examen.id,
        mapaVariante,
        preguntas,
        totalPreguntas: mapaVariante.ordenPreguntas.length,
        preguntaDesde: 1,
        preguntaHasta: mapaVariante.ordenPreguntas.length,
        questionIdsPagina: [preguntaId]
      });
      return { numeroPagina, qrTexto };
    });
    const mapaOmr = JSON.parse(String(examen.mapaOmr ?? '{}')) as Record<string, unknown>;
    const capturas = await Promise.all(codigosQr.map(async ({ qrTexto }, indice) => {
      const png = await QRCode.toDataURL(qrTexto, { width: 512, margin: 1 });
      if (indice === 0) return png;
      const jpeg = await sharp(Buffer.from(png.split(',')[1] ?? '', 'base64')).jpeg().toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    }));
    await prisma.examenGenerado.update({
      where: { id: examenId },
      data: {
        versionSet: await crearSnapshotVersionSet(preguntaId),
        paginas: JSON.stringify(codigosQr.map(({ numeroPagina, qrTexto }) => ({ numero: numeroPagina, qrTexto }))),
        mapaOmr: JSON.stringify({
          ...mapaOmr,
          templateId: 'omr-canonical-v4',
          paginas: codigosQr.map(({ numeroPagina, qrTexto }) => ({
            numeroPagina,
            templateId: 'omr-canonical-v4',
            templateVersion: 4,
            qr: { texto: qrTexto }
          }))
        })
      }
    });
    return { qrTexto: codigosQr[0]!.qrTexto, capturas };
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
          templateVersion: 4,
          paginas: []
        }),
        versionSet: await crearSnapshotVersionSet(pregunta.id)
      }
    });
    const evidenciaQr = await prepararQrVerificado(examen.id, pregunta.id);

    const reqGuardar = {
      docenteId,
      body: {
        examenGeneradoId: examen.id,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' }],
        // Las respuestas de este fixture no incluyen confianza por reactivo;
        // la persistencia se prueba con revisión humana explícita.
        omrAnalisis: crearAnalisisOmrOk(true, evidenciaQr.qrTexto),
        paginasOmr: [{ numeroPagina: 1, imagenBase64: evidenciaQr.capturas[0]! }],
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
          templateVersion: 4,
          paginas: []
        }),
        versionSet: await crearSnapshotVersionSet(pregunta.id)
      }
    });
    const evidenciaQr = await prepararQrVerificado(examen.id, pregunta.id, 2);

    const reqGuardar = {
      docenteId,
      body: {
        examenGeneradoId: examen.id,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' }],
        // Las respuestas de este fixture no incluyen confianza por reactivo;
        // la persistencia se prueba con revisión humana explícita.
        omrAnalisis: crearAnalisisOmrOk(true, evidenciaQr.qrTexto),
        paginasOmr: [
          {
            numeroPagina: 1,
            imagenBase64: evidenciaQr.capturas[0]!
          },
          {
            numeroPagina: 2,
            imagenBase64: evidenciaQr.capturas[1]!
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
          templateVersion: 4,
          paginas: []
        }),
        versionSet: await crearSnapshotVersionSet(pregunta.id)
      }
    });
    const evidenciaQr = await prepararQrVerificado(examen.id, pregunta.id);

    const cuerpoBase = {
      examenGeneradoId: examen.id,
      respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' }],
      // Capturas legacy sin confianza por reactivo: revisión humana confirmada.
      omrAnalisis: crearAnalisisOmrOk(true, evidenciaQr.qrTexto)
    };

    await calificarExamen(
      {
        docenteId,
        body: {
          ...cuerpoBase,
          paginasOmr: [{ numeroPagina: 1, imagenBase64: evidenciaQr.capturas[0]! }]
        }
      } as unknown as SolicitudDocente,
      crearRespuesta()
    );

    await calificarExamen(
      {
        docenteId,
        body: {
          ...cuerpoBase,
          paginasOmr: [{ numeroPagina: 1, imagenBase64: evidenciaQr.capturas[0]! }]
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
