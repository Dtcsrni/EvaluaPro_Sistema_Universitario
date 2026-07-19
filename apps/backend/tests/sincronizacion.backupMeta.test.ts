/**
 * sincronizacion.backupMeta.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import { ErrorAplicacion } from '../src/compartido/errores/errorAplicacion';
import { validarBackupMetaImportacion } from '../src/modulos/modulo_sincronizacion_nube/domain/paqueteSincronizacion';
import { cifrarRespaldo, descifrarRespaldo } from '../src/modulos/modulo_sincronizacion_nube/sincronizacionInterna';

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

describe('cifrado autenticado de respaldos', () => {
  it('cifra el payload y lo recupera únicamente para el propietario', () => {
    const original = Buffer.from('gzip-academico-de-prueba', 'utf8');
    const cifrado = cifrarRespaldo(original, 'Docente@Example.com');

    expect(cifrado.equals(original)).toBe(false);
    expect(cifrado.toString('utf8')).not.toContain('gzip-academico-de-prueba');
    expect(descifrarRespaldo(cifrado, 'docente@example.com')).toEqual({ gzipBytes: original, cifrado: true });
    expect(() => descifrarRespaldo(cifrado, 'otro@example.com')).toThrowError(ErrorAplicacion);
  });

  it('rechaza alteración autenticada y conserva lectura de gzip legado', () => {
    const original = Buffer.from('gzip-legado', 'utf8');
    const cifrado = cifrarRespaldo(original, 'docente@example.com');
    const sobre = JSON.parse(cifrado.toString('utf8')) as { ciphertext: string };
    const ciphertext = Buffer.from(sobre.ciphertext, 'base64');
    ciphertext[0] ^= 1;
    sobre.ciphertext = ciphertext.toString('base64');
    const alterado = Buffer.from(JSON.stringify(sobre), 'utf8');

    expect(() => descifrarRespaldo(alterado, 'docente@example.com')).toThrowError(ErrorAplicacion);
    expect(descifrarRespaldo(original, 'docente@example.com')).toEqual({ gzipBytes: original, cifrado: false });
  });
});

