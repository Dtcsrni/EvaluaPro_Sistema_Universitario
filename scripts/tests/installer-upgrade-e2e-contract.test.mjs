import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const e2ePath = path.join(root, 'scripts', 'tests', 'installer-hub-e2e-docente.ps1');
const e2e = fs.readFileSync(e2ePath, 'utf8');
const workflowPath = path.join(root, '.github', 'workflows', 'ci-installer-windows.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');

test('upgrade E2E verifica el bundle oficial v1.2.3 y prepara su MSI extraído', () => {
  assert.match(e2e, /\[string\]\$BaselineBundlePath/);
  assert.match(e2e, /644984c84fc05c4ec1f3804bda9d20666d229f7bab23caeb3a9c767179c82913/);
  assert.match(e2e, /Get-FileHash -LiteralPath \$resolvedPath -Algorithm SHA256/);
  assert.match(e2e, /Assert-OfficialUpgradeBaseline -Path \$BaselinePath/);
  assert.match(e2e, /function Install-OfficialUpgradeBaselineMsi/);
  assert.match(e2e, /function Test-MsiPackageFile/);
  assert.match(e2e, /0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1/);
  assert.match(e2e, /wixCommand\.Source -ArgumentList @\('burn', 'extract'/);
  assert.match(e2e, /EvaluaPro-docente-local\.msi/);
  assert.match(e2e, /Where-Object \{ Test-MsiPackageFile -Path \$_.FullName \}/);
  assert.match(e2e, /Move-Item -LiteralPath \$baselineMsis\[0\]\.FullName -Destination \$baselineMsiPath/);
  assert.match(e2e, /REQUIRE_INSTALLER_HUB=1/);
  assert.match(e2e, /Install-OfficialUpgradeBaselineMsi -VerifiedBundlePath \$verifiedBaseline/);
  assert.match(e2e, /baselineVersion -ne \[version\]'1\.2\.3'/);
});

test('runner E2E recupera ExitCode del handle de Windows y falla si sigue siendo desconocido', () => {
  assert.match(e2e, /GetExitCodeProcess\(\$process\.Handle, \[ref\]\$nativeExitCode\)/);
  assert.match(e2e, /No se pudo determinar ExitCode de \$Name mediante GetExitCodeProcess/);
  assert.doesNotMatch(e2e, /Falling back to 0 \(Success\)/);
});

test('upgrade E2E prueba instalación baseline → versión candidata → datos SQLite conservados', () => {
  const baselineInstall = e2e.indexOf('Install-OfficialUpgradeBaselineMsi -VerifiedBundlePath $verifiedBaseline');
  const stopBaseline = e2e.indexOf("Invoke-InstalledBroker -Action 'stop-all' -RunId ('upgrade-stop-", baselineInstall);
  const markerWrite = e2e.indexOf("Invoke-UpgradeDataMarker -Action 'write' -Marker $marker");
  const candidateInstall = e2e.indexOf("Invoke-InstallerHubMode -Mode 'install' -BundlePath $script:bundlePath");
  const versionCheck = e2e.indexOf("Get-InstalledProductVersion", candidateInstall);
  const markerVerify = e2e.indexOf("Invoke-UpgradeDataMarker -Action 'verify' -Marker $marker", candidateInstall);
  assert.ok(baselineInstall >= 0 && baselineInstall < markerWrite);
  assert.match(e2e, /upgrade-baseline-post-install\.request\.json/);
  assert.match(e2e, /response\.ok/);
  assert.match(e2e, /official-msi-installed/);
  assert.ok(stopBaseline >= 0 && stopBaseline < markerWrite, 'la app baseline debe cerrarse antes de escribir SQLite');
  assert.ok(markerWrite < candidateInstall);
  assert.ok(candidateInstall < versionCheck && versionCheck < markerVerify);
  assert.match(e2e, /candidateVersion -gt \$baselineVersion/);
  assert.match(e2e, /finally\s*\{\s*try \{ Invoke-UpgradeDataMarker -Action 'remove'/);
  assert.match(e2e, /if \(\[string\]::IsNullOrWhiteSpace\(\$BaselineBundlePath\)\)/);
  assert.match(e2e, /Invoke-UpgradeBaselineFlow -BaselinePath \$BaselineBundlePath/);
  assert.match(e2e, /\$databasePath = Resolve-InstalledSqlitePath/);
  assert.match(e2e, /Join-Path \$installedRoot 'runtime\\node\\node\.exe'/);
  assert.match(e2e, /EVALUAPRO_DATABASE_URL = 'file:' \+ \(\(Join-Path \$installedRoot 'data\\evaluapro\.db'\)/);
  assert.match(e2e, /if \(\$databasePath -ne \$localDatabase\)/);
});

test('CI descarga y verifica el baseline v1.2.3 oficial y lo pasa al runner upgrade', () => {
  assert.match(workflow, /releases\/download\/v1\.2\.3\/' \+ \$baselineName/);
  assert.match(workflow, /\$baselineName = 'EvaluaPro-InstallerHub-docente-local-v1\.2\.3\.exe'/);
  assert.match(workflow, /\$baselineVersion = \[version\]'1\.2\.3'/);
  assert.match(workflow, /steps\.upgrade_gate\.outputs\.required == 'true'/);
  assert.match(workflow, /download-github-release-asset\.ps1/);
  assert.match(workflow, /-ExpectedLength 249491600 -ExpectedSha256 \$expectedHash/);
  assert.doesNotMatch(workflow, /Invoke-WebRequest -Uri \$baselineUrl -OutFile/);
  assert.match(workflow, /Get-FileHash -LiteralPath \$baselinePath -Algorithm SHA256/);
  assert.match(workflow, /644984c84fc05c4ec1f3804bda9d20666d229f7bab23caeb3a9c767179c82913/);
  assert.match(workflow, /\$runnerArgs \+= @\('-BaselineBundlePath', \$env:BASELINE_BUNDLE_PATH\)/);
  assert.match(workflow, /\$required = \$candidateVersion -gt \$baselineVersion/);
});

test('runner acepta el EXE publicado con SHA obligatorio y CRC32 opcional', () => {
  assert.match(e2e, /\[string\]\$CandidateBundlePath/);
  assert.match(e2e, /Resolve-Path -LiteralPath \$CandidateBundlePath/);
  assert.match(e2e, /if \(Test-Path -LiteralPath \$crcPath\)/);
  assert.match(e2e, /No se publicó CRC32; SHA-256 es obligatorio y se verificó/);
  assert.doesNotMatch(e2e, /if \(-not \(Test-Path -LiteralPath \$crcPath\)\) \{ throw "No existe CRC32/);
});

test('runner protege ProgramData y aísla la SQLite recién creada por el baseline', () => {
  assert.match(e2e, /sharedProgramDataSqliteArtifactsAtStart = @\([\s\S]+?-wal'[\s\S]+?'-shm'[\s\S]+?'-journal'/);
  assert.match(e2e, /sharedProgramDataDatabaseExistedAtStart = \$script:sharedProgramDataSqliteArtifactsAtStart\.Count -gt 0/);
  assert.match(e2e, /shared-programdata-database-absent/);
  assert.match(e2e, /host QA limpio para no tocar datos existentes/);
  assert.match(e2e, /function Set-QAIsolatedSqlite/);
  assert.match(e2e, /sharedProgramDataDatabaseExistedAtStart\)\s*\{\s*throw/);
  assert.match(e2e, /foreach \(\$suffix in @\('', '-wal', '-shm', '-journal'\)\)/);
  const baselineInstall = e2e.indexOf('Install-OfficialUpgradeBaselineMsi -VerifiedBundlePath $verifiedBaseline');
  const isolateBaseline = e2e.indexOf('Set-QAIsolatedSqlite | Out-Null', baselineInstall);
  const baselineState = e2e.indexOf("Test-InstalledState -Phase 'post-baseline-install'", baselineInstall);
  assert.ok(baselineInstall >= 0 && isolateBaseline > baselineInstall && isolateBaseline < baselineState);
  assert.match(e2e, /operationalConfigOriginalBytes/);
  assert.match(e2e, /operationalConfigExistedAtStart -and \(-not \$currentProfileExists -or \$currentProfileOwnedByQa\)/);
  assert.match(e2e, /Perfil operativo previo restaurado tras la prueba QA/);
  assert.match(e2e, /Move-Item -LiteralPath \$move\.destination -Destination \$move\.source/);
});

test('tutorial y capturas de una E2E fallida se quedan dentro del reporte QA', () => {
  assert.match(e2e, /Set-Content -Path \$tutorialPath/);
  assert.doesNotMatch(e2e, /Copy-Item -LiteralPath \$tutorialPath -Destination .*installer-hub-docente-e2e\.md/);
});

test('release valida el asset descargado desde GitHub antes de hacer público el release', () => {
  assert.match(workflow, /draft: true/);
  assert.match(workflow, /post_publish_installer_e2e:/);
  assert.match(workflow, /needs: \[installer_windows, publish_installer_release\]/);
  assert.match(workflow, /outputs:\s+release_id: \$\{\{ steps\.publish_release\.outputs\.id \}\}/);
  assert.match(workflow, /if \("v\$packageVersion" -ne \$tag\)/);
  assert.match(workflow, /CandidateBundlePath/);
  assert.match(workflow, /\$candidateAsset\.url/);
  assert.match(workflow, /-ExpectedLength \(\[long\]\$candidateAsset\.size\) -ExpectedSha256 \$digestMatch\.Groups\[1\]\.Value -GitHubApiAsset/);
  assert.match(workflow, /assetDigest/);
  assert.match(workflow, /SHA-256 del EXE no coincide con el digest de GitHub/);
  assert.match(workflow, /draft=false/);
  assert.match(workflow, /finalize_installer_release:/);
  assert.match(workflow, /needs: \[publish_installer_release, post_publish_installer_e2e\]/);
  assert.match(workflow, /Publicar evidencia E2E del asset descargado/);
});

test('el tiempo de descarga y la E2E cabe en las ventanas de tag y promoción estable', () => {
  const tagGuard = fs.readFileSync(path.join(root, '.github', 'workflows', 'tag-release-guard.yml'), 'utf8');
  const stableGate = fs.readFileSync(path.join(root, '.github', 'workflows', 'release-stable-gate.yml'), 'utf8');
  const installerTimeout = Number(workflow.match(/installer_windows:[\s\S]*?timeout-minutes:\s*(\d+)/)?.[1]);
  const publishTimeout = Number(workflow.match(/publish_installer_release:[\s\S]*?timeout-minutes:\s*(\d+)/)?.[1]);
  const releaseWindow = installerTimeout + publishTimeout;
  const tagAttempts = Number(tagGuard.match(/max_attempts=(\d+)/)?.[1]);
  const stableAttempts = Number(stableGate.match(/for attempt in \{1\.\.(\d+)\}/)?.[1]);
  const tagTimeout = Number(tagGuard.match(/timeout-minutes:\s*(\d+)/)?.[1]);
  const stableTimeout = Number(stableGate.match(/timeout-minutes:\s*(\d+)/)?.[1]);

  assert.equal(installerTimeout, 180);
  assert.ok(tagAttempts * 30 / 60 >= releaseWindow, 'tag guard debe esperar build/E2E y publicación');
  assert.ok(tagTimeout >= tagAttempts * 30 / 60 + 10, 'timeout del tag guard debe incluir margen');
  assert.ok(stableAttempts * 30 / 60 >= releaseWindow, 'gate estable debe esperar build y publicación');
  assert.ok(stableTimeout >= releaseWindow + 90, 'gate estable debe dejar margen para QA completa');
});
