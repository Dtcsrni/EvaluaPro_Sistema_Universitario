import { describe, expect, it } from 'vitest';
import {
  consensuarLecturasBonoGuia,
  UMBRAL_CONFIANZA_BONO_GUIA
} from '../src/modulos/modulo_calificacion/detectorBonoGuiaEstudio.js';

describe('consenso OCR del bono de guía de estudio', () => {
  it('detecta solo cuando ambas lecturas reconocen +0.25 con confianza suficiente', () => {
    expect(consensuarLecturasBonoGuia([
      { texto: '+0.25', confianza: UMBRAL_CONFIANZA_BONO_GUIA, coincide: true },
      { texto: '+0,25', confianza: 94, coincide: true }
    ])).toBe('detectado');
  });

  it('requiere revisión si solo una variante reconoce el bono', () => {
    expect(consensuarLecturasBonoGuia([
      { texto: '+0.25', confianza: 96, coincide: true },
      { texto: '+0.2S', confianza: 88, coincide: false }
    ])).toBe('requiere_revision');
  });

  it('requiere revisión si ambas reconocen el texto pero una lectura no es confiable', () => {
    expect(consensuarLecturasBonoGuia([
      { texto: '+0.25', confianza: 79.9, coincide: true },
      { texto: '+0.25', confianza: 90, coincide: true }
    ])).toBe('requiere_revision');
  });

  it('no detecta si ninguna variante identifica la marca', () => {
    expect(consensuarLecturasBonoGuia([
      { texto: '', confianza: 0, coincide: false },
      { texto: '+0.2S', confianza: 77, coincide: false }
    ])).toBe('no_detectado');
  });
});
