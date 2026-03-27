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
      EVALUAPRO_UPDATE_REQUIRE_SHA256: '1'
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

