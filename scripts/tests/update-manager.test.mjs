import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { compareSemver, createUpdateManager, selectLatestRelease } from '../update-manager.mjs';

test('compareSemver respeta precedence con prerelease', () => {
  assert.equal(compareSemver('1.0.0', '1.0.0-beta.1') > 0, true);
  assert.equal(compareSemver('1.2.0', '1.10.0') < 0, true);
  assert.equal(compareSemver('2.0.0-alpha.2', '2.0.0-alpha.10') < 0, true);
});

test('selectLatestRelease detecta error por asset faltante', () => {
  const pick = selectLatestRelease([{
    tag_name: 'v1.1.0',
    prerelease: false,
    assets: [{ name: 'otro.exe', browser_download_url: 'http://example/otro.exe' }]
  }], '1.0.0', { assetName: 'EvaluaPro-Setup.exe' });

  assert.equal(pick.found, false);
  assert.match(String(pick.error || ''), /no incluye asset requerido/i);
});

test('selectLatestRelease en canal beta solo acepta tags beta', () => {
  const releases = [
    {
      tag_name: 'v1.2.0-rc.1',
      prerelease: true,
      assets: [{ name: 'EvaluaPro-Setup.exe', browser_download_url: 'http://example/rc.exe' }]
    },
    {
      tag_name: 'v1.1.0-beta.3',
      prerelease: true,
      assets: [{ name: 'EvaluaPro-Setup.exe', browser_download_url: 'http://example/beta.exe' }]
    },
    {
      tag_name: 'v1.0.1',
      prerelease: false,
      assets: [{ name: 'EvaluaPro-Setup.exe', browser_download_url: 'http://example/stable.exe' }]
    }
  ];

  const pickBeta = selectLatestRelease(releases, '1.0.0', {
    channel: 'beta',
    includePrerelease: true,
    assetName: 'EvaluaPro-Setup.exe'
  });
  assert.equal(pickBeta.found, true);
  assert.equal(pickBeta.candidate.version, '1.1.0-beta.3');

  const pickStable = selectLatestRelease(releases, '1.0.0', {
    channel: 'stable',
    includePrerelease: false,
    assetName: 'EvaluaPro-Setup.exe'
  });
  assert.equal(pickStable.found, true);
  assert.equal(pickStable.candidate.version, '1.0.1');
});

test('download soporta reintentos y valida sha256', async () => {
  let calls = 0;
  const bytes = Buffer.from('installer-bytes', 'utf8');
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');

  const manager = createUpdateManager({
    fetchImpl: async (url) => {
      calls += 1;
      if (String(url).includes('.sha256')) {
        return new Response(`${sha}  EvaluaPro-Setup.exe`, { status: 200 });
      }
      if (String(url).includes('/installer')) {
        if (calls < 3) throw new Error('network down');
        return new Response(bytes, { status: 200, headers: { 'content-length': String(bytes.length) } });
      }
      return new Response('not-found', { status: 404 });
    },
    downloadRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'ep-update-')),
    downloadRetries: 3,
    retryDelayMs: 1,
    requireSha256: true,
    assetName: 'EvaluaPro-Setup.exe',
    sha256AssetName: 'EvaluaPro-Setup.exe.sha256'
  });

  manager.setAvailableForTest({
    version: '1.3.0',
    assetUrl: 'http://test/installer',
    shaUrl: 'http://test/installer.sha256'
  });

  const status = await manager.download();
  assert.equal(status.state, 'ready');
  assert.equal(status.download.sha256Ok, true);
  assert.equal(fs.existsSync(status.download.filePath), true);
});

test('apply ejecuta preflight -> stop -> install -> start -> health', async () => {
  const calls = [];
  const manager = createUpdateManager({
    fetchImpl: async () => new Response(Buffer.from('X'), { status: 200 }),
    downloadRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'ep-update-')),
    preflightSync: async () => {
      calls.push('preflight');
      return { ok: true, backupOk: true, pushOk: true, pullOk: true, details: [] };
    },
    stopTasks: async () => {
      calls.push('stop');
      return { ok: true, runningBefore: ['dev'] };
    },
    runInstaller: async () => {
      calls.push('install');
      return { ok: true };
    },
    startTasks: async () => {
      calls.push('start');
      return { ok: true };
    },
    healthCheck: async () => {
      calls.push('health');
      return { ok: true };
    }
  });

  manager.setAvailableForTest({ version: '1.9.0', assetUrl: 'data:application/octet-stream;base64,WA==' });
  await manager.download();
  const status = await manager.apply();

  assert.equal(status.state, 'idle');
  assert.deepEqual(calls, ['preflight', 'stop', 'install', 'start', 'health']);
});

test('apply bloquea instalación si falla preflight', async () => {
  let installed = false;
  const manager = createUpdateManager({
    fetchImpl: async () => new Response(Buffer.from('X'), { status: 200 }),
    downloadRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'ep-update-')),
    preflightSync: async () => ({ ok: false, error: 'Falló push', backupOk: true, pushOk: false, pullOk: false, details: ['push:502'] }),
    runInstaller: async () => {
      installed = true;
      return { ok: true };
    }
  });

  manager.setAvailableForTest({ version: '1.8.0', assetUrl: 'data:application/octet-stream;base64,WA==' });
  await manager.download();
  const status = await manager.apply();

  assert.equal(status.state, 'error');
  assert.equal(installed, false);
  assert.match(String(status.lastError || ''), /push/i);
});
