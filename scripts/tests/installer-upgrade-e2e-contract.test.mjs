import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const e2ePath = path.join(root, 'scripts', 'tests', 'installer-hub-e2e-docente.ps1');
const e2e = fs.readFileSync(e2ePath, 'utf8');
const workflowPath = path.join(root, '.github', 'workflows', 'ci-installer-windows.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const installerHubContractsPath = path.join(root, 'scripts', 'installer-burn', 'modules', 'InstallerHubContracts.psm1');
const installerHubContracts = fs.readFileSync(installerHubContractsPath, 'utf8');

test('todos los flujos Installer Hub generan reportes bajo el perfil y publican la ruta calculada', () => {
  const flows = [
    ['installer-hub-e2e-docente-ci-', 'installer-hub-e2e-${{ github.run_id }}'],
    ['installer-hub-e2e-published-ci-', 'installer-hub-published-e2e-${{ github.run_id }}'],
    ['installer-hub-e2e-public-ci-', 'installer-hub-public-e2e-${{ github.run_id }}']
  ];

  for (const [folder, artifact] of flows) {
    assert.ok(workflow.includes(`Join-Path $env:USERPROFILE ('${folder}' + $env:INSTALLER_CI_RUN_ID + '-' + $env:INSTALLER_CI_RUN_ATTEMPT)`), `el flujo ${folder} prepara un reporte como hijo del perfil privado del runner y separa los reintentos`);
    assert.ok(workflow.includes('report_dir=$reportDir'), `el flujo ${folder} expone la ruta calculada para el upload`);
    assert.ok(workflow.includes(`name: ${artifact}`), `el flujo ${folder} mantiene el nombre del artefacto`);
    const artifactStart = workflow.indexOf(`name: ${artifact}`);
    const artifactBlock = workflow.slice(artifactStart, workflow.indexOf('\n      - name:', artifactStart + 1));
    assert.ok(artifactBlock.includes('path: ${{ steps.preparar_reporte_e2e.outputs.report_dir }}/'), `el upload ${folder} apunta al reporte que preparó el flujo`);
  }

  assert.doesNotMatch(workflow, /\$reportDir\s*=\s*["']reports[\\/]/);
  assert.doesNotMatch(workflow, /\$reportDir\s*=\s*Join-Path \$env:RUNNER_TEMP/);
  assert.equal((workflow.match(/id: preparar_reporte_e2e/g) ?? []).length, 3, 'cada flujo calcula una ruta privada una sola vez');
  assert.equal((workflow.match(/E2E_REPORT_DIR: \$\{\{ steps\.preparar_reporte_e2e\.outputs\.report_dir \}\}/g) ?? []).length, 4, 'los tres flujos Installer Hub y el E2E PDF consumen el reporte calculado');
  const evidenceUploads = workflow.match(/- name: Publicar evidencia[^\n]*\n\s+if: ([^\n]*)\n\s+uses: actions\/upload-artifact[^\n]*\n\s+with:\n\s+name: installer-hub-[^\n]*\n\s+path: \$\{\{ steps\.preparar_reporte_e2e\.outputs\.report_dir \}\}\//g) ?? [];
  assert.equal(evidenceUploads.length, 3, 'los tres flujos conservan su upload de evidencia');
  assert.ok(evidenceUploads.every((block) => block.includes("steps.preparar_reporte_e2e.outputs.report_dir != ''")), 'nunca se pasa una ruta vacía al uploader de artefactos');
  assert.match(e2e, /Import-Module -Name \$reportDirectoryModule -Force -ErrorAction Stop/);
  assert.doesNotMatch(e2e, /Import-Module -LiteralPath/);
  assert.match(e2e, /Initialize-InstallerHubE2EReportDirectory -Path \$ReportDir/);
  assert.match(e2e, /GetTempPath\(\)/);
});

test('el módulo de reportes se importa con el parámetro real de Windows PowerShell', (t) => {
  if (process.platform !== 'win32') {
    t.skip('La validación de binding de Windows PowerShell se ejecuta en runner Windows.');
    return;
  }

  const modulePath = path.join(root, 'scripts', 'tests', 'installer-e2e-report-directory.psm1');
  const escapedModulePath = modulePath.replaceAll("'", "''");
  const command = [
    `$modulePath = '${escapedModulePath}'`,
    'Import-Module -Name $modulePath -Force -ErrorAction Stop',
    "if (-not (Get-Command Initialize-InstallerHubE2EReportDirectory -ErrorAction SilentlyContinue)) { exit 1 }"
  ].join('; ');
  const powershellPath = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const result = spawnSync(powershellPath, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8' });

  assert.equal(result.error, undefined, `No se pudo validar Import-Module: ${result.error?.message ?? ''}`);
  assert.equal(result.status, 0, `Windows PowerShell no pudo cargar el módulo: ${result.stderr || result.stdout}`);
});

test('el guard del handoff conserva el rechazo de escritura para Users y grupos amplios', () => {
  assert.match(installerHubContracts, /\$untrustedSids = @\('S-1-1-0', 'S-1-5-11', 'S-1-5-32-545'\)/);
  assert.match(installerHubContracts, /\$rule\.AccessControlType -ne \[Security\.AccessControl\.AccessControlType\]::Allow/);
  assert.match(installerHubContracts, /permite escritura a una identidad local no confiable/);
});

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
  assert.match(e2e, /\$processHandle = \[IntPtr\]::Zero\s+try \{ \$processHandle = \[IntPtr\]\$process\.Handle \} catch \{\}\s+if \(-not \$process\.WaitForExit/);
  assert.match(e2e, /GetExitCodeProcess\(\$processHandle, \[ref\]\$nativeExitCode\)/);
  assert.match(e2e, /handle nativo del proceso no estuvo disponible antes de esperar su finalización/);
  assert.match(e2e, /No se pudo determinar ExitCode de \$Name mediante GetExitCodeProcess/);
  assert.doesNotMatch(e2e, /Falling back to 0 \(Success\)/);
});

test('el estado del App Host se inicializa antes de las lecturas y permite limpieza sin instancia', () => {
  const strictMode = e2e.indexOf('Set-StrictMode -Version Latest');
  const initialization = e2e.indexOf('$script:activeNativeAppHost = $null', strictMode);
  const firstRead = e2e.indexOf('if ($script:activeNativeAppHost)');
  const cleanupRead = e2e.indexOf('if ($script:activeNativeAppHost)', firstRead + 1);

  assert.ok(strictMode >= 0 && initialization > strictMode, 'el estado se define con StrictMode activo');
  assert.ok(firstRead > initialization && cleanupRead > firstRead, 'ninguna ruta lee el estado antes de inicializarlo');
  assert.match(e2e, /if \(-not \$identity\) \{\s*Add-Result -Area 'native-app-host' -Item \$Action -Ok \$true -Detail "no E2E-owned host was active/);
  assert.match(e2e, /if \(\$script:activeNativeAppHost\) \{\s*try \{\s*Invoke-InstalledAppHost -Action 'stop-all' -RunId 'finally-cleanup'/);
});

test('baseline legado valida version ARP sin InstallLocation solo con una entrada y payload aislado', () => {
  const getterStart = e2e.indexOf('function Get-InstalledProductVersion {');
  const getterEnd = e2e.indexOf('\nfunction Assert-OfficialUpgradeBaseline {', getterStart);
  const getter = e2e.slice(getterStart, getterEnd);

  assert.match(getter, /\$matchingEntries\.Count -gt 1/);
  assert.match(getter, /\$script:upgradingExistingInstall\s+-and\s+\$allEntries\.Count -eq 1/);
  assert.match(getter, /\$script:initialUninstallRegistryPaths -contains \[string\]\$allEntries\[0\]\.registryPath/);
  assert.match(getter, /\$newEntries\.Count -eq 1[\s\S]*?installLocation/);
  assert.match(getter, /Join-Path \$target 'EvaluaPro\.exe'/);
  assert.match(getter, /Join-Path \$target 'evaluapro-native-dist\.zip'/);
  assert.match(getter, /No existe una entrada MSI inequívoca/);
  assert.doesNotMatch(getter, /\)\[0\]/);
});

test('E2E conserva el log MSI verbose para diagnosticar propiedades de instalación del baseline', () => {
  assert.match(e2e, /upgrade-baseline-msi-install\.log/);
  assert.match(e2e, /'\/l\*v', \$quotedMsiInstallLog/);
  assert.match(e2e, /Copy-ArtifactIfExists -Path \$msiInstallLog/);
});

test('Copy-ArtifactIfExists tolera origen y destino iguales sin perder el artefacto', () => {
  const copyStart = e2e.indexOf('function Copy-ArtifactIfExists {');
  const copyEnd = e2e.indexOf('\nfunction Resolve-BundlePath {', copyStart);
  const copyHelper = e2e.slice(copyStart, copyEnd);

  assert.match(copyHelper, /\[IO\.Path\]::GetFullPath\(\(Resolve-Path -LiteralPath \$Path -ErrorAction Stop\)\.Path\)/);
  assert.match(copyHelper, /\[IO\.Path\]::GetFullPath\(\$target\)/);
  assert.match(copyHelper, /\[string\]::Equals\(\$sourceFullPath, \$targetFullPath, \[StringComparison\]::OrdinalIgnoreCase\)/);
  assert.match(copyHelper, /if \(-not \$script:artifacts\.Contains\(\$targetFullPath\)\) \{ \$script:artifacts\.Add\(\$targetFullPath\)/);
  assert.match(copyHelper, /return \$targetFullPath\s*\}\s*Copy-Item/);

  const responseStart = e2e.indexOf("$responsePath = Join-Path $ReportDir 'upgrade-baseline-post-install.response.json'");
  const responseEnd = e2e.indexOf("Add-Result -Area 'upgrade-baseline'", responseStart);
  const responseHandling = e2e.slice(responseStart, responseEnd);
  assert.match(responseHandling, /Copy-ArtifactIfExists -Path \$responsePath/);
  assert.match(responseHandling, /El helper escribe la respuesta directamente dentro de ReportDir/);
});

test('E2E normaliza la versión MSI de cuatro componentes al SemVer de tres', () => {
  assert.match(e2e, /function Normalize-InstallerProductVersion/);
  assert.match(e2e, /\[version\]::new\(\$Version\.Major, \$Version\.Minor, \$Version\.Build\)/);
  assert.match(e2e, /cuarto componente inesperado/);
  assert.match(e2e, /return \(Normalize-InstallerProductVersion -Version \$parsed\)/);
});

test('upgrade baseline construye un sobre v1 válido para post-install y conserva el payload QA aislado', () => {
  const requestPath = e2e.indexOf("$requestPath = Join-Path $ReportDir 'upgrade-baseline-post-install.request.json'");
  const requestStart = e2e.indexOf('$request = [ordered]@{', requestPath);
  const requestEnd = e2e.indexOf('[IO.File]::WriteAllText($requestPath', requestStart);
  assert.ok(requestPath >= 0 && requestStart > requestPath && requestEnd > requestStart, 'el runner genera la solicitud del baseline');
  const builder = e2e.slice(requestStart, requestEnd);
  const payloadStart = builder.indexOf('    payload = [ordered]@{');
  assert.ok(payloadStart > 0, 'los parámetros mutables deben quedar dentro de payload');
  const envelope = builder.slice(0, payloadStart);
  const payload = builder.slice(payloadStart);

  assert.match(envelope, /schemaVersion = 1/);
  assert.match(envelope, /operationId = \[guid\]::NewGuid\(\)\.ToString\('D'\)/);
  assert.match(envelope, /command = 'post-install'/);
  assert.match(envelope, /issuedAtUtc = \$now\.AddSeconds\(-1\)\.ToString\('o'\)/);
  assert.match(envelope, /expiresAtUtc = \$now\.AddMinutes\(5\)\.ToString\('o'\)/);
  assert.doesNotMatch(envelope, /^\s+(mode|flavorId|installDir|dataDir|config)\s*=/m);
  assert.match(payload, /mode = 'install'/);
  assert.match(payload, /flavorId = 'docente-local'/);
  assert.match(payload, /installDir = \[IO\.Path\]::GetFullPath\(\$installedRoot\)/);
  assert.match(payload, /dataDir = Join-Path \$installedRoot 'data'/);
  assert.match(payload, /config = \[ordered\]@\{/);
  assert.match(payload, /databaseUrl = 'file:C:\/ProgramData\/EvaluaPro\/data\/evaluapro\.db'/);
  assert.match(payload, /portalAlumnoApiKey = 'portal-key-shared'/);
  assert.match(e2e.slice(requestEnd, requestEnd + 200), /ConvertTo-Json -Depth 8/);
});

test('upgrade E2E prueba instalación baseline → versión candidata → datos SQLite conservados', () => {
  const baselineInstall = e2e.indexOf('Install-OfficialUpgradeBaselineMsi -VerifiedBundlePath $verifiedBaseline');
  const stopBaseline = e2e.indexOf("Invoke-InstalledAppHost -Action 'stop-all' -RunId ('upgrade-stop-", baselineInstall);
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
  assert.match(e2e, /function Invoke-InstalledAppHost/);
  assert.match(e2e, /Wait-NativeDashboardHealth/);
  assert.doesNotMatch(e2e, /Invoke-InstalledBroker|launcher-broker\.ps1/);
  assert.match(e2e, /\$databasePath = Resolve-InstalledSqlitePath/);
  assert.match(e2e, /Join-Path \$installedRoot 'runtime\\node\\node\.exe'/);
  assert.match(e2e, /function Get-ConfiguredInstalledSqlitePath/);
  assert.match(e2e, /BACKEND_DATABASE_URL\|DATABASE_URL/);
  assert.match(e2e, /Join-Path \$installedRoot 'data\\evaluapro\.db'/);
  assert.match(e2e, /La ruta SQLite del instalador está fuera de los destinos QA permitidos/);
  assert.match(e2e, /if \(\$databasePath -ne \$localDatabase\)/);
});

test('CI descarga y verifica el baseline v1.2.3 oficial y lo pasa al runner upgrade', () => {
  assert.match(workflow, /- name: Determinar si aplica upgrade desde v1\.2\.3\s+id: upgrade_gate\s+if: github\.event_name == 'pull_request' \|\| startsWith\(github\.ref, 'refs\/tags\/v'\) \|\| github\.event_name == 'workflow_dispatch'/);
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

test('smoke GUI cierra y confirma la salida de todo proceso Installer Hub que él mismo inició', () => {
  const smokeStart = workflow.indexOf('- name: Smoke GUI del bundle Burn publico empaquetado');
  const smokeEnd = workflow.indexOf('- name: Etapa hash/manifest de release instalador', smokeStart);
  const smoke = workflow.slice(smokeStart, smokeEnd);

  assert.ok(smokeStart >= 0 && smokeEnd > smokeStart, 'el workflow conserva el smoke GUI de empaquetado');
  assert.match(smoke, /Get-CimInstance Win32_Process -ErrorAction Stop/);
  assert.match(smoke, /EvaluaPro-InstallerHub\*\.exe/);
  assert.match(smoke, /EvaluaPro\.BurnBootstrapperApp\.exe/);
  assert.match(smoke, /runner ya tenía procesos Installer Hub antes del smoke/);
  assert.match(smoke, /\$startupDeadline = \(Get-Date\)\.AddSeconds\(15\)/);
  assert.match(smoke, /EvaluaPro\.BurnBootstrapperApp\.exe' -and \$_.ProcessId -notin/);
  assert.match(smoke, /no mantuvo activo EvaluaPro\.BurnBootstrapperApp\.exe tras el arranque/);
  assert.match(smoke, /La interfaz WPF del Installer Hub se cerró antes del smoke timeout/);
  assert.match(smoke, /taskkill\.exe \/PID \$\(\$proc\.Id\) \/T \/F/);
  assert.match(smoke, /\$deadline = \(Get-Date\)\.AddSeconds\(30\)/);
  assert.match(smoke, /taskkill\.exe \/PID \$\(\$smokeProcess\.ProcessId\) \/T \/F/);
  assert.match(smoke, /Get-ActiveInstallerHubProcess \| Where-Object \{ \$_.ProcessId -notin/);
  assert.match(smoke, /smoke dejó procesos Installer Hub activos tras el cierre del árbol/);
  assert.match(smoke, /SMOKE_BURN_REMAINING_PROCESSES:/);
  assert.match(smoke, /\$global:LASTEXITCODE = 0/);
});

test('preflight E2E identifica nombre y PID cuando detecta un Installer Hub activo', () => {
  assert.match(e2e, /\$activeInstallerHubProcessDetails = \(\$activeInstallerHubProcesses \| ForEach-Object \{ "\{0\}:\{1\}" -f \$_.ProcessName, \$_.Id \}\) -join ', '/);
  assert.match(e2e, /Add-Result -Area 'preflight' -Item 'no-active-installer-hub' -Ok \(\$activeInstallerHubProcesses\.Count -eq 0\) -Detail \$activeInstallerHubProcessDetails/);
  assert.match(e2e, /Hay procesos Installer Hub activos: \$activeInstallerHubProcessDetails/);
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
  assert.match(e2e, /shared-programdata-sqlite-unchanged/);
  assert.match(e2e, /Se rechaza mover una SQLite de ProgramData preexistente/);
  assert.match(e2e, /SQLite preexistente se preservará por SHA-256/);
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

test('la evidencia visual del Installer Hub valida PNG, dimensiones, píxeles y huella', () => {
  const xaml = fs.readFileSync(path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'MainWindow.xaml'), 'utf8');
  assert.match(e2e, /function Get-VisualScreenshotEvidence/);
  assert.match(e2e, /System\.Drawing\.Bitmap\]::FromFile\(\$Path\)/);
  assert.match(e2e, /distinctSamples\.Count -lt 8/);
  assert.match(e2e, /requestedWindowSize/);
  assert.match(e2e, /actualCaptureSize/);
  assert.match(e2e, /requestHonored/);
  assert.match(e2e, /valid = \(-not \$requestedWindowSize -or \(\$bitmap\.Width -eq \$RequestedWidth -and \$bitmap\.Height -eq \$RequestedHeight\)\)/);
  assert.match(e2e, /Get-FileHash -LiteralPath \$Path -Algorithm SHA256/);
  assert.match(e2e, /Where-Object \{ -not \$_\.valid \}/);
  assert.match(e2e, /CopyFromScreen\(\$captureRect\.X, \$captureRect\.Y, 0, 0, \$bitmap\.Size\)/);
  assert.doesNotMatch(e2e, /PrintWindow/);
  assert.match(e2e, /sha256Required = \$true/);
  assert.match(e2e, /RequestedWidth 1040 -RequestedHeight 760/);
  assert.match(e2e, /RequestedWidth 1280 -RequestedHeight 720/);
  assert.match(e2e, /Resize-WindowForEvidence -Process \$process -Width 1040 -Height 760/);
  assert.match(e2e, /Resize-WindowForEvidence -Process \$process -Width 1280 -Height 720/);
  assert.match(e2e, /ejecutar-solicitud-1040x760/);
  assert.match(e2e, /ejecutar-solicitud-1280x720/);
  assert.match(xaml, /Width="1040"/);
  assert.match(xaml, /Height="760"/);
  assert.match(xaml, /MinWidth="980"/);
  assert.match(xaml, /MinHeight="700"/);
});

test('E2E valida el preflight antes de instalar y reconoce la actualización aislada desde baseline', () => {
  assert.match(e2e, /\$candidateBundleVerified = -not \[string\]::IsNullOrWhiteSpace\(\$bundlePath\)/);
  assert.match(e2e, /\$isolatedBaselineUpgradeRun = \$candidateBundleVerified -and \$baselineBundleExists/);
  assert.match(e2e, /\$validInstallMode = \$isolatedCandidateRun -or \$isolatedBaselineUpgradeRun -or \$script:upgradingExistingInstall/);
  const invalidModeGuard = e2e.indexOf('if (-not $validInstallMode)');
  const installInvocation = e2e.indexOf("Invoke-InstallerHubMode -Mode 'install'", invalidModeGuard);
  assert.ok(invalidModeGuard >= 0 && installInvocation > invalidModeGuard, 'un modo no reconocido debe abortar antes de cambiar la instalación');
  assert.match(e2e, /try \{ Save-Report -Status 'failed' \} catch/);
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

test('las E2E del asset de borrador y público instalan WiX para extraer el baseline', () => {
  const jobs = workflow.split(/(?=^  [a-z0-9_]+:)/m);
  for (const jobName of ['post_publish_installer_e2e', 'verify_public_installer_e2e']) {
    const job = jobs.find((section) => section.startsWith(`  ${jobName}:`));
    assert.ok(job, `Debe existir el job ${jobName}`);
    assert.match(job, /actions\/setup-dotnet@[a-f0-9]{40}/);
    assert.match(job, /dotnet-version:\s*10\.0\.x/);
    assert.match(job, /dotnet tool install --global wix --version 7\.0\.0/);
    assert.match(job, /wix eula accept wix7/);
    assert.match(job, /GITHUB_PATH/);
    assert.ok(job.indexOf('Instalar WiX CLI estable para la E2E') < job.indexOf('E2E completa'));
  }
});

test('las PR ejecutan y conservan la E2E GUI real del Installer Hub y la descarga PDF en Edge', () => {
  const pullRequestGate = /github\.event_name\s*==\s*'pull_request'\s*\|\|\s*startsWith\(github\.ref,\s*'refs\/tags\/v'\)\s*\|\|\s*github\.event_name\s*==\s*'workflow_dispatch'/;
  for (const stepName of [
    'Instalar Chromium para la E2E docente completa',
    'Instalar Microsoft Edge para validar el PDF en GUI',
    'Determinar si aplica upgrade desde v1.2.3',
    'Preparar ruta privada para evidencia E2E',
    'E2E completa sobre el bundle docente que se publicará',
    'E2E visual de vista y descarga PDF en Edge'
  ]) {
    const stepStart = workflow.indexOf(`- name: ${stepName}`);
    assert.ok(stepStart >= 0, `Debe existir el paso ${stepName}`);
    const stepEnd = workflow.indexOf('\n      - name:', stepStart + 1);
    const step = workflow.slice(stepStart, stepEnd < 0 ? workflow.length : stepEnd);
    assert.match(step, pullRequestGate, `La PR debe ejecutar ${stepName}`);
  }
  const evidenceUpload = workflow.slice(workflow.indexOf('- name: Publicar evidencia de la E2E completa'));
  assert.match(evidenceUpload, /github\.event_name\s*==\s*'pull_request'/, 'la evidencia GUI debe conservarse para revisión del PR');
});

test('el build candidato y QA caben en la ventana del gate estable previo a publicación', () => {
  const tagGuard = fs.readFileSync(path.join(root, '.github', 'workflows', 'tag-release-guard.yml'), 'utf8');
  const stableGate = fs.readFileSync(path.join(root, '.github', 'workflows', 'release-stable-gate.yml'), 'utf8');
  const installerBuildTimeout = Number(workflow.match(/installer_windows_build:[\s\S]*?timeout-minutes:\s*(\d+)/)?.[1]);
  const publishTimeout = Number(workflow.match(/publish_installer_release:[\s\S]*?timeout-minutes:\s*(\d+)/)?.[1]);
  const releaseWindow = installerBuildTimeout + publishTimeout;
  const tagAttempts = Number(tagGuard.match(/max_attempts=(\d+)/)?.[1]);
  const tagTimeout = Number(tagGuard.match(/timeout-minutes:\s*(\d+)/)?.[1]);
  const stableTimeout = Number(stableGate.match(/timeout-minutes:\s*(\d+)/)?.[1]);

  assert.equal(installerBuildTimeout, 180);
  assert.ok(tagAttempts * 30 / 60 >= releaseWindow, 'tag guard debe esperar build/E2E y publicación');
  assert.ok(tagTimeout >= tagAttempts * 30 / 60 + 10, 'timeout del tag guard debe incluir margen');
  assert.ok(stableTimeout >= installerBuildTimeout + 90, 'gate estable debe dejar margen para build candidato y QA completa');
  assert.match(stableGate, /run-id:\s*\$\{\{ inputs\.candidate_run_id \}\}/);
  assert.doesNotMatch(stableGate.slice(0, stableGate.indexOf('validate-stable-promotion.mjs')), /gh release download/);
});
