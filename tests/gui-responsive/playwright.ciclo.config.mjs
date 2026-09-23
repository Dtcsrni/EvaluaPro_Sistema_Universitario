import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docenteWebPort = Number(process.env.E2E_DOCENTE_WEB_PORT || 4173);
const docenteApiPort = Number(process.env.E2E_DOCENTE_API_PORT || 4000);
const alumnoWebPort = Number(process.env.E2E_ALUMNO_WEB_PORT || 4174);
const scratchRoot = path.resolve(
  process.env.E2E_SCRATCH_ROOT || path.join(process.env.TEMP || process.cwd(), 'evaluapro-e2e-cycle')
);
const e2eDatabasePath = path.join(scratchRoot, 'evaluapro.db');
const e2ePortalDatabasePath = path.join(scratchRoot, 'portal.db');
const e2eDocenteWebDist = path.join(scratchRoot, 'dist-docente');
const e2eLogsRoot = path.join(scratchRoot, 'logs');
const e2eScreenshotRoot = path.join(scratchRoot, 'screenshots');
fs.mkdirSync(e2eScreenshotRoot, { recursive: true });
process.env.E2E_SCREENSHOT_DIR = e2eScreenshotRoot;

export default defineConfig({
  testDir: __dirname,
  testMatch: ['**/ciclo-completo.spec.ts', '**/journey-docente-integral.spec.ts'],
  outputDir: path.join(scratchRoot, `results-${process.pid}`),
  timeout: 90_000,
  retries: 0,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${docenteWebPort}`, browserName: 'chromium', headless: true, viewport: { width: 1920, height: 1080 } },
  reporter: [['list']],
  webServer: [
    {
      command: 'node ../../scripts/start-docente-native.mjs',
      url: `http://127.0.0.1:${docenteWebPort}`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        EVALUAPRO_E2E_BUILD: '1',
        REQUIRE_GOOGLE_OAUTH: '0',
        E2E_DOCENTE_SQLITE_PATH: e2eDatabasePath,
        E2E_PORTAL_DATABASE_PATH: e2ePortalDatabasePath,
        E2E_DOCENTE_WEB_DIST: e2eDocenteWebDist,
        E2E_LOGS_DIR: e2eLogsRoot,
        E2E_SCREENSHOT_DIR: e2eScreenshotRoot,
        E2E_DISABLE_PORTAL: process.env.E2E_DISABLE_PORTAL || '1',
        E2E_SKIP_BACKEND_BUILD: process.env.E2E_SKIP_BACKEND_BUILD || '0',
        PUERTO_API: String(docenteApiPort),
        PUERTO_WEB: String(docenteWebPort),
        CORS_ORIGENES: `http://127.0.0.1:${docenteWebPort},http://localhost:${docenteWebPort},http://127.0.0.1:${alumnoWebPort}`,
        JWT_SECRETO: process.env.E2E_JWT_SECRETO || 'e2e-local-only-jwt-secret'
      },
      stdout: 'pipe',
      stderr: 'pipe'
    },
    ...(process.env.E2E_START_ALUMNO_SERVER === '0' ? [] : [{
      command: `node ../../scripts/testing/start-frontend-e2e-server.mjs --port ${alumnoWebPort} --destino alumno`,
      url: `http://127.0.0.1:${alumnoWebPort}`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        VITE_PORTAL_BASE_URL: 'http://127.0.0.1:8080/api/portal',
        E2E_PORTAL_DATABASE_PATH: e2ePortalDatabasePath,
        E2E_FRONTEND_BUILD_ROOT: path.join(scratchRoot, 'dist-alumno'),
        E2E_SCREENSHOT_DIR: e2eScreenshotRoot
      },
      stdout: 'pipe',
      stderr: 'pipe'
    }])
  ]
});
