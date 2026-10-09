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

  it('normaliza entidades HTML y escapes numéricos inválidos en el atributo LaTeX', () => {
    expect(sanitizarContenidoRico('<span data-latex = \'&LT;&#62;&quot;&apos;&#39;&nbsp;&#65;&#x1F600;&#0;&#xD800;&#x110000;\'>x</span>'))
      .toBe('<span data-latex="&lt;&gt;&quot;\'\' A😀���">x</span>');
  });

  it('omite comentarios incompletos y texto raw hasta un cierre válido', () => {
    expect(sanitizarContenidoRico('antes<!-- sin cierre')).toBe('antes');
    expect(sanitizarContenidoRico('<script>uno</scripture>dos</script>después'))
      .toBe('después');
    expect(sanitizarContenidoRico('<style>todo el resto')).toBe('');
  });

  it('rechaza marcadores duplicados, sin valor y con cierres no confiables', () => {
    expect(sanitizarContenidoRico('<span data-latex="a" DATA-LATEX="b">x</span>')).toBe('x');
    expect(sanitizarContenidoRico('<span data-latex>y</span>')).toBe('y');
    expect(sanitizarContenidoRico('</span><span class="solo formato">z</span>')).toBe('z');
  });

  it('maneja etiquetas sin nombre válido y delimitadores incompletos como texto', () => {
    expect(sanitizarContenidoRico('<>texto<1bad>más <?xml?> <texto')).toBe('texto más  &lt;texto');
  });
});
