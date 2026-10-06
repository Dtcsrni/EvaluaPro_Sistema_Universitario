import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const nativeLauncher = fs.readFileSync(path.join(root, 'scripts', 'start-docente-native.mjs'), 'utf8');
const sqliteRuntime = fs.readFileSync(path.join(root, 'apps', 'backend', 'src', 'infraestructura', 'baseDatos', 'sqlite.ts'), 'utf8');
const msiBuilder = fs.readFileSync(path.join(root, 'scripts', 'build-msi.ps1'), 'utf8');
const installerHelper = fs.readFileSync(path.join(root, 'scripts', 'installer-burn', 'InstallerBurnHelper.ps1'), 'utf8');
const runtimeEnv = fs.readFileSync(path.join(root, 'scripts', 'runtime-env.mjs'), 'utf8');
const staticServer = fs.readFileSync(path.join(root, 'scripts', 'serve-docente-static.mjs'), 'utf8');
const bundleGuard = fs.readFileSync(path.join(root, 'scripts', 'docente-bundle-guard.mjs'), 'utf8');
const cicloPlaywright = fs.readFileSync(path.join(root, 'tests', 'gui-responsive', 'playwright.ciclo.config.mjs'), 'utf8');

test('el arranque nativo evita duplicar API o web cuando el puerto ya está ocupado', () => {
  assert.match(nativeLauncher, /probeHttpEndpoint/);
  assert.match(nativeLauncher, /isPortInUse/);
  assert.match(nativeLauncher, /canLaunchHttpService\('api'/);
  assert.match(nativeLauncher, /canLaunchHttpService\('web'/);
  assert.match(nativeLauncher, /se evita un segundo proceso/);
  assert.match(nativeLauncher, /se mantiene el supervisor activo/);
});

test('el launcher nativo recarga configuración Classroom del .env frente a un supervisor obsoleto', () => {
  assert.match(nativeLauncher, /overrideKeys:\s*obtenerClavesEnvAutoritativas\(/);
  assert.match(runtimeEnv, /'CLASSROOM_ENABLED'/);
  assert.match(runtimeEnv, /'GOOGLE_CLASSROOM_CLIENT_ID'/);
  assert.match(runtimeEnv, /'GOOGLE_CLASSROOM_CLIENT_SECRET'/);
  assert.match(runtimeEnv, /'GOOGLE_CLASSROOM_REDIRECT_URI'/);
  assert.match(runtimeEnv, /'CLASSROOM_TOKEN_CIPHER_KEY'/);
  assert.match(runtimeEnv, /nodeEnv[\s\S]*production[\s\S]*flavor[\s\S]*docente-local/);
});

test('el runtime y el payload nativo incluyen las migraciones SQLite nuevas', () => {
  const migrations = [
    'migrate-calificacion-origen-inferida-sqlite.mjs',
    'migrate-preferencias-retencion-parcial-sqlite.mjs',
    'migrate-resultados-extra-externos-sqlite.mjs'
  ];
  for (const migration of migrations) {
    assert.ok(sqliteRuntime.includes(`ejecutarMigracionSqliteAdicional('${migration}')`));
    assert.ok(msiBuilder.includes(migration), `El MSI debe empaquetar ${migration}.`);
    assert.ok(installerHelper.includes(migration), `El instalador debe validar ${migration}.`);
  }
});

test('el servidor estático registra EADDRINUSE sin dejar un error no controlado', () => {
  assert.match(staticServer, /server\.on\('error'/);
  assert.match(staticServer, /no se pudo iniciar/);
  assert.doesNotMatch(staticServer, /server\.listen\([^\n]+\);\s*\n\s*function stop/);
});

test('el journey docente-alumno inicia el portal y apunta al puerto correcto', () => {
  assert.match(cicloPlaywright, /const portalApiPort = Number\(process\.env\.E2E_PORTAL_API_PORT \|\| 8080\)/);
  assert.match(cicloPlaywright, /E2E_DISABLE_PORTAL: process\.env\.E2E_DISABLE_PORTAL \|\| '0'/);
  assert.match(cicloPlaywright, /VITE_PORTAL_BASE_URL: `http:\/\/127\.0\.0\.1:\$\{portalApiPort\}\/api\/portal`/);
  assert.match(nativeLauncher, /const portalApiPort = String\(process\.env\.E2E_PORTAL_API_PORT \|\| '8080'\)/);
  assert.match(nativeLauncher, /env\.PORTAL_ALUMNO_URL = `http:\/\/127\.0\.0\.1:\$\{portalApiPort\}`/);
});

test('servidor docente bloquea bundles viejos o incompletos antes de escuchar', () => {
  assert.match(staticServer, /assertDocenteBundle/);
  assert.match(staticServer, /bundle validado/);
  assert.match(bundleGuard, /evaluapro-ui-contract/);
  assert.match(bundleGuard, /docente-frosted-editorial-v2/);
  assert.match(bundleGuard, /assets compilados/);
  assert.match(bundleGuard, /styleContract/);
});
