import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolverPermisosSesion } from '../api/sesion-local-permissions.mjs';

test('la autorización OMR pide solo scopes usados por el flujo de calificación', () => {
  assert.deepEqual(resolverPermisosSesion(['--purpose=omr-grading']), [
    'omr:analizar', 'banco:leer', 'calificaciones:calificar'
  ]);
});

test('la sesión conserva el conjunto de solo lectura si no se indica propósito', () => {
  assert.deepEqual(resolverPermisosSesion([]), [
    'periodos:leer', 'temarios:leer', 'banco:leer', 'plantillas:leer', 'examenes:leer'
  ]);
});

test('status sin propósito conserva la consulta de autenticación sin exigir scopes', () => {
  assert.deepEqual(resolverPermisosSesion([], { defaultPermissions: false }), []);
});

test('los scopes personalizados se limpian y deduplican', () => {
  assert.deepEqual(resolverPermisosSesion(['--permissions=omr:analizar, omr:analizar,calificaciones:calificar']), [
    'omr:analizar', 'calificaciones:calificar'
  ]);
});

test('rechaza propósitos desconocidos y opciones de permisos simultáneas', () => {
  assert.throws(() => resolverPermisosSesion(['--purpose=admin']), /purpose debe ser omr-grading/);
  assert.throws(() => resolverPermisosSesion(['--purpose=omr-grading', '--permissions=omr:analizar']), /no ambos/);
});

test('status comprueba permisos requeridos y falla cerrado ante scopes ausentes', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const cli = fs.readFileSync(path.join(root, 'api', 'sesion-local.mjs'), 'utf8');
  assert.match(cli, /const requiredPermissions = resolverPermisosSesion\(argumentos, \{ defaultPermissions: false \}\);/);
  assert.match(cli, /api\.preflight\(\{ requiredPermissions \}\)/);
  assert.match(cli, /estado\.permissionCheck\.state !== 'satisfied'\) process\.exitCode = 3/);
});
