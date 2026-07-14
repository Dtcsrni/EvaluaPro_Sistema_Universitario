/**
 * mongo
 *
 * Responsabilidad: Mock de base de datos para pruebas. Redirige llamadas de MongoDB
 * a SQLite/Prisma Client con aislamiento por worker de Vitest.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { resolverNombreDbTest } from './testDbPath';

const dbFile = resolverNombreDbTest();
const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.resolve(dataDir, dbFile);
const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;

// Set default test DATABASE_URL and BACKEND_DATABASE_URL
process.env.DATABASE_URL = dbUrl;
process.env.BACKEND_DATABASE_URL = dbUrl;

import { prisma } from '../../src/infraestructura/baseDatos/sqlite';

export async function conectarMongoTest() {
  process.env.DATABASE_URL = dbUrl;
  process.env.BACKEND_DATABASE_URL = dbUrl;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    fs.closeSync(fs.openSync(dbPath, 'w'));
  }

  // Resolver rutas de Prisma CLI y esquema de forma robusta usando __dirname
  let prismaBin = path.resolve(__dirname, '..', '..', 'node_modules', '.bin', 'prisma');
  if (!fs.existsSync(prismaBin)) {
    prismaBin = path.resolve(__dirname, '..', '..', '..', '..', 'node_modules', '.bin', 'prisma');
  }
  if (!fs.existsSync(prismaBin)) {
    prismaBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'prisma');
  }

  let schemaPath = path.resolve(__dirname, '..', '..', 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
  }

  const cmd = `"${prismaBin}" db push --schema="${schemaPath}" --skip-generate --accept-data-loss`;
  
  try {
    execSync(cmd, {
      env: { ...process.env, DATABASE_URL: process.env.BACKEND_DATABASE_URL },
      stdio: 'pipe'
    });
  } catch (error: any) {
    console.error("Error executing prisma db push during tests:", error.stderr?.toString() || error.message);
    throw error;
  }

  await prisma.$connect();
}

export async function limpiarMongoTest() {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
  try {
    const existingTables = await prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table';"
    );
    const existingNames = new Set(existingTables.map((t) => t.name.toLowerCase()));

    const tables = [
      'tenants',
      'suscripciones',
      'cobranzas',
      'licencias',
      'cupones',
      'campanas',
      'consentimientos_comerciales',
      'eventos_comerciales',
      'auditorias_comerciales',
      'planes_comerciales',
      'plantillas_notificaciones',
      'sincronizaciones',
      'omr_scan_jobs',
      'omr_sheet_revisions',
      'omr_sheet_families',
      'mapeos_classroom_evidencia',
      'mapeos_classroom_alumno_curso',
      'bitacora_sync_classroom',
      'integraciones_classroom',
      'solicitudes_dsr',
      'eventos_cumplimiento',
      'resumenes_evaluacion_alumno',
      'componentes_examen',
      'evidencias_evaluacion',
      'configuraciones_periodo_evaluacion',
      'reconstrucciones_examenes',
      'escaneos_omr_archivados',
      'banco_temas',
      'codigos_acceso',
      'entregas',
      'papelera_items',
      'examen_recovery_manifests',
      'examen_recovery_bundles',
      'eventos_uso',
      'banderas_revision',
      'solicitudes_revision',
      'calificaciones',
      'politicas_calificacion',
      'examenes_generados',
      'pregunta_plantilla',
      'examenes_plantilla',
      'opcion_preguntas',
      'version_preguntas',
      'banco_preguntas',
      'temario_nodos',
      'temarios',
      'asistencia_excepciones',
      'asistencia_registros',
      'asistencia_sesiones',
      'asistencia_reglas',
      'alumnos',
      'periodos',
      'sesiones_docente',
      'recuperacion_contrasena_docente',
      'docentes'
    ];

    for (const table of tables) {
      if (existingNames.has(table.toLowerCase())) {
        await prisma.$executeRawUnsafe(`DELETE FROM ${table};`);
      }
    }
  } catch {
    // Ignorar si hay algún error
  }
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
}

export async function cerrarMongoTest() {
  await prisma.$disconnect();
  // Borrar el archivo de base de datos de pruebas temporal para higiene
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch {
      // Ignorar si está bloqueado temporalmente
    }
  }
}
