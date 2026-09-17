/**
 * richTextEditor.test
 *
 * Responsabilidad: proteger la representación visible de fórmulas del editor.
 */
import { describe, expect, it } from 'vitest';
import { textoVisibleLatex } from '../src/apps/app_docente/features/banco/components/RichTextEditor';

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
});
