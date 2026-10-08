import { describe, expect, it } from 'vitest';
import { sanitizarContenidoRico } from '../src/modulos/modulo_banco_preguntas/sanitizarContenidoRico.js';

describe('sanitizarContenidoRico', () => {
  it('conserva el formato docente y normaliza el marcador LaTeX', () => {
    expect(sanitizarContenidoRico('<B>Pregunta</B><br><span data-latex="x &amp; y" class="x">x &amp; y</span>'))
      .toBe('<b>Pregunta</b><br><span data-latex="x &amp; y">x &amp; y</span>');
  });

  it('elimina etiquetas activas, sus cuerpos y atributos adicionales', () => {
    const limpio = sanitizarContenidoRico('<strong onclick="alert(1)">válido</strong><script>alert(1)</script><style>body{}</style><span data-latex="x" onerror="alert(2)">x</span>');
    expect(limpio).toBe('<strong>válido</strong><span data-latex="x">x</span>');
    expect(limpio).not.toMatch(/on(?:click|error)|<script|<style/i);
  });

  it('no transforma etiquetas anidadas o incompletas en HTML ejecutable', () => {
    const limpio = sanitizarContenidoRico('<<script>alert(1)</script><scr<script>ipt><script sin-cierre');
    expect(limpio).not.toMatch(/<\s*script\b/i);
    expect(limpio).toContain('&lt;script sin-cierre');
  });

  it('rechaza un marcador LaTeX sin valor citado o duplicado', () => {
    expect(sanitizarContenidoRico('<span data-latex=x>x</span>')).toBe('x');
    expect(sanitizarContenidoRico('<span data-latex="a" data-latex="b">x</span>')).toBe('x');
  });
});
