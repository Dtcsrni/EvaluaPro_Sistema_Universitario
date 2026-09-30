/**
 * omr.tv4.pilot-real.validator
 *
 * Garantiza que la ausencia de capturas fisicas se registre como
 * not_applicable, sin convertirla en una falsa aprobacion ni en un fallo
 * silencioso del proceso de validacion.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runTv4PilotRealValidation } from '../scripts/omr-tv4-validate-pilot-real.js';

describe('validador piloto real TV4', () => {
  it('persiste not_applicable cuando el dataset no tiene capturas', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-tv4-pilot-'));
    const reportPath = path.join(root, 'reports', 'validation.json');
    const failureReportPath = path.join(root, 'reports', 'failures.json');
    try {
      await fs.writeFile(
        path.join(root, 'manifest.json'),
        JSON.stringify({
          version: '1',
          datasetType: 'tv4_pilot_real',
          templateVersion: 4,
          thresholds: {
            precisionMin: 0.98,
            falsePositiveMax: 0.01,
            invalidDetectionMin: 0.95,
            pagePassMin: 0.95,
            autoGradeTrustMin: 0.95,
            autoCoverageMin: 0.95
          },
          groundTruthRef: 'ground_truth.jsonl',
          capturas: []
        }),
        'utf8'
      );

      const resultado = await runTv4PilotRealValidation({
        datasetRoot: root,
        reportPath,
        failureReportPath
      });

      expect(resultado.report.status).toBe('not_applicable');
      expect(resultado.report.ok).toBe(false);
      expect(resultado.report.metrics.totalCaptures).toBe(0);
      expect(resultado.report.checks.pagePassRate).toBe(false);
      expect(resultado.failures.topCauses).toEqual([{ causa: 'capture_count_zero', total: 1 }]);
      expect(JSON.parse(await fs.readFile(reportPath, 'utf8')).status).toBe('not_applicable');
      expect(JSON.parse(await fs.readFile(failureReportPath, 'utf8')).status).toBe('not_applicable');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
