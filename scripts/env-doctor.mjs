/**
 * env-doctor
 *
 * Responsabilidad: Validar prerequisitos operativos por entorno (WSL2 o Windows)
 * para detectar desalineaciones tempranas de Node y runtime Docker.
 * Limites: No modifica estado; solo inspecciona comandos y contexto.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv = process.argv.slice(2)) {
  const defaults = { target: 'auto' };
  const next = { ...defaults };
  for (const raw of argv) {
    const arg = String(raw || '').trim();
    if (!arg) continue;
    if (arg.startsWith('--target=')) {
      const value = arg.slice('--target='.length).trim().toLowerCase();
      if (value) next.target = value;
    }
  }
  return next;
}

function resolveTarget(target, platform) {
  const raw = String(target || 'auto').trim().toLowerCase();
  if (raw === 'wsl' || raw === 'windows') return raw;
  return platform === 'win32' ? 'windows' : 'wsl';
}

function parseNodeMajor(version) {
  const raw = String(version || '').trim().replace(/^v/i, '');
  const major = Number.parseInt(raw.split('.')[0] || '', 10);
  return Number.isFinite(major) ? major : 0;
}

function hasPlaywrightChromium(stdout) {
  const raw = String(stdout || '');
  return /chromium-\d+/i.test(raw) && /chromium_headless_shell-\d+/i.test(raw);
}

function execCommand(command) {
  try {
    const stdout = execSync(command, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    return { ok: true, stdout };
  } catch {
    return { ok: false, stdout: '' };
  }
}

function detectWslContext(env, readFile, run) {
  const envMap = env || {};
  const osRelease = (() => {
    try {
      return String(readFile('/proc/sys/kernel/osrelease', 'utf8') || '').trim();
    } catch {
      return '';
    }
  })();
  const uname = run('uname -r');
  const joinedKernel = `${osRelease} ${uname.ok ? uname.stdout : ''}`.toLowerCase();
  const isWsl = Boolean(envMap.WSL_DISTRO_NAME || envMap.WSL_INTEROP || joinedKernel.includes('microsoft'));
  const isWsl2 = isWsl && joinedKernel.includes('wsl2');
  return {
    isWsl,
    isWsl2,
    kernel: joinedKernel || 'unknown'
  };
}

function loadDockerRuntimeReport(run, nodeExecutable) {
  const scriptPath = path.join(__dirname, 'docker-runtime-check.mjs');
  const command = `"${nodeExecutable}" "${scriptPath}"`;
  const result = run(command, { JSON: '1' });
  if (!result.ok || !result.stdout) {
    return { ok: false, payload: null };
  }
  try {
    return { ok: true, payload: JSON.parse(result.stdout) };
  } catch {
    return { ok: false, payload: null };
  }
}

function evaluateEnvDoctor(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const nodeVersion = options.nodeVersion || process.versions.node;
  const readFile = options.readFile || fs.readFileSync;
  const run = options.run || ((command, extraEnv = null) => {
    try {
      const stdout = execSync(command, {
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
        timeout: 6000,
        env: extraEnv ? { ...process.env, ...extraEnv } : process.env
      }).trim();
      return { ok: true, stdout };
    } catch {
      return { ok: false, stdout: '' };
    }
  });
  const target = resolveTarget(options.target || 'auto', platform);

  const checks = [];
  const failures = [];
  const warnings = [];

  const pushCheck = (status, id, message, details = '') => {
    const item = { status, id, message, details };
    checks.push(item);
    if (status === 'fail') failures.push(item);
    if (status === 'warn') warnings.push(item);
  };

  if (target === 'wsl') {
    if (platform !== 'linux') {
      pushCheck('fail', 'platform.wsl', 'El target wsl requiere ejecutar este comando dentro de WSL/Linux.', `platform=${platform}`);
    } else {
      pushCheck('ok', 'platform.wsl', 'Plataforma Linux detectada.', `platform=${platform}`);
    }

    const wsl = detectWslContext(env, readFile, execCommand);
    if (!wsl.isWsl2) {
      pushCheck('fail', 'wsl2.required', 'No se detecta WSL2 activo.', `kernel=${wsl.kernel}`);
    } else {
      pushCheck('ok', 'wsl2.required', 'WSL2 activo detectado.', `kernel=${wsl.kernel}`);
    }
  } else {
    if (platform !== 'win32') {
      pushCheck('fail', 'platform.windows', 'El target windows requiere ejecutarse desde host Windows (PowerShell o CMD).', `platform=${platform}`);
    } else {
      pushCheck('ok', 'platform.windows', 'Plataforma Windows detectada.', `platform=${platform}`);
    }

    const wslStatus = run('wsl --status');
    if (!wslStatus.ok || !wslStatus.stdout) {
      pushCheck('fail', 'wsl.status', 'No fue posible consultar `wsl --status`.', 'Instala/activa WSL2 y valida desde PowerShell.');
    } else {
      pushCheck('ok', 'wsl.status', '`wsl --status` accesible.', wslStatus.stdout.split('\n')[0] || 'ok');
    }
  }

  const nodeMajor = parseNodeMajor(nodeVersion);
  if (nodeMajor < 24) {
    pushCheck('fail', 'node.version', 'Node.js no cumple el minimo requerido (>=24).', `node=${nodeVersion || 'unknown'}`);
  } else {
    pushCheck('ok', 'node.version', 'Node.js cumple version minima.', `node=${nodeVersion}`);
  }

  const npmVersion = run('npm -v');
  if (!npmVersion.ok || !npmVersion.stdout) {
    pushCheck('fail', 'npm.available', 'No se detecta npm en PATH.', 'Verifica instalacion de Node y variables PATH.');
  } else {
    pushCheck('ok', 'npm.available', 'npm disponible.', `npm=${npmVersion.stdout}`);
  }

  const playwrightBrowsers = run('npx playwright install --list');
  if (!playwrightBrowsers.ok || !hasPlaywrightChromium(playwrightBrowsers.stdout)) {
    pushCheck(
      'fail',
      'playwright.chromium',
      'No se detecta Chromium + Headless Shell de Playwright para QA GUI.',
      'Ejecuta `npx playwright install chromium` en el repo.'
    );
  } else {
    pushCheck('ok', 'playwright.chromium', 'Browser Chromium de Playwright disponible.', 'GUI responsive/e2e listo.');
  }

  const runtimeReport = loadDockerRuntimeReport(run, process.execPath);
  const runtimePayload = runtimeReport.ok ? runtimeReport.payload : null;
  const runtimeDocker = runtimePayload?.docker || null;
  const runtimeName = String(runtimePayload?.runtime || '');
  const windowsWslDockerReady = target === 'windows'
    && runtimeName === 'wsl2-engine'
    && Boolean(runtimeDocker?.clientVersion && runtimeDocker?.clientVersion !== 'unknown')
    && Boolean(runtimeDocker?.serverVersion && runtimeDocker?.serverVersion !== 'unknown')
    && Boolean(runtimeDocker?.daemonAvailable)
    && Boolean(runtimeDocker?.composeVersion && runtimeDocker?.composeVersion !== 'unknown');

  const dockerClient = run('docker version --format "{{.Client.Version}}"');
  if (dockerClient.ok && dockerClient.stdout) {
    pushCheck('ok', 'docker.cli', 'Docker CLI disponible.', `client=${dockerClient.stdout}`);
  } else if (windowsWslDockerReady) {
    pushCheck('ok', 'docker.cli', 'Docker CLI disponible via WSL2.', `client=${runtimeDocker.clientVersion}`);
  } else {
    pushCheck('fail', 'docker.cli', 'No se detecta Docker CLI operativo.', 'Instala o corrige runtime Docker compatible.');
  }

  const dockerServer = run('docker version --format "{{.Server.Version}}"');
  if (dockerServer.ok && dockerServer.stdout) {
    pushCheck('ok', 'docker.daemon', 'Docker daemon operativo.', `server=${dockerServer.stdout}`);
  } else if (windowsWslDockerReady) {
    pushCheck('ok', 'docker.daemon', 'Docker daemon operativo via WSL2.', `server=${runtimeDocker.serverVersion}`);
  } else {
    pushCheck('fail', 'docker.daemon', 'Docker daemon no responde.', 'Inicia Docker Engine/Daemon y vuelve a intentar.');
  }

  const dockerCompose = run('docker compose version');
  if (dockerCompose.ok && dockerCompose.stdout) {
    pushCheck('ok', 'docker.compose', 'docker compose disponible.', dockerCompose.stdout.split('\n')[0] || 'ok');
  } else if (windowsWslDockerReady) {
    pushCheck('ok', 'docker.compose', 'docker compose disponible via WSL2.', String(runtimeDocker.composeVersion).split('\n')[0] || 'ok');
  } else {
    pushCheck('fail', 'docker.compose', 'No se detecta `docker compose`.', 'Actualiza Docker CLI a una version con Compose v2.');
  }

  if (!runtimePayload) {
    pushCheck('warn', 'docker.runtime.report', 'No se pudo parsear salida de `docker:runtime:check`.', 'Continuar con verificaciones directas.');
  } else {
    pushCheck('ok', 'docker.runtime.report', 'Reporte de runtime Docker obtenido.', `runtime=${runtimeName || 'unknown'}`);
  }

  const report = {
    ok: failures.length === 0,
    target,
    platform,
    checks,
    failures,
    warnings
  };

  if (runtimePayload) {
    report.runtime = runtimePayload;
  }

  return report;
}

function printReport(report) {
  const lines = [
    `[env-doctor] target=${report.target} platform=${report.platform}`,
    `[env-doctor] checks=${report.checks.length} failures=${report.failures.length} warnings=${report.warnings.length}`
  ];
  for (const check of report.checks) {
    const prefix = check.status === 'ok' ? 'OK' : (check.status === 'warn' ? 'WARN' : 'FAIL');
    const detail = check.details ? ` | ${check.details}` : '';
    lines.push(`[${prefix}] ${check.id}: ${check.message}${detail}`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = evaluateEnvDoctor({ target: args.target });
  printReport(report);
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export {
  evaluateEnvDoctor,
  hasPlaywrightChromium,
  parseNodeMajor,
  resolveTarget
};
