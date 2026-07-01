const path = require('node:path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['**/ciclo-completo.spec.ts'],
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173', // The web UI port
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1366, height: 768 }
  },
  reporter: [['list']]
});
