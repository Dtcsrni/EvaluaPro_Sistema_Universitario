import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const downloader = path.join(root, 'scripts', 'ci', 'download-github-release-asset.ps1');
const source = await fs.readFile(downloader, 'utf8');

function runPowerShell(args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', args, options);
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => child.kill(), 120_000);
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (status, signal) => {
      clearTimeout(timeout);
      resolve({ status, signal, stdout, stderr });
    });
  });
}

test('release downloader has resume, bounded retry, progress, and redirect-safe auth contracts', () => {
  assert.match(source, /--continue-at',\s*'-'/);
  assert.match(source, /MaxAttempts = 5/);
  assert.match(source, /AttemptTimeoutSeconds = 1800/);
  assert.match(source, /--progress-bar/);
  assert.match(source, /--speed-limit', '1024', '--speed-time', '120'/);
  assert.match(source, /--write-out/);
  assert.match(source, /SetAccessRuleProtection\(\$true, \$false\)/);
  assert.match(source, /finally\s*\{\s*if \(\$curlConfigPath/);
  assert.doesNotMatch(source, /--location-trusted/);
  assert.match(source, /--proto-redir', '=https'/);
});

test('release downloader resumes a partial asset and verifies its final SHA-256 on Windows', {
  skip: process.platform !== 'win32' ? 'la integración requiere curl.exe y Windows PowerShell' : false,
}, async (t) => {
  const payload = Buffer.from('verified-release-asset-resume-fixture');
  const expectedSha256 = createHash('sha256').update(payload).digest('hex');
  let attempts = 0;
  let rangeSeen;
  const server = createServer((request, response) => {
    attempts += 1;
    const range = request.headers.range;
    if (attempts === 1) {
      assert.equal(range, undefined);
      response.writeHead(200, {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(payload.length),
        'Content-Type': 'application/octet-stream',
      });
      response.write(payload.subarray(0, 8));
      setTimeout(() => response.destroy(), 25);
      return;
    }

    rangeSeen = range;
    const offset = Number(/^bytes=(\d+)-$/.exec(range || '')?.[1]);
    assert.ok(Number.isInteger(offset) && offset > 0 && offset < payload.length, `invalid resume range: ${range}`);
    response.writeHead(206, {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(payload.length - offset),
      'Content-Range': `bytes ${offset}-${payload.length - 1}/${payload.length}`,
      'Content-Type': 'application/octet-stream',
    });
    response.end(payload.subarray(offset));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-release-download-'));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));
  const output = path.join(tempDir, 'asset.bin');
  const uri = `http://127.0.0.1:${server.address().port}/asset.bin`;
  const invocation = await runPowerShell([
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', downloader,
    '-Uri', uri,
    '-Destination', output,
    '-ExpectedLength', String(payload.length),
    '-ExpectedSha256', expectedSha256,
    '-MaxAttempts', '3',
    '-AttemptTimeoutSeconds', '60',
  ], {
    cwd: root,
    env: { ...process.env, RUNNER_TEMP: tempDir, GH_TOKEN: '' },
  });

  assert.equal(invocation.signal, null, `${invocation.stdout}\n${invocation.stderr}`);
  assert.equal(invocation.status, 0, `${invocation.stdout}\n${invocation.stderr}`);
  assert.equal(attempts, 2, `${invocation.stdout}\n${invocation.stderr}`);
  assert.match(rangeSeen || '', /^bytes=\d+-$/);
  assert.deepEqual(await fs.readFile(output), payload);
});
