const path = require('node:path');
const { defineConfig } = require('@playwright/test');

const port = Number(process.env.GUI_RESPONSIVE_PORT || 4173);
const rootDir = path.resolve(__dirname, '..', '..');
const startServerScript = path.join(rootDir, 'scripts', 'testing', 'start-frontend-e2e-server.mjs');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['**/responsive-docente.spec.ts'],
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    headless: true
  },
  webServer: {
    command: `node "${startServerScript}" --port ${port} --destino docente`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']]
});
