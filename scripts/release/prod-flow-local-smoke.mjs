#!/usr/bin/env node
/**
 * prod-flow-local-smoke
 *
 * Responsabilidad: Ejecutar el smoke local del gate de flujo docente mayo-junio.
 * Limites: Usa Vitest/backend test DB y escribe evidencia en version local separada.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function npmBin() {
  return process.platform === 'win32' ? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js') : 'npm';
}

const args = ['-C', 'apps/backend', 'run', 'test', '--', 'tests/integracion/prodFlowLocalSmoke.test.ts', '--reporter=verbose'];
const resultado =
  process.platform === 'win32'
    ? spawnSync(process.execPath, [npmBin(), ...args], {
        cwd: process.cwd(),
        env: process.env,
        encoding: 'utf8'
      })
    : spawnSync(npmBin(), args, { cwd: process.cwd(), env: process.env, encoding: 'utf8' });

process.stdout.write(resultado.stdout || '');
process.stderr.write(resultado.stderr || '');
process.exit(resultado.status || 0);
