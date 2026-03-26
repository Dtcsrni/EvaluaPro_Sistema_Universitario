/**
 * docker-runtime-check
 *
 * Responsabilidad: Detectar y resumir el runtime Docker operativo del host.
 * Limites: No modifica estado; solo inspecciona CLI, contexto y WSL cuando aplica.
 */
import { execSync } from 'node:child_process';

function run(command, fallback = '', timeoutMs = 2500) {
  try {
    return execSync(command, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: timeoutMs
    }).trim();
  } catch {
    return fallback;
  }
}

function truthyEnv(name, fallback = '') {
  const raw = String(process.env[name] ?? fallback).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function detectDesktopInstalled() {
  if (process.platform !== 'win32') return false;
  const checks = [
    'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Docker Desktop" /v DisplayName',
    'reg query "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Docker Desktop" /v DisplayName'
  ];
  return checks.some((command) => Boolean(run(command)));
}

const preferredRuntime = String(process.env.EVALUAPRO_DOCKER_RUNTIME || 'auto').trim() || 'auto';
const clientVersion = run('docker version --format "{{.Client.Version}}"');
const serverVersion = run('docker version --format "{{.Server.Version}}"');
const context = run('docker context show');
const composeVersion = run('docker compose version');
const wslStatus = process.platform === 'win32' ? run('wsl --status') : '';
const wslDistros = process.platform === 'win32' ? run('wsl -l -v') : '';
const desktopInstalled = detectDesktopInstalled();
const daemonAvailable = Boolean(serverVersion);

let runtime = 'unknown';
if (daemonAvailable) {
  if (context === 'desktop-linux' || desktopInstalled) runtime = 'desktop';
  else if (process.platform === 'win32') runtime = 'wsl2-engine';
  else runtime = 'linux-engine';
} else if (desktopInstalled) {
  runtime = 'desktop-installed-not-running';
} else if (process.platform === 'win32' && (wslStatus || wslDistros)) {
  runtime = 'wsl2-detected-no-daemon';
}

const payload = {
  preferredRuntime,
  runtime,
  docker: {
    clientVersion: clientVersion || 'unknown',
    serverVersion: serverVersion || 'unknown',
    daemonAvailable,
    context: context || 'unknown',
    composeVersion: composeVersion || 'unknown'
  },
  windows: process.platform === 'win32' ? {
    desktopInstalled,
    wslStatus: wslStatus || 'unknown',
    wslDistros: wslDistros || 'unknown'
  } : undefined
};

if (truthyEnv('JSON', '1')) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  process.stdout.write(`runtime=${payload.runtime}\n`);
  process.stdout.write(`context=${payload.docker.context}\n`);
  process.stdout.write(`client=${payload.docker.clientVersion}\n`);
  process.stdout.write(`server=${payload.docker.serverVersion}\n`);
}
