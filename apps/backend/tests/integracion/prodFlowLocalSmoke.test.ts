/**
 * prodFlowLocalSmoke.test
 *
 * Responsabilidad: Validar localmente el gate de flujo docente mayo-junio sin
 * reemplazar la evidencia humana productiva.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { prepararEscenarioFlujo } from './_flujoDocenteHelper';

const VERSION_LOCAL = '1.1.0-local.0';
const MANUAL_LOCAL = 'docs/release/manual/prod-flow-1.1.0-mayo-junio.local.json';
const DOCENTE_ID_LOCAL = 'docente-local-smoke-mayo-junio';

function npmBin() {
  return process.platform === 'win32' ? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js') : 'npm';
}

function ejecutarNpmRepo(args: string[], env: NodeJS.ProcessEnv): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const comando =
    process.platform === 'win32'
      ? {
          cmd: process.execPath,
          args: [npmBin(), ...args]
        }
      : { cmd: npmBin(), args };
  return new Promise((resolve, reject) => {
    const child = spawn(comando.cmd, comando.args, { cwd: repoRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

describe('release prod-flow local smoke mayo-junio', () => {
  const app = crearApp();
  let server: ReturnType<typeof app.listen> | undefined;

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => server?.close((error) => (error ? reject(error) : resolve())));
    }
    await cerrarMongoTest();
  });

  it('ejecuta el gate automatico contra API local y evidencia separada', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'global', 'docente-release-mayo-junio@local.test');
    server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const apiBase = `http://127.0.0.1:${port}/api`;
    const env = {
      ...process.env,
      RELEASE_GATE_API_BASE: apiBase,
      RELEASE_GATE_DOCENTE_TOKEN: escenario.token,
      RELEASE_GATE_DOCENTE_ID: DOCENTE_ID_LOCAL,
      RELEASE_GATE_CI_GREEN: '13'
    };

    const resultado = await ejecutarNpmRepo(
      [
        'run',
        'release:gate:prod-flow',
        '--',
        `--version=${VERSION_LOCAL}`,
        `--periodo-id=${escenario.periodoId}`,
        `--manual=${MANUAL_LOCAL}`,
        `--api-base=${apiBase}`,
        `--docente-id=${DOCENTE_ID_LOCAL}`,
        '--entorno=local-smoke',
        '--ci-green=13'
      ],
      env
    );

    expect(`${resultado.stdout}\n${resultado.stderr}`).not.toContain(escenario.token);
    expect(resultado.status, `${resultado.stdout}\n${resultado.stderr}`).toBe(0);
    expect(resultado.stdout).toContain('"resultado":"ok"');
    expect(resultado.stdout).toContain('1.1.0-local.0');

    const repoRoot = path.resolve(process.cwd(), '..', '..');
    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/release/evidencias/1.1.0-local.0/manifest.json'), 'utf8'));
    expect(manifest.gateHumanoProduccion.entorno).toBe('local-smoke');
    expect(manifest.gateHumanoProduccion.resultado).toBe('ok');
    expect(JSON.stringify(manifest.gateHumanoProduccion.pasos)).not.toContain('docente humano en produccion');
  }, 30000);
});
