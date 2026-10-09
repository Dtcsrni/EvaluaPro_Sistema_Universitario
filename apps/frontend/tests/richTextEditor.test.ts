/**
 * richTextEditor.test
 *
 * Responsabilidad: proteger la representación visible de fórmulas del editor.
 */
import { describe, expect, it, vi } from 'vitest';
import { sanearHtml, textoVisibleLatex } from '../src/apps/app_docente/features/banco/components/RichTextEditor';

describe('RichTextEditor', () => {
  it('convierte notacion LaTeX habitual a una previsualizacion segura y legible', () => {
    const formula = String.raw`\frac{x^2+1}{y_1} + \sqrt{z} \leq \alpha`;
    const visible = textoVisibleLatex(formula);

    expect(visible).toContain('(x<sup>2</sup>+1)/(y<sub>1</sub>)');
    expect(visible).toContain('sqrt(z)');
    expect(visible).toContain('≤');
    expect(visible).toContain('α');
    expect(visible).toContain('<sup>2</sup>');
    expect(visible).toContain('<sub>1</sub>');
    expect(visible).not.toContain('\\frac');
  });

  it('escapa HTML introducido dentro de una formula', () => {
    const visible = textoVisibleLatex(String.raw`x<y & z`);

    expect(visible).toContain('&lt;');
    expect(visible).toContain('&amp;');
    expect(visible).not.toContain('<y');
  });

  it('elimina contenido peligroso anidado dentro de etiquetas no permitidas', () => {
    const limpio = sanearHtml('<x-wrapper><img src="x" onerror="alert(1)"></x-wrapper>');

    expect(limpio).not.toContain('<img');
    expect(limpio).not.toContain('onerror');
  });

  it('vuelve a limpiar los elementos permitidos que estaban bajo una etiqueta no permitida', () => {
    const limpio = sanearHtml('<x-wrapper><span data-latex="x" onclick="alert(1)"><b>seguro</b></span></x-wrapper>');

    expect(limpio).toContain('<span data-latex="x"><b>seguro</b></span>');
    expect(limpio).not.toContain('onclick');
  });

  it('escapa el contenido por completo cuando DOMParser no está disponible', () => {
    const parser = globalThis.DOMParser;
    vi.stubGlobal('DOMParser', undefined);
    try {
      expect(sanearHtml('<script>alert(1)</script> & texto'))
        .toBe('&lt;script&gt;alert(1)&lt;/script&gt; &amp; texto');
    } finally {
      vi.stubGlobal('DOMParser', parser);
    }
  });
});
