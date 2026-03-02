/**
 * pdfImpresionContrato
 *
 * Garantia contractual de PDF para impresion (Carta + nombre trazable).
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { prepararEscenarioFlujo } from './_flujoDocenteHelper';

const TOLERANCIA_PUNTOS = 0.5;
const CARTA_ANCHO = 612;
const CARTA_ALTO = 792;

async function obtenerExamenGenerado(app: ReturnType<typeof crearApp>, folio: string, auth: Record<string, string>) {
  const examenResp = await request(app)
    .get(`/api/examenes/generados/folio/${encodeURIComponent(folio)}`)
    .set(auth)
    .expect(200);
  return examenResp.body.examen as {
    mapaOmr?: { paginas?: Array<{ qr?: { texto?: string } }>; perfilLayout?: { gridStepPt?: number; bottomSafePt?: number; headerHeightFirst?: number } };
  };
}

function validarContratoMapaOmr(examen: {
  mapaOmr?: { paginas?: Array<{ qr?: { texto?: string } }>; perfilLayout?: { gridStepPt?: number; bottomSafePt?: number; headerHeightFirst?: number } };
}, folio: string) {
  const mapaOmr = examen.mapaOmr;
  expect(mapaOmr).toBeTruthy();

  const paginas = Array.isArray(mapaOmr?.paginas) ? mapaOmr.paginas : [];
  const perfilLayout = mapaOmr?.perfilLayout || {};

  expect(paginas.length).toBeGreaterThan(0);
  expect(Number(perfilLayout.gridStepPt || 0)).toBeGreaterThan(0);
  expect(Number(perfilLayout.gridStepPt || 99)).toBeLessThanOrEqual(6);
  expect(Number(perfilLayout.bottomSafePt || 0)).toBeGreaterThanOrEqual(8);
  expect(Number(perfilLayout.headerHeightFirst || 0)).toBeGreaterThan(20);
  for (const pagina of paginas) {
    expect(String(pagina?.qr?.texto ?? '')).toContain(folio);
  }
}

async function descargarPdfExamen(app: ReturnType<typeof crearApp>, examenId: string, auth: Record<string, string>) {
  return request(app)
    .get(`/api/examenes/generados/${encodeURIComponent(examenId)}/pdf`)
    .set(auth)
    .buffer(true)
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    })
    .expect(200);
}

function validarTamanoCarta(doc: PDFDocument) {
  const pages = doc.getPages();
  expect(pages.length).toBeGreaterThan(0);
  pages.forEach((page) => {
    const { width, height } = page.getSize();
    expect(Math.abs(width - CARTA_ANCHO)).toBeLessThanOrEqual(TOLERANCIA_PUNTOS);
    expect(Math.abs(height - CARTA_ALTO)).toBeLessThanOrEqual(TOLERANCIA_PUNTOS);
  });
  return pages.length;
}

describe('contrato PDF impresion', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('genera PDF carta trazable y eficiente para impresion', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'global', 'docente-pdf-contrato@prueba.test');
    const examen = await obtenerExamenGenerado(app, escenario.folio, escenario.auth);
    validarContratoMapaOmr(examen, escenario.folio);

    const pdfResp = await descargarPdfExamen(app, escenario.examenId, escenario.auth);

    const contentDisposition = String(pdfResp.headers['content-disposition'] ?? '');
    expect(contentDisposition).toContain('attachment; filename=');
    expect(contentDisposition).toMatch(/examen_.*folio-[A-Z0-9]+\.pdf/);

    const pdfBuffer = pdfResp.body as Buffer;
    // Umbral inferior robusto entre entornos: asegura contenido real sin acoplarse
    // a variaciones menores del encoder/fuentes entre SO.
    expect(pdfBuffer.byteLength).toBeGreaterThan(12_000);
    expect(pdfBuffer.byteLength).toBeLessThan(1_500_000);

    const doc = await PDFDocument.load(pdfBuffer);
    const totalPaginas = validarTamanoCarta(doc);

    // Reglas minimas de impresion/tinta: peso por pagina contenido y no excesivo.
    const bytesPorPagina = Math.round(pdfBuffer.byteLength / Math.max(1, totalPaginas));
    expect(bytesPorPagina).toBeGreaterThan(10_000);
    expect(bytesPorPagina).toBeLessThan(500_000);

    const hashSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const reporte = {
      version: '1',
      ejecutadoEn: new Date().toISOString(),
      archivo: `${escenario.folio}.pdf`,
      contentDisposition,
      paginaTamanoCartaOk: true,
      qrFolioEnTodasLasPaginas: true,
      reglasTintaOk: true,
      hashSha256,
      bytes: pdfBuffer.byteLength,
      paginas: totalPaginas
    };
    const out = path.resolve(process.cwd(), 'reports/qa/latest/pdf-print.json');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, `${JSON.stringify(reporte, null, 2)}\n`, 'utf8');
  });
});
