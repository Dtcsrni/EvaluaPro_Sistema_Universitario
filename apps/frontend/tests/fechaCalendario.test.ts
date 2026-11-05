import { describe, expect, it } from 'vitest';
import {
  fechaCalendarioEnMilisegundos,
  formatearFechaCalendario,
  normalizarFechaCalendarioISO
} from '../src/apps/app_docente/fechaCalendario';

describe('fechas calendario', () => {
  it('conserva el día de una fecha guardada a medianoche UTC', () => {
    const valor = '2026-08-01T00:00:00.000Z';

    expect(normalizarFechaCalendarioISO(valor)).toBe('2026-08-01');
    expect(fechaCalendarioEnMilisegundos(valor)).toBe(Date.UTC(2026, 7, 1));
    expect(formatearFechaCalendario(valor, 'es-MX')).toBe('1 ago 2026');
    expect(formatearFechaCalendario(valor)).toBe('1 ago 2026');
  });

  it('rechaza días imposibles y entradas vacías', () => {
    expect(normalizarFechaCalendarioISO('2026-02-29')).toBeNull();
    expect(fechaCalendarioEnMilisegundos('')).toBeNull();
    expect(formatearFechaCalendario('no-es-una-fecha')).toBeNull();
  });

  it('acepta el 29 de febrero en año bisiesto', () => {
    expect(normalizarFechaCalendarioISO('2028-02-29T00:00:00Z')).toBe('2028-02-29');
    expect(fechaCalendarioEnMilisegundos('2028-02-29')).toBe(Date.UTC(2028, 1, 29));
  });
});
