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

function runWsl(command, fallback = '') {
  if (process.platform !== 'win32') return fallback;
  const escaped = String(command || '').replaceAll('"', '\\"');
  return run(`wsl -- sh -lc "${escaped}"`, fallback, 5000);
}

const preferredRuntime = String(process.env.EVALUAPRO_DOCKER_RUNTIME || 'auto').trim() || 'auto';
let clientVersion = run('docker version --format "{{.Client.Version}}"');
let serverVersion = run('docker version --format "{{.Server.Version}}"');
let context = run('docker context show');
let composeVersion = run('docker compose version');
const wslStatus = process.platform === 'win32' ? run('wsl --status') : '';
const wslDistros = process.platform === 'win32' ? run('wsl -l -v') : '';
const desktopInstalled = detectDesktopInstalled();
let daemonAvailable = Boolean(serverVersion);

if (process.platform === 'win32' && !daemonAvailable && (wslStatus || wslDistros)) {
  const wslClientVersion = runWsl("docker version --format '{{.Client.Version}}'");
  const wslServerVersion = runWsl("docker version --format '{{.Server.Version}}'");
  const wslContext = runWsl('docker context show');
  const wslComposeVersion = runWsl('docker compose version');

  if (wslClientVersion) clientVersion = wslClientVersion;
  if (wslServerVersion) serverVersion = wslServerVersion;
  if (wslContext) context = wslContext;
  if (wslComposeVersion) composeVersion = wslComposeVersion;
  daemonAvailable = Boolean(serverVersion);
}

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
