/**
 * env-doctor.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { evaluateEnvDoctor, parseNodeMajor, resolveTarget } from '../env-doctor.mjs';

const root = process.cwd();
const playwrightBrowsers = [
  'Playwright version: 1.58.2',
  '  Browsers:',
  '    C:\\Users\\tester\\AppData\\Local\\ms-playwright\\chromium-1208',
  '    C:\\Users\\tester\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208'
].join('\n');

function buildRunner(map) {
  return (command) => {
    const value = map[command];
    if (!value) {
      return { ok: false, stdout: '' };
    }
    if (typeof value === 'string') {
      return { ok: true, stdout: value };
    }
    return value;
  };
}

test('resolveTarget selecciona target por plataforma', () => {
  assert.equal(resolveTarget('auto', 'linux'), 'wsl');
  assert.equal(resolveTarget('auto', 'win32'), 'windows');
  assert.equal(resolveTarget('wsl', 'win32'), 'wsl');
  assert.equal(resolveTarget('windows', 'linux'), 'windows');
});

test('parseNodeMajor detecta major correctamente', () => {
  assert.equal(parseNodeMajor('v24.11.1'), 24);
  assert.equal(parseNodeMajor('25.0.0'), 25);
  assert.equal(parseNodeMajor('unknown'), 0);
});

test('env-doctor wsl exitoso con runtime y docker operativos', () => {
  const run = buildRunner({
    'npm -v': '11.4.0',
    'docker version --format "{{.Client.Version}}"': '26.1.4',
    'docker version --format "{{.Server.Version}}"': '26.1.4',
    'docker compose version': 'Docker Compose version v2.27.1',
    'npx playwright install --list': playwrightBrowsers,
    [`"${process.execPath}" "${path.join(root, 'scripts', 'docker-runtime-check.mjs')}"`]: JSON.stringify({
      runtime: 'linux-engine',
      docker: { daemonAvailable: true }
    })
  });

  const report = evaluateEnvDoctor({
    target: 'wsl',
    platform: 'linux',
    env: { WSL_DISTRO_NAME: 'Ubuntu', WSL_INTEROP: '/run/WSL/9_interop' },
    nodeVersion: '24.11.1',
    readFile: () => '5.15.167.4-microsoft-standard-WSL2',
    run
  });

  assert.equal(report.ok, true);
  assert.equal(report.target, 'wsl');
  assert.equal(report.failures.length, 0);
  assert.equal(report.checks.some((item) => item.id === 'docker.runtime.report' && item.status === 'ok'), true);
});

test('env-doctor falla por node menor a 24', () => {
  const run = buildRunner({
    'npm -v': '10.9.0',
    'docker version --format "{{.Client.Version}}"': '26.0.0',
    'docker version --format "{{.Server.Version}}"': '26.0.0',
    'docker compose version': 'Docker Compose version v2.26.0',
    'npx playwright install --list': playwrightBrowsers,
    [`"${process.execPath}" "${path.join(root, 'scripts', 'docker-runtime-check.mjs')}"`]: JSON.stringify({
      runtime: 'linux-engine',
      docker: { daemonAvailable: true }
    })
  });

  const report = evaluateEnvDoctor({
    target: 'wsl',
    platform: 'linux',
    env: { WSL_DISTRO_NAME: 'Ubuntu' },
    nodeVersion: '23.9.0',
    readFile: () => '5.15.167.4-microsoft-standard-WSL2',
    run
  });

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((item) => item.id === 'node.version'), true);
});

test('env-doctor falla cuando docker daemon no responde', () => {
  const run = buildRunner({
    'npm -v': '11.4.0',
    'docker version --format "{{.Client.Version}}"': '26.1.4',
    'docker version --format "{{.Server.Version}}"': { ok: false, stdout: '' },
    'docker compose version': 'Docker Compose version v2.27.1',
    'npx playwright install --list': playwrightBrowsers,
    [`"${process.execPath}" "${path.join(root, 'scripts', 'docker-runtime-check.mjs')}"`]: JSON.stringify({
      runtime: 'wsl2-detected-no-daemon',
      docker: { daemonAvailable: false }
    })
  });

  const report = evaluateEnvDoctor({
    target: 'wsl',
    platform: 'linux',
    env: { WSL_DISTRO_NAME: 'Ubuntu' },
    nodeVersion: '24.11.1',
    readFile: () => '5.15.167.4-microsoft-standard-WSL2',
    run
  });

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((item) => item.id === 'docker.daemon'), true);
});

test('env-doctor windows acepta Docker operativo dentro de WSL2 aunque no exista CLI host', () => {
  const run = buildRunner({
    'wsl --status': 'Distribucion predeterminada: Ubuntu',
    'npm -v': '11.4.0',
    'docker version --format "{{.Client.Version}}"': { ok: false, stdout: '' },
    'docker version --format "{{.Server.Version}}"': { ok: false, stdout: '' },
    'docker compose version': { ok: false, stdout: '' },
    'npx playwright install --list': playwrightBrowsers,
    [`"${process.execPath}" "${path.join(root, 'scripts', 'docker-runtime-check.mjs')}"`]: JSON.stringify({
      runtime: 'wsl2-engine',
      docker: {
        clientVersion: '29.4.0',
        serverVersion: '29.4.0',
        daemonAvailable: true,
        context: 'default',
        composeVersion: 'Docker Compose version v2.40.3'
      },
      windows: {
        desktopInstalled: false,
        wslStatus: 'Distribucion predeterminada: Ubuntu',
        wslDistros: '* Ubuntu Running 2'
      }
    })
  });

  const report = evaluateEnvDoctor({
    target: 'windows',
    platform: 'win32',
    env: {},
    nodeVersion: '24.11.1',
    readFile: () => '',
    run
  });

  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
  assert.equal(report.checks.some((item) => item.id === 'docker.cli' && item.status === 'ok'), true);
  assert.equal(report.checks.some((item) => item.id === 'docker.daemon' && item.status === 'ok'), true);
  assert.equal(report.checks.some((item) => item.id === 'docker.compose' && item.status === 'ok'), true);
});

test('env-doctor falla cuando falta browser Chromium de Playwright para QA GUI', () => {
  const run = buildRunner({
    'wsl --status': 'Distribucion predeterminada: Ubuntu',
    'npm -v': '11.4.0',
    'docker version --format "{{.Client.Version}}"': '26.1.4',
    'docker version --format "{{.Server.Version}}"': '26.1.4',
    'docker compose version': 'Docker Compose version v2.27.1',
    'npx playwright install --list': 'Playwright version: 1.58.2\n  Browsers:\n    ffmpeg-1011',
    [`"${process.execPath}" "${path.join(root, 'scripts', 'docker-runtime-check.mjs')}"`]: JSON.stringify({
      runtime: 'desktop',
      docker: { daemonAvailable: true }
    })
  });

  const report = evaluateEnvDoctor({
    target: 'windows',
    platform: 'win32',
    env: {},
    nodeVersion: '24.11.1',
    readFile: () => '',
    run
  });

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((item) => item.id === 'playwright.chromium'), true);
});

test('env-doctor falla por plataforma incorrecta para target windows', () => {
  const run = buildRunner({
    'wsl --status': { ok: false, stdout: '' },
    'npm -v': '11.4.0',
    'docker version --format "{{.Client.Version}}"': '26.1.4',
    'docker version --format "{{.Server.Version}}"': '26.1.4',
    'docker compose version': 'Docker Compose version v2.27.1',
    'npx playwright install --list': playwrightBrowsers,
    [`"${process.execPath}" "${path.join(root, 'scripts', 'docker-runtime-check.mjs')}"`]: JSON.stringify({
      runtime: 'desktop',
      docker: { daemonAvailable: true }
    })
  });

  const report = evaluateEnvDoctor({
    target: 'windows',
    platform: 'linux',
    env: {},
    nodeVersion: '24.11.1',
    readFile: () => '5.15.167.4-microsoft-standard-WSL2',
    run
  });

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((item) => item.id === 'platform.windows'), true);
});

test('contrato de salida mantiene llaves principales', () => {
  const run = buildRunner({
    'npm -v': '11.4.0',
    'docker version --format "{{.Client.Version}}"': '26.1.4',
    'docker version --format "{{.Server.Version}}"': '26.1.4',
    'docker compose version': 'Docker Compose version v2.27.1',
    'npx playwright install --list': playwrightBrowsers,
    [`"${process.execPath}" "${path.join(root, 'scripts', 'docker-runtime-check.mjs')}"`]: JSON.stringify({
      runtime: 'linux-engine',
      docker: { daemonAvailable: true }
    })
  });

  const report = evaluateEnvDoctor({
    target: 'wsl',
    platform: 'linux',
    env: { WSL_DISTRO_NAME: 'Ubuntu' },
    nodeVersion: '24.11.1',
    readFile: () => '5.15.167.4-microsoft-standard-WSL2',
    run
  });

  assert.deepEqual(
    Object.keys(report).sort(),
    ['checks', 'failures', 'ok', 'platform', 'runtime', 'target', 'warnings']
  );
});

test('regresion: contrato docker runtime check no se altera', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['docker:runtime:check'], 'node scripts/docker-runtime-check.mjs');
});
