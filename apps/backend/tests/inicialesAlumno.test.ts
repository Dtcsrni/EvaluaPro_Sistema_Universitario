import { describe, expect, it } from 'vitest';
import { construirInicialesAlumno } from '../src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.js';

describe('construirInicialesAlumno', () => {
  it('construye iniciales de nombres y apellidos ignorando particulas', () => {
    expect(construirInicialesAlumno('Erick Renato Vega Ceron')).toBe('ERVC');
    expect(construirInicialesAlumno('Ana María de la Cruz')).toBe('AMC');
  });

  it('normaliza acentos y limita identificadores demasiado largos', () => {
    expect(construirInicialesAlumno('Ángel José Luis María González Pérez')).toBe('AJLMGP');
    expect(construirInicialesAlumno('')).toBe('');
  });
});
