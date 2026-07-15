/**
 * Seed y ciclo API local del flavor docente.
 * Crea datos aislados, los verifica y los elimina al finalizar.
 */
import assert from 'node:assert/strict';

const baseUrl = (process.env.E2E_DOCENTE_BASE_URL || 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const stamp = Date.now().toString(36);
const correo = process.env.E2E_DOCENTE_EMAIL || `e2e.docente.${stamp}@example.test`;
const contrasena = process.env.E2E_DOCENTE_PASSWORD || `E2eLocal-${stamp}-Seguro!`;
const resultados = { baseUrl, cuenta: correo, materias: [], alumnos: [], cleanup: [], cleanupErrors: [] };

async function cleanupLocalFallback() {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(`${baseUrl}/`)) {
    throw new Error('la limpieza directa solo se permite contra una API localhost');
  }
  process.env.DATABASE_URL ||= 'file:V:/Software/EvaluaPro/apps/backend/data/evaluapro.db';
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const docentes = await prisma.docente.findMany({
      where: { correo },
      select: { id: true }
    });
    for (const docente of docentes) {
      const alumnos = await prisma.alumno.deleteMany({ where: { periodo: { docenteId: docente.id } } });
      const periodos = await prisma.periodo.deleteMany({ where: { docenteId: docente.id } });
      resultados.cleanup.push(`alumnos-local:${alumnos.count}`, `materias-local:${periodos.count}`);
      await prisma.docente.delete({ where: { id: docente.id } });
    }
    resultados.cleanup.push('cuenta:local-db');
    resultados.cleanupMode = 'api+local-db-fallback';
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
  for (const id of resultados.alumnos.reverse()) {
    try { await request(`/alumnos/${id}/eliminar`, { method: 'POST', headers: auth, body: '{}' }); resultados.cleanup.push(`alumno:${id}`); }
    catch (error) { resultados.cleanupErrors.push(`alumno:${id}:${error.message}`); }
  }
for (const id of resultados.materias.reverse()) {
    try { await request(`/periodos/${id}/eliminar`, { method: 'POST', headers: auth, body: '{}' }); resultados.cleanup.push(`materia:${id}`); }
    catch (error) { resultados.cleanupErrors.push(`materia:${id}:${error.message}`); }
  }
}

if (resultados.cleanupErrors.length > 0) await cleanupLocalFallback();
assert.equal(resultados.cleanupErrors.length, 0, `la limpieza dummy debe ser completa: ${resultados.cleanupErrors.join('; ')}`);
assert.ok(resultados.cleanup.some((entry) => entry.startsWith('alumnos-local:3')), 'debe limpiar 3 alumnos');
assert.ok(resultados.cleanup.some((entry) => entry.startsWith('materias-local:3')), 'debe limpiar 3 materias');
assert.ok(resultados.cleanup.includes('cuenta:local-db'), 'debe limpiar la cuenta dummy');
console.log(JSON.stringify(resultados, null, 2));
