/**
 * dashboard-repair.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';

const root = path.resolve(process.cwd());
const lockPath = path.join(root, 'logs', 'dashboard.lock.json');
const singletonPath = path.join(root, 'logs', 'dashboard.singleton.json');
const requestedPort = 5699;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ping(port, timeoutMs = 1800) {
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

test('dashboard repair endpoints expose status, run lock and progress', { timeout: 180_000 }, async (t) => {
  const hasExisting = await (async () => {
    const p = readLockPort();
    if (!p) return false;
    return ping(p, 600);
  })();

  if (hasExisting) {
    t.diagnostic('Dashboard ya estaba activo. Se omite para no interferir con sesión del usuario.');
    t.skip();
    return;
  }

  // En pruebas locales pueden quedar locks obsoletos sin instancia viva.
  try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch {}
  try { if (fs.existsSync(singletonPath)) fs.unlinkSync(singletonPath); } catch {}

  const child = spawn('node', ['scripts/launcher-dashboard.mjs', '--mode', 'none', '--port', String(requestedPort), '--no-open', '--verbose'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let childStdout = '';
  let childStderr = '';
  child.stdout?.on('data', (chunk) => { childStdout += String(chunk || ''); });
  child.stderr?.on('data', (chunk) => { childStderr += String(chunk || ''); });

  t.after(async () => {
    try { child.kill(); } catch {}
    await sleep(250);
  });

  const port = await findReadyPort();
  if (!(port > 0)) {
    t.diagnostic(`stdout=${childStdout.slice(-1200)}`);
    t.diagnostic(`stderr=${childStderr.slice(-1200)}`);
  }
  assert.ok(port > 0, 'Dashboard no respondió en tiempo');

  const dashboardStatusRes = await fetch(`http://127.0.0.1:${port}/api/status`);
  assert.equal(dashboardStatusRes.status, 200);
  const dashboardStatus = await dashboardStatusRes.json();
  assert.ok(Array.isArray(dashboardStatus.managedTasks));
  assert.ok(Array.isArray(dashboardStatus.running));

  const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(healthRes.status, 200);
  const healthBody = await healthRes.json();
  assert.ok(healthBody.services && typeof healthBody.services === 'object');
  assert.ok(healthBody.services.mongoLocal && typeof healthBody.services.mongoLocal === 'object');
  assert.equal(typeof healthBody.services.mongoLocal.ok, 'boolean');

  const statusRes = await fetch(`http://127.0.0.1:${port}/api/repair/status`);
  assert.equal(statusRes.status, 200);
  const statusBody = await statusRes.json();
  assert.equal(typeof statusBody.needsRepair, 'boolean');
  assert.ok(Array.isArray(statusBody.issues));

  const cfgGetRes = await fetch(`http://127.0.0.1:${port}/api/config`);
  assert.equal(cfgGetRes.status, 200);
  const cfgGet = await cfgGetRes.json();
  assert.equal(typeof cfgGet.autoRestart, 'boolean');
  assert.equal(typeof cfgGet.showFullLogs, 'boolean');
  assert.equal(typeof cfgGet.autoScroll, 'boolean');
  assert.equal(typeof cfgGet.pauseUpdates, 'boolean');

  const cfgSetRes = await fetch(`http://127.0.0.1:${port}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      showFullLogs: !cfgGet.showFullLogs,
      autoScroll: !cfgGet.autoScroll,
      pauseUpdates: !cfgGet.pauseUpdates
    })
  });
  assert.equal(cfgSetRes.status, 200);
  const cfgSet = await cfgSetRes.json();
  assert.equal(cfgSet.ok, true);
  assert.ok(cfgSet.config && typeof cfgSet.config === 'object');

  const cfgResetRes = await fetch(`http://127.0.0.1:${port}/api/config/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(cfgResetRes.status, 200);
  const cfgReset = await cfgResetRes.json();
  assert.equal(cfgReset.ok, true);
  assert.ok(cfgReset.config && typeof cfgReset.config === 'object');
  assert.ok(cfgReset.defaults && typeof cfgReset.defaults === 'object');

  const supportStatusRes = await fetch(`http://127.0.0.1:${port}/api/support/privileged/status`);
  assert.equal(supportStatusRes.status, 200);
  const supportStatus = await supportStatusRes.json();
  assert.equal(supportStatus.ok, true);
  assert.equal(supportStatus.authorization.active, false);
  assert.deepEqual(
    supportStatus.authorization.allowlist.sort(),
    ['hub-install', 'hub-repair', 'hub-uninstall', 'hub-update-apply'].sort()
  );

  const supportDeniedRes = await fetch(`http://127.0.0.1:${port}/api/support/privileged/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'hub-repair' })
  });
  assert.equal(supportDeniedRes.status, 403);
  const supportDenied = await supportDeniedRes.json();
  assert.equal(supportDenied.error, 'step_up_required');

  const run1Res = await fetch(`http://127.0.0.1:${port}/api/repair/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(run1Res.status, 200);
  const run1 = await run1Res.json();
  assert.equal(run1.ok, true);
  assert.equal(typeof run1.runId, 'string');
  assert.ok(run1.runId.length > 0);

  const run2Res = await fetch(`http://127.0.0.1:${port}/api/repair/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(run2Res.status, 409);

  let finalState = '';
  for (let i = 0; i < 120; i += 1) {
    const progressRes = await fetch(`http://127.0.0.1:${port}/api/repair/progress`);
    assert.equal(progressRes.status, 200);
    const progress = await progressRes.json();
    assert.equal(typeof progress.state, 'string');
    assert.ok(Array.isArray(progress.steps));
    assert.equal(typeof progress.percent, 'number');

    finalState = progress.state;
    if (progress.state !== 'running') break;
    await sleep(1000);
  }

  assert.ok(['ok', 'error', 'idle'].includes(finalState), `Estado final inesperado: ${finalState}`);
});
