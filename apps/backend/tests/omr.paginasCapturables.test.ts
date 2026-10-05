import { describe, expect, it } from 'vitest';
import { resolverPaginaCapturableOmr } from '../src/modulos/modulo_escaneo_omr/paginasCapturablesOmr.js';

describe('resolverPaginaCapturableOmr', () => {
  const paginas = [
    { numeroPagina: 1, tipoPagina: 'examen' as const },
    { numeroPagina: 2, tipoPagina: 'reverso-vacio' as const },
    { numeroPagina: 3, tipoPagina: 'examen' as const }
  ];

  it('asocia capturas de imagen consecutivas solo a caras con respuestas', () => {
    expect(resolverPaginaCapturableOmr(paginas, 1, 'image_batch')?.numeroPagina).toBe(1);
    expect(resolverPaginaCapturableOmr(paginas, 2, 'camera_capture')?.numeroPagina).toBe(3);
    expect(resolverPaginaCapturableOmr(paginas, 3, 'image_batch')).toBeUndefined();
  });

  it('conserva el índice físico de cada página al analizar un PDF dúplex', () => {
    expect(resolverPaginaCapturableOmr(paginas, 2, 'pdf')).toMatchObject({
      numeroPagina: 2,
      tipoPagina: 'reverso-vacio'
    });
    expect(resolverPaginaCapturableOmr(paginas, 3, 'pdf')?.numeroPagina).toBe(3);
  });
});
