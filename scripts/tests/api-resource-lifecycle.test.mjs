import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditarCoberturaModelos } from '../api/check-resource-lifecycle.mjs';

test('el inventario CRUD declara cada modelo Prisma y no conserva nombres inexistentes', () => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const schema = fs.readFileSync(path.join(rootDir, 'apps/backend/prisma/schema.prisma'), 'utf8');
  const lifecycle = fs.readFileSync(path.join(rootDir, 'scripts/api/RESOURCE_LIFECYCLE.md'), 'utf8');
  const result = auditarCoberturaModelos({ schema, lifecycle });

  assert.equal(result.totalModels, 68);
  assert.equal(result.missing.length, 0, `Modelos sin ciclo declarado: ${result.missing.join(', ')}`);
  assert.equal(result.unknown.length, 0, `Nombres que no son modelos: ${result.unknown.join(', ')}`);
});

test('la auditoría identifica los modelos omitidos y nombres inventados', () => {
  const result = auditarCoberturaModelos({
    schema: 'model Alumno {\n id String\n}\nmodel Calificacion {\n id String\n}',
    lifecycle: '# test\n| Recurso de dominio | Modelos persistidos principales |\n| --- | --- |\n| Alumnos | `Alumno`, `ModeloFalso` |\n\n## Siguiente trabajo de auditoría'
  });

  assert.deepEqual(result.missing, ['Calificacion']);
  assert.deepEqual(result.unknown, ['ModeloFalso']);
});
