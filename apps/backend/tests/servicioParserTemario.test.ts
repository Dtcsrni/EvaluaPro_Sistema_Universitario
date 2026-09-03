import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extraerTextoPdf } from '../src/modulos/modulo_temarios/servicioParserTemario';

describe('servicioParserTemario', () => {
  it('extrae texto de un PDF válido con la API instalada de pdf-parse', async () => {
    const pdfPath = path.resolve(__dirname, '../sample-test.pdf');
    const texto = await extraerTextoPdf(fs.readFileSync(pdfPath));

    expect(texto.trim()).toContain('PDF TEST');
  });
});
