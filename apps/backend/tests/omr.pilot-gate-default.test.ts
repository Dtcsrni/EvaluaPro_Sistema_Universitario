import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const REPORT_ENV = 'EVALUAPRO_OMR_TV4_REAL_PILOT_REPORT';
const directoriosTemporales: string[] = [];
const checksAprobados = {
  precision: true,
  falsePositiveRate: true,
  invalidDetectionRate: true,
  pagePassRate: true,
  autoGradeTrustRate: true,
  autoCoverageRate: true,
  gradeConsistencyLower95: true,
  bonusConsistencyLower95: true
};

async function escribirReportePiloto(overrides: Record<string, unknown> = {}) {
  const directorio = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-omr-gate-'));
  directoriosTemporales.push(directorio);
  const reportePath = path.join(directorio, 'pilot-report.json');
  const { OMR_RUNTIME_CONFIG_SHA256 } = await import('../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js');
  const reporte = {
    datasetType: 'tv4_pilot_real',
    status: 'passed',
    ok: true,
    checks: checksAprobados,
    thresholds: { gradeConsistencyLower95Min: 0.98, autoCoverageMin: 1 },
    metrics: {
      totalCaptures: 298,
      pagePassRate: 1,
      autoGradeTrustRate: 1,
      gradeComparisons: 149,
      bonusComparisons: 149,
      gradeConsistencyLower95: 0.980095,
      bonusConsistencyLower95: 0.980095,
      autoCoverageRate: 1,
      humanReviewedRows: 298,
      humanReviewerCount: 2
    },
    evidenceHashes: {
      manifestSha256: 'a'.repeat(64),
      groundTruthSha256: 'b'.repeat(64),
      answerKeySha256: 'c'.repeat(64),
      captureAssetsSha256: 'd'.repeat(64),
      evaluatorCodeSha256: 'e'.repeat(64),
      omrRuntimeConfigSha256: OMR_RUNTIME_CONFIG_SHA256
    },
    ...overrides
  };
  await fs.writeFile(reportePath, JSON.stringify(reporte), 'utf8');
  return reportePath;
}

describe('gate real TV4 de autocalificación', () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    await Promise.all(directoriosTemporales.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
  });

  it.each([undefined, '', 'true', 'passed', 'passed-without-report'])('permanece cerrado sin un reporte local de piloto (%s)', async (value) => {
    vi.stubEnv(REPORT_ENV, value);
    vi.resetModules();

    const { OMR_TV4_REAL_PILOT_GATE_PASSED } = await import('../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js');

    expect(OMR_TV4_REAL_PILOT_GATE_PASSED).toBe(false);
  });

  it('no se abre al configurar solo la huella OMR, aunque coincida', async () => {
    vi.stubEnv('OMR_AUTO_CONF_MIN', '0.58');
    vi.stubEnv(REPORT_ENV, '');
    vi.resetModules();
    const { OMR_RUNTIME_CONFIG_SHA256 } = await import('../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js');

    vi.stubEnv(REPORT_ENV, OMR_RUNTIME_CONFIG_SHA256);
    vi.resetModules();
    const policy = await import('../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js');
    expect(policy.OMR_TV4_REAL_PILOT_GATE_PASSED).toBe(false);
  });

  it('solo abre con reporte aprobado, suficiente e idéntico a la configuración activa', async () => {
    vi.stubEnv('OMR_AUTO_CONF_MIN', '0.58');
    vi.stubEnv(REPORT_ENV, '');
    vi.resetModules();
    const reportePath = await escribirReportePiloto();
    vi.stubEnv(REPORT_ENV, reportePath);
    vi.resetModules();
    const policy = await import('../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js');
    expect(policy.OMR_TV4_REAL_PILOT_GATE_PASSED).toBe(true);
  });

  it.each([
    { status: 'failed' },
    { ok: false },
    { checks: { ...checksAprobados, bonusConsistencyLower95: false } },
    { metrics: { totalCaptures: 298, pagePassRate: 1, autoGradeTrustRate: 1, gradeComparisons: 148, bonusComparisons: 149, gradeConsistencyLower95: 0.98, bonusConsistencyLower95: 0.98, autoCoverageRate: 1, humanReviewedRows: 298, humanReviewerCount: 2 } },
    { thresholds: { gradeConsistencyLower95Min: 0.98, autoCoverageMin: 0.95 } },
    { metrics: { totalCaptures: 598, pagePassRate: 0.999, autoGradeTrustRate: 1, gradeComparisons: 299, bonusComparisons: 299, gradeConsistencyLower95: 0.99, bonusConsistencyLower95: 0.99, autoCoverageRate: 1, humanReviewedRows: 598, humanReviewerCount: 2 } },
    { metrics: { totalCaptures: 598, pagePassRate: 1, autoGradeTrustRate: 0.999, gradeComparisons: 299, bonusComparisons: 299, gradeConsistencyLower95: 0.99, bonusConsistencyLower95: 0.99, autoCoverageRate: 1, humanReviewedRows: 598, humanReviewerCount: 2 } },
    { metrics: { totalCaptures: 598, pagePassRate: 1, autoGradeTrustRate: 1, gradeComparisons: 299, bonusComparisons: 299, gradeConsistencyLower95: 0.99, bonusConsistencyLower95: 0.99, autoCoverageRate: 0.999, humanReviewedRows: 598, humanReviewerCount: 2 } }
  ])('rechaza reportes que no prueban el gate ($status)', async (overrides) => {
    vi.stubEnv(REPORT_ENV, '');
    vi.resetModules();
    const reportePath = await escribirReportePiloto(overrides);
    vi.stubEnv(REPORT_ENV, reportePath);
    vi.resetModules();
    const policy = await import('../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js');
    expect(policy.OMR_TV4_REAL_PILOT_GATE_PASSED).toBe(false);
  });
});
