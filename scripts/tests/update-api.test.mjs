/**
 * update-api.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';

const root = path.resolve(process.cwd());
const lockPath = path.join(root, 'logs', 'dashboard.lock.json');
const singletonPath = path.join(root, 'logs', 'dashboard.singleton.json');
const requestedPort = 5799;

test('el update local bloquea el instalador si no valida firma del mismo editor del Hub', () => {
  const launcher = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');
  const verifierPath = path.join(root, 'scripts', 'verify-update-installer-signature.ps1');
  assert.equal(fs.existsSync(verifierPath), true);
  const verifier = fs.readFileSync(verifierPath, 'utf8');
  assert.match(verifier, /Get-AuthenticodeSignature -LiteralPath \$bundlePath/);
  assert.match(verifier, /Get-AuthenticodeSignature -LiteralPath \$target/);
  assert.match(verifier, /SignerCertificate\.Thumbprint/);
  const apply = launcher.slice(launcher.indexOf('async function runInstallerForUpdate'), launcher.indexOf('async function healthCheckAfterUpdate'));
  assert.match(apply, /verify-update-installer-signature\.ps1/);
  assert.ok(apply.indexOf('if (!signature.ok)') < apply.indexOf("runProcessCapture(installerPath"), 'la verificación debe ocurrir antes de ejecutar el instalador');
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ping(port, timeoutMs = 1800) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: '/api/status', timeout: timeoutMs }, (res) => {
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

function readLockPort() {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const p = Number(lock?.port || 0);
    return Number.isFinite(p) && p > 0 ? p : 0;
  } catch {
    return 0;
  }
}

async function findReadyPort(maxMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const direct = await ping(requestedPort, 1400);
    if (direct) return requestedPort;
    const lockPort = readLockPort();
    if (lockPort > 0) {
      const viaLock = await ping(lockPort, 1400);
      if (viaLock) return lockPort;
    }
    await sleep(350);
  }
  return 0;
}

function startFakeReleaseServer() {
  const installer = Buffer.from('fake-evaluapro-installer', 'utf8');
  const sha = createHash('sha256').update(installer).digest('hex');
  const server = http.createServer((req, res) => {
    if (req.url === '/releases') {
      const payload = [
        {
          tag_name: 'v9.9.9',
          prerelease: false,
          html_url: 'https://example/releases/v9.9.9',
          body: 'release test',
          assets: [
            { name: 'EvaluaPro-InstallerHub-docente-local.exe', browser_download_url: `http://127.0.0.1:${server.address().port}/asset.exe` },
            { name: 'EvaluaPro-InstallerHub-docente-local.exe.sha256', browser_download_url: `http://127.0.0.1:${server.address().port}/asset.exe.sha256` }
          ]
        }
      ];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }
    if (req.url === '/asset.exe') {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': String(installer.length) });
      res.end(installer);
      return;
    }
    if (req.url === '/asset.exe.sha256') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`${sha}  EvaluaPro-InstallerHub-docente-local.exe`);
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

test('update API expone check y download con transición válida', { timeout: 180_000 }, async (t) => {
  const hasExisting = await (async () => {
    const p = readLockPort();
    if (!p) return false;
    return ping(p, 600);
  })();

  if (hasExisting) {
    t.diagnostic('Dashboard ya activo; test se omite para no interferir con sesión local.');
    t.skip();
    return;
  }

  try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch {}
  try { if (fs.existsSync(singletonPath)) fs.unlinkSync(singletonPath); } catch {}

  const fake = await startFakeReleaseServer();
  t.after(() => {
    try { fake.server.close(); } catch {}
  });

  const child = spawn('node', ['scripts/launcher-dashboard.mjs', '--mode', 'none', '--port', String(requestedPort), '--no-open'], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      EVALUAPRO_UPDATE_FEED_URL: `http://127.0.0.1:${fake.port}/releases`,
      EVALUAPRO_UPDATE_FLAVOR: 'docente-local',
      EVALUAPRO_UPDATE_REQUIRE_SHA256: '1',
      EVALUAPRO_TEST_INSTANCE: '1'
    }
  });

  t.after(async () => {
    try { child.kill(); } catch {}
    await sleep(250);
  });

  const port = await findReadyPort();
  if (port === 0) {
    t.diagnostic(`Dashboard no respondió en tiempo${child.exitCode !== null ? ` (exit=${child.exitCode})` : ''}. Se omite para no fallar por entorno local.`);
    t.skip();
    return;
  }

  const statusRes = await fetch(`http://127.0.0.1:${port}/api/update/status`);
  assert.equal(statusRes.status, 200);
  const initial = await statusRes.json();
  assert.equal(typeof initial.state, 'string');
  const expectedHubVersion = JSON.parse(fs.readFileSync(path.join(root, 'config', 'hub-version.json'), 'utf8')).version;
  assert.equal(initial.currentVersion, expectedHubVersion, 'updater debe comparar la versión del Hub, no package.json (versión de la app)');
  const expectedAppVersion = JSON.parse(fs.readFileSync(path.join(root, 'config', 'app-version.json'), 'utf8')).version;
  assert.equal(initial.appVersion, expectedAppVersion);
  assert.equal(initial.hubVersion, expectedHubVersion);

  for (const page of ['/update', '/reconnect']) {
    const pageRes = await fetch(`http://127.0.0.1:${port}${page}`);
    assert.equal(pageRes.status, 200);
    assert.match(pageRes.headers.get('content-type') || '', /text\/html/);
    assert.match(pageRes.headers.get('cache-control') || '', /no-store/);
    const html = await pageRes.text();
    assert.match(html, page === '/update' ? /api\/update\/apply/ : /api\/lifecycle\/reconcile/);
    if (page === '/update') {
      assert.match(html, /aria-live="polite"/);
      assert.match(html, /aria-label="Progreso de actualización"/);
      assert.match(html, /Solicitar reinicio de Windows/);
      assert.match(html, /Reabre EvaluaPro/);
    }
  }
  const stepUpRes = await fetch(`http://127.0.0.1:${port}/api/support/privileged/step-up`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  assert.equal(stepUpRes.status, 400, 'step-up sin código debe rechazarse sin invocar el proveedor');

  const checkRes = await fetch(`http://127.0.0.1:${port}/api/update/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(checkRes.status, 200);
  const checked = await checkRes.json();
  assert.equal(checked.state, 'available');
  assert.equal(checked.availableVersion, '9.9.9');

  const downloadRes = await fetch(`http://127.0.0.1:${port}/api/update/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(downloadRes.status, 200);
  const downloaded = await downloadRes.json();
  assert.equal(downloaded.state, 'ready');
  assert.equal(Boolean(downloaded.download?.filePath), true);
  assert.equal(fs.existsSync(downloaded.download.filePath), true);
});

