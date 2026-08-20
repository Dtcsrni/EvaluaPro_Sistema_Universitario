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
const hubWindow = fs.readFileSync(path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'MainWindow.xaml.cs'), 'utf8');
const productWxs = fs.readFileSync(path.join(root, 'packaging', 'wix', 'Product.wxs'), 'utf8');
const msiBuild = fs.readFileSync(path.join(root, 'scripts', 'build-msi.ps1'), 'utf8');
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
  assert.match(helper, /ValidateSet\('detect-prereqs', 'post-install', 'license-heartbeat', 'update', 'uninstall'\)/);
  for (const mode of ['detect-prereqs', 'post-install', 'license-heartbeat', 'update', 'uninstall']) {
    assert.match(helper, new RegExp(`Mode -eq '${mode}'`));
  }
});

test('post-install ejecuta activacion comercial solo cuando el flavor la requiere y conserva grace local', () => {
  assert.match(helper, /Invoke-EvaluaProLicenseActivationSecure/);
  assert.match(helper, /Get-EvaluaProCommercialLicenseState/);
  assert.match(helper, /No se pudo validar online; se conserva la licencia local/);
  assert.match(helper, /requiresLicense/);
  assert.match(helper, /EvaluaProCommercialLicenseHeartbeat/);
  assert.match(helper, /Invoke-EvaluaProLicenseHeartbeatSecure/);
  assert.match(helper, /Unregister-ScheduledTask -TaskName \"EvaluaProCommercialLicenseHeartbeat\"/);
  assert.match(helper, /state -eq 'comunitaria'/);
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

test('helper PowerShell tiene timeout por operación y cancela su árbol', () => {
  assert.match(bootstrapper, /GetHelperTimeout\(mode\)/);
  assert.match(bootstrapper, /WaitForExitAsync\(timeoutCts\.Token\)/);
  assert.match(bootstrapper, /Kill\(entireProcessTree: true\)/);
  assert.match(bootstrapper, /request=\{requestPath\} response=\{responsePath\}/);
  assert.match(runner, /\[int\]\$TimeoutMinutes = 10/);
});

test('runtime nativo tolera arranque lento sin reinicio prematuro', () => {
  const dashboard = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');
  assert.match(dashboard, /waitForLifecycleHealth\(desiredMode, flavorPolicy\.requireLocalPortal, 90_000\)/);
  assert.match(dashboard, /async function waitForLifecycleHealth/);
  assert.match(runner, /\$deadline = \(Get-Date\)\.AddSeconds\((?:90|120|150)\)/);
  assert.match(runner, /Runtime nativo no alcanzó salud API\/web en (?:90|120|150)s/);
});

test('dashboard lanza Node nativo directamente y conserva su árbol', () => {
  const dashboard = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');
  assert.match(dashboard, /const isNativeRuntime = command === nativeDocenteCommand/);
  assert.match(dashboard, /spawn\(nativeNodePath, \[path\.join\(root, 'scripts', 'start-docente-native\.mjs'\)\]/);
  assert.match(dashboard, /spawn\('cmd\.exe', \['\/d', '\/s', '\/c', command\]/);
});

test('runner serializa Windows Installer y no mata el Hub durante una transacción', () => {
  assert.match(runner, /function Wait-WindowsInstallerIdle/);
  assert.match(runner, /Wait-WindowsInstallerIdle -TimeoutSec 300 -Context "before-\$Mode"/);
  assert.match(runner, /Wait-ControlEnabled -RootElement \$window -AutomationId 'CloseButton' -TimeoutSec 600/);
  assert.match(runner, /\$process\.WaitForExit\(30000\)/);
  assert.match(runner, /\$process\.CloseMainWindow\(\)/);
  assert.match(runner, /persistente tras estado final/);
  assert.match(runner, /Wait-WindowsInstallerIdle -TimeoutSec 300 -Context "after-\$Mode"/);
  assert.match(runner, /\[int\]\$TimeoutMinutes = 10/);
  assert.match(runner, /Installer\\InProgress/);
  assert.match(runner, /ParentProcessId -ne 1604/);
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

test('MSI docente usa un CAB embebido y el build valida su extracción con límite', () => {
  assert.match(productWxs, /<MediaTemplate EmbedCab="yes" CompressionLevel="mszip" MaximumUncompressedMediaSize="2048" \/>/);
  assert.match(msiBuild, /WaitForExit\(300000\)/);
  assert.match(msiBuild, /\$proc\.Refresh\(\)/);
  assert.match(msiBuild, /WiX no confirmó la terminación del proceso/);
  assert.match(msiBuild, /\$installExitCode = \[int\]\$proc\.ExitCode/);
  assert.match(msiBuild, /Instalacion MSI aislada excedio 300 segundos/);
  assert.match(msiBuild, /Remove-Item -LiteralPath \$productOut -Force/);
  assert.match(msiBuild, /"-intermediatefolder", \$wixProductWorkRoot/);
  assert.match(msiBuild, /"-cabcache", \$wixCabCache/);
  assert.match(msiBuild, /"-cabthreads", "1"/);
});

test('el authoring del MSI excluye contenido de ingeniería que no se ejecuta', () => {
  for (const literal of ["$relativePath -match '\\.md$'", "$relativePath -match '^apps/[^/]+/(src|tests|reports)/'", "$relativePath -match '^apps/backend/data/'", "$relativePath -match '^scripts/tests/'"]) {
    assert.ok(msiBuild.includes(literal), `falta filtro de staging: ${literal}`);
  }
  assert.match(msiBuild, /\$runtimeNodeModules = Join-Path \$backendTarget 'node_modules'/);
  assert.match(msiBuild, /\(md\|markdown\|map\|ts\|tsx\|mts\|cts\)/);
  assert.match(msiBuild, /'LICENSE', 'LICENCE', 'NOTICE'/);
  assert.match(msiBuild, /\^\(test\|tests\|__tests__\|docs\|examples\?\|\\\.github\)\$/);
});

test('la ETA del Hub se deriva del avance real, se suaviza y declara verificación', () => {
  assert.match(hubWindow, /Queue<\(DateTime At, int Progress\)> progressSamples/);
  assert.match(hubWindow, /smoothedRemainingSeconds/);
  assert.match(hubWindow, /previousEstimate\.Value \* 1\.20/);
  assert.match(hubWindow, /Tiempo restante: verificando etapa actual/);
  assert.match(hubWindow, /Tiempo restante estimado: \{FormatDuration\(lowerSeconds\)\} a \{FormatDuration\(upperSeconds\)\}/);
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
