import { describe, expect, it } from 'vitest';
import {
  diagnosticoGatePilotoRealOmr,
  MENSAJE_PLANTILLA_OMR_NO_COMPATIBLE
} from '../src/modulos/modulo_escaneo_omr/diagnosticosOmr.js';

describe('diagnósticos visibles de versión OMR', () => {
  it('explica el gate pendiente sin presentar un alias histórico como versión activa', () => {
    expect(diagnosticoGatePilotoRealOmr(false)).toBe(
      'La autocalificación requiere la validación independiente del piloto real del motor OMR.'
    );
    expect(diagnosticoGatePilotoRealOmr(true)).toBeNull();
    expect(diagnosticoGatePilotoRealOmr(false)).not.toMatch(/TV4|OMR v4/i);
  });

  it('describe incompatibilidad con el layout activo sin exponer la versión histórica', () => {
    expect(MENSAJE_PLANTILLA_OMR_NO_COMPATIBLE).toBe(
      'El lote contiene una plantilla que no es compatible con el layout OMR activo.'
    );
    expect(MENSAJE_PLANTILLA_OMR_NO_COMPATIBLE).not.toMatch(/TV4|OMR v4/i);
  });
});

