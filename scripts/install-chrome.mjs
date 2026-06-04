/**
 * install-chrome
 *
 * Responsabilidad: Descargar e instalar la versión exacta de Chrome necesaria para la generación de diagramas en CI/CD.
 * Limites: Ejecutar de manera no interactiva y compatible con entornos headless sin TTY.
 */
import { install, detectBrowserPlatform, resolveBuildId } from '@puppeteer/browsers';
import path from 'node:path';
import os from 'node:os';

async function run() {
  const platform = detectBrowserPlatform();
  console.log('[install-chrome] Platform:', platform);
  
  const targetVersion = '131.0.6778.204';
  const buildId = await resolveBuildId('chrome', platform, targetVersion);
  console.log('[install-chrome] Resolved buildId:', buildId);
  
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), '.cache', 'puppeteer');
  console.log('[install-chrome] Cache path:', cacheDir);
  
  console.log('[install-chrome] Downloading Chrome...');
  const result = await install({
    browser: 'chrome',
    buildId: buildId,
    platform: platform,
    cacheDir: cacheDir,
  });
  console.log('[install-chrome] Installed successfully at:', result.executablePath);
}

run().catch((err) => {
  console.error('[install-chrome] Fatal error:', err);
  process.exit(1);
});
