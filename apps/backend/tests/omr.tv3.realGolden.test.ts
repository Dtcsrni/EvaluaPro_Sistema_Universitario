/**
 * omr.tv3.realGolden.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr';

type GoldenCase = {
  captureId: string;
  question: number;
  expected: 'A' | 'B' | 'C' | 'D' | 'E' | null;
};

const DATASET_ROOT = path.resolve(process.cwd(), '../../omr_samples_tv3_real_por_folio');
const GOLDEN_CASES: GoldenCase[] = [
  { captureId: '6A98D91E-P2-C1', question: 204, expected: 'E' },
  { captureId: 'A93D8EFA-P2-C1', question: 202, expected: 'D' },
  { captureId: 'ECF3E587-P2-C1', question: 206, expected: 'E' },
  { captureId: '503CF7FA-P1-C1', question: 105, expected: 'E' },
  { captureId: '5EA00A22-P2-C1', question: 201, expected: 'C' },
  { captureId: '07BE7982-P2-C1', question: 202, expected: 'B' },
  { captureId: 'EEB4EB38-P1-C1', question: 104, expected: null }
];

async function readJson<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function imageToDataUrl(imagePath: string) {
  const buffer = await fs.readFile(imagePath);
  const mime = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

describe('omr tv3 real golden', () => {
  it('resuelve preguntas reales seleccionadas del lote Por Folio sin flags criticos', async () => {
    for (const caso of GOLDEN_CASES) {
      const imagePath = path.join(DATASET_ROOT, 'images', `${caso.captureId}.jpg`);
      const mapPath = path.join(DATASET_ROOT, 'maps', `${caso.captureId}.json`);
      const mapa = await readJson<{
        numeroPagina: number;
        preguntas: Array<{ numeroPregunta: number }>;
        templateVersion?: 3 | 4;
        qr?: { texto?: string };
      }>(mapPath);
      const partes = caso.captureId.split('-');
      const folio = partes[0] ?? '';
      const numeroPagina = Number(String(partes[1] ?? 'P1').replace(/^P/i, '')) || mapa.numeroPagina;
      const templateVersion = mapa.templateVersion === 4 ? 4 : 3;
      const qrEsperado = String(mapa.qr?.texto ?? `EXAMEN:${folio}:P${numeroPagina}:TV${templateVersion}`);
      const result = await analizarOmr(
        await imageToDataUrl(imagePath),
        mapa,
        [qrEsperado, folio],
        10,
        { folio, numeroPagina, templateVersionDetectada: templateVersion }
      );
      const respuesta = result.respuestasDetectadas.find((item) => item.numeroPregunta === caso.question);
      expect(result.estadoAnalisis).toBe('ok');
      expect(respuesta?.opcion).toBe(caso.expected);
      expect(respuesta?.flags ?? []).not.toContain('bajo_contraste');
      expect(respuesta?.flags ?? []).not.toContain('doble_marca');
      expect(respuesta?.flags ?? []).not.toContain('fuera_roi');
      expect(respuesta?.flags ?? []).not.toContain('parcial_detectada');
    }
  }, 300000);
});
