import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: __dirname,
  testMatch: ['**/plantillas-pdf-edge.spec.ts'],
  outputDir: process.env.E2E_REPORT_DIR
    ? path.join(process.env.E2E_REPORT_DIR, 'pdf-edge-test-results')
    : path.join(process.env.TEMP || process.cwd(), 'evaluapro-edge-pdf-qa'),
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { browserName: 'chromium', ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : { channel: 'msedge' }), headless: true, viewport: { width: 1440, height: 1000 }, actionTimeout: 20_000, navigationTimeout: 30_000 }
});
