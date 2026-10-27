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
  gradeConsistencyObserved: true,
  bonusConsistencyObserved: true
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
    thresholds: { gradeConsistencyObservedMin: 1, autoCoverageMin: 1 },
    metrics: {
      totalCaptures: 24,
      pagePassRate: 1,
      autoGradeTrustRate: 1,
      gradeComparisons: 149,
      bonusComparisons: 149,
      gradeConsistency: 1,
      bonusConsistency: 1,
      automaticGradeDiscordances: 0,
      bonusDiscordances: 0,
      gradeConsistencyLower95: 0.980095,
      bonusConsistencyLower95: 0.980095,
      autoCoverageRate: 1,
      humanReviewedRows: 24,
      humanReviewerCount: 2
    },
    batchGate: { status: 'passed', minimumIndependentExams: 12, gradeComparisons: 149, bonusComparisons: 149, passed: true },
    populationGate: {
      status: 'passed',
      method: 'clopper_pearson_one_sided_exact_binomial_lower_bound',
      confidenceLevel: 0.95,
      minimumLowerBound: 0.98,
      minimumIndependentExamsAtZeroDiscordances: 149,
      grade: { independentExams: 149, discordances: 0, lowerBound: 0.980095 },
      bonus: { independentExams: 149, discordances: 0, lowerBound: 0.980095 },
      passed: true
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

  it('un lote perfecto de 12 exámenes pasa su gate de lote, pero no el gate poblacional global', async () => {
    vi.stubEnv(REPORT_ENV, '');
    vi.resetModules();
    const reportePath = await escribirReportePiloto({
      metrics: {
        totalCaptures: 24,
        pagePassRate: 1,
        autoGradeTrustRate: 1,
        gradeComparisons: 12,
        bonusComparisons: 12,
        gradeConsistency: 1,
        bonusConsistency: 1,
        gradeConsistencyLower95: 0.779078,
        bonusConsistencyLower95: 0.779078,
        automaticGradeDiscordances: 0,
        bonusDiscordances: 0,
        autoCoverageRate: 1,
        humanReviewedRows: 24,
        humanReviewerCount: 2
      },
      batchGate: { status: 'passed', minimumIndependentExams: 12, gradeComparisons: 12, bonusComparisons: 12, passed: true },
      populationGate: {
        status: 'failed',
        method: 'clopper_pearson_one_sided_exact_binomial_lower_bound',
        confidenceLevel: 0.95,
        minimumLowerBound: 0.98,
        minimumIndependentExamsAtZeroDiscordances: 149,
        grade: { independentExams: 12, discordances: 0, lowerBound: 0.779078 },
        bonus: { independentExams: 12, discordances: 0, lowerBound: 0.779078 },
        passed: false
      }
    });
    vi.stubEnv(REPORT_ENV, reportePath);
    vi.resetModules();
    const policy = await import('../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js');
    expect(policy.OMR_TV4_REAL_PILOT_GATE_PASSED).toBe(false);
  });

  it.each([
    { exams: 148, discordances: 0, lowerBound: 0.9799 },
    { exams: 149, discordances: 1, lowerBound: 0.97 }
  ])('mantiene cerrado el runtime con $exams exámenes y $discordances discordancias bajo el límite poblacional', async ({ exams, discordances, lowerBound }) => {
    vi.stubEnv(REPORT_ENV, '');
    vi.resetModules();
    const reportePath = await escribirReportePiloto({
      metrics: {
        totalCaptures: 24,
        pagePassRate: 1,
        autoGradeTrustRate: 1,
        gradeComparisons: exams,
        bonusComparisons: exams,
        gradeConsistency: (exams - discordances) / exams,
        bonusConsistency: (exams - discordances) / exams,
        gradeConsistencyLower95: lowerBound,
        bonusConsistencyLower95: lowerBound,
        automaticGradeDiscordances: discordances,
        bonusDiscordances: discordances,
        autoCoverageRate: 1,
        humanReviewedRows: 24,
        humanReviewerCount: 2
      },
      populationGate: {
        status: 'failed',
        method: 'clopper_pearson_one_sided_exact_binomial_lower_bound',
        confidenceLevel: 0.95,
        minimumLowerBound: 0.98,
        minimumIndependentExamsAtZeroDiscordances: 149,
        grade: { independentExams: exams, discordances, lowerBound },
        bonus: { independentExams: exams, discordances, lowerBound },
        passed: false
      }
    });
    vi.stubEnv(REPORT_ENV, reportePath);
    vi.resetModules();
    const policy = await import('../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js');
    expect(policy.OMR_TV4_REAL_PILOT_GATE_PASSED).toBe(false);
  });

  it.each([
    { status: 'failed' },
    { ok: false },
    { checks: { ...checksAprobados, bonusConsistencyObserved: false } },
    { metrics: { totalCaptures: 24, pagePassRate: 1, autoGradeTrustRate: 1, gradeComparisons: 11, bonusComparisons: 12, gradeConsistency: 1, bonusConsistency: 1, autoCoverageRate: 1, humanReviewedRows: 24, humanReviewerCount: 2 } },
    { thresholds: { gradeConsistencyObservedMin: 0.99, autoCoverageMin: 1 } },
    { metrics: { totalCaptures: 24, pagePassRate: 1, autoGradeTrustRate: 1, gradeComparisons: 12, bonusComparisons: 12, gradeConsistency: 0.99, bonusConsistency: 1, autoCoverageRate: 1, humanReviewedRows: 24, humanReviewerCount: 2 } },
    { metrics: { totalCaptures: 24, pagePassRate: 1, autoGradeTrustRate: 1, gradeComparisons: 12, bonusComparisons: 12, gradeConsistency: 1, bonusConsistency: 0.99, autoCoverageRate: 1, humanReviewedRows: 24, humanReviewerCount: 2 } },
    { metrics: { totalCaptures: 24, pagePassRate: 0.999, autoGradeTrustRate: 1, gradeComparisons: 12, bonusComparisons: 12, gradeConsistency: 1, bonusConsistency: 1, autoCoverageRate: 1, humanReviewedRows: 24, humanReviewerCount: 2 } },
    { metrics: { totalCaptures: 24, pagePassRate: 1, autoGradeTrustRate: 1, gradeComparisons: 12, bonusComparisons: 12, gradeConsistency: 1, bonusConsistency: 1, autoCoverageRate: 0.999, humanReviewedRows: 24, humanReviewerCount: 2 } }
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
