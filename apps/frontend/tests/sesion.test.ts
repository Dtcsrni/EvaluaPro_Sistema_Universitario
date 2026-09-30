import { afterEach, describe, expect, it, vi } from 'vitest';
import { obtenerSessionId } from '../src/ui/ux/sesion';

describe('obtenerSessionId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('genera y conserva un UUID criptográfico cuando randomUUID está disponible', () => {
    const randomUUID = vi.fn(() => '00000000-0000-4000-8000-000000000001');
    vi.stubGlobal('crypto', { randomUUID });

    expect(obtenerSessionId('sesion-test')).toBe('00000000-0000-4000-8000-000000000001');
    expect(obtenerSessionId('sesion-test')).toBe('00000000-0000-4000-8000-000000000001');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('usa getRandomValues si randomUUID no existe', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0);
        return bytes;
      }
    });

    expect(obtenerSessionId('sesion-test')).toBe('00000000-0000-4000-8000-000000000000');
  });
});
