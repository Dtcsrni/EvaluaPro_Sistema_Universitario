#!/usr/bin/env node
/**
 * perf-check-business
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

function leerArg(nombre, porDefecto) {
  const prefijo = `--${nombre}=`;
  const item = process.argv.find((v) => v.startsWith(prefijo));
  return item ? item.slice(prefijo.length) : porDefecto;
}

function clave(item) {
  return `${String(item.service)}|${String(item.method || 'GET')}|${String(item.route)}`;
}

async function run() {
  const reportPath = path.resolve(
    process.cwd(),
    leerArg('report', process.env.PERF_BUSINESS_REPORT_PATH || 'reports/perf/business.latest.json')
  );
  const baselinePath = path.resolve(
    process.cwd(),
    leerArg('baseline', process.env.PERF_BUSINESS_BASELINE_PATH || 'docs/perf/baseline.business.json')
  );

  const [reportRaw, baselineRaw] = await Promise.all([
    fs.readFile(reportPath, 'utf8'),
    fs.readFile(baselinePath, 'utf8')
  ]);

  const report = JSON.parse(reportRaw);
  const baseline = JSON.parse(baselineRaw);
  const reportResults = Array.isArray(report?.results) ? report.results : [];
  const budgets = Array.isArray(baseline?.budgets) ? baseline.budgets : [];

  if (reportResults.length === 0) throw new Error('Reporte negocio sin results[]');
  if (budgets.length === 0) throw new Error('Baseline negocio sin budgets[]');

  const mapaReport = new Map(reportResults.map((r) => [clave(r), r]));
  const violaciones = [];

  for (const budget of budgets) {
    const k = clave(budget);
    const actual = mapaReport.get(k);
    if (!actual) {
      violaciones.push(`Falta métrica en reporte negocio para ${k}`);
      continue;
    }

    const actualP95 = Number(actual?.p95Ms ?? Infinity);
    const budgetP95 = Number(budget?.budgetP95Ms ?? 0);
    const actualFailures = Number(actual?.failures ?? 0);
    const budgetFailures = Number(budget?.maxFailures ?? 0);

    if (!(actualP95 <= budgetP95)) {
      violaciones.push(`p95 negocio fuera de presupuesto en ${k}: actual=${actualP95}ms budget=${budgetP95}ms`);
    }
    if (!(actualFailures <= budgetFailures)) {
      violaciones.push(`failures negocio fuera de presupuesto en ${k}: actual=${actualFailures} budget=${budgetFailures}`);
    }
  }

  if (violaciones.length > 0) {
    process.stderr.write('[perf-check-business] Violaciones:\n');
    for (const v of violaciones) process.stderr.write(`- ${v}\n`);
    process.exit(1);
  }

  process.stdout.write(`[perf-check-business] OK (${budgets.length} budgets negocio verificados)\n`);
}

run().catch((error) => {
  process.stderr.write(`[perf-check-business] Error: ${String(error?.message || error)}\n`);
  process.exit(1);
});
