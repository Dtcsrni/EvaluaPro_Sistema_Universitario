import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.GUI_RESPONSIVE_ALUMNO_PORT || 4174);
const rootDir = path.resolve(__dirname, '..', '..');
const startServerScript = path.join(rootDir, 'scripts', 'testing', 'start-frontend-e2e-server.mjs');

export default defineConfig({
  testDir: __dirname,
  testMatch: ['**/responsive-alumno.spec.ts'],
  outputDir: path.join(rootDir, 'test-results', `gui-responsive-alumno-${process.pid}`),
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', headless: true },
  webServer: {
    command: `node "${startServerScript}" --port ${port} --destino alumno`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000
  },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']]
});
