/**
 * windows-release-smoke.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import {
  assertBrokerSuccess,
  assertSmokeRuntimeAvailable,
  assertSmokeEnvironmentAvailable,
  cleanupOwnedDashboard,
  createOwnedDashboardIdentity,
  isActiveSmokeEnabled
} from '../testing/windows-release-smoke-ownership.mjs';

const root = process.cwd();
const brokerPath = path.join(root, 'scripts', 'launcher-broker.ps1');
const manifestPath = path.join(root, 'logs', 'installation.manifest.json');
const lockPath = path.join(root, 'logs', 'dashboard.lock.json');
const localPathsManifestPath = path.join(root, 'dist', 'installer', 'installer-local-paths.json');
const internalLocalPathsManifestPath = path.join(root, 'dist', 'installer', '_internal', 'installer-local-paths.json');
const productWxsPath = path.join(root, 'packaging', 'wix', 'Product.wxs');
const bundleWxsPath = path.join(root, 'packaging', 'wix', 'Bundle.wxs');

function getAvailablePowerShell() {
  const candidates = process.platform === 'win32'
    ? ['pwsh.exe', 'pwsh', 'powershell.exe']
    : ['pwsh', 'powershell'];

  for (const command of candidates) {
    try {
      const versionOutput = execFileSync(command, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 12_000
      });
      const major = Number.parseInt(String(versionOutput || '').trim(), 10);
      if (!Number.isFinite(major) || major < 5) continue;
      return command;
    } catch {
      // continue
    }
  }

  return '';
}

const shell = getAvailablePowerShell();

function runPowerShell(args, options = {}) {
  if (!shell) {
    return { skipped: true, stdout: '', stderr: '', status: 0 };
  }

  try {
    let execArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...args];
    if (Array.isArray(args) && args.length > 1 && args[0] === '-Command') {
      execArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${String(args[1])}`];
    }

    const stdout = execFileSync(shell, execArgs, {
      encoding: 'utf8',
      timeout: options.timeout ?? 180_000,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    return { skipped: false, stdout: String(stdout || '').trim(), stderr: '', status: 0 };
  } catch (error) {
    return {
      skipped: false,
      stdout: String(error.stdout || '').trim(),
      stderr: String(error.stderr || '').trim(),
      status: Number(error.status || 1)
    };
  }
}

function parseJsonOutput(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return {};

  function normalizePossiblyMojibake(value) {
    if (value && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        value[key] = normalizePossiblyMojibake(value[key]);
      }
      return value;
    }

    if (typeof value !== 'string') {
      return value;
    }

    if (!/Ã.|Â.|â.|�/.test(value)) {
      return value;
    }

    try {
      const fixed = Buffer.from(value, 'latin1').toString('utf8');
      return fixed.includes('\uFFFD') ? value : fixed;
    } catch {
      return value;
    }
  }

  try {
    return normalizePossiblyMojibake(JSON.parse(text));
  } catch {
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end >= start) {
        return normalizePossiblyMojibake(JSON.parse(text.slice(start, end + 1)));
      }
    } catch {
      // ignore
    }

    try {
      return normalizePossiblyMojibake(JSON.parse(Buffer.from(text, 'latin1').toString('utf8')));
    } catch {
      return {};
    }
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function normalizeManifestPath(value) {
  return String(value || '').replaceAll('\\', '/');
}

function normalizeIconPath(value) {
  return String(value || '').replaceAll('\\', '/').toLowerCase();
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function terminateChild(child, timeoutMs = 5_000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  try { child.kill('SIGTERM'); } catch {
    // El proceso pudo terminar entre la comprobación y el envío de señal.
  }
  const exited = await Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    sleep(timeoutMs).then(() => false)
  ]);
  if (!exited && process.platform === 'win32' && child.pid) {
    try {
      execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        encoding: 'utf8',
        stdio: 'ignore',
        timeout: 10_000
      });
    } catch {
      // El estado de salida se confirma observando el proceso hijo a continuación.
    }
    await Promise.race([
      new Promise((resolve) => child.once('exit', () => resolve(true))),
      sleep(2_000).then(() => false)
    ]);
  }
}

async function httpJson(url, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return { status: res.status, body: await res.json() };
  } finally {
    clearTimeout(timer);
  }
}

function readLockPort() {
  return Number(readDashboardLock()?.port || 0);
}

function readDashboardLock() {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

function probeTcpPort(port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (listening) => {
      socket.destroy();
      resolve(listening);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function readProcessIdentity(pid) {
  const safePid = Number(pid);
  if (!Number.isInteger(safePid) || safePid <= 0) return {};
  const command = `$p = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId=${safePid}" -ErrorAction SilentlyContinue; if ($p) { [pscustomobject]@{ pid=[int]$p.ProcessId; creationDate=[string]$p.CreationDate; commandLine=[string]$p.CommandLine } | ConvertTo-Json -Compress }`;
  const result = runPowerShell(['-Command', command], { timeout: 10_000 });
  return result.status === 0 ? parseJsonOutput(result.stdout) : {};
}

async function waitForOwnedProcessExit(owner, maxMs) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      process.kill(owner.pid, 0);
    } catch (error) {
      if (error?.code === 'ESRCH') return true;
      if (error?.code !== 'EPERM') throw error;
    }
    await sleep(250);
  }
  return false;
}

async function requestDashboardShutdown(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/shutdown`, { method: 'POST', signal: AbortSignal.timeout(5_000) });
  assert.equal(response.status, 202, `El dashboard de smoke no aceptó cierre en puerto ${port}.`);
}

function killOwnedProcessTree(pid) {
  execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
    encoding: 'utf8',
    stdio: 'ignore',
    timeout: 10_000
  });
}

function readBootstrapPort(bootstrap) {
  const base = String(bootstrap?.meta?.base || '').trim();
  const match = /^http:\/\/127\.0\.0\.1:(\d+)$/.exec(base);
  const p = Number(match?.[1] || 0);
  return Number.isFinite(p) && p > 0 ? p : 0;
}

function uniquePositivePorts(values) {
  return [...new Set(values.map((value) => Number(value || 0)).filter((value) => Number.isFinite(value) && value > 0))];
}

async function pingStatus(port, timeoutMs = 1_500) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: '127.0.0.1',
      port,
      path: '/api/status',
      timeout: timeoutMs
    }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      try { req.destroy(); } catch {
        // El socket pudo cerrarse ya al dispararse el timeout.
      }
      resolve(false);
    });
  });
}

async function waitForAnyHttpPort(ports, maxMs = 60_000) {
  const candidates = uniquePositivePorts(ports);
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    for (const port of candidates) {
      if (await pingStatus(port, 1_200)) {
        return port;
      }
    }
    await sleep(400);
  }

  return 0;
}

async function waitForBootstrapState(runId, acceptedStates, maxMs = 180_000) {
  const filePath = path.join(root, 'logs', `bootstrap-state-${runId}.json`);
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (fs.existsSync(filePath)) {
      try {
        const parsed = readJson(filePath);
        if (acceptedStates.includes(String(parsed.state || ''))) {
          return parsed;
        }
      } catch {
        // continue
      }
    }

    await sleep(800);
  }

  throw new Error(`Bootstrap state no alcanzo ${acceptedStates.join(', ')} para runId=${runId}`);
}

function resolveBurnBundlePath() {
  const manifestFile = fs.existsSync(localPathsManifestPath) ? localPathsManifestPath : internalLocalPathsManifestPath;
  if (!fs.existsSync(manifestFile)) {
    return '';
  }

  const manifest = readJson(manifestFile);
  const recommended = String(manifest?.recommended?.bundlePublicPath || '').trim();
  if (recommended && fs.existsSync(recommended)) {
    return recommended;
  }

  const fallback = Array.isArray(manifest?.artifacts)
    ? manifest.artifacts.find((item) => item?.bundlePublicPath && fs.existsSync(item.bundlePublicPath))
    : null;
  return String(fallback?.bundlePublicPath || '').trim();
}

test('parseJsonOutput preserva UTF-8 valido y repara mojibake sin degradar acentos correctos', () => {
  const valid = parseJsonOutput('{"state":"dañada","issues":["Falta archivo crítico"]}');
  assert.equal(valid.state, 'dañada');
  assert.equal(valid.issues[0], 'Falta archivo crítico');

  const mojibake = parseJsonOutput('{"state":"daÃ±ada","issues":["Falta archivo crÃ­tico"]}');
  assert.equal(mojibake.state, 'dañada');
  assert.equal(mojibake.issues[0], 'Falta archivo crítico');
});

test('bundle Burn no duplica el gate Docker del MSI cuando Installer Hub ya valida prerequisitos', () => {
  const productWxs = fs.readFileSync(productWxsPath, 'utf8');
  const bundleWxs = fs.readFileSync(bundleWxsPath, 'utf8');

  assert.match(bundleWxs, /MsiProperty Name="REQUIRE_INSTALLER_HUB" Value="1"/);
  assert.match(productWxs, /SKIP_DOCKER_RUNTIME_CHECK = 1 OR REQUIRE_INSTALLER_HUB = 1 OR BURNMSIINSTALL = 1 OR DOCKERINSTALLED64 OR DOCKERINSTALLEDUSER OR WSLINSTALLED/);
});

test('smoke GUI no destructivo valida el bundle Burn publico empaquetado', { timeout: 120_000 }, async () => {
  if (process.platform !== 'win32' || !shell) {
    test.skip();
    return;
  }

  const exe = resolveBurnBundlePath();
  if (!exe || !fs.existsSync(exe)) {
    test.skip();
    return;
  }

  const child = spawn(exe, ['/repair'], {
    env: {
      ...process.env,
      EVALUAPRO_INSTALLER_SIMULATE_WSL_BOOTSTRAP: '1',
      EVALUAPRO_INSTALLER_SIMULATE_AUTO_BOOTSTRAP: '1',
      EVALUAPRO_INSTALLER_AUTO_BOOTSTRAP_WSL: '1',
      EVALUAPRO_INSTALLER_SIMULATE_PRODUCT_ACTION: '1',
      EVALUAPRO_INSTALLER_ASSUME_INTERNET: '1'
    },
    windowsHide: true,
    stdio: 'ignore'
  });

  await sleep(1800);
  assert.equal(child.exitCode, null, 'El bundle Burn se cerro antes del umbral de smoke.');
  await terminateChild(child);
  assert.equal(child.exitCode !== null || child.signalCode !== null, true);
});

test('smoke activo valida broker, manifest, shortcuts y control plane sin depender del legado', { timeout: 480_000 }, async (t) => {
  if (!isActiveSmokeEnabled(process.env)) {
    test.skip('Requiere opt-in explícito; inicia procesos de la aplicación en modo prod.');
    return;
  }
  assertSmokeRuntimeAvailable({ platform: process.platform, shell });

  const fallbackPorts = Array.from({ length: 20 }, (_, index) => 4519 + index);
  const previousLock = readDashboardLock();
  await assertSmokeEnvironmentAvailable({
    ports: fallbackPorts,
    probePort: probeTcpPort,
    lock: previousLock,
    isProcessAlive: async (pid) => Number(readProcessIdentity(pid)?.pid) === pid
  });

  let ownedDashboard = null;
  t.after(async () => {
    if (!ownedDashboard) return;
    await cleanupOwnedDashboard(ownedDashboard, {
      readProcess: readProcessIdentity,
      readLock: readDashboardLock,
      requestShutdown: requestDashboardShutdown,
      waitForExit: waitForOwnedProcessExit,
      killExactProcess: killOwnedProcessTree
    });
    assert.equal(await probeTcpPort(ownedDashboard.port), false, `El puerto propio ${ownedDashboard.port} quedó activo después del smoke.`);
  });

  const verifyRes = runPowerShell([
    '-File', brokerPath,
    '-Action', 'verify-installation',
    '-Mode', 'prod',
    '-Port', '4519',
    '-NoOpen'
  ], { timeout: 120_000 });
  assertBrokerSuccess(verifyRes, 'verify-installation');

  const openRunId = `release-smoke-${Date.now()}`;
  const openRes = runPowerShell([
    '-File', brokerPath,
    '-Action', 'open-dashboard',
    '-Mode', 'prod',
    '-Port', '4519',
    '-RunId', openRunId,
    '-NoOpen'
  ], { timeout: 300_000 });

  const currentLock = readDashboardLock();
  const processInfo = readProcessIdentity(currentLock?.pid);
  ownedDashboard = createOwnedDashboardIdentity({
    lock: currentLock,
    previousLock,
    processInfo,
    ports: fallbackPorts,
    installRoot: root
  });
  assertBrokerSuccess(openRes, 'open-dashboard');

  const bootstrap = await waitForBootstrapState(openRunId, ['healthy', 'degraded'], 60_000);
  assert.equal(bootstrap.desiredMode, 'prod');
  assert.notEqual(bootstrap.state, 'failed');

  const dashboardBase = String(bootstrap.meta?.base || '').trim();
  assert.match(dashboardBase, /^http:\/\/127\.0\.0\.1:\d+$/);

  const bootstrapPort = readBootstrapPort(bootstrap);
  const lockPort = readLockPort();
  const responsivePort = await waitForAnyHttpPort([bootstrapPort, lockPort, ...fallbackPorts], 90_000);
  assert.ok(responsivePort > 0);

  const manifest = readJson(manifestPath);
  assert.equal(manifest.installation.installed, true);
  assert.equal(manifest.installation.flavor, 'docente-local');
  assert.equal(manifest.installation.runtimeTarget, 'native-node-sqlite');
  assert.equal(typeof manifest.shortcuts, 'object');
  assert.equal(manifest.criticalFiles.some((entry) => normalizeManifestPath(entry.path) === 'scripts/launcher-broker.ps1'), true);
  assert.equal(manifest.criticalFiles.some((entry) => normalizeManifestPath(entry.path).includes('scripts/installer-hub/InstallerHub.ps1')), false);
  assert.equal(typeof manifest.runtime, 'object');
  assert.equal(typeof manifest.runtime.embeddedNode, 'object');
  assert.equal(typeof manifest.runtime.embeddedNode.present, 'boolean');
  assert.match(String(manifest.runtime.embeddedNode.path || ''), /runtime[\\/]+node[\\/]+node\.exe$/i);
  assert.equal(typeof manifest.runtime.wsl, 'object');
  assert.equal(typeof manifest.runtime.wsl.distro, 'string');
  assert.equal(typeof manifest.runtime.wsl.dockerReady, 'boolean');
  for (const shortcut of Object.values(manifest.shortcuts)) {
    const expectedIcon = normalizeIconPath(shortcut?.expectedIconLocation);
    const actualIcon = normalizeIconPath(shortcut?.iconLocation);
    assert.equal(expectedIcon.includes('/appdata/local/evaluapro/icons/'), false);
    assert.match(expectedIcon, /\/scripts\/icons\/.+\.ico$/);
    if (actualIcon) {
      assert.equal(actualIcon.includes('/appdata/local/evaluapro/icons/'), false);
    }
  }

  const status = await httpJson(`http://127.0.0.1:${responsivePort}/api/status`, 15_000);
  assert.equal(status.status, 200);
  assert.equal(status.body.lifecycle.desiredMode, 'prod');
  assert.equal(status.body.flavorPolicy.flavorId, 'docente-local');
  assert.equal(status.body.flavorPolicy.requireLocalPortal, false);
  assert.equal(status.body.flavorPolicy.runtimeTarget, 'native-node-sqlite');
  assert.equal(typeof status.body.installationState, 'object');
  assert.equal(typeof status.body.shortcutState, 'object');
  assert.equal(typeof status.body.licenseState, 'object');
  assert.equal(typeof status.body.bootstrapState, 'object');
});
