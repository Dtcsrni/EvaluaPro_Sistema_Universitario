/**
 * Seed y ciclo API local del flavor docente.
 * Crea datos aislados, los verifica y los elimina al finalizar.
 */
import assert from 'node:assert/strict';
import { realpath } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = (process.env.E2E_DOCENTE_BASE_URL || 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const stamp = Date.now().toString(36);
const correo = process.env.E2E_DOCENTE_EMAIL || `e2e.docente.${stamp}@example.test`;
const contrasena = process.env.E2E_DOCENTE_PASSWORD || `E2eLocal-${stamp}-Seguro!`;
const resultados = { baseUrl, cuenta: correo, materias: [], alumnos: [], cleanup: [], cleanupErrors: [] };

async function cleanupLocalFallback() {
  const apiCleanupErrors = [...resultados.cleanupErrors];
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(`${baseUrl}/`)) {
    throw new Error('la limpieza directa solo se permite contra una API localhost');
  }
  const requestedSqlitePath = process.env.E2E_DOCENTE_SQLITE_PATH;
  if (!requestedSqlitePath || !path.win32.isAbsolute(requestedSqlitePath)) {
    throw new Error('E2E_DOCENTE_SQLITE_PATH es obligatorio para limpieza local confinada');
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData || path.win32.basename(requestedSqlitePath).toLowerCase() !== 'evaluapro.db') {
    throw new Error('la limpieza local requiere LOCALAPPDATA y la SQLite esperada del instalador');
  }
  const sqlitePath = path.win32.resolve(requestedSqlitePath);
  const localRoot = path.win32.resolve(localAppData);
  const relativePath = path.win32.relative(localRoot, sqlitePath);
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${path.win32.sep}`) || path.win32.isAbsolute(relativePath)) {
    throw new Error('la limpieza local solo permite una base bajo LOCALAPPDATA');
  }
  const [realSqlitePath, realLocalRoot] = await Promise.all([realpath(sqlitePath), realpath(localRoot)]);
  const realRelativePath = path.win32.relative(realLocalRoot, realSqlitePath);
  if (!realRelativePath || realRelativePath === '..' || realRelativePath.startsWith(`..${path.win32.sep}`) || path.win32.isAbsolute(realRelativePath)) {
    throw new Error('la ruta real de la SQLite debe permanecer bajo LOCALAPPDATA');
  }
  process.env.DATABASE_URL = `file:${sqlitePath.replace(/\\/g, '/')}`;
  process.env.BACKEND_DATABASE_URL = process.env.DATABASE_URL;
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
  const databaseUrl = process.env.BACKEND_DATABASE_URL || process.env.DATABASE_URL || 'file:./data/evaluapro.db';
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
  try {
    const docentes = await prisma.docente.findMany({
      where: { correo },
      select: { id: true }
    });
    const nombresPeriodo = Array.from({ length: 3 }, (_, index) => `Materia E2E Local ${stamp}-${index + 1}`);
    const correosAlumno = Array.from({ length: 3 }, (_, index) => `alumno.e2e.${stamp}.${index + 1}@cuh.mx`);
    let alumnosEliminados = 0;
    let periodosEliminados = 0;
    let papelerasEliminadas = 0;
    let cuentasEliminadas = 0;

    for (const docente of docentes) {
      const periodos = await prisma.periodo.findMany({
        where: { docenteId: docente.id, OR: [{ id: { in: resultados.materias } }, { nombre: { in: nombresPeriodo } }] },
        select: { id: true }
      });
      const periodoIds = [...new Set([...resultados.materias, ...periodos.map(({ id }) => id)])];
      const alumnos = await prisma.alumno.deleteMany({
        where: {
          OR: [
            { id: { in: resultados.alumnos } },
            { correo: { in: correosAlumno } },
            { periodo: { is: { id: { in: periodoIds }, docenteId: docente.id } } }
          ]
        }
      });
      alumnosEliminados += alumnos.count;
      const periodosBorrados = await prisma.periodo.deleteMany({ where: { id: { in: periodoIds }, docenteId: docente.id } });
      periodosEliminados += periodosBorrados.count;
      const papelera = await prisma.papeleraItem.deleteMany({ where: { docenteId: docente.id } });
      papelerasEliminadas += papelera.count;
      const cuenta = await prisma.docente.deleteMany({ where: { id: docente.id, correo } });
      cuentasEliminadas += cuenta.count;
    }

    const [cuentasRestantes, periodosRestantes, alumnosRestantes] = await Promise.all([
      prisma.docente.count({ where: { correo } }),
      prisma.periodo.count({
        where: { OR: [{ id: { in: resultados.materias } }, { docente: { is: { correo } }, nombre: { in: nombresPeriodo } }] }
      }),
      prisma.alumno.count({ where: { OR: [{ id: { in: resultados.alumnos } }, { correo: { in: correosAlumno } }] } })
    ]);
    assert.equal(cuentasRestantes, 0, 'la cuenta dummy debe desaparecer de la SQLite aislada');
    assert.equal(periodosRestantes, 0, 'las materias dummy deben desaparecer de la SQLite aislada');
    assert.equal(alumnosRestantes, 0, 'los alumnos dummy deben desaparecer de la SQLite aislada');
    resultados.cleanup.push(`alumnos-local:${alumnosEliminados}`, `materias-local:${periodosEliminados}`, `papelera-local:${papelerasEliminadas}`);
    resultados.cleanup.push(`cuenta-local:${cuentasEliminadas}`);
    resultados.cleanup.push('cuenta:local-db');
    resultados.cleanupVerified = true;
    resultados.cleanupMode = 'api+verified-isolated-local-db';
    resultados.cleanupApiErrors = apiCleanupErrors;
    resultados.cleanupErrors = [];
  } finally {
    await prisma.$disconnect();
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

const registro = await request('/autenticacion/registrar', {
  method: 'POST',
  body: JSON.stringify({ nombreCompleto: 'Docente E2E Local', correo, contrasena })
});
const token = registro.token || (await request('/autenticacion/ingresar', {
  method: 'POST', body: JSON.stringify({ correo, contrasena })
})).token;
assert.ok(token, 'el registro/login debe entregar token');
const auth = { Authorization: `Bearer ${token}` };
resultados.cuentaCreada = true;

try {
  for (let i = 1; i <= 3; i += 1) {
    const periodo = await request('/periodos', {
      method: 'POST', headers: auth,
      body: JSON.stringify({
        nombre: `Materia E2E Local ${stamp}-${i}`,
        fechaInicio: '2026-01-01', fechaFin: '2026-12-31', grupos: ['E2E']
      })
    });
    const materia = periodo.periodo;
    assert.ok(materia?.id, 'la materia debe devolver id');
    resultados.materias.push(materia.id);
  }
  for (let i = 1; i <= 3; i += 1) {
    const alumno = await request('/alumnos', {
      method: 'POST', headers: auth,
      body: JSON.stringify({
        periodoId: resultados.materias[0], matricula: `CUH${String(990000000 + i)}`,
        nombreCompleto: `Alumno E2E ${i}`, correo: `alumno.e2e.${stamp}.${i}@cuh.mx`, grupo: 'E2E'
      })
    });
    assert.ok(alumno.alumno?.id, 'el alumno debe devolver id');
    resultados.alumnos.push(alumno.alumno.id);
  }
  const periodos = await request('/periodos', { headers: auth });
  const alumnos = await request(`/alumnos?periodoId=${encodeURIComponent(resultados.materias[0])}`, { headers: auth });
  assert.ok(periodos.periodos?.some(({ id }) => id === resultados.materias[0]));
  assert.equal(alumnos.alumnos?.filter(({ id }) => resultados.alumnos.includes(id)).length, 3);
  resultados.verificado = true;
} finally {
  for (const id of [...resultados.alumnos].reverse()) {
    try { await request(`/alumnos/${id}/eliminar`, { method: 'POST', headers: auth, body: '{}' }); resultados.cleanup.push(`alumno:${id}`); }
    catch (error) { resultados.cleanupErrors.push(`alumno:${id}:${error.message}`); }
  }
  for (const id of [...resultados.materias].reverse()) {
    try { await request(`/periodos/${id}/eliminar`, { method: 'POST', headers: auth, body: '{}' }); resultados.cleanup.push(`materia:${id}`); }
    catch (error) { resultados.cleanupErrors.push(`materia:${id}:${error.message}`); }
  }
}

await cleanupLocalFallback();
assert.equal(resultados.cleanupErrors.length, 0, `la limpieza dummy debe ser completa: ${resultados.cleanupErrors.join('; ')}`);
assert.equal(resultados.cleanupVerified, true, 'debe verificar la eliminación de todos los datos dummy');
assert.ok(resultados.cleanup.includes('cuenta:local-db'), 'debe limpiar la cuenta dummy');
console.log(JSON.stringify(resultados, null, 2));
