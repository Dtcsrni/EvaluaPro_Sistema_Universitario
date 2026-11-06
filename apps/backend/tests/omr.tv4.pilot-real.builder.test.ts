import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { normalizarClavePilotoReal } from '../src/modulos/modulo_escaneo_omr/clavePilotoReal.js';
import { buildTemplateImportManifest } from '../scripts/omr-tv4-build-pilot-real.js';

describe('plantilla del piloto real TV4', () => {
  it('no inventa claves, capturas ni etiquetas de verdad terreno', () => {
    const template = buildTemplateImportManifest();

    expect(template).toEqual({
      version: '1',
      datasetType: 'tv4_pilot_real_import',
      captures: []
    });
    expect(template).not.toHaveProperty('answerKey');
    expect(template).not.toHaveProperty('answerKeyByFolio');
  });

  it('mantiene vacía la plantilla versionada para no presentar predicciones como verdad terreno', async () => {
    const checkedInTemplate = JSON.parse(await readFile(
      new URL('../../../omr_samples_tv4_pilot_real/source/pilot_import.template.json', import.meta.url),
      'utf8'
    ));

    expect(checkedInTemplate).toEqual(buildTemplateImportManifest());
    expect(checkedInTemplate.captures).toEqual([]);
    expect(checkedInTemplate).not.toHaveProperty('answerKey');
  });
});

describe('clave del piloto real TV4', () => {
  it('normaliza una clave explícita sin inferirla de las respuestas del alumno', () => {
    expect(normalizarClavePilotoReal({ 2: ' d ', 1: 'a' })).toEqual({ 1: 'A', 2: 'D' });
  });

  it('rechaza claves ausentes, inválidas o con preguntas omitidas', () => {
    expect(() => normalizarClavePilotoReal(undefined)).toThrow('objeto pregunta-opción explícito');
    expect(() => normalizarClavePilotoReal({})).toThrow('explícita no vacía');
    expect(() => normalizarClavePilotoReal({ 1: 'A', 3: 'C' })).toThrow('preguntas consecutivas desde 1');
    expect(() => normalizarClavePilotoReal({ 1: 'F' })).toThrow('entrada inválida');
  });
});
