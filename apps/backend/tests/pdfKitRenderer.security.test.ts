import { describe, expect, it } from 'vitest';
import { decodificarEntidadesPdf } from '../src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.js';

describe('decodificarEntidadesPdf', () => {
  it('decodifica cada entidad una sola vez', () => {
    expect(decodificarEntidadesPdf('&amp;lt;script&amp;gt; &lt;img&gt; &amp;'))
      .toBe('&lt;script&gt; <img> &');
  });
});
