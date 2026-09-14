/**
 * normalizarEnunciadoBanco.test
 *
 * Responsabilidad: evitar que etiquetas editoriales pegadas desde el banco
 * aparezcan como parte del enunciado del examen.
 */
import { describe, expect, it } from 'vitest';
import { normalizarEnunciadoBanco } from '../src/modulos/modulo_banco_preguntas/normalizarEnunciadoBanco.js';

describe('normalizarEnunciadoBanco', () => {
  it('quita número y etiqueta de tema en texto pegado', () => {
    expect(normalizarEnunciadoBanco('17. HTTP\n\nUna petición GET obtiene información.'))
      .toBe('Una petición GET obtiene información.');
    expect(normalizarEnunciadoBanco('21. JSON\nUn cliente envía datos válidos.'))
      .toBe('Un cliente envía datos válidos.');
  });

  it('quita la etiqueta inicial compuesta solicitada', () => {
    expect(normalizarEnunciadoBanco('CORS, JSON, etc.\n¿Qué encabezado corresponde?'))
      .toBe('¿Qué encabezado corresponde?');
  });

  it('quita solo el número editorial y conserva números del contenido', () => {
    expect(normalizarEnunciadoBanco('12. ¿Cuál es el resultado de 2.5 + 1?'))
      .toBe('¿Cuál es el resultado de 2.5 + 1?');
    expect(normalizarEnunciadoBanco('La versión 2.5 del protocolo es válida.'))
      .toBe('La versión 2.5 del protocolo es válida.');
  });

  it('limpia bloques HTML de una línea sin perder el enunciado', () => {
    expect(normalizarEnunciadoBanco('<p>28. CORS</p><p>¿Qué encabezado debe enviarse?</p>'))
      .toBe('<p>¿Qué encabezado debe enviarse?</p>');
  });
});
