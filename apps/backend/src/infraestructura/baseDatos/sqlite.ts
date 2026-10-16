/**
 * sqlite
 *
 * Responsabilidad: Singleton del cliente de Prisma para conexion local a SQLite.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Asegurar que el directorio data/ existe para guardar evaluapro.db
import fs from 'node:fs';

let dataDir = path.resolve(process.cwd(), 'data');
const entorno = process.env.NODE_ENV ?? 'production';
if (entorno === 'production') {
  // In native production, always use ProgramData to persist across upgrades/uninstalls and avoid System32
  dataDir = path.resolve(process.env.PROGRAMDATA || 'C:\\ProgramData', 'EvaluaPro', 'data');
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function crearClientePrismaSqlite(
  url: string,
  log: ('query' | 'error' | 'warn')[] = ['error']
): PrismaClient {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }), log });
}

const databaseUrl = process.env.BACKEND_DATABASE_URL || process.env.DATABASE_URL ||
  `file:${path.resolve(dataDir, 'evaluapro.db').replace(/\\/g, '/')}`;
export const prisma = crearClientePrismaSqlite(
  databaseUrl,
  entorno === 'development' ? ['query', 'error', 'warn'] : ['error']
);

export async function conectarSqlite(): Promise<void> {
  await prisma.$connect();
  await asegurarEsquemaSqlite();
  ejecutarMigracionReactivosAditiva();
  ejecutarMigracionSqliteAdicional('migrate-calificacion-origen-inferida-sqlite.mjs');
  ejecutarMigracionSqliteAdicional('migrate-preferencias-retencion-parcial-sqlite.mjs');
  ejecutarMigracionSqliteAdicional('migrate-resultados-extra-externos-sqlite.mjs');
  ejecutarMigracionCalificacionesListaManual();
  ejecutarMigracionCalificacionesListaIdempotencia();
  await asegurarColumnasTrazabilidadCalificaciones();
  ejecutarMigracionArtefactosLotePdf();
  ejecutarMigracionCicloVidaLotesPdf();
  ejecutarMigracionTipoExamenGenerado();
  ejecutarMigracionEvidenciasEvaluacion();
  ejecutarMigracionTemariosAuditoria();
  ejecutarMigracionTemasBancoAuditoria();
  ejecutarMigracionPoliticasCalificacionAuditoria();
  ejecutarMigracionPlantillasAuditoria();
}

function ejecutarMigracionSqliteAdicional(nombreScript: string): void {
  const databasePath = resolverRutaArchivoSqlite(databaseUrl);
  if (!databasePath) return;
  const candidatos = [
    path.resolve(process.cwd(), 'scripts', nombreScript),
    path.resolve(process.cwd(), '..', '..', 'scripts', nombreScript)
  ];
  const script = candidatos.find((candidate) => fs.existsSync(candidate));
  if (!script) {
    if (entorno === 'production') throw new Error(`Falta la migración SQLite requerida: ${nombreScript}`);
    return;
  }
  execFileSync(process.execPath, [script, '--database', databasePath], { stdio: 'ignore' });
}

function resolverRutaArchivoSqlite(urlConfigurada?: string): string | null {
  const raw = String(urlConfigurada ?? process.env.BACKEND_DATABASE_URL ?? process.env.DATABASE_URL ?? '').trim();
  if (!raw.startsWith('file:')) return null;
  const valor = raw.slice('file:'.length).split('?')[0];
  if (!valor || valor === ':memory:') return null;
  return path.resolve(valor);
}

function ejecutarMigracionReactivosAditiva() {
  const databasePath = resolverRutaArchivoSqlite();
  if (!databasePath) return;
  const candidatos = [
    path.resolve(process.cwd(), 'scripts', 'migrate-reactivos-sqlite.mjs'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'migrate-reactivos-sqlite.mjs')
  ];
  const script = candidatos.find((candidate) => fs.existsSync(candidate));
  if (!script) return;
  try {
    execFileSync(process.execPath, [script, '--database', databasePath], { stdio: 'ignore' });
  } catch {
    // La preparación Prisma posterior conserva el diagnóstico original. No se
    // oculta un fallo de conexión ni se intenta una migración destructiva.
  }
}

function ejecutarMigracionCalificacionesListaManual() {
  const databasePath = resolverRutaArchivoSqlite(databaseUrl);
  if (!databasePath) return;
  const candidatos = [
    path.resolve(process.cwd(), 'scripts', 'migrate-calificaciones-lista-manual-sqlite.mjs'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'migrate-calificaciones-lista-manual-sqlite.mjs')
  ];
  const script = candidatos.find((candidate) => fs.existsSync(candidate));
  if (!script) return;
  execFileSync(process.execPath, [script, '--database', databasePath], { stdio: 'ignore' });
}

function ejecutarMigracionCalificacionesListaIdempotencia() {
  const databasePath = resolverRutaArchivoSqlite(databaseUrl);
  if (!databasePath) return;
  const candidatos = [
    path.resolve(process.cwd(), 'scripts', 'migrate-calificaciones-lista-idempotencia-sqlite.mjs'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'migrate-calificaciones-lista-idempotencia-sqlite.mjs')
  ];
  const script = candidatos.find((candidate) => fs.existsSync(candidate));
  if (!script) return;
  execFileSync(process.execPath, [script, '--database', databasePath], { stdio: 'ignore' });
}

async function asegurarColumnasTrazabilidadCalificaciones(): Promise<void> {
  const columnas = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("calificaciones_lista_manual_mutaciones");');
  if (columnas.length === 0) return;
  const existentes = new Set(columnas.map((columna) => columna.name));
  const requeridas: Array<[string, string]> = [
    ['canalCaptura', 'TEXT'], ['metodoCaptura', 'TEXT'], ['actorId', 'TEXT'], ['periodoId', 'TEXT'],
    ['alumnoId', 'TEXT'], ['componente', 'TEXT'], ['valorAnterior', 'REAL'], ['valorNuevo', 'REAL'],
    ['version', 'INTEGER'], ['escalaMaxima', 'REAL'], ['referenciaOrigen', 'TEXT']
  ];
  for (const [nombre, tipo] of requeridas) {
    if (!existentes.has(nombre)) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "calificaciones_lista_manual_mutaciones" ADD COLUMN "${nombre}" ${tipo};`);
    }
  }
}

function ejecutarMigracionArtefactosLotePdf() {
  const databasePath = resolverRutaArchivoSqlite(databaseUrl);
  if (!databasePath) return;
  const candidatos = [
    path.resolve(process.cwd(), 'scripts', 'migrate-examen-lote-artefactos-pdf-sqlite.mjs'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'migrate-examen-lote-artefactos-pdf-sqlite.mjs')
  ];
  const script = candidatos.find((candidate) => fs.existsSync(candidate));
  if (!script) return;
  execFileSync(process.execPath, [script, '--database', databasePath], { stdio: 'ignore' });
}

function ejecutarMigracionCicloVidaLotesPdf() {
  const databasePath = resolverRutaArchivoSqlite(databaseUrl);
  if (!databasePath) return;
  const candidatos = [
    path.resolve(process.cwd(), 'scripts', 'migrate-examen-lotes-ciclo-vida-sqlite.mjs'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'migrate-examen-lotes-ciclo-vida-sqlite.mjs')
  ];
  const script = candidatos.find((candidate) => fs.existsSync(candidate));
  if (!script) return;
  execFileSync(process.execPath, [script, '--database', databasePath], { stdio: 'ignore' });
}

function ejecutarMigracionTipoExamenGenerado() {
  const databasePath = resolverRutaArchivoSqlite(databaseUrl);
  if (!databasePath) return;
  const candidatos = [
    path.resolve(process.cwd(), 'scripts', 'migrate-examen-tipo-examen-sqlite.mjs'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'migrate-examen-tipo-examen-sqlite.mjs')
  ];
  const script = candidatos.find((candidate) => fs.existsSync(candidate));
  if (!script) return;
  try {
    execFileSync(process.execPath, [script, '--database', databasePath], { stdio: 'ignore' });
  } catch {
    // Prisma conserva el diagnóstico original si el esquema no puede prepararse.
  }
}

function ejecutarMigracionEvidenciasEvaluacion() {
  const databasePath = resolverRutaArchivoSqlite(databaseUrl);
  if (!databasePath) return;
  const candidatos = [
    path.resolve(process.cwd(), 'scripts', 'migrate-evidencias-evaluacion-sqlite.mjs'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'migrate-evidencias-evaluacion-sqlite.mjs')
  ];
  const script = candidatos.find((candidate) => fs.existsSync(candidate));
  if (!script) return;
  execFileSync(process.execPath, [script, '--database', databasePath], { stdio: 'ignore' });
}

function ejecutarMigracionTemariosAuditoria() {
  const databasePath = resolverRutaArchivoSqlite(databaseUrl);
  if (!databasePath) return;
  const candidatos = [
    path.resolve(process.cwd(), 'scripts', 'migrate-temarios-auditoria-sqlite.mjs'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'migrate-temarios-auditoria-sqlite.mjs')
  ];
  const script = candidatos.find((candidate) => fs.existsSync(candidate));
  if (!script) return;
  execFileSync(process.execPath, [script, '--database', databasePath], { stdio: 'ignore' });
}

function ejecutarMigracionTemasBancoAuditoria() {
  const databasePath = resolverRutaArchivoSqlite(databaseUrl);
  if (!databasePath) return;
  const candidatos = [
    path.resolve(process.cwd(), 'scripts', 'migrate-temas-banco-auditoria-sqlite.mjs'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'migrate-temas-banco-auditoria-sqlite.mjs')
  ];
  const script = candidatos.find((candidate) => fs.existsSync(candidate));
  if (!script) return;
  execFileSync(process.execPath, [script, '--database', databasePath], { stdio: 'ignore' });
}

function ejecutarMigracionPoliticasCalificacionAuditoria() {
  const databasePath = resolverRutaArchivoSqlite(databaseUrl);
  if (!databasePath) return;
  const candidatos = [
    path.resolve(process.cwd(), 'scripts', 'migrate-politicas-calificacion-auditoria-sqlite.mjs'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'migrate-politicas-calificacion-auditoria-sqlite.mjs')
  ];
  const script = candidatos.find((candidate) => fs.existsSync(candidate));
  if (!script) return;
  execFileSync(process.execPath, [script, '--database', databasePath], { stdio: 'ignore' });
}

function ejecutarMigracionPlantillasAuditoria() {
  const databasePath = resolverRutaArchivoSqlite(databaseUrl);
  if (!databasePath) return;
  const candidatos = [
    path.resolve(process.cwd(), 'scripts', 'migrate-plantillas-auditoria-sqlite.mjs'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'migrate-plantillas-auditoria-sqlite.mjs')
  ];
  const script = candidatos.find((candidate) => fs.existsSync(candidate));
  if (!script) return;
  execFileSync(process.execPath, [script, '--database', databasePath], { stdio: 'ignore' });
}

async function asegurarEsquemaSqlite(): Promise<void> {
  const databasePath = resolverRutaArchivoSqlite();
  if (!databasePath) return;
  try {
    const tablas = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='docentes';"
    );
    if (!tablas || tablas.length === 0) {
      const schemaCandidates = [
        path.resolve(process.cwd(), 'apps', 'backend', 'prisma', 'schema.prisma'),
        path.resolve(process.cwd(), 'prisma', 'schema.prisma'),
        path.resolve(process.cwd(), '..', '..', 'apps', 'backend', 'prisma', 'schema.prisma')
      ];
      const targetSchema = schemaCandidates.find((candidate) => fs.existsSync(candidate)) || null;
      if (targetSchema) {
        const prismaCandidates = [
          path.resolve(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js'),
          path.resolve(process.cwd(), '..', '..', 'node_modules', 'prisma', 'build', 'index.js')
        ];
        const prismaCli = prismaCandidates.find((candidate) => fs.existsSync(candidate));
      if (prismaCli) {
          const databaseUrl = `file:${databasePath.replace(/\\/g, '/')}`;
          const schemaSql = execFileSync(process.execPath, [
            prismaCli,
            'migrate',
            'diff',
            '--from-empty',
            '--to-schema',
            targetSchema,
            '--config',
            path.resolve(path.dirname(targetSchema), '..', 'prisma.config.mjs'),
            '--script'
          ], {
            env: { ...process.env, DATABASE_URL: databaseUrl, BACKEND_DATABASE_URL: databaseUrl },
            encoding: 'utf8'
          });
          const { DatabaseSync } = await import('node:sqlite');
          const database = new DatabaseSync(databasePath);
          try {
            database.exec(schemaSql);
          } finally {
            database.close();
          }
        }
      }
    }
    const columnasDocente = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("docentes");');
    if (columnasDocente.length > 0 && !columnasDocente.some((columna) => columna.name === 'imagenPerfil')) {
      await prisma.$executeRawUnsafe('ALTER TABLE "docentes" ADD COLUMN "imagenPerfil" TEXT;');
    }
    // Additive migration for existing SQLite installations. The cover stays
    // in a child table, so ordinary period queries never load its bytes.
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "periodo_portadas" (
        "periodoId" TEXT NOT NULL PRIMARY KEY,
        "contenido" BLOB NOT NULL,
        "mimeType" TEXT NOT NULL,
        "sizeBytes" INTEGER NOT NULL,
        "width" INTEGER NOT NULL,
        "height" INTEGER NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "periodo_portadas_periodoId_fkey"
          FOREIGN KEY ("periodoId") REFERENCES "periodos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "historial_classroom_cortes" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "docenteId" TEXT NOT NULL,
        "periodoId" TEXT NOT NULL,
        "alumnoId" TEXT NOT NULL,
        "corte" INTEGER NOT NULL,
        "snapshotHash" TEXT NOT NULL,
        "promedioSobre10" REAL,
        "estado" TEXT NOT NULL,
        "puntosObtenidos" REAL NOT NULL,
        "puntosPosibles" REAL NOT NULL,
        "actividades" TEXT NOT NULL,
        "capturaWebp" BLOB NOT NULL,
        "capturaHash" TEXT NOT NULL,
        "capturaBytes" INTEGER NOT NULL,
        "capturaWidth" INTEGER NOT NULL,
        "capturaHeight" INTEGER NOT NULL,
        "importacionId" TEXT,
        "capturadoPor" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "historial_classroom_cortes_docenteId_snapshotHash_key" ON "historial_classroom_cortes"("docenteId", "snapshotHash");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "historial_classroom_cortes_docenteId_periodoId_alumnoId_corte_createdAt_idx" ON "historial_classroom_cortes"("docenteId", "periodoId", "alumnoId", "corte", "createdAt");`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "historial_classroom_entregas" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "docenteId" TEXT NOT NULL,
        "periodoId" TEXT NOT NULL,
        "alumnoId" TEXT NOT NULL,
        "courseId" TEXT NOT NULL,
        "courseWorkId" TEXT NOT NULL,
        "submissionId" TEXT NOT NULL,
        "corte" INTEGER,
        "puntosObtenidos" REAL,
        "puntosPosibles" REAL,
        "calificacionSobre10" REAL,
        "estado" TEXT NOT NULL,
        "estadoClassroom" TEXT,
        "estadoHash" TEXT NOT NULL,
        "importacionId" TEXT NOT NULL,
        "capturadoPor" TEXT NOT NULL,
        "observadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "historial_classroom_entregas_docenteId_estadoHash_key" ON "historial_classroom_entregas"("docenteId", "estadoHash");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "historial_classroom_entregas_scope_observadoEn_idx" ON "historial_classroom_entregas"("docenteId", "periodoId", "alumnoId", "courseId", "courseWorkId", "submissionId", "observadoEn");`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "classroom_import_jobs" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "docenteId" TEXT NOT NULL,
        "periodoId" TEXT NOT NULL,
        "clientRequestId" TEXT NOT NULL,
        "requestHash" TEXT NOT NULL,
        "payload" TEXT NOT NULL,
        "estado" TEXT NOT NULL DEFAULT 'queued',
        "progreso" INTEGER NOT NULL DEFAULT 0,
        "total" INTEGER NOT NULL,
        "resultado" TEXT,
        "error" TEXT,
        "activeKey" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        "startedAt" DATETIME,
        "completedAt" DATETIME
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "classroom_import_jobs_docenteId_clientRequestId_key" ON "classroom_import_jobs"("docenteId", "clientRequestId");`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "classroom_import_jobs_activeKey_key" ON "classroom_import_jobs"("activeKey");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "classroom_import_jobs_docenteId_periodoId_createdAt_idx" ON "classroom_import_jobs"("docenteId", "periodoId", "createdAt");`);
  } catch (error) {
    // Si la conexion es en memoria de tests o no permite aplicar el esquema,
    // conserva el diagnóstico para que el arranque pueda reportarlo.
    console.error('[sqlite] No se pudo inicializar el esquema SQLite', error);
  }
}

export async function desconectarSqlite(): Promise<void> {
  await prisma.$disconnect();
}
