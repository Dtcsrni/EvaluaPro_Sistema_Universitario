// Pruebas de servicio de sesion.
import { describe, expect, it } from 'vitest';
import { generarTokenSesion, hashToken } from '../src/servicios/servicioSesion';

describe('servicioSesion', () => {
  it('genera token y hash consistentes', () => {
    const { token, hash } = generarTokenSesion();

    expect(token).toHaveLength(48);
    expect(hash).toHaveLength(64);
    expect(hashToken(token)).toBe(hash);
  });
});
