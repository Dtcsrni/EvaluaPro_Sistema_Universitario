import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import sharp from 'sharp';

type Medicion = {
  service: 'backend';
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
  profile: 'business-auth';
  results: Medicion[];
};

const rutasBase: DefRuta[] = [
  { route: '/api/examenes/plantillas', method: 'GET', expectedStatus: 200 },
  { route: '/api/examenes/generados', method: 'GET', expectedStatus: 200 },
  { route: '/api/periodos', method: 'GET', expectedStatus: 200 },
  { route: '/api/sincronizaciones', method: 'GET', expectedStatus: 200 },
  { route: '/api/omr/prevalidar-lote', method: 'POST', expectedStatus: 200 },
  { route: '/api/analiticas/lista-academica-csv?periodoId=507f1f77bcf86cd799439011', method: 'GET', expectedStatus: 200 }
];

function percentil(valores: number[], q: number): number {
  if (valores.length === 0) return 0;
  const idx = Math.max(0, Math.min(valores.length - 1, Math.ceil(q * valores.length) - 1));
  return valores[idx] ?? 0;
}

async function registrarDocente(app: { (): unknown } | unknown): Promise<string> {
  const dominioPermitido =
    String(process.env.DOMINIOS_CORREO_PERMITIDOS || '')
      .split(',')
      .map((item) => item.trim().replace(/^@/, ''))
      .find(Boolean) || 'evaluapro.mx';
  const correo = `perf_${Date.now()}_${randomUUID().slice(0, 8)}@${dominioPermitido}`;
  const password = 'Perf_Valid_2026!';
  const respuesta = await request(app).post('/api/autenticacion/registrar').send({
    correo,
    contrasena: password,
    nombres: 'Perf',
    apellidos: 'Business'
  });
  if (respuesta.status !== 201 || !respuesta.body?.token) {
    throw new Error(`No se pudo autenticar docente perf: status=${respuesta.status}`);
  }
  return String(respuesta.body.token);
}

async function crearCapturaBase64(): Promise<string> {
  const buffer = await sharp({
    create: {
      width: 1600,
      height: 1100,
      channels: 3,
      background: { r: 235, g: 235, b: 235 }
    }
  })
    .png()
    .toBuffer();
  return buffer.toString('base64');
}

async function medirRuta(
  app: ReturnType<typeof crearAppBackend>,
  token: string,
  def: DefRuta,
  iterations: number,
  warmup: number,
  capturaBase64: string
): Promise<Medicion> {
  const tiempos: number[] = [];
  let failures = 0;

  for (let i = 0; i < warmup + iterations; i += 1) {
    const inicio = process.hrtime.bigint();
    const metodo = request(app)[def.method.toLowerCase() as 'get' | 'post'](def.route)
      .set('Authorization', `Bearer ${token}`);

    let cuerpo = def.body;
    if (def.route === '/api/omr/prevalidar-lote') {
      cuerpo = { capturas: [{ nombreArchivo: 'perf.jpg', imagenBase64: capturaBase64 }] };
    }

    const resp = cuerpo ? await metodo.send(cuerpo) : await metodo;
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
    service: 'backend',
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
  const iterations = Math.max(6, Number.parseInt(process.env.PERF_BUSINESS_ITERATIONS || '20', 10));
  const warmup = Math.max(1, Number.parseInt(process.env.PERF_BUSINESS_WARMUP || '3', 10));
  const output = path.resolve(
    process.cwd(),
    process.env.PERF_BUSINESS_REPORT_PATH || 'reports/perf/business.latest.json'
  );

  const dbFile = 'perf_business.db';
  const dataDir = path.resolve(process.cwd(), 'data');
  const dbPath = path.resolve(dataDir, dbFile);
  const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;

  process.env.DATABASE_URL = dbUrl;
  process.env.BACKEND_DATABASE_URL = dbUrl;
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.JWT_SECRETO = process.env.JWT_SECRETO || 'perf_business_jwt_secret_2026';
  process.env.PORTAL_ALUMNO_API_KEY = process.env.PORTAL_ALUMNO_API_KEY || 'perf_business_portal_key_2026';

  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.unlink(dbPath);
  } catch {}

  const { execSync } = await import('node:child_process');
  const fsSync = await import('node:fs');
  let prismaBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'prisma');
  if (!fsSync.existsSync(prismaBin)) {
    prismaBin = path.resolve(process.cwd(), 'apps', 'backend', 'node_modules', '.bin', 'prisma');
  }
  const schemaPath = path.resolve(process.cwd(), 'apps', 'backend', 'prisma', 'schema.prisma');
  const cmd = `"${prismaBin}" db push --schema="${schemaPath}" --skip-generate --accept-data-loss`;

  try {
    execSync(cmd, {
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: 'pipe'
    });
  } catch (error: any) {
    process.stderr.write(`Error executing prisma db push during perf business: ${String(error.stderr?.toString() || error.message)}\n`);
    throw error;
  }

  const { conectarSqlite, desconectarSqlite } = await import('../apps/backend/src/infraestructura/baseDatos/sqlite');
  const { crearApp: crearAppBackend } = await import('../apps/backend/src/app');

  await conectarSqlite();
  const app = crearAppBackend();
  const token = await registrarDocente(app);
  const capturaBase64 = await crearCapturaBase64();

  const resultados: Medicion[] = [];
  for (const ruta of rutasBase) {
    resultados.push(await medirRuta(app, token, ruta, iterations, warmup, capturaBase64));
  }

  const payload: Resultado = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    iterations,
    warmup,
    profile: 'business-auth',
    results: resultados
  };

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`[perf-collect-business] Reporte generado en ${output}\n`);

  await desconectarSqlite();
  try {
    await fs.unlink(dbPath);
  } catch {}
}

run().catch((error) => {
  process.stderr.write(`[perf-collect-business] Error: ${String((error as Error)?.message || error)}\n`);
  process.exit(1);
});
