#!/usr/bin/env node
/**
 * Ejecuta Vite con salida segura cuando una instalación local está sirviendo
 * el directorio de build y Windows impide reemplazar sus archivos.
 */
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function obtenerOutDir(args) {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--outDir') return args[index + 1] || 'dist';
    if (args[index]?.startsWith('--outDir=')) return args[index].slice('--outDir='.length) || 'dist';
  }
  return 'dist';
}

function conOutDir(args, outDir) {
  const resultado = [...args];
  for (let index = 0; index < resultado.length; index += 1) {
    if (resultado[index] === '--outDir') {
      resultado[index + 1] = outDir;
      return resultado;
    }
    if (resultado[index]?.startsWith('--outDir=')) {
      resultado[index] = `--outDir=${outDir}`;
      return resultado;
    }
  }
  resultado.push('--outDir', outDir);
  return resultado;
}

function ejecutarVite(args) {
  const vite = process.platform === 'win32' ? 'vite.cmd' : 'vite';
  return spawnSync(vite, ['build', ...args], {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8'
  });
}

function emitir(resultado) {
  if (resultado.stdout) process.stdout.write(resultado.stdout);
  if (resultado.stderr) process.stderr.write(resultado.stderr);
}

function esErrorPermiso(resultado) {
  const texto = `${resultado.stdout || ''}\n${resultado.stderr || ''}`;
  return /\b(?:EPERM|EACCES|Acceso denegado|Permission denied)\b/i.test(texto);
}

function puertoActivo(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const terminar = (activo) => {
      socket.destroy();
      resolve(activo);
    };
    socket.once('connect', () => terminar(true));
    socket.once('error', () => terminar(false));
    socket.setTimeout(350, () => terminar(false));
  });
}

function directorioStaging(outDir) {
  const nombre = path.basename(path.resolve(process.cwd(), outDir));
  return path.join(os.tmpdir(), 'evaluapro-builds', `${nombre}-${Date.now()}-${process.pid}`);
}

function promoverStaging(staging, destino) {
  fs.mkdirSync(destino, { recursive: true });
  // Copiar el contenido, en vez de sustituir el directorio servido, evita
  // invalidar handles abiertos por WebView2 o por el servidor estático.
  try {
    fs.cpSync(staging, destino, { recursive: true, force: true });
  } catch (error) {
    if (process.platform !== 'win32') throw error;
    // En Windows, WebView2/antivirus puede mantener un handle sobre la
    // carpeta de assets y hacer que cpSync falle aunque la copia por archivo
    // sea válida. Robocopy devuelve 0..7 para resultados exitosos.
    const copia = spawnSync('robocopy', [
      staging,
      destino,
      '/E',
      '/COPY:DAT',
      '/DCOPY:DAT',
      '/R:2',
      '/W:1',
      '/NFL',
      '/NDL',
      '/NJH',
      '/NJS'
    ], { stdio: 'ignore', windowsHide: true });
    if (copia.error || (copia.status ?? 16) > 7) throw error;
    process.stdout.write('[frontend-build] staging promovido con robocopy\n');
  }
  process.stdout.write(`[frontend-build] staging promovido a: ${destino}\n`);
}

const args = process.argv.slice(2);
const outDir = obtenerOutDir(args);
const destino = path.resolve(process.cwd(), outDir);
const hostActivo = process.platform === 'win32' && fs.existsSync(destino)
  && await puertoActivo(Number(process.env.PUERTO_WEB || 4173));

let resultado;
let staging;
if (hostActivo) {
  staging = directorioStaging(outDir);
  process.stderr.write(`[frontend-build] salida en uso; compilando en staging: ${staging}\n`);
  resultado = ejecutarVite(conOutDir(args, staging));
} else {
  resultado = ejecutarVite(args);
  if (resultado.status !== 0 && process.platform === 'win32' && esErrorPermiso(resultado)) {
    staging = directorioStaging(outDir);
    process.stderr.write(`[frontend-build] EPERM/EACCES en ${destino}; reintentando en staging: ${staging}\n`);
    resultado = ejecutarVite(conOutDir(args, staging));
  }
}

emitir(resultado);
if (resultado.status === 0 && staging) {
  try {
    promoverStaging(staging, destino);
    fs.rmSync(staging, { recursive: true, force: true });
  } catch (error) {
    process.stderr.write(`[frontend-build] no se pudo promover staging: ${error?.message || error}\n`);
    process.exit(1);
  }
}
process.exit(resultado.status ?? 1);
