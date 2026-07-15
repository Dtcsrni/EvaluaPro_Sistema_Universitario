/**
 * Contratos deterministas del lifecycle nativo del Installer Hub.
 * Verifica rutas alcanzables sin ejecutar una mutacion del equipo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const helper = fs.readFileSync(path.join(root, 'scripts', 'installer-burn', 'InstallerBurnHelper.ps1'), 'utf8');
const bootstrapper = fs.readFileSync(path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'EvaluaProBootstrapperApplication.cs'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'scripts', 'tests', 'installer-hub-e2e-docente.ps1'), 'utf8');
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'reports', 'qa', 'latest', 'gui-screen-matrix.json'), 'utf8'));

function luminance(hex) {
  const rgb = hex.slice(1).match(/.{2}/g).map((part) => Number.parseInt(part, 16) / 255);
  const linear = rgb.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

test('lifecycle helper expone todos los modos implementados', () => {
  assert.match(helper, /ValidateSet\('detect-prereqs', 'post-install', 'update', 'uninstall'\)/);
  for (const mode of ['detect-prereqs', 'post-install', 'update', 'uninstall']) {
    assert.match(helper, new RegExp(`Mode -eq '${mode}'`));
  }
});

test('lifecycle bootstrapper normaliza operaciones peligrosas de forma explícita', () => {
  assert.match(bootstrapper, /"repair" => "repair"/);
  assert.match(bootstrapper, /"uninstall" => "uninstall"/);
  assert.match(bootstrapper, /_ => "install"/);
  assert.match(bootstrapper, /currentOperation switch/);
});

test('cada invocación de helper tiene correlación y respuesta aisladas', () => {
  assert.match(bootstrapper, /Directory\.CreateDirectory\(requestRoot\)/);
  assert.match(bootstrapper, /Guid\.NewGuid\(\)/);
  assert.match(bootstrapper, /correlationId/);
  assert.match(bootstrapper, /\.request\.json/);
  assert.match(bootstrapper, /\.response\.json/);
});

test('runner limita broker y mata solo su árbol al vencer timeout', () => {
  assert.match(runner, /\$TimeoutSec = 60/);
  assert.match(runner, /WaitForExit\(\$TimeoutSec \* 1000\)/);
  assert.match(runner, /taskkill\.exe \/PID \$process\.Id \/T \/F/);
  assert.match(runner, /timeout=\$\{TimeoutSec\}s/);
  assert.match(runner, /EvaluaPro\.BurnBootstrapperApp/);
  assert.match(runner, /MainWindowHandle/);
  assert.match(runner, /AutomationElement\]::FromHandle/);
  assert.match(runner, /PrintWindow/);
  assert.match(runner, /estado JSON healthy/);
  assert.match(runner, /open-dashboard sigue vivo como proceso persistente/);
});

test('matriz visual cubre lifecycle, contraste y escenarios de recuperación', () => {
  assert.equal(matrix.version, 2);
  assert.equal(matrix.acceptance.lifecycleScenarioCoverageRequired, true);
  assert.equal(matrix.acceptance.contrastStateCoverageRequired, true);
  assert.equal(matrix.acceptance.visualEvidenceManifestRequired, true);
  const ids = new Set(matrix.lifecycleScenarios.map((scenario) => scenario.id));
  for (const id of ['install-success', 'repair-success', 'update-rejected-integrity', 'uninstall-uac-rejected', 'restart-required', 'broker-degraded', 'close-blocked']) {
    assert.ok(ids.has(id), `falta escenario ${id}`);
  }
});

test('paleta semántica del Hub conserva contraste mínimo en estados críticos', () => {
  const pairs = [
    ['#E6FAFF', '#123E53'], // activo
    ['#D8FFF1', '#123F35'], // éxito
    ['#FFE8EE', '#4A1D2B'], // error
    ['#FFF1C7', '#4A3213'], // advertencia
    ['#D7E6F5', '#172A3E'] // pendiente
  ];
  for (const [foreground, background] of pairs) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground}/${background} no alcanza WCAG AA`);
  }
});
