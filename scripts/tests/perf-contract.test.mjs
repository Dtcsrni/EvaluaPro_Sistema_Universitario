/**
 * perf-contract.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();

test('perf-collect genera reporte estable con backend y portal en Windows/local', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-perf-contract-'));
  const reportPath = path.join(tempDir, 'perf-report.json');

  try {
    execFileSync(
      process.execPath,
      ['--import', 'tsx', path.join(root, 'scripts', 'perf-collect.ts')],
      {
        cwd: root,
        env: {
          ...process.env,
          PERF_ITERATIONS: '10',
          PERF_WARMUP: '1',
          PERF_REPORT_PATH: reportPath,
          EVALUAPRO_LOG_SILENT: '1'
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000
      }
    );

    const payload = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(typeof payload.generatedAt, 'string');
    assert.equal(Array.isArray(payload.results), true);
    assert.equal(payload.results.length >= 8, true);

    const keys = new Set(payload.results.map((item) => `${item.service}|${item.method}|${item.route}`));
    assert.ok(keys.has('backend|GET|/api/salud/live'));
    assert.ok(keys.has('backend|GET|/api/metrics'));
    assert.ok(keys.has('portal|GET|/api/portal/salud/live'));
    assert.ok(keys.has('portal|GET|/api/portal/metrics'));

    for (const item of payload.results) {
      assert.equal(typeof item.iterations, 'number');
      assert.equal(item.iterations >= 10, true);
      assert.equal(typeof item.p95Ms, 'number');
      assert.equal(typeof item.failures, 'number');
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
