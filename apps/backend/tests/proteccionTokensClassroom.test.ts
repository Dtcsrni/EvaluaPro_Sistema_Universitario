import { describe, expect, it } from 'vitest';
import { descifrarTokenClassroom, esTokenClassroomDpapi, protegerTokenClassroom } from '../src/modulos/modulo_integraciones_classroom/proteccionTokensClassroom.js';

describe('protección de tokens Classroom', () => {
  it.runIf(process.platform === 'win32')('protege y recupera bajo DPAPI CurrentUser', () => {
    const tokenOriginal = 'refresh-token-for-test-only';
    const protegido = protegerTokenClassroom(tokenOriginal);

    expect(protegido).not.toContain(tokenOriginal);
    expect(esTokenClassroomDpapi(protegido)).toBe(true);
    expect(descifrarTokenClassroom(protegido)).toEqual({ token: tokenOriginal, migrado: false });
  });

  it('rechaza migrar token legado si falta la llave y permite identificar formato DPAPI', () => {
    expect(esTokenClassroomDpapi('ciphertext-legacy')).toBe(false);
    expect(() => descifrarTokenClassroom('ciphertext-legacy')).toThrowError(/llave anterior/);
  });
});
