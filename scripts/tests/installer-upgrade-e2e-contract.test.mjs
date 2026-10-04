import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const e2ePath = path.join(root, 'scripts', 'tests', 'installer-hub-e2e-docente.ps1');
const e2e = fs.readFileSync(e2ePath, 'utf8');

test('upgrade E2E fija y verifica el instalador oficial v1.2.3 antes de ejecutarlo', () => {
  assert.match(e2e, /\[string\]\$BaselineBundlePath/);
  assert.match(e2e, /644984c84fc05c4ec1f3804bda9d20666d229f7bab23caeb3a9c767179c82913/);
  assert.match(e2e, /Get-FileHash -LiteralPath \$resolvedPath -Algorithm SHA256/);
  assert.match(e2e, /Assert-OfficialUpgradeBaseline -Path \$BaselinePath/);
  assert.match(e2e, /Invoke-InstallerHubMode -Mode 'install' -BundlePath \$verifiedBaseline/);
  assert.match(e2e, /baselineVersion -ne \[version\]'1\.2\.3'/);
});

test('upgrade E2E prueba instalación baseline → versión candidata → datos SQLite conservados', () => {
  const baselineInstall = e2e.indexOf("Invoke-InstallerHubMode -Mode 'install' -BundlePath $verifiedBaseline");
  const stopBaseline = e2e.indexOf("Invoke-InstalledBroker -Action 'stop-all' -RunId ('upgrade-stop-", baselineInstall);
  const markerWrite = e2e.indexOf("Invoke-UpgradeDataMarker -Action 'write' -Marker $marker");
  const candidateInstall = e2e.indexOf("Invoke-InstallerHubMode -Mode 'install' -BundlePath $script:bundlePath");
  const versionCheck = e2e.indexOf("Get-InstalledProductVersion", candidateInstall);
  const markerVerify = e2e.indexOf("Invoke-UpgradeDataMarker -Action 'verify' -Marker $marker", candidateInstall);
  assert.ok(baselineInstall >= 0 && baselineInstall < markerWrite);
  assert.ok(stopBaseline >= 0 && stopBaseline < markerWrite, 'la app baseline debe cerrarse antes de escribir SQLite');
  assert.ok(markerWrite < candidateInstall);
  assert.ok(candidateInstall < versionCheck && versionCheck < markerVerify);
  assert.match(e2e, /candidateVersion -gt \$baselineVersion/);
  assert.match(e2e, /finally\s*\{\s*try \{ Invoke-UpgradeDataMarker -Action 'remove'/);
  assert.match(e2e, /if \(\[string\]::IsNullOrWhiteSpace\(\$BaselineBundlePath\)\)/);
  assert.match(e2e, /Invoke-UpgradeBaselineFlow -BaselinePath \$BaselineBundlePath/);
  assert.match(e2e, /Join-Path \$installedRoot 'data\\evaluapro\.db'/);
  assert.match(e2e, /Join-Path \$installedRoot 'runtime\\node\\node\.exe'/);
});
