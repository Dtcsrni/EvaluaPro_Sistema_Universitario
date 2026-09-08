/** E2E real de sincronización 1:1 entre dos instalaciones SQLite independientes. */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-two-computers-'));
const baseEquipoA = path.join(raiz, 'equipo-a', 'evaluapro.db');
const baseEquipoB = path.join(raiz, 'equipo-b', 'evaluapro.db');
const carpetaCompartidaConfigurada = String(process.env.EVALUAPRO_SYNC_E2E_CLOUD_DIR || '').trim();
const carpetaCompartida = carpetaCompartidaConfigurada
  ? path.resolve(carpetaCompartidaConfigurada)
  : await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-two-computers-cloud-'));
const docenteId = 'dos-equipos-docente';
const password = 'DosEquipos-Password-123!';
const equipoA = 'equipo-a-e2e-123456';
const equipoB = 'equipo-b-e2e-123456';

const rutaSqlite = pathToFileURL(path.resolve(process.cwd(), 'src/infraestructura/baseDatos/sqlite.ts')).href;
const rutaHash = pathToFileURL(path.resolve(process.cwd(), 'src/modulos/modulo_autenticacion/servicioHash.ts')).href;
const rutaSync = pathToFileURL(path.resolve(process.cwd(), 'src/modulos/modulo_sincronizacion_nube/domain/leaseSincronizacion.ts')).href;

const worker = `
const { prisma, conectarSqlite, desconectarSqlite } = await import(${JSON.stringify(rutaSqlite)});
const { crearHash } = await import(${JSON.stringify(rutaHash)});
const modulo = await import(${JSON.stringify(rutaSync)});
const docenteId = process.env.EVALUAPRO_SYNC_E2E_DOCENTE;
const password = process.env.EVALUAPRO_SYNC_E2E_PASSWORD;
const equipoId = process.env.EVALUAPRO_SYNC_E2E_EQUIPO;
const op = process.env.EVALUAPRO_SYNC_E2E_OP;
try {
  await conectarSqlite();
  if (op === 'preparar') {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
    const tablas = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    for (const tabla of tablas) await prisma.$executeRawUnsafe(\`DELETE FROM "\${tabla.name.replace(/"/g, '""')}"\`);
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
    await prisma.docente.create({ data: { id: docenteId, correo: 'dos-equipos@evaluapro.test', nombreCompleto: 'Docente Dos Equipos', hashContrasena: await crearHash(password), roles: '["docente"]', activo: true } });
    if (process.env.EVALUAPRO_SYNC_E2E_SEMILLA === '1') {
      await prisma.periodo.create({ data: { id: 'periodo-dos-equipos', docenteId, nombre: 'Materia sincronizada', nombreNormalizado: 'materia sincronizada', fechaInicio: new Date('2026-01-01T00:00:00.000Z'), fechaFin: new Date('2026-06-30T00:00:00.000Z'), grupos: '["A"]' } });
    }
  } else if (op === 'publicar') {
    const lease = await modulo.adquirirLease(docenteId, equipoId);
    const publicado = await modulo.publicarInstantaneaNube({ docenteId, equipoId, leaseId: lease.lease.leaseId, metodo: 'contrasena', credencial: password });
    const estado = await modulo.obtenerEstadoLease(docenteId, equipoId);
    console.log(JSON.stringify({ publicado, estado }));
  } else if (op === 'competir') {
    const lease = await modulo.adquirirLease(docenteId, equipoId);
    console.log(JSON.stringify({ lease }));
  } else if (op === 'liberar') {
    const liberado = await modulo.liberarLease(docenteId, equipoId, process.env.EVALUAPRO_SYNC_E2E_LEASE_ID || '');
    console.log(JSON.stringify({ liberado }));
  } else if (op === 'importar') {
    const lease = await modulo.adquirirLease(docenteId, equipoId);
    const seco = await modulo.importarInstantaneaNube({ docenteId, equipoId, leaseId: lease.lease.leaseId, metodo: 'contrasena', credencial: password, dryRun: true });
    const aplicado = await modulo.importarInstantaneaNube({ docenteId, equipoId, leaseId: lease.lease.leaseId, metodo: 'contrasena', credencial: password, dryRun: false });
    const periodo = await prisma.periodo.findUnique({ where: { id: 'periodo-dos-equipos' } });
    console.log(JSON.stringify({ seco, aplicado, periodo }));
  } else {
    throw new Error('Operación E2E desconocida');
  }
} catch (error) {
  console.error(JSON.stringify({ codigo: error?.codigo, mensaje: error?.message }));
  process.exitCode = 1;
} finally {
  await desconectarSqlite();
}
`;

function ejecutarWorker(params: { db: string; equipoId?: string; leaseId?: string; op: 'preparar' | 'publicar' | 'importar' | 'competir' | 'liberar'; semilla?: boolean }) {
  return new Promise<Record<string, any>>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', worker], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        EVALUAPRO_LOG_SILENT: '1',
        DATABASE_URL: `file:${params.db.replace(/\\/g, '/')}`,
        BACKEND_DATABASE_URL: `file:${params.db.replace(/\\/g, '/')}`,
        EVALUAPRO_SYNC_CLOUD_DIR: carpetaCompartida,
        EVALUAPRO_SYNC_E2E_DOCENTE: docenteId,
        EVALUAPRO_SYNC_E2E_PASSWORD: password,
        EVALUAPRO_SYNC_E2E_EQUIPO: params.equipoId || '',
        EVALUAPRO_SYNC_E2E_LEASE_ID: params.leaseId || '',
        EVALUAPRO_SYNC_E2E_OP: params.op,
        EVALUAPRO_SYNC_E2E_SEMILLA: params.semilla ? '1' : '0'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker ${params.op} terminó con exit=${code}: ${stderr || stdout}`));
        return;
      }
      if (params.op === 'preparar') {
        resolve({});
        return;
      }
      try { resolve(JSON.parse(stdout.trim()) as Record<string, any>); }
      catch (error) { reject(new Error(`Worker ${params.op} no devolvió JSON válido: ${String(error)}\n${stdout}\n${stderr}`)); }
    });
  });
}

describe('sincronización E2E entre dos equipos', () => {
  beforeAll(async () => {
    await fs.mkdir(path.dirname(baseEquipoA), { recursive: true });
    await fs.mkdir(path.dirname(baseEquipoB), { recursive: true });
    await ejecutarWorker({ db: baseEquipoA, op: 'preparar', semilla: true });
    await ejecutarWorker({ db: baseEquipoB, op: 'preparar' });
  });

  afterAll(async () => {
    await fs.rm(raiz, { recursive: true, force: true });
    if (!carpetaCompartidaConfigurada) await fs.rm(carpetaCompartida, { recursive: true, force: true });
  });

  it('solo permite un lease cuando dos procesos independientes compiten simultáneamente', async () => {
    const resultados = await Promise.allSettled([
      ejecutarWorker({ db: baseEquipoA, equipoId: equipoA, op: 'competir' }),
      ejecutarWorker({ db: baseEquipoB, equipoId: equipoB, op: 'competir' })
    ]);
    const exitosos = resultados.filter((resultado): resultado is PromiseFulfilledResult<Record<string, any>> => resultado.status === 'fulfilled');
    const fallidos = resultados.filter((resultado): resultado is PromiseRejectedResult => resultado.status === 'rejected');

    expect(exitosos).toHaveLength(1);
    expect(fallidos).toHaveLength(1);
    expect(String(fallidos[0].reason?.message || fallidos[0].reason)).toContain('SYNC_LEASE_OCUPADO');

    const ganador = exitosos[0].value.lease.lease;
    expect(ganador.leaseId).toMatch(/^[A-Za-z0-9-]{16,128}$/);
    await ejecutarWorker({ db: baseEquipoA, equipoId: ganador.equipoId, leaseId: ganador.leaseId, op: 'liberar' });
  });

  it('publica desde A e importa 1:1 en B usando la carpeta compartida', async () => {
    const publicado = await ejecutarWorker({ db: baseEquipoA, equipoId: equipoA, op: 'publicar' });
    const importado = await ejecutarWorker({ db: baseEquipoB, equipoId: equipoB, op: 'importar' });

    expect(publicado.publicado.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(importado.seco.mensaje).toBe('Instantánea válida');
    expect(importado.aplicado.requiereReinicioSesion).toBe(true);
    expect(importado.periodo).toMatchObject({ id: 'periodo-dos-equipos', nombre: 'Materia sincronizada', docenteId });
  });
});
