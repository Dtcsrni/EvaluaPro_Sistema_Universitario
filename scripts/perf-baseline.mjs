#!/usr/bin/env node
/**
 * perf-baseline
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * perf-baseline
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * perf-baseline
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

async function run() {
  const input = path.resolve(process.cwd(), leerArg('input', process.env.PERF_REPORT_PATH || 'reports/perf/latest.json'));
  const output = path.resolve(process.cwd(), leerArg('output', process.env.PERF_BASELINE_PATH || 'docs/perf/baseline.json'));
  const factor = Number.parseFloat(process.env.PERF_BASELINE_FACTOR || '3');
  const margenMinimoMs = Number.parseFloat(process.env.PERF_BASELINE_MARGIN_MS || '50');

  const raw = await fs.readFile(input, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data?.results) || data.results.length === 0) {
    throw new Error('Reporte de performance invalido: falta results[]');
  }

  const budgets = data.results.map((item) => {
    const base = Number(item?.p95Ms ?? 0);
    const budget = Math.max(base * factor, base + margenMinimoMs);
    return {
      service: String(item.service),
      route: String(item.route),
      method: String(item.method || 'GET'),
      baselineP95Ms: Number(base.toFixed(2)),
      budgetP95Ms: Number(budget.toFixed(2)),
      maxFailures: 0
    };
  });

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceReport: path.relative(process.cwd(), input).replace(/\\/g, '/'),
    baselineFactor: factor,
    baselineMarginMs: margenMinimoMs,
    budgets
  };

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`[perf-baseline] Baseline generada en ${output}\n`);
}

run().catch((error) => {
  process.stderr.write(`[perf-baseline] Error: ${String(error?.message || error)}\n`);
  process.exit(1);
});
