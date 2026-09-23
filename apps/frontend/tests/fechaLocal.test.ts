import { describe, expect, it } from 'vitest';
import { fechaLocalISO } from '../src/apps/app_docente/fechaLocal';

describe('fechaLocalISO', () => {
  it('conserva el día del calendario local al final de la jornada', () => {
    const fecha = new Date(2026, 8, 22, 23, 59, 0);
    expect(fechaLocalISO(fecha)).toBe('2026-09-22');
  });
});