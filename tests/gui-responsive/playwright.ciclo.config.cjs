const path = require('node:path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['**/ciclo-completo.spec.ts', '**/journey-docente-integral.spec.ts'],
  timeout: 90_000,
  retries: 0,
  // API, portal y SQLite se comparten dentro de esta topología nativa; la
  // serialización evita carreras entre sesiones y resultados no reproducibles.
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173', // Native docente-local web port
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1366, height: 768 }
  },
  reporter: [['list']],
  webServer: [
    {
      // Arranca la misma topología nativa que usa el flavor docente-local:
      // API Node en 4000, portal local en 8080 y web docente en 4173.
      command: 'node ../../scripts/start-docente-native.mjs',
      url: 'http://127.0.0.1:4173',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        EVALUAPRO_E2E_BUILD: '1',
        REQUIRE_GOOGLE_OAUTH: '0',
        E2E_DOCENTE_SQLITE_PATH: path.resolve(__dirname, '../../test-results/docente-cycle/evaluapro.db'),
        // Solo para el proceso efímero del E2E; nunca se usa para releases.
        JWT_SECRETO: process.env.E2E_JWT_SECRETO || 'e2e-local-only-jwt-secret'
      },
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      // Segunda superficie real del mismo build, compilada como alumno para
      // validar la publicación sin reutilizar el storage del docente.
      command: 'node ../../scripts/testing/start-frontend-e2e-server.mjs --port 4174 --destino alumno',
      url: 'http://127.0.0.1:4174',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        VITE_PORTAL_BASE_URL: 'http://127.0.0.1:8080/api/portal'
      },
      stdout: 'pipe',
      stderr: 'pipe'
    }
  ]
});
