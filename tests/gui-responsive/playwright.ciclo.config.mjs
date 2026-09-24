import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: __dirname,
  testMatch: ['**/ciclo-completo.spec.ts', '**/journey-docente-integral.spec.ts'],
  outputDir: path.join(__dirname, '..', '..', 'test-results', `gui-responsive-native-cycle-${process.pid}`),
  timeout: 90_000,
  retries: 0,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', headless: true, viewport: { width: 1920, height: 1080 } },
  reporter: [['list']],
  webServer: [
    {
      command: 'node ../../scripts/start-docente-native.mjs',
      url: 'http://127.0.0.1:4173',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        EVALUAPRO_E2E_BUILD: '1',
        REQUIRE_GOOGLE_OAUTH: '0',
        E2E_DOCENTE_SQLITE_PATH: path.resolve(__dirname, '../../test-results/docente-cycle/evaluapro.db'),
        JWT_SECRETO: process.env.E2E_JWT_SECRETO || 'e2e-local-only-jwt-secret'
      },
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      command: 'node ../../scripts/testing/start-frontend-e2e-server.mjs --port 4174 --destino alumno',
      url: 'http://127.0.0.1:4174',
      timeout: 120_000,
      reuseExistingServer: false,
      env: { NODE_ENV: 'test', VITE_PORTAL_BASE_URL: 'http://127.0.0.1:8080/api/portal' },
      stdout: 'pipe',
      stderr: 'pipe'
    }
  ]
});
