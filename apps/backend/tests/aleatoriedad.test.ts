// Pruebas de utilidades de aleatoriedad.
import { describe, expect, it } from 'vitest';
import { barajar } from '../src/compartido/utilidades/aleatoriedad';

describe('barajar', () => {
  it('mantiene los mismos elementos sin mutar el arreglo original', () => {
    const original = [1, 2, 3, 4, 5];
    const resultado = barajar(original);

    expect(resultado).not.toBe(original);
    expect([...resultado].sort()).toEqual([...original].sort());
    expect(original).toEqual([1, 2, 3, 4, 5]);
  });
});
