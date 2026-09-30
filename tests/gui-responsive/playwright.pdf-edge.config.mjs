import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: __dirname,
  testMatch: ['**/plantillas-pdf-edge.spec.ts'],
  outputDir: path.join(process.env.TEMP || process.cwd(), 'evaluapro-edge-pdf-qa'),
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { browserName: 'chromium', channel: 'msedge', headless: true, viewport: { width: 1440, height: 1000 } }
});
