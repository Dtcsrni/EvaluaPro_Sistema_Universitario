import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = fs.readFileSync(path.join(root, 'packaging', 'app-host', 'MainWindow.xaml.cs'), 'utf8');
const app = fs.readFileSync(path.join(root, 'packaging', 'app-host', 'App.xaml.cs'), 'utf8');
const shortcutReconciler = fs.readFileSync(path.join(root, 'packaging', 'app-host', 'ShortcutReconciler.cs'), 'utf8');
const authController = fs.readFileSync(path.join(root, 'apps', 'backend', 'src', 'modulos', 'modulo_autenticacion', 'controladorAutenticacion.ts'), 'utf8');
const accountSection = fs.readFileSync(path.join(root, 'apps', 'frontend', 'src', 'apps', 'app_docente', 'SeccionCuenta.tsx'), 'utf8');

test('AppHost no declara lista la ventana si solo responde el servidor web', () => {
  assert.match(source, /apiHealthUrl\s*=\s*"http:\/\/127\.0\.0\.1:4000\/api\/salud"/);
  assert.match(source, /ProbePortAsync\(webHealthUrl\)\s*&&\s*await ProbePortAsync\(apiHealthUrl\)/);
  assert.match(source, /RequestDashboardReconcileAsync/);
  assert.match(source, /api\/lifecycle\/reconcile/);
});

test('AppHost tolera arranque frío acotado y conserva el diagnóstico de timeout', () => {
  assert.match(source, /ServiceStartupTimeout\s*=\s*TimeSpan\.FromSeconds\(60\)/);
  assert.match(source, /new CancellationTokenSource\(ServiceStartupTimeout\)/);
  assert.match(source, /Timeout esperando web\/API locales/);
});

test('AppHost prioriza la instalación canónica y reconcilia accesos antes del arranque', () => {
  assert.match(source, /ResolveCanonicalInstallRoot\(\)/);
  assert.match(source, /Se ignoró una copia no canónica/);
  assert.match(app, /ShortcutReconciler\.EnsureCurrent\(\)/);
  assert.doesNotMatch(source, /ReconcileShortcutsAsync|create-shortcuts\.ps1|powershell\.exe/i);
  assert.match(source, /app-host\.log/);
});

test('la regeneración nativa genera los dos accesos y refresca Explorer', () => {
  assert.match(app, /--regenerate-shortcuts/);
  assert.match(shortcutReconciler, /"EvaluaPro"/);
  assert.match(shortcutReconciler, /"EvaluaPro - Hub"/);
  assert.match(shortcutReconciler, /SetArguments\(arguments\)/);
  assert.match(shortcutReconciler, /SetShowCmd\(1\)/);
  assert.match(shortcutReconciler, /ShcneUpdateItem/);
  assert.match(shortcutReconciler, /ShcnfFlush/);
  assert.match(shortcutReconciler, /shortcut-reconciliation\.json/);
  assert.match(shortcutReconciler, /Environment\.GetEnvironmentVariable\("OneDrive"\)/);
  assert.match(authController, /spawn\(\s*hostPath,\s*\['--regenerate-shortcuts'\]/);
  assert.doesNotMatch(authController, /powershell|create-shortcuts\.ps1/i);
  assert.match(accountSection, /\/autenticacion\/accesos-directos\/regenerar/);
  assert.match(accountSection, /Regenerar accesos e iconos/);
});

test('el acceso Hub acepta el tag hub-v y arranca desde SHA-256 oficial cuando no hay Hub instalado', () => {
  const trustRegistration = source.slice(source.indexOf('private static void RegisterTrustedInstallerHub'), source.indexOf('private static bool IsTrustedInstallerHub'));
  assert.match(source, /TryParseHubReleaseTag\(tag, out var releaseVersion\)/);
  assert.match(source, /\(\?:hub-\)\?v\?/);
  assert.match(source, /installedHubPath is null \|\| installedHubVersion is null \|\| releaseVersion > installedHubVersion/);
  assert.match(source, /ReadExpectedHashAsync\(client, checksum\)/);
  assert.match(source, /RegisterTrustedInstallerHub\(targetPath, latest, expectedHash\)/);
  assert.match(source, /HashMatches\(path, sha256\.GetString\(\)!\)/);
  assert.match(source, /VerifySameTrustedPublisher\(targetPath\)/);
  assert.match(source, /Guid\.NewGuid\(\)\.ToString\("N"\) \+ "\.partial"/);
  assert.match(app, /HubBootstrapSingletonMutexName/);
  assert.match(source, /WriteAllText\(temporaryPath, record\)/);
  assert.doesNotMatch(trustRegistration, /JsonSerializer\.Serialize/);
  assert.doesNotMatch(source, /VerifySameTrustedPublisher\(targetPath\);[\s\S]{0,160}installedHubPath is null/);
});

test('las confirmaciones de descarga del Hub no dependen de una ventana oculta', () => {
  const downloadFlow = source.slice(source.indexOf('private async Task<bool> DownloadAndOpenLatestInstallerHubAsync'), source.indexOf('private static Uri ResolveReleaseAsset'));
  assert.match(source, /ShowInTaskbar = false;\s*Hide\(\);\s*await OpenInstallerHubFromShortcutAsync\(\)/);
  assert.match(downloadFlow, /WpfMessageBox\.Show\(\s*\$"Se encontró Installer Hub/);
  assert.doesNotMatch(downloadFlow, /WpfMessageBox\.Show\(\s*this\s*,/);
});

test('el cierre limpia servicios antes de volver al Dispatcher y no reentra al cierre async', () => {
  const closing = source.slice(source.indexOf('private async void MainWindow_Closing'));
  assert.match(source, /private bool shutdownCompleted;/);
  assert.match(closing, /if \(shutdownCompleted\) return;/);
  assert.match(closing, /if \(App\.IsInstallerHubInvocation\) return;/);
  assert.match(closing, /stopped = await ShutdownServicesAsync\(\)/);
  assert.match(closing, /shutdownCompleted = true;[\s\S]*Dispatcher\.BeginInvoke\(new Action\(Close\)\)/);
  assert.doesNotMatch(closing, /await ShutdownServicesAsync\(\);\s*Close\(\);/);
});
