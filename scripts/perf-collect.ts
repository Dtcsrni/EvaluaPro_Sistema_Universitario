/**
 * perf-collect
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { crearApp as crearAppBackend } from '../apps/backend/src/app';
import { crearApp as crearAppPortal } from '../apps/portal_alumno_cloud/src/app';

type Medicion = {
  service: 'backend' | 'portal';
  route: string;
  method: 'GET' | 'POST';
  iterations: number;
  warmup: number;
  failures: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
};

type DefRuta = {
  service: 'backend' | 'portal';
  route: string;
  method: 'GET' | 'POST';
  expectedStatus: number;
  body?: Record<string, unknown>;
};

type Resultado = {
  generatedAt: string;
  node: string;
  iterations: number;
  warmup: number;
  results: Medicion[];
};

const rutas: DefRuta[] = [
  { service: 'backend', route: '/api/salud/live', method: 'GET', expectedStatus: 200 },
  { service: 'backend', route: '/api/metrics', method: 'GET', expectedStatus: 200 },
  // Endpoints criticos de negocio medidos en modo no autenticado para monitorear no-regresion de middleware/ruteo.
  { service: 'backend', route: '/api/examenes/generados', method: 'GET', expectedStatus: 401 },
  { service: 'backend', route: '/api/omr/analizar', method: 'POST', expectedStatus: 401, body: {} },
  { service: 'backend', route: '/api/sincronizaciones/pull', method: 'POST', expectedStatus: 401, body: {} },
  { service: 'backend', route: '/api/analiticas/lista-academica-csv?periodoId=PERF', method: 'GET', expectedStatus: 401 },
  { service: 'portal', route: '/api/portal/salud/live', method: 'GET', expectedStatus: 200 },
  { service: 'portal', route: '/api/portal/metrics', method: 'GET', expectedStatus: 200 }
];

function percentil(valores: number[], q: number): number {
  if (valores.length === 0) return 0;
  const idx = Math.max(0, Math.min(valores.length - 1, Math.ceil(q * valores.length) - 1));
  return valores[idx] ?? 0;
}

async function medirRuta(
  app: ReturnType<typeof crearAppBackend>,
  def: DefRuta,
  iterations: number,
  warmup: number
): Promise<Medicion> {
  const tiempos: number[] = [];
  let failures = 0;

  for (let i = 0; i < warmup + iterations; i += 1) {
    const inicio = process.hrtime.bigint();
    const metodo = request(app)[def.method.toLowerCase() as 'get' | 'post'](def.route);
    const resp = def.body ? await metodo.send(def.body) : await metodo;
    const fin = process.hrtime.bigint();
    const ms = Number(fin - inicio) / 1_000_000;

    if (i >= warmup) {
      tiempos.push(ms);
      if (resp.status !== def.expectedStatus) failures += 1;
    }
  }

  const ordenados = [...tiempos].sort((a, b) => a - b);
  const total = ordenados.reduce((acc, v) => acc + v, 0);
  const min = ordenados[0] ?? 0;
  const max = ordenados[ordenados.length - 1] ?? 0;
  const avg = ordenados.length ? total / ordenados.length : 0;

  return {
    service: def.service,
    route: def.route,
    method: def.method,
    iterations,
    warmup,
    failures,
    minMs: Number(min.toFixed(2)),
    maxMs: Number(max.toFixed(2)),
    avgMs: Number(avg.toFixed(2)),
    p50Ms: Number(percentil(ordenados, 0.5).toFixed(2)),
    p95Ms: Number(percentil(ordenados, 0.95).toFixed(2)),
    p99Ms: Number(percentil(ordenados, 0.99).toFixed(2))
  };
}

async function run() {
  const iterations = Math.max(10, Number.parseInt(process.env.PERF_ITERATIONS || '80', 10));
  const warmup = Math.max(1, Number.parseInt(process.env.PERF_WARMUP || '10', 10));
  const output = path.resolve(process.cwd(), process.env.PERF_REPORT_PATH || 'reports/perf/latest.json');
  process.env.EVALUAPRO_LOG_SILENT = '1';

  const resultados: Medicion[] = [];
  const backendApp = crearAppBackend();
  const portalApp = crearAppPortal();

  for (const ruta of rutas) {
    const app = ruta.service === 'backend' ? backendApp : portalApp;
    const medicion = await medirRuta(app, ruta, iterations, warmup);
    resultados.push(medicion);
  }

  const payload: Resultado = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    iterations,
    warmup,
    results: resultados
  };

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`[perf-collect] Reporte generado en ${output}\n`);
}

run().catch((error) => {
  process.stderr.write(`[perf-collect] Error: ${String((error as Error)?.message || error)}\n`);
  process.exit(1);
});

