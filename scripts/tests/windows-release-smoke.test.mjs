import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const brokerPath = path.join(root, 'scripts', 'launcher-broker.ps1');
const installerHubPath = path.join(root, 'scripts', 'installer-hub', 'InstallerHub.ps1');
const prereqDetectorModulePath = path.join(root, 'scripts', 'installer-hub', 'modules', 'PrereqDetector.psm1');
const manifestPath = path.join(root, 'logs', 'installation.manifest.json');
const lockPath = path.join(root, 'logs', 'dashboard.lock.json');

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
    const stdout = execFileSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...args], {
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
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) return {};
    return JSON.parse(text.slice(start, end + 1));
  }
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

async function startMockLicenseApi() {
  const tenantId = 'tenant-smoke';
  const activationCode = 'code-smoke';
  const tokenLicencia = 'header.payload.signature';
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/comercial-publico/licencias/activar') {
      let body = '';
      req.on('data', (chunk) => { body += String(chunk || ''); });
      req.on('end', () => {
        let payload = {};
        try { payload = JSON.parse(body || '{}'); } catch {}
        if (String(payload.tenantId || '') !== tenantId || String(payload.codigoActivacion || '') !== activationCode) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'invalid_license_credentials' }));
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          licencia: {
            tokenLicencia,
            canalRelease: 'stable',
            expiraEn: '2099-12-31T23:59:59.000Z',
            graciaOfflineDias: 30
          }
        }));
      });
      return;
    }
    res.statusCode = 404;
    res.end('not_found');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? Number(address.port || 0) : 0;
  if (!port) {
    server.close();
    throw new Error('No se pudo levantar mock de licencia.');
  }
  return {
    tenantId,
    activationCode,
    apiBaseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  };
}

function readLockPort() {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const p = Number(lock?.port || 0);
    return Number.isFinite(p) && p > 0 ? p : 0;
  } catch {
    return 0;
  }
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
      try { req.destroy(); } catch {}
      resolve(false);
    });
  });
}

async function waitForDashboardPort(maxMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const lockPort = readLockPort();
    if (lockPort > 0 && await pingStatus(lockPort, 1_200)) return lockPort;
    await sleep(500);
  }
  return 0;
}

async function waitForHttpPort(port, maxMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (await pingStatus(port, 1_200)) return port;
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
        if (acceptedStates.includes(String(parsed.state || ''))) return parsed;
      } catch {
        // continue
      }
    }
    await sleep(800);
  }
  throw new Error(`Bootstrap state no alcanzo ${acceptedStates.join(', ')} para runId=${runId}`);
}

async function waitForBootstrapFile(runId, maxMs = 30_000) {
  const filePath = path.join(root, 'logs', `bootstrap-state-${runId}.json`);
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (fs.existsSync(filePath)) return filePath;
    await sleep(500);
  }
  throw new Error(`No se genero archivo bootstrap para runId=${runId}`);
}

test('repair headless aislado recupera una instalacion dañada agresivamente', { timeout: 240_000 }, async () => {
  if (process.platform !== 'win32' || !shell) {
    test.skip();
    return;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-release-smoke-'));
  const licenseApi = await startMockLicenseApi();
  const installDir = path.join(tempRoot, 'EvaluaPro');
  const fakeReleaseDir = path.join(tempRoot, 'release');
  const securityDir = path.join(tempRoot, 'security');
  const desktopDir = path.join(tempRoot, 'desktop');
  const startMenuDir = path.join(tempRoot, 'startmenu', 'EvaluaPro');

  fs.mkdirSync(fakeReleaseDir, { recursive: true });
  fs.mkdirSync(securityDir, { recursive: true });
  fs.mkdirSync(desktopDir, { recursive: true });
  fs.mkdirSync(startMenuDir, { recursive: true });

  const fakeMsiPath = path.join(fakeReleaseDir, 'EvaluaPro-docente-local.msi');
  const fakeShaPath = path.join(fakeReleaseDir, 'EvaluaPro-docente-local.msi.sha256');
  fs.writeFileSync(fakeMsiPath, 'fake-msi-for-release-smoke\n', 'utf8');
  fs.writeFileSync(fakeShaPath, `${sha256(fakeMsiPath)}  ${path.basename(fakeMsiPath)}\n`, 'utf8');

  const commonEnv = {
    EVALUAPRO_INSTALLER_ASSUME_INTERNET: '1',
    EVALUAPRO_INSTALLER_RELEASE_MSI_PATH: fakeMsiPath,
    EVALUAPRO_INSTALLER_RELEASE_SHA_PATH: fakeShaPath,
    EVALUAPRO_INSTALLER_RELEASE_TAG: '1.0.0-test',
    EVALUAPRO_INSTALLER_SIMULATE_WSL_BOOTSTRAP: '1',
    EVALUAPRO_INSTALLER_SIMULATE_AUTO_BOOTSTRAP: '1',
    EVALUAPRO_INSTALLER_AUTO_BOOTSTRAP_WSL: '1',
    EVALUAPRO_INSTALLER_SIMULATE_PRODUCT_ACTION: '1',
    EVALUAPRO_INSTALLER_SIMULATE_SOURCE_DIR: root,
    EVALUAPRO_INSTALLER_ALLOW_UNREGISTERED: '1',
    EVALUAPRO_SECURITY_ROOT: securityDir,
    EVALUAPRO_DESKTOP_PATH: desktopDir,
    EVALUAPRO_STARTMENU_PATH: startMenuDir
  };

  try {
    const installRes = runPowerShell([
      '-File', installerHubPath,
      '-Headless',
      '-NoElevation',
      '-Mode', 'install',
      '-FlavorId', 'docente-local',
      '-InstallDir', installDir,
      '-ApiComercialBaseUrl', licenseApi.apiBaseUrl,
      '-TenantId', licenseApi.tenantId,
      '-CodigoActivacion', licenseApi.activationCode,
      '-PasswordResetUrlBase', 'https://localhost/reset'
    ], { env: commonEnv, timeout: 240_000 });
    assert.equal(installRes.status, 0, installRes.stderr || installRes.stdout);
    const installBody = parseJsonOutput(installRes.stdout);
    assert.equal(installBody.ok, true);
    assert.equal(installBody.mode, 'install');

    const manifestFile = path.join(installDir, 'logs', 'installation.manifest.json');
    const brokerFile = path.join(installDir, 'scripts', 'launcher-broker.ps1');
    const trayHiddenFile = path.join(installDir, 'scripts', 'launcher-tray-hidden.vbs');
    const updateConfigFile = path.join(installDir, 'config', 'update-config.json');
    assert.equal(fs.existsSync(manifestFile), true);
    assert.equal(fs.existsSync(brokerFile), true);
    assert.equal(fs.existsSync(trayHiddenFile), true);

    fs.rmSync(manifestFile, { force: true });
    fs.rmSync(brokerFile, { force: true });
    fs.rmSync(trayHiddenFile, { force: true });
    for (const shortcutName of ['EvaluaPro - Dev.lnk', 'EvaluaPro - Prod.lnk', 'EvaluaPro - Hub.lnk']) {
      fs.rmSync(path.join(desktopDir, shortcutName), { force: true });
      fs.rmSync(path.join(startMenuDir, shortcutName), { force: true });
    }
    const corruptedUpdate = JSON.parse(fs.readFileSync(updateConfigFile, 'utf8').replace(/^\uFEFF/, ''));
    corruptedUpdate.flavorId = 'saas-completo';
    corruptedUpdate.assetName = 'wrong-installer.exe';
    fs.writeFileSync(updateConfigFile, `${JSON.stringify(corruptedUpdate, null, 2)}\n`, 'utf8');

    const beforeHealth = runPowerShell([
      '-Command',
      `Import-Module -Force '${prereqDetectorModulePath.replace(/'/g, "''")}'; Get-EvaluaProInstallationHealth -InstallDir '${installDir.replace(/'/g, "''")}' | ConvertTo-Json -Depth 8`
    ], { env: commonEnv });
    assert.equal(beforeHealth.status, 0, beforeHealth.stderr || beforeHealth.stdout);
    const beforeHealthBody = parseJsonOutput(beforeHealth.stdout);
    assert.ok(['degradada', 'dañada'].includes(String(beforeHealthBody.state || '')));
    assert.ok(Array.isArray(beforeHealthBody.issues));
    assert.ok(beforeHealthBody.issues.some((item) => String(item).includes('Falta archivo crítico')));

    const repairRes = runPowerShell([
      '-File', installerHubPath,
      '-Headless',
      '-NoElevation',
      '-Mode', 'repair',
      '-FlavorId', 'docente-local',
      '-InstallDir', installDir,
      '-ApiComercialBaseUrl', licenseApi.apiBaseUrl,
      '-TenantId', licenseApi.tenantId,
      '-CodigoActivacion', licenseApi.activationCode,
      '-PasswordResetUrlBase', 'https://localhost/reset'
    ], { env: commonEnv, timeout: 240_000 });
    assert.equal(repairRes.status, 0, repairRes.stderr || repairRes.stdout);
    const repairBody = parseJsonOutput(repairRes.stdout);
    assert.equal(repairBody.ok, true);
    assert.equal(repairBody.mode, 'repair');

    const afterHealth = runPowerShell([
      '-Command',
      `Import-Module -Force '${prereqDetectorModulePath.replace(/'/g, "''")}'; Get-EvaluaProInstallationHealth -InstallDir '${installDir.replace(/'/g, "''")}' | ConvertTo-Json -Depth 8`
    ], { env: commonEnv });
    assert.equal(afterHealth.status, 0, afterHealth.stderr || afterHealth.stdout);
    const afterHealthBody = parseJsonOutput(afterHealth.stdout);
    assert.equal(afterHealthBody.state, 'ok');

    const manifest = readJson(manifestFile);
    assert.equal(manifest.installation.installed, true);
    assert.equal(manifest.installation.flavor, 'docente-local');

    const repairedUpdate = JSON.parse(fs.readFileSync(updateConfigFile, 'utf8').replace(/^\uFEFF/, ''));
    assert.equal(repairedUpdate.flavorId, 'docente-local');
    assert.equal(repairedUpdate.assetName, 'EvaluaPro-docente-local-Setup.exe');
    assert.equal(fs.existsSync(brokerFile), true);
    assert.equal(fs.existsSync(trayHiddenFile), true);
    for (const shortcutName of ['EvaluaPro - Dev.lnk', 'EvaluaPro - Prod.lnk', 'EvaluaPro - Hub.lnk']) {
      assert.equal(fs.existsSync(path.join(desktopDir, shortcutName)), true);
      assert.equal(fs.existsSync(path.join(startMenuDir, shortcutName)), true);
    }
  } finally {
    await licenseApi.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('smoke activo valida broker, manifest, shortcuts y control plane sin dañar la instalacion real', { timeout: 240_000 }, async () => {
  if (process.platform !== 'win32' || !shell) {
    test.skip();
    return;
  }

  const licenseApi = await startMockLicenseApi();
  const brokerEnv = {
    EVALUAPRO_LICENSE_API_BASE_URL: licenseApi.apiBaseUrl,
    EVALUAPRO_LICENSE_TENANT_ID: licenseApi.tenantId,
    EVALUAPRO_LICENSE_ACTIVATION_CODE: licenseApi.activationCode
  };

  try {
    const verifyRes = runPowerShell([
      '-File', brokerPath,
      '-Action', 'verify-installation',
      '-Mode', 'prod',
      '-Port', '4519',
      '-NoOpen'
    ], { timeout: 120_000, env: brokerEnv });
    assert.equal(verifyRes.status, 0, verifyRes.stderr || verifyRes.stdout);

    const regenerateRes = runPowerShell([
      '-File', brokerPath,
      '-Action', 'regenerate-shortcuts',
      '-Mode', 'prod',
      '-Port', '4519',
      '-NoOpen'
    ], { timeout: 120_000, env: brokerEnv });
    assert.equal(regenerateRes.status, 0, regenerateRes.stderr || regenerateRes.stdout);

    const openRunId = `release-smoke-${Date.now()}`;
    const openRes = runPowerShell([
      '-File', brokerPath,
      '-Action', 'open-dashboard',
      '-Mode', 'prod',
      '-Port', '4519',
      '-RunId', openRunId,
      '-NoOpen'
    ], { timeout: 180_000, env: brokerEnv });
    assert.equal(openRes.status, 0, openRes.stderr || openRes.stdout);

    await waitForBootstrapFile(openRunId, 30_000);
    const bootstrap = await waitForBootstrapState(openRunId, ['healthy', 'degraded'], 60_000);
    assert.equal(bootstrap.desiredMode, 'prod');
    assert.notEqual(bootstrap.state, 'failed');

  const manifest = readJson(manifestPath);
  assert.equal(manifest.installation.installed, true);
  assert.equal(manifest.installation.flavor, 'docente-local');
  assert.equal(manifest.shortcuts.devDesktop.exists, true);
  assert.equal(manifest.shortcuts.prodDesktop.exists, true);
  assert.equal(manifest.shortcuts.hubDesktop.exists, true);
  assert.equal(manifest.shortcuts.devStart.exists, true);
  assert.equal(manifest.shortcuts.prodStart.exists, true);
  assert.equal(manifest.shortcuts.hubStart.exists, true);
  const manifestStepUpMethods = Array.isArray(manifest?.license?.stepUpMethods) ? manifest.license.stepUpMethods : [];
  assert.equal(typeof manifest.license.portableExists, 'boolean');
  assert.equal(typeof manifest.license.stepUpConfigExists, 'boolean');
  assert.ok(Array.isArray(manifestStepUpMethods));
  if (manifest.license.stepUpConfigExists) {
    assert.ok(manifestStepUpMethods.includes('totp'));
    assert.equal(Number(manifest.license.recoveryCodesRemaining) > 0, true);
  }

    const dashboardBase = String(bootstrap.meta?.base || '').trim();
    assert.match(dashboardBase, /^http:\/\/127\.0\.0\.1:\d+$/);
    const status = await httpJson(`${dashboardBase}/api/status`, 15_000);
    assert.equal(status.status, 200);
    assert.equal(typeof status.body.installationState, 'object');
    assert.equal(typeof status.body.shortcutState, 'object');
    assert.equal(typeof status.body.licenseState, 'object');
    assert.equal(typeof status.body.bootstrapState, 'object');
    assert.equal(status.body.lifecycle.desiredMode, 'prod');
    assert.equal(status.body.licenseState.state, manifest.license.portableExists ? 'portable_present' : 'missing');
    assert.equal(status.body.licenseState.portableExists, manifest.license.portableExists);
    if (Object.prototype.hasOwnProperty.call(status.body.licenseState, 'stepUpConfigExists')) {
      assert.equal(status.body.licenseState.stepUpConfigExists, manifest.license.stepUpConfigExists);
    }

    const statusScript = runPowerShell(['-Command', 'npm run status'], { timeout: 120_000, env: brokerEnv });
    assert.equal(statusScript.status, 0, statusScript.stderr || statusScript.stdout);
    assert.match(statusScript.stdout, /Estado API: (UP|DOWN)/);
    assert.match(statusScript.stdout, /Estado Web: (UP|DOWN)/);
    if (bootstrap.state === 'healthy') {
      assert.match(statusScript.stdout, /Estado API: UP/);
      assert.match(statusScript.stdout, /Estado Web: UP/);
    }
  } finally {
    await licenseApi.close();
  }
});
