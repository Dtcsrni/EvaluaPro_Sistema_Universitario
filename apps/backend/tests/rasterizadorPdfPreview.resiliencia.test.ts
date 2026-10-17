import fs from 'node:fs/promises';
import os from 'node:os';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../src/modulos/modulo_generacion_pdf/infra/procesoPdfLimitado.js', () => ({
  ejecutarProcesoPdfLimitado: vi.fn()
}));

import { ejecutarProcesoPdfLimitado } from '../src/modulos/modulo_generacion_pdf/infra/procesoPdfLimitado.js';
import { rasterizarPdfParaPreview } from '../src/modulos/modulo_generacion_pdf/infra/rasterizadorPdfPreview.js';

const ejecutarMock = vi.mocked(ejecutarProcesoPdfLimitado);

beforeEach(() => {
  vi.stubEnv('EVALUAPRO_PDF_RASTERIZER', 'rasterizer-ausente');
  vi.stubEnv('PDF_RASTERIZER_EXECUTABLE', 'rasterizer-ausente');
  ejecutarMock.mockRejectedValue(Object.assign(new Error('El rasterizador agotó su tiempo límite.'), { code: 'ETIMEDOUT' }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it('usa Sharp tras los timeout externos, coalesce concurrentes y limpia temporales', async () => {
  const documento = await PDFDocument.create();
  documento.addPage([612, 792]);
  const pdf = Buffer.from(await documento.save());
  const directorio = os.tmpdir();
  const antes = new Set((await fs.readdir(directorio)).filter((nombre) => nombre.startsWith('evaluapro-pdf-preview-')));

  const [primero, segundo] = await Promise.all([
    rasterizarPdfParaPreview(pdf, { cantidadPaginas: 1, dpi: 144 }),
    rasterizarPdfParaPreview(pdf, { cantidadPaginas: 1, dpi: 144 })
  ]);

  expect(primero).toBe(segundo);
  expect(ejecutarMock).toHaveBeenCalledTimes(3);
  for (const llamada of ejecutarMock.mock.calls) {
    expect(llamada[2]).toBeGreaterThan(0);
    expect(llamada[2]).toBeLessThanOrEqual(6_000);
  }
  expect(primero.paginasTotales).toBe(1);
  expect(primero.paginas).toHaveLength(1);
  expect(primero.paginas[0]?.width).toBeGreaterThan(0);
  expect(primero.paginas[0]?.height).toBeGreaterThan(0);

  const despues = await fs.readdir(directorio);
  expect(despues.filter((nombre) => nombre.startsWith('evaluapro-pdf-preview-') && !antes.has(nombre))).toEqual([]);
});
