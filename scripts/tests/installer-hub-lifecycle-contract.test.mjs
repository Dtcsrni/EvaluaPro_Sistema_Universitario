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
const processModule = fs.readFileSync(path.join(root, 'scripts', 'installer-burn', 'modules', 'InstallerHubProcesses.psm1'), 'utf8');
const transactionModule = fs.readFileSync(path.join(root, 'scripts', 'installer-burn', 'modules', 'InstallerHubTransaction.psm1'), 'utf8');
const payloadModule = fs.readFileSync(path.join(root, 'scripts', 'installer-burn', 'modules', 'InstallerHubPayload.psm1'), 'utf8');
const verificationModule = fs.readFileSync(path.join(root, 'scripts', 'installer-burn', 'modules', 'InstallerHubVerification.psm1'), 'utf8');
const bootstrapper = fs.readFileSync(path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'EvaluaProBootstrapperApplication.cs'), 'utf8');
const appHost = fs.readFileSync(path.join(root, 'packaging', 'app-host', 'MainWindow.xaml.cs'), 'utf8');
const hubWindow = fs.readFileSync(path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'MainWindow.xaml.cs'), 'utf8');
const hubWindowXaml = fs.readFileSync(path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'MainWindow.xaml'), 'utf8');
const productWxs = fs.readFileSync(path.join(root, 'packaging', 'wix', 'Product.wxs'), 'utf8');
const msiBuild = fs.readFileSync(path.join(root, 'scripts', 'build-msi.ps1'), 'utf8');
const installerWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci-installer-windows.yml'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'scripts', 'tests', 'installer-hub-e2e-docente.ps1'), 'utf8');
const uiLifecycle = fs.readFileSync(path.join(root, 'scripts', 'tests', 'installer-hub-ui-lifecycle.ps1'), 'utf8');
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

test('el E2E visual del Installer Hub rechaza capturas vacías y ajusta el HWND de UIA', () => {
  const resize = uiLifecycle.slice(uiLifecycle.indexOf('function Resize-WindowForQa {'), uiLifecycle.indexOf('\nfunction Test-ScrollPattern {'));
  const capture = uiLifecycle.slice(uiLifecycle.indexOf('function Capture-Window {'), uiLifecycle.indexOf('\nfunction Resize-WindowForQa {'));

  assert.match(capture, /GetPixel\(/);
  assert.match(capture, /coloredBodySamples -lt 100/);
  assert.match(capture, /distinctBodyColors\.Count -lt 8/);
  assert.match(capture, /ventana vacía o monocroma/);
  assert.match(capture, /\[EvaluaProQaNativeWindow\]::IsWindowVisible\(\$handle\)/);
  assert.match(capture, /\[EvaluaProQaNativeWindow\]::IsWindowAtPoint\(\$handle/);
  assert.match(capture, /DescribeWindowAtPoint\(\$point\.X, \$point\.Y\)/);
  assert.match(uiLifecycle, /DescribeWindowAtPoint\(int x, int y\)/);
  assert.match(capture, /no se cambiará el foco/);
  assert.match(capture, /CopyFromScreen\(\$x, \$y, 0, 0, \$bitmap\.Size\)/);
  assert.doesNotMatch(capture, /SetForegroundWindow|GetForegroundWindow|PrintWindow|SetCursorPos/);
  assert.match(resize, /\[System\.Windows\.Automation\.AutomationElement\]\$Window/);
  assert.match(resize, /\$Window\.Current\.NativeWindowHandle/);
  assert.doesNotMatch(resize, /\$Process\.MainWindowHandle/);
  assert.match(uiLifecycle, /Resize-WindowForQa -Window \$window -Width 980 -Height 700/);
  assert.match(uiLifecycle, /Collapse-Control -Element \$logExpander/);
  assert.match(uiLifecycle, /\$logExpandPattern\.Current\.ExpandCollapseState -eq \[System\.Windows\.Automation\.ExpandCollapseState\]::Collapsed/);
  for (const stage of ['navigate-prepare', 'navigate-review', 'verify-review-controls', 'validate-modes', 'validate-expanders', 'capture-advanced', 'run-nondestructive-qa', 'validate-minimum-viewport', 'close-owned-process', 'finalize-report']) {
    assert.match(uiLifecycle, new RegExp(`\\$currentStage = '${stage}'`), `falta el marcador de etapa ${stage}`);
  }
  assert.match(uiLifecycle, /integrity-verification-visible/);
  assert.match(uiLifecycle, /primary-close-visible/);
  assert.match(uiLifecycle, /ResultSummaryScrollViewer/);
  assert.match(uiLifecycle, /ResultEvidenceScrollViewer/);
  const splashCapture = uiLifecycle.indexOf("Capture-Window -Window $window -Name '01-splash'");
  const splashAccessibility = uiLifecycle.indexOf("foreach ($controlId in @('FooterStatusTextBlock'");
  assert.ok(splashCapture >= 0 && splashAccessibility > splashCapture, 'captura diagnóstica antes de validar controles UIA');
  assert.match(uiLifecycle, /AutomationIdProperty,[\s\S]*?'FooterStatusTextBlock'/);
});

test('el resumen de edición del Installer Hub reutiliza la versión dinámica visible', () => {
  assert.match(hubWindowXaml, /x:Name="EditionVersionTextBlock"[^>]*AutomationProperties\.AutomationId="EditionVersionTextBlock"/);
  assert.doesNotMatch(hubWindowXaml, /EvaluaPro Docente Local \(v?\d+\.\d+\.\d+/);
  assert.match(hubWindow, /HubVersionTextBlock\.Text\s*=\s*versionText/);
  assert.match(hubWindow, /EditionVersionTextBlock\.Text\s*=\s*\$"EvaluaPro Docente Local \(\{versionText\}\)"/);
  assert.match(hubWindowXaml, /x:Name="HubVersionTextBlock"[^>]*AutomationProperties\.AutomationId="HubVersionTextBlock"/);
});

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
  assert.match(bootstrapper, /CreatePrivateHandoffDirectory\(requestRoot\)/);
  assert.match(bootstrapper, /Guid\.NewGuid\(\)/);
  assert.match(bootstrapper, /correlationId/);
  assert.match(bootstrapper, /\.request\.json/);
  assert.match(bootstrapper, /\.response\.json/);
  assert.match(bootstrapper, /\["operationId"\] = operationId/);
  assert.match(helper, /\$Payload\['operationId'\] = \$script:InstallerHubOperationId/);
});

test('helper PowerShell tiene timeout por operación y cancela su árbol', () => {
  assert.match(bootstrapper, /GetHelperTimeout\(mode\)/);
  assert.match(bootstrapper, /WaitForExitAsync\(timeoutCts\.Token\)/);
  assert.match(bootstrapper, /Kill\(entireProcessTree: true\)/);
  assert.match(bootstrapper, /request=\{requestPath\} response=\{responsePath\}/);
  assert.match(runner, /\[int\]\$TimeoutMinutes = 10/);
});

test('post-install informa etapas, conserva salida al vencer timeout y no depende de descargar Node', () => {
  assert.match(helper, /function Write-HelperProgress/);
  assert.match(helper, /EVALUAPRO_PROGRESS:/);
  assert.match(helper, /Expandiendo y validando el payload antes de modificar configuración/);
  assert.match(helper, /Base de datos SQLite preparada/);
  assert.match(helper, /Manifiesto de actualización validado/);
  assert.match(verificationModule, /runtime\\node\\node\.exe/);
  assert.match(verificationModule, /Runtime Node docente inválido/);
  assert.match(verificationModule, /\$nodeVersionOutput = @\(& \$nodeExe --version 2>&1\)\s+\$nodeExitCode = \$LASTEXITCODE/);
  assert.doesNotMatch(verificationModule, /& \$nodeExe --version 2>&1 \| Select-Object -First 1/);
  assert.doesNotMatch(helper, /Invoke-WebRequest\s+-Uri\s+\$nodeUrl/);
  assert.match(bootstrapper, /stdout-at-timeout/);
  assert.match(bootstrapper, /stderr-at-timeout/);
  assert.match(bootstrapper, /\[native-helper:\{mode\}:progress\]/);
});

test('payload nativo usa extracción rápida y publica desde staging sin copiar el árbol completo', () => {
  assert.match(payloadModule, /Get-Command -Name 'tar\.exe' -CommandType Application/);
  assert.match(payloadModule, /& \$tar\.Source -xf \$PayloadZip -C \$payloadStage/);
  assert.match(payloadModule, /\[System\.IO\.Compression\.ZipFile\]::ExtractToDirectory\(\$PayloadZip, \$payloadStage\)/);
  assert.match(payloadModule, /Move-Item -LiteralPath \$stagedEntry -Destination \$destination -ErrorAction Stop/);
  assert.doesNotMatch(payloadModule, /Copy-Item -LiteralPath \$stagedEntry -Destination \$destination -Recurse -Force/);
});

test('payload nativo valida entradas y registra respaldo recuperable antes de promover', () => {
  assert.match(payloadModule, /Get-ChildItem -LiteralPath \$payloadStage -Recurse -Force/);
  assert.match(payloadModule, /ReparsePoint/);
  assert.match(payloadModule, /Write-PayloadTransactionJournal -TransactionDir \$transactionDir -Journal \$journal/);
  assert.ok(payloadModule.indexOf('Write-PayloadTransactionJournal') < payloadModule.indexOf('Move-Item -LiteralPath $destination -Destination $backup'));
  assert.ok(payloadModule.indexOf('Move-Item -LiteralPath $destination -Destination $backup') < payloadModule.indexOf('Move-Item -LiteralPath $stagedEntry -Destination $destination'));
  assert.match(transactionModule, /function Recover-PayloadTransaction/);
  assert.match(transactionModule, /function Complete-PayloadTransaction/);
  assert.match(helper, /-ModuleName Transaction -FunctionName 'Recover-PayloadTransaction' -Parameters @\{ TargetDir = \$targetDir \}/);
  assert.match(helper, /Complete-PayloadTransaction -TargetDir \$targetDir/);
  assert.match(helper, /Global\\EvaluaProInstallerRoot-/);
});

test('el inventario de procesos propios falla cerrado y no usa prefijos de rutas', () => {
  const inventory = processModule.slice(processModule.indexOf('function Get-EvaluaProOwnedNodeProcessIds {'), processModule.indexOf('\nfunction Stop-EvaluaProOwnedNodeProcesses {'));
  assert.match(inventory, /Get-CimInstance -ClassName Win32_Process -Filter "Name = 'node\.exe'" -ErrorAction Stop\)/);
  assert.match(inventory, /No se pudo verificar la identidad del proceso node\.exe/);
  assert.match(inventory, /GetFullPath\(\$executablePath\)\.Equals\(\$runtimeNode/);
  assert.match(inventory, /rootArgumentPattern/);
  assert.match(inventory, /TrimEnd\('\\'\) \+ '\\'/);
  assert.doesNotMatch(inventory, /StartsWith\(\(Join-Path \$targetRoot/);
  assert.doesNotMatch(inventory, /return @\(\)\s*\}/);
  assert.match(processModule, /AddSeconds\(15\)/);
});

test('un fallo de repair conserva el payload previo y el rollback fallido conserva su evidencia', () => {
  const dispatcher = helper.slice(helper.lastIndexOf('$failureMessage = $_.Exception.Message'));
  assert.match(dispatcher, /installMode\.Trim\(\)\.ToLowerInvariant\(\) -eq 'install'/);
  assert.match(dispatcher, /-not \$transactionEvidenceExists -and -not \$script:PendingPayloadTransaction/);
  assert.match(dispatcher, /-ModuleName Transaction -FunctionName 'Recover-PayloadTransaction' -Parameters @\{ TargetDir = \$script:InstallerRootPath \}/);
});

test('elevated helper consumes el snapshot validado y no reabre la ruta de usuario', () => {
  const requestReader = helper.slice(helper.indexOf('function Read-InstallerRequestPayload {'), helper.indexOf('\nfunction Write-HelperProgress {'));
  const elevation = helper.slice(helper.indexOf('function Invoke-PostInstall {'), helper.indexOf('\nfunction Invoke-Update {'));
  const elevatedArguments = elevation.slice(elevation.indexOf('$childArgs = @('), elevation.indexOf("$elevated = Start-Process"));

  assert.match(helper, /\[string\]\$RequestJsonBase64 = ''/);
  assert.match(requestReader, /FromBase64String\(\$RequestJsonBase64\)/);
  assert.match(requestReader, /JsonContent = \$requestJson/);
  assert.match(requestReader, /excede el límite seguro de 16 KiB/);
  assert.match(elevatedArguments, /'-RequestJsonBase64', \$requestSnapshot/);
  assert.doesNotMatch(elevatedArguments, /RequestPath/);
  assert.match(elevation, /\$script:InstallerRequestJson/);
});

test('el workflow de release bloquea la publicación si falla la E2E completa del bundle', () => {
  assert.match(installerWorkflow, /E2E completa sobre el bundle docente que se publicará/);
  assert.match(installerWorkflow, /- name: Instalar Chromium para la E2E docente completa\s+if: github\.event_name == 'pull_request' \|\| startsWith\(github\.ref, 'refs\/tags\/v'\) \|\| github\.event_name == 'workflow_dispatch'/);
  assert.match(installerWorkflow, /- name: Determinar si aplica upgrade desde v1\.2\.3\s+id: upgrade_gate\s+if: github\.event_name == 'pull_request' \|\| startsWith\(github\.ref, 'refs\/tags\/v'\) \|\| github\.event_name == 'workflow_dispatch'/);
  assert.match(installerWorkflow, /- name: E2E completa sobre el bundle docente que se publicará\s+if: github\.event_name == 'pull_request' \|\| startsWith\(github\.ref, 'refs\/tags\/v'\) \|\| github\.event_name == 'workflow_dispatch'/);
  assert.match(installerWorkflow, /- name: Publicar evidencia de la E2E completa\s+if: always\(\) && steps\.preparar_reporte_e2e\.outputs\.report_dir != '' && \(github\.event_name == 'pull_request' \|\| startsWith\(github\.ref, 'refs\/tags\/v'\) \|\| github\.event_name == 'workflow_dispatch'\)/);
  assert.match(installerWorkflow, /scripts\/tests\/installer-hub-e2e-docente\.ps1/);
  assert.match(installerWorkflow, /-SeedDummyData/);
  assert.match(installerWorkflow, /Publicar evidencia de la E2E completa/);
  assert.match(installerWorkflow, /if: always\(\)/);
  assert.match(installerWorkflow, /EvaluaPro-QA-Isolated-installer-hub-e2e/);
  assert.ok(installerWorkflow.indexOf('E2E completa sobre el bundle docente que se publicará') < installerWorkflow.indexOf('Publicar artefactos instalador'));
});

test('runtime nativo tolera arranque lento sin reinicio prematuro', () => {
  const dashboard = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');
  assert.match(dashboard, /waitForLifecycleHealth\(\s*desiredMode,\s*flavorPolicy\.requireLocalPortal,\s*flavorPolicy\.requireDockerRuntime,\s*90_000\s*\)/);
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

test('dashboard mantiene TLS, argumentos y timers bajo contratos seguros', () => {
  const dashboard = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');
  assert.doesNotMatch(dashboard, /rejectUnauthorized\s*:\s*false/);
  assert.doesNotMatch(dashboard, /function quoteCmdArg/);
  assert.match(dashboard, /runProcessCapture\(installerPath, \['\/quiet', '\/norestart'\]/);
  assert.match(dashboard, /EVALUAPRO_BURN_INSTALLDIR:\s*root/);
  assert.match(dashboard, /EVALUAPRO_FLAVOR_ID:\s*String\(updateConfig\.flavorId/);
  assert.match(dashboard, /runProcessCapture\(installerPath, \['\/quiet', '\/norestart'\], 10 \* 60_000, \{\s*env: installerEnv\s*\}\)/);
  assert.match(dashboard, /legacyProfilePath/);
  assert.match(dashboard, /stableProfilePath/);
  assert.match(dashboard, /cpSync\(legacyProfilePath, stableProfilePath/);
  assert.match(appHost, /ResolveWebView2UserDataFolder\(\)/);
  assert.match(appHost, /EvaluaPro-UserData[\\/\\"]+,?\s*"webview2-profile"/);
  assert.match(dashboard, /runProcessCapture\(resolved\.path, args, 30_000\)/);
  assert.match(dashboard, /continuityTimer = setInterval\([\s\S]*?DASHBOARD_TIMER_TICK_MS\)/);
  assert.match(dashboard, /lifecycleSupervisorTimer = setInterval\([\s\S]*?DASHBOARD_TIMER_TICK_MS\)/);
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

test('runner selecciona opciones del combo solo con SelectionItemPattern', () => {
  assert.match(runner, /Find-ByName -RootElement \$Combo -Name \$ItemName[\s\S]*?SelectionItemPattern/);
  assert.match(runner, /\$selectionPattern\.Select\(\)/);
  assert.match(runner, /'uninstall' \{ 'Desinstalar \(con respaldo\)' \}/);
  assert.match(runner, /'repair' \{ 'Reparar componentes' \}/);
  assert.match(runner, /No se pudo seleccionar la opcion/);
  assert.match(runner, /SendKeys\]::SendWait\('\{ENTER\}'\)/);
  assert.match(runner, /Modo no aplicado: solicitado=\$\{Mode\} accion=/);
  assert.match(runner, /Add-Result -Area \$Mode -Item 'mode-selection' -Ok \$true -Detail "action=\$expectedAction"/);
  assert.doesNotMatch(runner, /Invoke-Control -Element \$item/);
});

test('GUI lifecycle asocia ventana y detección al proceso iniciado y cierra su árbol', () => {
  assert.match(uiLifecycle, /\[Parameter\(Mandatory = \$true\)\]\[int\]\$TargetPid/);
  assert.match(uiLifecycle, /window\.Current\.ProcessId/);
  assert.match(uiLifecycle, /function Get-VerifiedBundleUiProcessIds/);
  assert.match(uiLifecycle, /function Get-LocalProcessSnapshot/);
  assert.match(uiLifecycle, /CreateToolhelp32Snapshot/);
  assert.match(uiLifecycle, /Process32FirstW/);
  assert.match(uiLifecycle, /Process32NextW/);
  assert.match(uiLifecycle, /GetProcessSnapshot\(\)/);
  assert.doesNotMatch(uiLifecycle, /Get-CimInstance -ClassName Win32_Process|Get-WmiObject -Class Win32_Process/);
  assert.equal((uiLifecycle.match(/Get-LocalProcessSnapshot\)/g) ?? []).length, 2);
  assert.match(uiLifecycle, /EvaluaPro\.BurnBootstrapperApp\.exe/);
  assert.match(uiLifecycle, /return \$ownedUiPids\.ToArray\(\)/);
  assert.match(uiLifecycle, /\$ownedUiProcessIds -notcontains \$windowPid/);
  assert.match(uiLifecycle, /Find-Window -TargetPid \$bundleProcessId/);
  assert.match(uiLifecycle, /uiProcessId = \$bundleUiProcessId/);
  assert.match(uiLifecycle, /Wait-DetectionCompletion -Window \$window -TimeoutSec \$DetectionTimeoutSec/);
  assert.match(uiLifecycle, /AutomationIdProperty,[\s\S]*?'FooterStatusTextBlock'/);
  assert.match(uiLifecycle, /function Stop-OwnedProcessTree/);
  const cleanup = uiLifecycle.slice(uiLifecycle.lastIndexOf('\nfinally {'));
  assert.match(cleanup, /Save-Report -Status \$\(if \(\$failed\) \{ 'failed' \} else \{ 'passed' \}\)/);
  assert.match(uiLifecycle, /GetProcessSnapshot\(\)/);
  assert.match(uiLifecycle, /\$ownedProcess\.Kill\(\)/);
  assert.match(uiLifecycle, /\$RootProcess\.Kill\(\)/);
  assert.match(uiLifecycle, /processStartedAt = \$bundleProcessStartedAt/);
  assert.doesNotMatch(uiLifecycle, /Stop-Process -Id \$process\.Id/);
});

test('runner limita broker y mata solo su árbol al vencer timeout', () => {
  assert.match(runner, /\$TimeoutSec = 60/);
  assert.match(runner, /WaitForExit\(\$TimeoutSec \* 1000\)/);
  assert.match(runner, /taskkill\.exe \/PID \$process\.Id \/T \/F/);
  assert.match(runner, /timeout=\$\{TimeoutSec\}s/);
  assert.match(runner, /EvaluaPro\.BurnBootstrapperApp/);
  assert.match(runner, /\$Window\.Current\.NativeWindowHandle/);
  assert.match(runner, /AutomationElement\]::FromHandle/);
  assert.match(runner, /CopyFromScreen/);
  assert.match(runner, /state = 'healthy'/);
  assert.match(runner, /closed and installed Node tree absent/);
});

test('MSI docente usa un CAB embebido y el build valida su extracción administrativa con límite', () => {
  assert.match(productWxs, /<MediaTemplate EmbedCab="yes" CompressionLevel="mszip" MaximumUncompressedMediaSize="2048" \/>/);
  assert.match(msiBuild, /WaitForExit\(300000\)/);
  assert.match(msiBuild, /\$proc\.Refresh\(\)/);
  assert.match(msiBuild, /Extracción administrativa MSI no confirmó su terminación/);
  assert.match(msiBuild, /\$installExitCode = \[int\]\$proc\.ExitCode/);
  assert.match(msiBuild, /Extracción administrativa MSI excedió 300 segundos/);
  assert.match(msiBuild, /@\('\/a', \$MsiPath/);
  assert.doesNotMatch(msiBuild, /@\('\/i', \$MsiPath|@\('\/x', \$MsiPath/);
  assert.match(msiBuild, /evaluapro-native-dist\.zip[\s\S]*?\$nativePayloadArchive\.FullName/);
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
  assert.match(msiBuild, /npmCommand prune --omit=dev --ignore-scripts/);
  assert.match(msiBuild, /foreach \(\$prunePath in \$prunePaths\)/);
  assert.match(msiBuild, /node_modules\/\.prisma\/client\/libquery_engine-\*\.so\.node/);
  assert.match(msiBuild, /node_modules\/\@prisma\/studio-core/);
  assert.match(msiBuild, /node_modules\/\@electric-sql/);
  assert.match(msiBuild, /node_modules\/better-sqlite3\/deps/);
  assert.match(msiBuild, /query_compiler_small_bg\\\.sqlite/);
  assert.match(msiBuild, /apps\/backend\/eng\.traineddata/);
  assert.match(msiBuild, /apps\/backend\/spa\.traineddata/);
  assert.match(msiBuild, /4\.0\.0_best_int\/spa\.traineddata\.gz/);
  assert.match(msiBuild, /better_sqlite3\.node/);
  assert.match(msiBuild, /Runtime Prisma\/SQLite validado con consulta en memoria/);
  assert.match(msiBuild, /pdf-parse/);
  assert.match(msiBuild, /pdfjs-dist/);
  assert.match(msiBuild, /Payload preconstruido reutilizado y podado/);
});

test('el payload docente conserva los módulos PDF requeridos en runtime', () => {
  assert.match(msiBuild, /foreach \(\$requiredRuntimeModule in @\('pdf-parse', 'pdfjs-dist', '@napi-rs\/canvas', 'tesseract\.js', '@tesseract\.js-data\/spa'\)\)/);
  assert.match(msiBuild, /Falta dependencia de runtime requerida por el backend/);
  assert.doesNotMatch(msiBuild, /Join-Path \$backendTarget 'node_modules\/pdfjs-dist'/);
});

test('la ETA del Hub se deriva del avance real, se suaviza y declara verificación', () => {
  assert.match(hubWindow, /Queue<\(DateTime At, int Progress\)> progressSamples/);
  assert.match(hubWindow, /smoothedRemainingSeconds/);
  assert.match(hubWindow, /\(previousEstimate\.Value \* 0\.70\) \+ \(rawSecondsRemaining \* 0\.30\)/);
  assert.match(hubWindow, /Tiempo restante: verificando etapa actual/);
  assert.match(hubWindow, /Tiempo restante estimado: \{FormatDuration\(lowerSeconds\)\} a \{FormatDuration\(upperSeconds\)\}/);
});

test('la ETA se ajusta al ancho y expone su contenido completo a UI Automation', () => {
  assert.match(hubWindowXaml, /<TextBlock[^>]*x:Name="ProgressEtaTextBlock"[^>]*TextWrapping="Wrap"[^>]*AutomationProperties\.AutomationId="ProgressEtaTextBlock"/);
  assert.doesNotMatch(hubWindowXaml, /x:Name="ProgressEtaTextBlock"[^>]*AutomationProperties\.Name=/);
  assert.match(uiLifecycle, /progress-eta-full-text-visible/);
  assert.match(uiLifecycle, /desempaquetando archivos nativos/);
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
