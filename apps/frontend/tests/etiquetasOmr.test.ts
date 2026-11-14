import { describe, expect, it } from 'vitest';
import { etiquetaEstadoPaginaOmr, etiquetaFlagOmr } from '../src/apps/app_docente/features/plantillas/etiquetasOmr';

describe('etiquetaFlagOmr', () => {
  it.each([
    ['bajo_contraste', 'Bajo contraste'],
    ['doble_marca', 'Varias marcas'],
    ['LOW_CONFIDENCE', 'Confianza baja'],
    ['captura_nueva', 'Captura nueva']
  ])('traduce %s para la interfaz docente', (flag, etiqueta) => {
    expect(etiquetaFlagOmr(flag)).toBe(etiqueta);
  });
});

describe('etiquetaEstadoPaginaOmr', () => {
  it.each([
    ['accepted', 'Aceptada'],
    ['needs_review', 'Requiere revisión'],
    ['rejected', 'Rechazada'],
    ['ignored', 'Omitida'],
    ['future_state', 'future_state']
  ])('traduce %s sin ocultar estados desconocidos', (estado, etiqueta) => {
    expect(etiquetaEstadoPaginaOmr(estado)).toBe(etiqueta);
  });
});
