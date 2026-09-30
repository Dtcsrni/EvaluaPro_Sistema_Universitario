import { describe, expect, it } from 'vitest';
import { esquemaCalificarExamen } from '../src/modulos/modulo_calificacion/validacionesCalificacion.js';

const analisis = {
  estadoAnalisis: 'requiere_revision' as const,
  calidadPagina: 0.8,
  confianzaPromedioPagina: 0.4,
  ratioAmbiguas: 0.2,
  templateVersionDetectada: 4 as const,
  motivosRevision: ['Revisión por marca ambigua'],
  revisionConfirmada: false,
  engineVersion: 'omr-cv',
  geomQuality: 0.8,
  photoQuality: 0.8,
  decisionPolicy: 'conservadora_v2',
  qrTexto: 'EXAMEN:ABC123:P1'
};

const base = {
  examenGeneradoId: '507f1f77bcf86cd799439011',
  omrAnalisis: analisis
};

describe('contrato de estado por reactivo OMR', () => {
  it('acepta una respuesta sin marca sin inventar una opción', () => {
    const resultado = esquemaCalificarExamen.safeParse({
      ...base,
      respuestasDetectadas: [{ numeroPregunta: 1, opcion: null, confianza: 0, estadoRespuesta: 'sin_marca' }]
    });
    expect(resultado.success).toBe(true);
  });

  it('rechaza un estado no calificable que conserva una opción', () => {
    const resultado = esquemaCalificarExamen.safeParse({
      ...base,
      respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'C', confianza: 0.8, estadoRespuesta: 'ambigua' }]
    });
    expect(resultado.success).toBe(false);
  });
});
