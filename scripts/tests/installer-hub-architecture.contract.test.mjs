import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const helper = read('scripts', 'installer-burn', 'InstallerBurnHelper.ps1');
const contracts = read('scripts', 'installer-burn', 'modules', 'InstallerHubContracts.psm1');
const operation = read('scripts', 'installer-burn', 'modules', 'InstallerHubOperation.psm1');
const processes = read('scripts', 'installer-burn', 'modules', 'InstallerHubProcesses.psm1');
const transaction = read('scripts', 'installer-burn', 'modules', 'InstallerHubTransaction.psm1');
const payload = read('scripts', 'installer-burn', 'modules', 'InstallerHubPayload.psm1');
const verification = read('scripts', 'installer-burn', 'modules', 'InstallerHubVerification.psm1');
const bootstrapper = read('packaging', 'wix', 'BurnBootstrapperApp', 'EvaluaProBootstrapperApplication.cs');
const appHost = read('packaging', 'app-host', 'MainWindow.xaml.cs');
const launcherBroker = read('scripts', 'launcher-broker.ps1');
const bundle = read('packaging', 'wix', 'Bundle.wxs');
const appFiles = read('packaging', 'wix', 'Fragments', 'AppFiles.wxs');
const msiBuild = read('scripts', 'build-msi.ps1');
const contract = JSON.parse(read('contracts', 'installer-hub', 'request-envelope-v1.schema.json'));
const responseContract = JSON.parse(read('contracts', 'installer-hub', 'response-envelope-v1.schema.json'));
const readinessContract = JSON.parse(read('contracts', 'installer-hub', 'dashboard-readiness-v1.schema.json'));
const launcher = read('scripts', 'launcher-dashboard.mjs');
const rootPackage = JSON.parse(read('package.json'));
const rootLock = JSON.parse(read('package-lock.json'));
const appVersionMetadata = JSON.parse(read('config', 'app-version.json'));

test('el contrato v1 rechaza versiones, comandos y campos de sobre desconocidos', () => {
  assert.equal(contract.properties.schemaVersion.const, 1);
  assert.deepEqual(contract.properties.command.enum, [
    'detect-prereqs', 'post-install', 'update', 'uninstall'
  ]);
  assert.equal(contract.additionalProperties, false);
  assert.match(contracts, /schemaVersion/);
  assert.match(contracts, /expiresAtUtc/);
  assert.match(contracts, /Unprotect/);
  assert.match(contracts, /Get-InstallerHubRequestSchema/);
  assert.match(contracts, /schema\.properties\.command\.enum/);
  assert.deepEqual(responseContract.required, ['schemaVersion', 'operationId', 'ok', 'phase', 'exitCode', 'message']);
  assert.deepEqual(readinessContract.required, ['dashboard', 'paths']);
  assert.deepEqual(readinessContract.properties.dashboard.required, ['contractVersion', 'instanceId', 'state', 'pid', 'port', 'startedAt']);
  assert.deepEqual(readinessContract.properties.paths.required, ['root']);
});

test('Burn y MSI empaquetan los módulos de contratos y orquestación', () => {
  assert.match(bundle, /InstallerHubContracts\.psm1/);
  assert.match(bundle, /InstallerHubOperation\.psm1/);
  assert.match(bundle, /InstallerHubProcesses\.psm1/);
  assert.match(bundle, /InstallerHubTransaction\.psm1/);
  assert.match(bundle, /InstallerHubPayload\.psm1/);
  assert.match(bundle, /InstallerHubVerification\.psm1/);
  assert.match(appFiles, /InstallerHubContracts\.psm1/);
  assert.match(appFiles, /InstallerHubOperation\.psm1/);
  assert.match(appFiles, /InstallerHubProcesses\.psm1/);
  assert.match(appFiles, /InstallerHubTransaction\.psm1/);
  assert.match(appFiles, /InstallerHubPayload\.psm1/);
  assert.match(appFiles, /InstallerHubVerification\.psm1/);
  assert.match(appFiles, /CMP\.BurnHubRequestSchema/);
  assert.match(appFiles, /CMP\.BurnHubResponseSchema/);
  assert.match(appFiles, /CMP\.BurnHubReadinessSchema/);
  assert.equal((appFiles.match(/<Component Id="CMP\.BurnHub(?:Request|Response|Readiness)Schema" Guid="\*">/g) ?? []).length, 3);
  assert.match(msiBuild, /'ls-files',\s*'--cached',\s*'--others',\s*'--exclude-standard'/);
  assert.match(msiBuild, /'contracts\/installer-hub\//);
  assert.match(msiBuild, /\$proc\.WaitForExit\(\)\s+\$proc\.Refresh\(\)\s+\$gitExitCode = if \(\$proc\.HasExited\)/);
  assert.match(msiBuild, /Git ls-files no expuso ExitCode/);
  assert.match(msiBuild, /CompressionLevel\]::Optimal/);
  assert.match(msiBuild, /EVALUAPRO_BA_PUBLISH_TIMEOUT_SECONDS/);
  assert.match(msiBuild, /Publish de Bootstrapper Application excedió/);
  assert.match(msiBuild, /Versiones desalineadas para/);
  assert.match(msiBuild, /lockPackageVersion -ne \$payloadVersion/);
  assert.match(msiBuild, /config\/app-version\.json desalineado/);
  assert.match(bundle, /request-envelope-v1\.schema\.json/);
  assert.match(bundle, /response-envelope-v1\.schema\.json/);
  assert.match(bundle, /dashboard-readiness-v1\.schema\.json/);
  assert.match(helper, /Import-Module \$installerHubContractsModule/);
  assert.match(helper, /Import-Module \$installerHubOperationModule/);
  assert.match(helper, /Import-Module \$installerHubProcessesModule/);
  assert.match(helper, /Import-Module \$installerHubTransactionModule/);
  assert.match(helper, /Import-Module \$installerHubPayloadModule/);
  assert.match(helper, /Import-Module \$installerHubVerificationModule/);
  assert.match(helper, /Invoke-EvaluaProPayloadPromotion/);
  assert.match(helper, /Invoke-EvaluaProInstallationManifestVerification/);
  assert.match(payload, /function Invoke-EvaluaProPayloadPromotion/);
  assert.match(payload, /OnBeforePromoteEntry/);
  assert.match(payload, /Recover-PayloadTransaction -TargetDir \$root/);
  assert.match(helper, /El módulo de payload devolvió una respuesta sin objeto único/);
  assert.match(helper, /requiredResultFields = @\('ok', 'transactionPending', 'root', 'transactionId', 'version'\)/);
  assert.match(verification, /function Assert-EvaluaProNativeRuntime/);
  assert.match(verification, /function Test-EvaluaProInstallationManifest/);
  assert.match(transaction, /function Recover-PayloadTransaction/);
  assert.match(transaction, /function Complete-PayloadTransaction/);
  assert.match(processes, /function Get-EvaluaProOwnedNodeProcessIds/);
  assert.match(processes, /function Stop-EvaluaProOwnedNodeProcesses/);
  assert.match(operation, /recovery_required/);
});

test('versiones de monorepo, lockfiles y release del payload permanecen alineadas', () => {
  assert.equal(appVersionMetadata.version, rootPackage.version);
  assert.equal(appVersionMetadata.displayVersion, rootPackage.version);
  const packages = [
    ['apps/backend/package.json', 'apps/backend/package-lock.json', 'apps/backend'],
    ['apps/frontend/package.json', 'apps/frontend/package-lock.json', 'apps/frontend'],
    ['apps/portal_alumno_cloud/package.json', 'apps/portal_alumno_cloud/package-lock.json', 'apps/portal_alumno_cloud'],
  ];
  assert.equal(rootLock.version, rootPackage.version);
  assert.equal(rootLock.packages[''].version, rootPackage.version);
  for (const [packagePath, lockPath, workspaceKey] of packages) {
    const pkg = JSON.parse(read(...packagePath.split('/')));
    const lock = JSON.parse(read(...lockPath.split('/')));
    assert.equal(pkg.version, rootPackage.version, `${packagePath} debe compartir la version del root`);
    assert.equal(lock.version, rootPackage.version, `${lockPath} version superior`);
    assert.equal(lock.packages[''].version, rootPackage.version, `${lockPath} paquete root`);
    assert.equal(rootLock.packages[workspaceKey].version, rootPackage.version, `${workspaceKey} en package-lock root`);
  }
});

test('el handoff usa solicitud privada, secretos protegidos y limpieza terminal', () => {
  assert.match(bootstrapper, /ProtectedData\.Protect/);
  assert.match(bootstrapper, /SetAccessRuleProtection\(isProtected: true, preserveInheritance: false\)/);
  assert.match(bootstrapper, /LocalApplicationData/);
  assert.match(bootstrapper, /TryDeleteHandoffFile\(requestPath\)/);
  assert.match(bootstrapper, /TryDeleteHandoffFile\(responsePath\)/);
  assert.match(helper, /Read-EvaluaProInstallerRequest/);
  assert.doesNotMatch(helper, /Get-RequestValue -Request \$Request -Names @\('PayloadZip', 'payloadZip'\)/);
});

test('AppHost solo declara readiness con identidad propia y runtime embebido', () => {
  assert.doesNotMatch(appHost, /nodeExe = "node"/);
  assert.match(appHost, /ProcessName|MainModule\?\.FileName/);
  assert.match(appHost, /StartTime/);
  assert.match(appHost, /SemaphoreSlim|startupSemaphore/);
  assert.match(appHost, /TryAdoptDashboardAsync/);
  assert.match(appHost, /dashboardProcess != null/);
  assert.match(appHost, /contractVersion != 1/);
  assert.match(appHost, /statusInstanceId/);
  assert.match(launcher, /const dashboardInstanceId = randomUUID\(\)/);
  assert.match(launcher, /contractVersion: 1/);
  assert.match(launcher, /instanceId: dashboardInstanceId/);
  assert.match(launcher, /fs\.renameSync\(temporaryPath, lockPath\)/);
});

test('AppHost abre Installer Hub solo por mensaje local validado del WebView', () => {
  assert.match(appHost, /e\.Source\.StartsWith\("http:\/\/127\.0\.0\.1:4173\//);
  assert.match(appHost, /EVALUAPRO_UPDATE_HUB/);
  assert.match(appHost, /releases\/latest/);
  assert.match(appHost, /UserAgent\.ParseAdd\("EvaluaPro-AppHost"\)/);
  assert.match(appHost, /MessageBoxButton\.YesNo/);
  assert.match(appHost, /ReadExpectedHashAsync/);
  assert.match(appHost, /HashMatches\(partialPath, expectedHash\)/);
  assert.match(appHost, /VerifySameTrustedPublisher/);
  assert.match(appHost, /ResolveInstalledHubPath/);
  assert.match(appHost, /BundleCachePath/);
  assert.match(appHost, /installedCert\.Thumbprint/);
  assert.match(appHost, /WinVerifyTrust/);
  assert.match(appHost, /EvaluaPro-InstallerHub-docente-local-v\{releaseVersion\}\.exe/);
  assert.match(appHost, /EvaluaPro-InstallerHub-docente-local-v\{requestedVersion\}\.exe/);
});

test('el acceso directo del Hub usa release estable, verifica y reutiliza su cache firmado', () => {
  assert.match(launcherBroker, /function Resolve-LatestStableHubExecutablePath/);
  assert.match(launcherBroker, /releases\/latest/);
  assert.match(launcherBroker, /config\.channel -ne 'stable'/);
  assert.match(launcherBroker, /config\.flavorId -ne 'docente-local'/);
  assert.match(launcherBroker, /EvaluaPro-InstallerHub-docente-local-v\$\(\$latestVersion\.ToString\(\)\)\.exe/);
  assert.match(launcherBroker, /Get-FileHash .* -Algorithm SHA256/);
  assert.match(launcherBroker, /Get-AuthenticodeSignature/);
  assert.match(launcherBroker, /currentSignature\.SignerCertificate\.Thumbprint -eq \$cachedSignature\.SignerCertificate\.Thumbprint/);
  assert.match(launcherBroker, /Move-Item -LiteralPath \$partialPath -Destination \$targetPath/);
  assert.match(launcherBroker, /Resolve-LatestStableHubExecutablePath -CurrentHubPath/);
});

test('la remediación no informa éxito si solo volvió a detectar requisitos', () => {
  assert.match(helper, /La remediación automática nativa no está disponible/);
  assert.match(bootstrapper, /La remediación automática nativa no está disponible/);
});

test('los estados de transacción cubren configuración, verificación y recuperación', () => {
  assert.match(helper, /Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Set-PayloadTransactionState' -Parameters @\{ TargetDir = \$targetDir; State = 'configuring' \}/);
  assert.match(helper, /Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Set-PayloadTransactionState' -Parameters @\{ TargetDir = \$targetDir; State = 'verifying' \}/);
  assert.match(helper, /Operation = Import-Module \$installerHubOperationModule .* -PassThru/);
  assert.match(helper, /return & \$module \{ param\(\$name, \$boundParameters\) & \$name @boundParameters \}/);
  assert.match(operation, /promoting = @\('configuring', 'verifying', 'recovery_required'\)/);
  assert.match(transaction, /Set-EvaluaProOperationState -Journal \$journal -State 'recovering'/);
  assert.match(transaction, /Set-EvaluaProOperationState -Journal \$journal -State 'recovered'/);
  const progressWriter = helper.slice(helper.indexOf('function Write-HelperProgress'), helper.indexOf('function Invoke-ShortcutReconciliation'));
  assert.match(progressWriter, /\[Console\]::Out\.WriteLine\("EVALUAPRO_PROGRESS:"/);
  assert.doesNotMatch(progressWriter, /\n\s*Write-Output\s*\(/);
});

test('uninstall usa transacción y conserva data sin exportación', () => {
  const uninstall = helper.slice(helper.indexOf('function Invoke-Uninstall'), helper.indexOf('function Invoke-LicenseHeartbeat'));
  assert.match(uninstall, /schemaVersion = 1/);
  assert.match(uninstall, /allowDataRemoval = \[bool\]\$allowLocalDataRemoval/);
  assert.match(uninstall, /Assert-InstallerHubTreeHasNoReparsePoints -Path \$dataDir/);
  assert.match(uninstall, /La desinstalación solo puede gestionar data dentro de la raíz/);
  assert.match(uninstall, /Set-PayloadTransactionState/);
  assert.match(uninstall, /Complete-PayloadTransaction/);
  assert.match(uninstall, /LOCALAPPDATA/);
  assert.doesNotMatch(uninstall, /Remove-Item -LiteralPath \$targetDir -Recurse/);
});
