import { describe, expect, it } from 'vitest';
import { hashContenidoPregunta } from '../src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.js';

describe('huella del blueprint legado', () => {
  it('normaliza igual los enunciados al fijar y validar, y detecta cambios reales', () => {
    const raw = {
      id: 'pregunta-legada',
      versionActual: 1,
      versiones: [{
        numeroVersion: 1,
        enunciado: 'HTTP\n¿Qué protocolo permite transferir hipertexto?',
        opciones: [{ texto: 'HTTP', esCorrecta: true }, { texto: 'FTP', esCorrecta: false }]
      }]
    };
    const normalizada = {
      ...raw,
      versiones: [{ ...raw.versiones[0]!, enunciado: '¿Qué protocolo permite transferir hipertexto?' }]
    };
    const modificada = {
      ...normalizada,
      versiones: [{ ...normalizada.versiones[0]!, enunciado: '¿Qué protocolo permite transferir archivos?' }]
    };

    expect(hashContenidoPregunta(raw, 1)).toBe(hashContenidoPregunta(normalizada, 1));
    expect(hashContenidoPregunta(modificada, 1)).not.toBe(hashContenidoPregunta(normalizada, 1));
  });
});
