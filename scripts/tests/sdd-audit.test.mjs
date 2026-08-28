/**
 * sdd-audit.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { validateSpecContent } from '../sdd-audit.mjs';

test('validateSpecContent - spec válida con frontmatter y secciones correctas', () => {
  const content = `---
id: SPEC-101
titulo: Spec de Prueba
version: 1.0.0
fecha: 2026-06-23
autor: Test Runner
modulo: devops
estado: draft
---

# SPEC-101: Spec de Prueba

## Contexto
Detalle del contexto.

## Requisitos Funcionales
- REQ-001: Hacer algo.

## Criterios de Aceptación
- AC-001: Probar algo.

## Matriz de Trazabilidad

| ID | Desc | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Caso | scripts/tests/sdd-audit.test.mjs | Completado |
`;

  const result = validateSpecContent('test.spec.md', content);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.metadata.id, 'SPEC-101');
  assert.strictEqual(result.metadata.estado, 'draft');
  assert.deepStrictEqual(result.testPaths, ['scripts/tests/sdd-audit.test.mjs']);
});

test('validateSpecContent - falla cuando falta YAML frontmatter', () => {
  const content = `
# SPEC-101: Spec de Prueba

## Contexto
Detalle.
`;

  const result = validateSpecContent('test.spec.md', content);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((err) => err.includes('YAML Frontmatter ausente')));
});

test('validateSpecContent - falla cuando faltan campos requeridos en frontmatter', () => {
  const content = `---
id: SPEC-101
version: 1.0.0
estado: draft
---

# SPEC-101: Spec de Prueba
`;

  const result = validateSpecContent('test.spec.md', content);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((err) => err.includes('titulo')));
  assert.ok(result.errors.some((err) => err.includes('fecha')));
  assert.ok(result.errors.some((err) => err.includes('autor')));
  assert.ok(result.errors.some((err) => err.includes('modulo')));
});

test('validateSpecContent - falla cuando el estado es inválido', () => {
  const content = `---
id: SPEC-101
titulo: Spec
version: 1.0.0
fecha: 2026-06-23
autor: Test Runner
modulo: devops
estado: invalid-status
---
`;

  const result = validateSpecContent('test.spec.md', content);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((err) => err.includes('Estado inválido')));
});

test('validateSpecContent - falla cuando faltan secciones obligatorias', () => {
  const content = `---
id: SPEC-101
titulo: Spec de Prueba
version: 1.0.0
fecha: 2026-06-23
autor: Test Runner
modulo: devops
estado: draft
---

# SPEC-101: Spec de Prueba

## Contexto
Detalle del contexto.
`;

  const result = validateSpecContent('test.spec.md', content);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((err) => err.includes('Requisitos Funcionales')));
  assert.ok(result.errors.some((err) => err.includes('Criterios de Aceptación')));
  assert.ok(result.errors.some((err) => err.includes('Matriz de Trazabilidad')));
});

test('validateSpecContent - falla cuando un archivo de test en la matriz no existe', () => {
  const content = `---
id: SPEC-101
titulo: Spec de Prueba
version: 1.0.0
fecha: 2026-06-23
autor: Test Runner
modulo: devops
estado: draft
---

# SPEC-101: Spec de Prueba

## Contexto
Detalle.

## Requisitos Funcionales
- REQ-001

## Criterios de Aceptación
- AC-001

## Matriz de Trazabilidad

| ID | Desc | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Caso | apps/backend/tests/nonexistent.test.ts | Completado |
`;

  const result = validateSpecContent('test.spec.md', content);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((err) => err.includes('no existe: "apps/backend/tests/nonexistent.test.ts"')));
});
