/**
 * install-chrome
 *
 * Responsabilidad: Descargar e instalar la versión exacta de Chrome (131.0.6778.204) necesaria para diagramas en CI/CD.
 * Limites: Usar fetch nativo y extract-zip para máxima portabilidad y evitar fallos por TTY o proxy-agent.
 */
import fs from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import extract from 'extract-zip';

async function downloadFile(url, dest) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download from ${url}: ${response.statusText}`);
  }
  const fileStream = createWriteStream(dest);
  const reader = response.body.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(Buffer.from(value));
  }
  
  await new Promise((resolve, reject) => {
    fileStream.end((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function run() {
  console.log('[install-chrome] Iniciando descarga nativa...');
  
  let platformFolder = 'linux64';
  let targetSubdir = 'linux-131.0.6778.204';
  let zipName = 'chrome-linux64.zip';
  
  if (process.platform === 'win32') {
    platformFolder = 'win64';
    targetSubdir = 'win64-131.0.6778.204';
    zipName = 'chrome-win64.zip';
  } else if (process.platform === 'darwin') {
    const isArm = os.arch() === 'arm64';
    platformFolder = isArm ? 'mac-arm64' : 'mac-x64';
    targetSubdir = isArm ? 'mac_arm-131.0.6778.204' : 'mac-131.0.6778.204';
    zipName = isArm ? 'chrome-mac-arm64.zip' : 'chrome-mac-x64.zip';
  }
  
  const url = `https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.204/${platformFolder}/${zipName}`;
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), '.cache', 'puppeteer');
  const targetDir = path.join(cacheDir, 'chrome', targetSubdir);
  
  console.log('[install-chrome] URL:', url);
  console.log('[install-chrome] Target Directory:', targetDir);
  
  // Limpiar/crear directorios
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
  
  const tempZipPath = path.join(os.tmpdir(), `chrome-131-${Date.now()}.zip`);
  console.log('[install-chrome] Descargando temporal en:', tempZipPath);
  
  await downloadFile(url, tempZipPath);
  console.log('[install-chrome] Descarga completada. Extrayendo archivo...');
  
  await extract(tempZipPath, { dir: targetDir });
  console.log('[install-chrome] Extracción exitosa.');
  
  // Limpiar zip temporal
  await fs.unlink(tempZipPath);
  
  // Verificar ejecutable
  const exeName = process.platform === 'win32' ? 'chrome.exe' : 'chrome';
  const expectedExePath = path.join(targetDir, zipName.replace('.zip', ''), exeName);
  
  if (existsSync(expectedExePath)) {
    console.log('[install-chrome] Ejecutable verificado en:', expectedExePath);
    // En plataformas tipo Unix, asegurar que sea ejecutable
    if (process.platform !== 'win32') {
      await fs.chmod(expectedExePath, 0o755);
      console.log('[install-chrome] Permisos de ejecución otorgados (0755).');
    }
  } else {
    console.error('[install-chrome] ¡ADVERTENCIA! No se encontró el ejecutable esperado en:', expectedExePath);
  }
}

run().then(() => {
  console.log('[install-chrome] Instalación terminada correctamente.');
}).catch((err) => {
  console.error('[install-chrome] Error fatal:', err);
  process.exit(1);
});
