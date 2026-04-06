import { describe, expect, it } from 'vitest';
import { ErrorAplicacion } from '../src/compartido/errores/errorAplicacion';
import { validarBackupMetaImportacion } from '../src/modulos/modulo_sincronizacion_nube/domain/paqueteSincronizacion';

describe('validarBackupMetaImportacion', () => {
  it('permite payload sin backupMeta por compatibilidad', () => {
    expect(() => validarBackupMetaImportacion(undefined)).not.toThrow();
  });

  it('rechaza backup expirado con contrato SYNC_BACKUP_EXPIRADO', () => {
    const meta = {
      schemaVersion: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      ttlMs: 86_400_000,
      expiresAt: '2026-01-02T00:00:00.000Z',
      businessLogicFingerprint: 'sync-v2-lww-updatedAt-schema2'
    };

    expect(() => validarBackupMetaImportacion(meta, new Date('2026-01-03T00:00:00.000Z').getTime())).toThrowError(ErrorAplicacion);
    try {
      validarBackupMetaImportacion(meta, new Date('2026-01-03T00:00:00.000Z').getTime());
    } catch (error) {
      const e = error as ErrorAplicacion;
      expect(e.codigo).toBe('SYNC_BACKUP_EXPIRADO');
      expect(e.estadoHttp).toBe(409);
    }
  });

  it('rechaza fingerprint incompatible con contrato SYNC_BACKUP_INVALIDADO', () => {
    const meta = {
      schemaVersion: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      ttlMs: 86_400_000,
      expiresAt: '2027-01-02T00:00:00.000Z',
      businessLogicFingerprint: 'sync-v2-breaking-change'
    };

    expect(() => validarBackupMetaImportacion(meta, new Date('2026-01-03T00:00:00.000Z').getTime())).toThrowError(ErrorAplicacion);
    try {
      validarBackupMetaImportacion(meta, new Date('2026-01-03T00:00:00.000Z').getTime());
    } catch (error) {
      const e = error as ErrorAplicacion;
      expect(e.codigo).toBe('SYNC_BACKUP_INVALIDADO');
      expect(e.estadoHttp).toBe(409);
    }
  });
});

