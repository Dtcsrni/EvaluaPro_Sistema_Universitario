// Pruebas de configuracion.
import { describe, expect, it } from 'vitest';
import { configuracion } from '../src/configuracion';

describe('configuracion', () => {
  it('expone valores basicos esperados', () => {
    expect(configuracion.puerto).toEqual(expect.any(Number));
    expect(configuracion.limiteJson).toEqual(expect.any(String));
    expect(configuracion.corsOrigenes).toEqual(expect.any(Array));
    expect(configuracion.jwtSecreto).toEqual(expect.any(String));
  });
});
