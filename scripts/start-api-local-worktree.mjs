#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cargarVariablesEnvDesdeArchivo, obtenerClavesEnvAutoritativas } from './runtime-env.mjs';

if (!process.argv.includes('--use-installed-database')) {
  throw new Error('Este arranque usa la base configurada en la instalación; confirma con --use-installed-database.');
}

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installRoot = path.resolve(
  process.env.EVALUAPRO_INSTALL_ROOT || path.join(process.env.LOCALAPPDATA || '', 'EvaluaPro')
);
const envPath = path.join(installRoot, '.env');
if (!fs.existsSync(envPath)) {
  throw new Error('No se encontró la configuración local de EvaluaPro para iniciar la API.');
}

process.env.NODE_ENV ||= 'production';
process.env.EVALUAPRO_FLAVOR ||= 'docente-local';
cargarVariablesEnvDesdeArchivo(envPath, process.env, {
  overrideKeys: obtenerClavesEnvAutoritativas({ nodeEnv: process.env.NODE_ENV, flavor: process.env.EVALUAPRO_FLAVOR })
});
process.chdir(sourceRoot);

const entrypoint = pathToFileURL(path.join(sourceRoot, 'apps/backend/dist/arranqueApiDocenteLocal.js')).href;
const api = await import(entrypoint);
const servidor = await api.iniciarApiDocenteLocal();

const address = servidor.address();
const port = typeof address === 'object' && address ? address.port : 'configured';
process.stdout.write(`API docente local disponible en http://127.0.0.1:${port}/api\n`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await api.cerrarApiDocenteLocal(servidor);
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void stop().catch(() => { process.exitCode = 1; });
  });
}
