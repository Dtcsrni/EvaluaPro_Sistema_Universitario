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
  ejecutarMigracionCalificacionesListaManual();
  ejecutarMigracionCalificacionesListaIdempotencia();
  ejecutarMigracionArtefactosLotePdf();
  ejecutarMigracionCicloVidaLotesPdf();
  ejecutarMigracionTipoExamenGenerado();
  ejecutarMigracionEvidenciasEvaluacion();
  ejecutarMigracionTemariosAuditoria();
  ejecutarMigracionTemasBancoAuditoria();
  ejecutarMigracionPoliticasCalificacionAuditoria();
  ejecutarMigracionPlantillasAuditoria();
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
  } catch (error) {
    // Si la conexion es en memoria de tests o no permite aplicar el esquema,
    // conserva el diagnóstico para que el arranque pueda reportarlo.
    console.error('[sqlite] No se pudo inicializar el esquema SQLite', error);
  }
}

export async function desconectarSqlite(): Promise<void> {
  await prisma.$disconnect();
}
