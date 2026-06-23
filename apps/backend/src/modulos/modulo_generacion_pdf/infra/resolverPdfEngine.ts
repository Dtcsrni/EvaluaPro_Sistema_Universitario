/**
 * resolverPdfEngine
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { existsSync } from 'node:fs';

export type PdfEngine = 'pdf-lib-legacy' | 'playwright-html-v1';

export function resolverPdfEngine(): PdfEngine {
  const raw = String(process.env.EXAMEN_PDF_ENGINE ?? 'auto').trim().toLowerCase();
  if (raw === 'pdf-lib-legacy') return 'pdf-lib-legacy';
  if (raw === 'playwright-html-v1') return 'playwright-html-v1';

  const executablePath = String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '').trim();
  if (executablePath) {
    return existsSync(executablePath) ? 'playwright-html-v1' : 'pdf-lib-legacy';
  }

  const preferredChannel = String(process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? '').trim();
  const entorno = String(process.env.NODE_ENV ?? '').trim().toLowerCase();

  // En Docker/prod no asumimos que Playwright tenga navegador descargado.
  if (entorno === 'production' && !preferredChannel) {
    return 'pdf-lib-legacy';
  }

  return 'playwright-html-v1';
}
