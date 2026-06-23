/**
 * run-client-proyectos-vite-tests
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const projects = [
  'client/proyectos_vite/login-react-mern/client',
  'client/proyectos_vite/login-react-mern/server',
  'client/proyectos_vite/practica1-api-notas/server',
  'client/proyectos_vite/practica-react-notas/client',
  'client/proyectos_vite/practica-05-react',
  'client/proyectos_vite/practica-React/sv-mini-registro'
];

function runTest(projectPath) {
  return new Promise((resolve, reject) => {
    const absolute = path.join(rootDir, projectPath);
    console.log(`[client-proyectos-vite] test -> ${projectPath}`);

    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCommand, ['test'], {
      cwd: absolute,
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', (error) => {
      reject(new Error(`[client-proyectos-vite] Error ejecutando tests en ${projectPath}: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`[client-proyectos-vite] Falló test en ${projectPath} (exit ${code})`));
      }
    });
  });
}

for (const project of projects) {
  const absolute = path.join(rootDir, project);
  if (!existsSync(absolute)) {
    console.warn(`[client-proyectos-vite] omitido (no existe): ${project}`);
    continue;
  }

  await runTest(project);
}

console.log('[client-proyectos-vite] OK');
