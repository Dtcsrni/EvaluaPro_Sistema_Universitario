import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extraerTextoPdf, parsearTextoTemario } from '../src/modulos/modulo_temarios/servicioParserTemario';

describe('servicioParserTemario', () => {
  it('parsea numeración jerárquica sin backtracking sobre títulos controlados por usuario', () => {
    const nodos = parsearTextoTemario([
      '1   Introducción',
      '1.2 Conceptos',
      '1.10 Aplicaciones',
      `0 ${' '.repeat(20_000)}fin`,
      'texto libre'
    ].join('\n'));

    expect(nodos.map(({ numero, titulo }) => `${numero}:${titulo}`)).toEqual([
      '0:fin',
      '1:Introducción',
      '1.2:Conceptos',
      '1.10:Aplicaciones'
    ]);
  });

  it('extrae texto de un PDF válido con la API instalada de pdf-parse', async () => {
    const pdfPath = path.resolve(__dirname, '../sample-test.pdf');
    const texto = await extraerTextoPdf(fs.readFileSync(pdfPath));

    expect(texto.trim()).toContain('PDF TEST');
  });
});
