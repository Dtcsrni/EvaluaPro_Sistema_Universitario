/**
 * Contrato minimo de respuestas para sincronizacion (behavior lock) usando SQLite.
 */
import type { Response } from 'express';
import type { SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { conectarMongoTest, cerrarMongoTest, limpiarMongoTest } from './utils/mongo';
import { prisma } from '../src/infraestructura/baseDatos/sqlite';
import {
  exportarPaquete,
  importarPaquete,
  listarSincronizaciones
} from '../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion';

vi.mock('../src/configuracion', () => ({
  configuracion: {
    codigoAccesoHoras: 12,
    portalAlumnoUrl: '',
    portalApiKey: '',
    jwtSecreto: 'sync-contract-secret',
    respaldoCifradoSecreto: 'sync-contract-backup-secret'
  }
}));

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

describe('sincronizacion contratos minimos', () => {
  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('mantiene shape en exportar/importar/listar', async () => {
    const docenteId = 'docente-contrato-1';
    const periodoId = 'periodo-contrato-1';

    await prisma.docente.create({
      data: {
        id: docenteId,
        correo: 'contrato-sync@test.com',
        nombreCompleto: 'Docente Contrato',
        roles: '["docente"]',
        activo: true
      }
    });

    await prisma.periodo.create({
      data: {
        id: periodoId,
        docenteId,
        nombre: 'Contrato Sync',
        nombreNormalizado: 'contrato sync',
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-06-30T00:00:00.000Z'),
        grupos: '["A"]'
      }
    });

    const resExport = crearRespuesta();
    await exportarPaquete({ body: { periodoId, incluirPdfs: false }, docenteId } as SolicitudDocente, resExport);
    const exportPayload = (resExport.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;

    expect(exportPayload).toMatchObject({
      paqueteBase64: expect.any(String),
      checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/i),
      checksumGzipSha256: expect.stringMatching(/^[a-f0-9]{64}$/i),
      exportadoEn: expect.any(String),
      conteos: expect.any(Object)
    });

    const resImport = crearRespuesta();
    await importarPaquete(
      {
        body: { paqueteBase64: String(exportPayload.paqueteBase64), checksumSha256: String(exportPayload.checksumSha256), dryRun: true },
        docenteId
      } as SolicitudDocente,
      resImport
    );
    const importPayload = (resImport.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(importPayload).toMatchObject({
      mensaje: 'Paquete valido',
      checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/i),
      conteos: expect.any(Object)
    });

    const resListar = crearRespuesta();
    await listarSincronizaciones({ query: {}, docenteId } as unknown as SolicitudDocente, resListar);
    const listarPayload = (resListar.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(listarPayload).toMatchObject({
      sincronizaciones: expect.any(Array)
    });
  });

  it('mantiene contrato de error al rechazar backupMeta expirado/incompatible', async () => {
    const docenteId = 'docente-contrato-2';

    await prisma.docente.create({
      data: {
        id: docenteId,
        correo: 'contrato-sync-errores@test.com',
        nombreCompleto: 'Docente Contrato Errores',
        roles: '["docente"]',
        activo: true
      }
    });

    const paqueteDummy = 'A'.repeat(40);

    await expect(
      importarPaquete(
        {
          body: {
            paqueteBase64: paqueteDummy,
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

    await expect(
      importarPaquete(
        {
          body: {
            paqueteBase64: paqueteDummy,
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
});
