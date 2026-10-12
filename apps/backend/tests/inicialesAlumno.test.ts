import { describe, expect, it } from 'vitest';
import { construirEncabezadoPdf, construirInicialesAlumno } from '../src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.js';

describe('construirInicialesAlumno', () => {
  it('construye iniciales de nombres y apellidos ignorando particulas', () => {
    expect(construirInicialesAlumno('Erick Renato Vega Ceron')).toBe('ERVC');
    expect(construirInicialesAlumno('Ana María de la Cruz')).toBe('AMC');
  });

  it('normaliza acentos y limita identificadores demasiado largos', () => {
    expect(construirInicialesAlumno('Ángel José Luis María González Pérez')).toBe('AJLMGP');
    expect(construirInicialesAlumno('')).toBe('');
  });

  it('ordena las iniciales del nombre antes de los apellidos si el padrón trae apellidos primero', () => {
    const encabezado = construirEncabezadoPdf({
      periodo: { nombre: 'Legalidad y Marketing' },
      docenteDb: { nombreCompleto: 'Docente' },
      instrucciones: '',
      alumno: { nombreCompleto: 'S V Mario A' }
    });

    expect(encabezado.alumno).toMatchObject({ primerNombre: 'Mario', iniciales: 'MASV' });
    expect(`${encabezado.alumno?.primerNombre}_${encabezado.alumno?.iniciales.slice(1)}`).toBe('Mario_ASV');
  });
});
