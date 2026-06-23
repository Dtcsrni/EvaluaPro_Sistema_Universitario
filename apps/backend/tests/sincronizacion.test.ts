/**
 * sincronizacion.test
 *
 * Responsabilidad: Verificar el correcto funcionamiento del modulo de sincronizacion en nube usando Prisma y SQLite.
 */
import type { Response } from 'express';
import type { SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { conectarMongoTest, cerrarMongoTest, limpiarMongoTest } from './utils/mongo';
import { prisma } from '../src/infraestructura/baseDatos/sqlite';

vi.mock('../src/configuracion', () => ({
  configuracion: {
    codigoAccesoHoras: 12,
    portalAlumnoUrl: '',
    portalApiKey: ''
  }
}));

let generarCodigoAcceso: typeof import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion').generarCodigoAcceso;
let publicarResultados: typeof import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion').publicarResultados;
let exportarPaquete: typeof import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion').exportarPaquete;
let importarPaquete: typeof import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion').importarPaquete;
let enviarPaqueteServidor: typeof import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion').enviarPaqueteServidor;
let traerPaquetesServidor: typeof import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion').traerPaquetesServidor;

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

async function esperar(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function asegurarDocente(docenteId: string, correo: string) {
  await prisma.docente.upsert({
    where: { id: docenteId },
    update: { correo },
    create: {
      id: docenteId,
      correo,
      nombreCompleto: 'Docente Test',
      roles: '["docente"]',
      activo: true
    }
  });
}

describe('sincronizacion nube', () => {
  beforeAll(async () => {
    const controlador = await import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion');
    generarCodigoAcceso = controlador.generarCodigoAcceso;
    publicarResultados = controlador.publicarResultados;
    exportarPaquete = controlador.exportarPaquete;
    importarPaquete = controlador.importarPaquete;
    enviarPaqueteServidor = controlador.enviarPaqueteServidor;
    traerPaquetesServidor = controlador.traerPaquetesServidor;
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('genera codigo de acceso y lo persiste', async () => {
    const docenteId = '507f1f77bcf86cd799439012';
    const periodoId = '507f1f77bcf86cd799439011';
    await asegurarDocente(docenteId, 'docente@test.com');
    await prisma.periodo.create({
      data: {
        id: periodoId,
        docenteId,
        nombre: 'Matematicas I',
        nombreNormalizado: 'matematicas i',
        fechaInicio: new Date(),
        fechaFin: new Date(),
        grupos: '["A"]'
      }
    });

    const req = {
      body: { periodoId },
      docenteId
    } as SolicitudDocente;
    const res = crearRespuesta();

    await generarCodigoAcceso(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { codigo: string };
    expect(payload.codigo).toHaveLength(8);

    const registro = await prisma.codigoAcceso.findUnique({
      where: { codigo: payload.codigo }
    });
    expect(registro).toBeTruthy();
    expect(registro?.docenteId).toBe(req.docenteId);
  });

  it('falla si el portal alumno no esta configurado', async () => {
    const req = {
      body: { periodoId: '507f1f77bcf86cd799439011' },
      docenteId: '507f1f77bcf86cd799439012'
    } as SolicitudDocente;

    await expect(publicarResultados(req, crearRespuesta())).rejects.toMatchObject({
      codigo: 'PORTAL_NO_CONFIG'
    });
  });

  it('falla push/pull si el servidor de sincronizacion no esta configurado', async () => {
    const req = {
      body: {},
      docenteId: '507f1f77bcf86cd799439099'
    } as SolicitudDocente;

    await expect(enviarPaqueteServidor(req, crearRespuesta())).rejects.toMatchObject({
      codigo: 'SYNC_SERVIDOR_NO_CONFIG',
      estadoHttp: 503
    });

    await expect(traerPaquetesServidor(req, crearRespuesta())).rejects.toMatchObject({
      codigo: 'SYNC_SERVIDOR_NO_CONFIG',
      estadoHttp: 503
    });
  });

  it('exporta e importa un paquete (idempotente)', async () => {
    const docenteId = '507f1f77bcf86cd799439012';
    const periodoId = '507f1f77bcf86cd799439011';
    await asegurarDocente(docenteId, 'docente@test.com');

    await prisma.periodo.create({
      data: {
        id: periodoId,
        docenteId,
        nombre: 'Matematicas I',
        nombreNormalizado: 'matematicas i',
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-06-30T00:00:00.000Z'),
        grupos: '["A"]'
      }
    });

    const alumno = await prisma.alumno.create({
      data: {
        id: 'alumno-1',
        periodoId,
        matricula: '2024-001',
        nombreCompleto: 'Ana Lopez',
        correo: 'ana@evaluapro.local',
        grupo: 'A'
      }
    });

    const pregunta = await prisma.bancoPregunta.create({
      data: {
        id: 'preg-1',
        docenteId,
        periodoId,
        tema: 'Algebra',
        versionActual: 1,
        versiones: {
          create: [
            {
              id: 'preg-ver-1',
              numeroVersion: 1,
              enunciado: '2+2=?',
              opciones: {
                create: [
                  { texto: '4', esCorrecta: true },
                  { texto: '3', esCorrecta: false },
                  { texto: '5', esCorrecta: false },
                  { texto: '1', esCorrecta: false },
                  { texto: '0', esCorrecta: false }
                ]
              }
            }
          ]
        }
      }
    });

    await prisma.examenPlantilla.create({
      data: {
        id: 'plantilla-1',
        docenteId,
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial 1',
        tituloNormalizado: 'parcial 1',
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

    const reqExport = {
      body: { periodoId, incluirPdfs: false },
      docenteId
    } as SolicitudDocente;
    const resExport = crearRespuesta();

    await exportarPaquete(reqExport, resExport);
    const payload = (resExport.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      paqueteBase64: string;
      conteos: Record<string, number>;
    };

    expect(payload.paqueteBase64).toBeTruthy();
    expect(payload.conteos.periodos).toBe(1);
    expect(payload.conteos.alumnos).toBe(1);
    expect(payload.conteos.bancoPreguntas).toBe(1);
    expect(payload.conteos.plantillas).toBe(1);

    // Limpiar base de datos para simular ambiente vacío
    await prisma.preguntaPlantilla.deleteMany();
    await prisma.examenPlantilla.deleteMany();
    await prisma.opcionPregunta.deleteMany();
    await prisma.versionPregunta.deleteMany();
    await prisma.bancoPregunta.deleteMany();
    await prisma.alumno.deleteMany();
    await prisma.periodo.deleteMany();

    const reqImport = {
      body: { paqueteBase64: payload.paqueteBase64 },
      docenteId
    } as SolicitudDocente;
    const resImport = crearRespuesta();

    await importarPaquete(reqImport, resImport);

    expect(await prisma.periodo.count({ where: { docenteId } })).toBe(1);
    expect(await prisma.alumno.count({ where: { periodo: { docenteId } } })).toBe(1);
    expect(await prisma.bancoPregunta.count({ where: { docenteId } })).toBe(1);
    expect(await prisma.examenPlantilla.count({ where: { docenteId } })).toBe(1);

    // Idempotencia: reimportar no duplica ni rompe.
    await importarPaquete(reqImport, crearRespuesta());
    expect(await prisma.alumno.count({ where: { periodo: { docenteId } } })).toBe(1);

    const alumnoImportado = await prisma.alumno.findUnique({
      where: { id: alumno.id }
    });
    expect(alumnoImportado?.nombreCompleto).toBe('Ana Lopez');
  });

  it('permite importar por correo cuando cambia el docenteId', async () => {
    const docenteIdOrigen = 'docente-origen-1';
    const docenteIdDestino = 'docente-destino-1';
    const correo = 'docente-mismo@test.com';
    const periodoId = '507f1f77bcf86cd799439111';

    await asegurarDocente(docenteIdOrigen, correo);
    await prisma.periodo.create({
      data: {
        id: periodoId,
        docenteId: docenteIdOrigen,
        nombre: 'Historia',
        nombreNormalizado: 'historia',
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-06-30T00:00:00.000Z'),
        grupos: '["A"]'
      }
    });

    const resExport = crearRespuesta();
    await exportarPaquete({ body: { periodoId, incluirPdfs: false }, docenteId: docenteIdOrigen } as SolicitudDocente, resExport);
    const payload = (resExport.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      paqueteBase64: string;
      checksumSha256: string;
    };

    await limpiarMongoTest();
    await asegurarDocente(docenteIdDestino, correo);

    const resImport = crearRespuesta();
    await importarPaquete(
      { body: { paqueteBase64: payload.paqueteBase64, checksumSha256: payload.checksumSha256 }, docenteId: docenteIdDestino } as SolicitudDocente,
      resImport
    );

    expect(await prisma.periodo.count({ where: { docenteId: docenteIdDestino } })).toBe(1);
    expect(await prisma.periodo.count({ where: { docenteId: docenteIdOrigen } })).toBe(0);
  });

  it('bloquea importacion si el checksum no coincide (anti-corrupcion)', async () => {
    const docenteId = 'docente-check-1';
    const periodoId = 'periodo-check-1';
    await asegurarDocente(docenteId, 'docente-check@test.com');

    await prisma.periodo.create({
      data: {
        id: periodoId,
        docenteId,
        nombre: 'Quimica',
        nombreNormalizado: 'quimica',
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-06-30T00:00:00.000Z'),
        grupos: '["A"]'
      }
    });

    await prisma.alumno.create({
      data: {
        id: 'alumno-check-1',
        periodoId,
        matricula: '2024-003',
        nombreCompleto: 'Maria Gomez',
        correo: 'maria@evaluapro.local',
        grupo: 'C'
      }
    });

    const resExport = crearRespuesta();
    await exportarPaquete({ body: { periodoId, incluirPdfs: false }, docenteId } as SolicitudDocente, resExport);
    const payload = (resExport.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      paqueteBase64: string;
    };

    // Limpia DB para validar que no se re-inserta si el checksum es incorrecto.
    await prisma.alumno.deleteMany();
    await prisma.periodo.deleteMany();
    expect(await prisma.periodo.count({ where: { docenteId } })).toBe(0);

    await expect(
      importarPaquete(
        { body: { paqueteBase64: payload.paqueteBase64, checksumSha256: '0'.repeat(64) }, docenteId } as SolicitudDocente,
        crearRespuesta()
      )
    ).rejects.toMatchObject({ codigo: 'SYNC_CHECKSUM' });

    expect(await prisma.periodo.count({ where: { docenteId } })).toBe(0);
    expect(await prisma.alumno.count({ where: { periodo: { docenteId } } })).toBe(0);
  });

  it('permite dryRun para validar sin aplicar cambios', async () => {
    const docenteId = 'docente-dry-1';
    const periodoId = 'periodo-dry-1';
    await asegurarDocente(docenteId, 'docente-dry@test.com');

    await prisma.periodo.create({
      data: {
        id: periodoId,
        docenteId,
        nombre: 'Programacion',
        nombreNormalizado: 'programacion',
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-06-30T00:00:00.000Z'),
        grupos: '["A"]'
      }
    });
    await prisma.alumno.create({
      data: {
        id: 'alumno-dry-1',
        periodoId,
        matricula: '2024-004',
        nombreCompleto: 'Jose Hernandez',
        correo: 'jose@evaluapro.local',
        grupo: 'A'
      }
    });

    const resExport = crearRespuesta();
    await exportarPaquete({ body: { periodoId, incluirPdfs: false }, docenteId } as SolicitudDocente, resExport);
    const payload = (resExport.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      paqueteBase64: string;
      checksumSha256: string;
      conteos: Record<string, number>;
    };

    await prisma.alumno.deleteMany();
    await prisma.periodo.deleteMany();

    const resDry = crearRespuesta();
    await importarPaquete(
      { body: { paqueteBase64: payload.paqueteBase64, checksumSha256: payload.checksumSha256, dryRun: true }, docenteId } as SolicitudDocente,
      resDry
    );

    const dryPayload = (resDry.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { conteos?: Record<string, number> };
    expect(dryPayload.conteos?.periodos).toBe(payload.conteos.periodos);
    expect(await prisma.periodo.count({ where: { docenteId } })).toBe(0);
    expect(await prisma.alumno.count({ where: { periodo: { docenteId } } })).toBe(0);
  });

  it('rechaza importacion con backupMeta expirado (SYNC_BACKUP_EXPIRADO)', async () => {
    const docenteId = 'docente-expirado-1';
    const periodoId = 'periodo-expirado-1';
    await asegurarDocente(docenteId, 'docente-expirado@test.com');

    await prisma.periodo.create({
      data: {
        id: periodoId,
        docenteId,
        nombre: 'Probabilidad',
        nombreNormalizado: 'probabilidad',
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-06-30T00:00:00.000Z'),
        grupos: '["A"]'
      }
    });

    const resExport = crearRespuesta();
    await exportarPaquete({ body: { periodoId, incluirPdfs: false }, docenteId } as SolicitudDocente, resExport);
    const payload = (resExport.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      paqueteBase64: string;
      checksumSha256: string;
    };

    await expect(
      importarPaquete(
        {
          body: {
            paqueteBase64: payload.paqueteBase64,
            checksumSha256: payload.checksumSha256,
            backupMeta: {
              schemaVersion: 2,
              createdAt: '2026-01-01T00:00:00.000Z',
              ttlMs: 86_400_000,
              expiresAt: '2026-01-02T00:00:00.000Z',
              businessLogicFingerprint: 'sync-v2-lww-updatedAt-schema2'
            }
          },
          docenteId
        } as SolicitudDocente,
        crearRespuesta()
      )
    ).rejects.toMatchObject({
      codigo: 'SYNC_BACKUP_EXPIRADO',
      estadoHttp: 409
    });
  });

  it('rechaza importacion con backupMeta invalidado (SYNC_BACKUP_INVALIDADO)', async () => {
    const docenteId = 'docente-invalido-1';
    const periodoId = 'periodo-invalido-1';
    await asegurarDocente(docenteId, 'docente-invalido@test.com');

    await prisma.periodo.create({
      data: {
        id: periodoId,
        docenteId,
        nombre: 'Topologia',
        nombreNormalizado: 'topologia',
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-06-30T00:00:00.000Z'),
        grupos: '["A"]'
      }
    });

    const resExport = crearRespuesta();
    await exportarPaquete({ body: { periodoId, incluirPdfs: false }, docenteId } as SolicitudDocente, resExport);
    const payload = (resExport.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      paqueteBase64: string;
      checksumSha256: string;
    };

    await expect(
      importarPaquete(
        {
          body: {
            paqueteBase64: payload.paqueteBase64,
            checksumSha256: payload.checksumSha256,
            backupMeta: {
              schemaVersion: 2,
              createdAt: new Date().toISOString(),
              ttlMs: 86_400_000,
              expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
              businessLogicFingerprint: 'sync-v2-breaking-change'
            }
          },
          docenteId
        } as SolicitudDocente,
        crearRespuesta()
      )
    ).rejects.toMatchObject({
      codigo: 'SYNC_BACKUP_INVALIDADO',
      estadoHttp: 409
    });
  });

  it('no sobreescribe registros mas nuevos (LWW por updatedAt)', async () => {
    const docenteId = 'docente-lww-1';
    const periodoId = 'periodo-lww-1';
    await asegurarDocente(docenteId, 'docente-lww@test.com');

    await prisma.periodo.create({
      data: {
        id: periodoId,
        docenteId,
        nombre: 'Fisica',
        nombreNormalizado: 'fisica',
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-06-30T00:00:00.000Z'),
        grupos: '["A"]'
      }
    });

    const alumno = await prisma.alumno.create({
      data: {
        id: 'alumno-lww-1',
        periodoId,
        matricula: '2024-002',
        nombreCompleto: 'Luis Perez',
        correo: 'luis@evaluapro.local',
        grupo: 'B'
      }
    });

    const reqExport = {
      body: { periodoId, incluirPdfs: false },
      docenteId
    } as SolicitudDocente;
    const resExport = crearRespuesta();
    await exportarPaquete(reqExport, resExport);
    const payload = (resExport.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { paqueteBase64: string };

    // Hacemos el registro local mas nuevo que el del paquete.
    await prisma.alumno.update({
      where: { id: alumno.id },
      data: { nombreCompleto: 'Luis Perez (editado)' }
    });
    const alumnoAntes = await prisma.alumno.findUnique({ where: { id: alumno.id } });
    expect(alumnoAntes?.nombreCompleto).toBe('Luis Perez (editado)');

    const reqImport = {
      body: { paqueteBase64: payload.paqueteBase64 },
      docenteId
    } as SolicitudDocente;

    await importarPaquete(reqImport, crearRespuesta());
    const alumnoDespues = await prisma.alumno.findUnique({ where: { id: alumno.id } });
    expect(alumnoDespues?.nombreCompleto).toBe('Luis Perez (editado)');
  });

  it('sincroniza entre computadoras aplicando version mas reciente aunque lleguen paquetes fuera de orden', async () => {
    const docenteId = 'docente-equipos-1';
    const periodoId = 'periodo-equipos-1';
    await asegurarDocente(docenteId, 'docente-equipos@test.com');

    await prisma.periodo.create({
      data: {
        id: periodoId,
        docenteId,
        nombre: 'Sistemas Distribuidos',
        nombreNormalizado: 'sistemas distribuidos',
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-06-30T00:00:00.000Z'),
        grupos: '["A"]'
      }
    });

    const alumno = await prisma.alumno.create({
      data: {
        id: 'alumno-equipos-1',
        periodoId,
        matricula: '2024-010',
        nombreCompleto: 'Carla Nava',
        correo: 'carla@evaluapro.local',
        grupo: 'A'
      }
    });

    const resV1 = crearRespuesta();
    await exportarPaquete({ body: { periodoId, incluirPdfs: false }, docenteId } as SolicitudDocente, resV1);
    const paqueteV1 = (resV1.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      paqueteBase64: string;
      checksumSha256: string;
    };

    // Fuerza monotonicidad de timestamps para probar LWW aun si los paquetes
    // se generan muy rapido en el mismo ms.
    await esperar(15);
    await prisma.alumno.update({
      where: { id: alumno.id },
      data: { nombreCompleto: 'Carla Nava V2', grupo: 'B' }
    });
    await esperar(15);

    const resV2 = crearRespuesta();
    await exportarPaquete({ body: { periodoId, incluirPdfs: false }, docenteId } as SolicitudDocente, resV2);
    const paqueteV2 = (resV2.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      paqueteBase64: string;
      checksumSha256: string;
    };

    await limpiarMongoTest();
    await asegurarDocente(docenteId, 'docente-equipos@test.com');

    await importarPaquete(
      { body: { paqueteBase64: paqueteV1.paqueteBase64, checksumSha256: paqueteV1.checksumSha256 }, docenteId } as SolicitudDocente,
      crearRespuesta()
    );
    let alumnoEnEquipo2 = await prisma.alumno.findUnique({ where: { id: alumno.id } });
    expect(alumnoEnEquipo2?.nombreCompleto).toBe('Carla Nava');
    expect(alumnoEnEquipo2?.grupo).toBe('A');

    await importarPaquete(
      { body: { paqueteBase64: paqueteV2.paqueteBase64, checksumSha256: paqueteV2.checksumSha256 }, docenteId } as SolicitudDocente,
      crearRespuesta()
    );
    alumnoEnEquipo2 = await prisma.alumno.findUnique({ where: { id: alumno.id } });
    expect(alumnoEnEquipo2?.nombreCompleto).toBe('Carla Nava V2');
    expect(alumnoEnEquipo2?.grupo).toBe('B');

    // Reimportar un paquete antiguo ya no debe degradar el estado.
    await importarPaquete(
      { body: { paqueteBase64: paqueteV1.paqueteBase64, checksumSha256: paqueteV1.checksumSha256 }, docenteId } as SolicitudDocente,
      crearRespuesta()
    );
    alumnoEnEquipo2 = await prisma.alumno.findUnique({ where: { id: alumno.id } });
    expect(alumnoEnEquipo2?.nombreCompleto).toBe('Carla Nava V2');
    expect(alumnoEnEquipo2?.grupo).toBe('B');
  });
});
