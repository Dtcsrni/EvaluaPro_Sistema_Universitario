import { describe, expect, it } from 'vitest';
import { esquemaCalificarExamen } from '../src/modulos/modulo_calificacion/validacionesCalificacion.js';
import { consensuarLecturasBonoGuia } from '../src/modulos/modulo_calificacion/detectorBonoGuiaEstudio.js';

describe('bono de examen', () => {
  it('acepta solo 0 o +0.25', () => {
    const examenGeneradoId = '507f1f77bcf86cd799439011';
    expect(esquemaCalificarExamen.safeParse({ examenGeneradoId, bonoSolicitado: 0 }).success).toBe(true);
    expect(esquemaCalificarExamen.safeParse({ examenGeneradoId, bonoSolicitado: 0.25 }).success).toBe(true);
    expect(esquemaCalificarExamen.safeParse({ examenGeneradoId, bonoSolicitado: 0.5 }).success).toBe(false);
    expect(esquemaCalificarExamen.safeParse({ examenGeneradoId, bonoSolicitado: 0.1 }).success).toBe(false);
  });

  it('acepta exclusión docente y confirmación manual del bono', () => {
    const examenGeneradoId = '507f1f77bcf86cd799439011';
    expect(esquemaCalificarExamen.safeParse({ examenGeneradoId, omitirBonoAcordeon: true }).success).toBe(true);
    expect(esquemaCalificarExamen.safeParse({ examenGeneradoId, confirmarBonoAcordeonManual: true }).success).toBe(true);
  });

  it('solo confirma OCR por dos lecturas coincidentes con umbral; deja desacuerdos para revisión', () => {
    const lecturas = [
      { texto: '+0.25', confianza: 91, coincide: true },
      { texto: '+0.25', confianza: 88, coincide: true }
    ] as const;
    expect(consensuarLecturasBonoGuia([...lecturas])).toBe('detectado');
    expect(consensuarLecturasBonoGuia([
      { ...lecturas[0] }, { texto: '', confianza: 0, coincide: false }
    ])).toBe('requiere_revision');
    expect(consensuarLecturasBonoGuia([
      { ...lecturas[0], confianza: 79 }, { ...lecturas[1], confianza: 80 }
    ])).toBe('requiere_revision');
    expect(consensuarLecturasBonoGuia([
      { texto: '', confianza: 0, coincide: false }, { texto: '0.25', confianza: 99, coincide: false }
    ])).toBe('no_detectado');
  });
});
