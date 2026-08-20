/**
 * playwright.alumno.config
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
const path = require('node:path');
const { defineConfig } = require('@playwright/test');

const port = Number(process.env.GUI_RESPONSIVE_ALUMNO_PORT || 4174);
const rootDir = path.resolve(__dirname, '..', '..');
const startServerScript = path.join(rootDir, 'scripts', 'testing', 'start-frontend-e2e-server.mjs');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['**/responsive-alumno.spec.ts'],
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    headless: true
  },
  webServer: {
    command: `node "${startServerScript}" --port ${port} --destino alumno`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000
  },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']]
});
