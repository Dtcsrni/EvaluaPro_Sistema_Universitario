/**
 * install-chrome
 *
 * Responsabilidad: Descargar e instalar la versión exacta de Chrome necesaria para la generación de diagramas en CI/CD.
 * Limites: Ejecutar de manera no interactiva y compatible con entornos headless sin TTY.
 */
// Habilitar logs de depuración para puppeteer y sus módulos asociados
process.env.DEBUG = 'puppeteer:*';

import { install, detectBrowserPlatform, resolveBuildId } from '@puppeteer/browsers';
import path from 'node:path';
import os from 'node:os';

// Registrar manejadores globales para capturar cualquier comportamiento extraño del proceso
process.on('exit', (code) => {
  console.log(`[install-chrome] Proceso finalizado con código: ${code}`);
});

process.on('uncaughtException', (err) => {
  console.error('[install-chrome] Excepción no capturada:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[install-chrome] Promesa rechazada sin manejar en:', promise, 'razón:', reason);
  process.exit(1);
});

async function run() {
  console.log('[install-chrome] Iniciando script...');
  const platform = detectBrowserPlatform();
  console.log('[install-chrome] Platform:', platform);
  
  const targetVersion = '131.0.6778.204';
  const buildId = await resolveBuildId('chrome', platform, targetVersion);
  console.log('[install-chrome] Resolved buildId:', buildId);
  
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), '.cache', 'puppeteer');
  console.log('[install-chrome] Cache path:', cacheDir);
  
  console.log('[install-chrome] Iniciando llamada a install()...');
  const result = await install({
    browser: 'chrome',
    buildId: buildId,
    platform: platform,
    cacheDir: cacheDir,
  });
  console.log('[install-chrome] Instalación exitosa:', result);
}

run().then(() => {
  console.log('[install-chrome] Ejecución de run() terminada con éxito');
}).catch((err) => {
  console.error('[install-chrome] Error fatal en run():', err);
  process.exit(1);
});
