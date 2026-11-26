import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = read('packaging/app-host/App.xaml.cs');
const window = read('packaging/app-host/MainWindow.xaml.cs');
const tray = read('packaging/app-host/NativeTrayIcon.cs');
const shortcuts = read('packaging/app-host/ShortcutReconciler.cs');
const csproj = read('packaging/app-host/EvaluaPro.AppHost.csproj');
const spec = read('docs/specs/SPEC-150_bandeja-nativa-inicio-automatico.spec.md');

test('SPEC-150 está aprobada y cubre inicio, bandeja y salida explícita', () => {
  assert.match(spec, /^estado: approved$/m);
  assert.match(spec, /--tray-start/);
  assert.match(spec, /detener servicios únicamente con «Salir»/);
});

test('el AppHost distingue inicio en bandeja de Installer Hub y oculta solo al terminar de cargar', () => {
  assert.match(app, /IsTrayStartupInvocation = e\.Args\.Any\(argument =>[\s\S]*?"--tray-start"/);
  assert.match(app, /IsInstallerHubInvocation = e\.Args\.Any\(argument =>[\s\S]*?"--installer-hub"/);
  assert.match(window, /App\.IsTrayStartupInvocation && System\.Windows\.Application\.Current is App app[\s\S]*?app\.EnterTrayMode\(this\)/);
});

test('el icono de bandeja es nativo y expone abrir y salir', () => {
  assert.match(csproj, /<UseWindowsForms>true<\/UseWindowsForms>/);
  assert.match(tray, /new NotifyIcon/);
  assert.match(tray, /Abrir EvaluaPro/);
  assert.match(tray, /Salir/);
  assert.match(tray, /notifyIcon\.DoubleClick/);
  assert.doesNotMatch(tray, /launcher-tray\.ps1|powershell\.exe|wscript\.exe/i);
});

test('cerrar oculta la ventana y solo Salir detiene servicios y termina el host', () => {
  assert.match(window, /if \(choice == MessageBoxResult\.No\)[\s\S]*?app\.EnterTrayMode\(this\)/);
  assert.match(app, /new NativeTrayIcon\([\s\S]*?window\.ShutdownFromTrayAsync\(\)/);
  assert.match(window, /internal async Task ShutdownFromTrayAsync\(\)[\s\S]*?await ShutdownServicesAsync\(\)[\s\S]*?Application\.Current\.Shutdown\(\)/);
  assert.match(app, /ShutdownMode = ShutdownMode\.OnExplicitShutdown/);
});

test('el acceso de inicio usa Startup por usuario y no sobrescribe otro ejecutable', () => {
  assert.match(shortcuts, /Environment\.SpecialFolder\.Startup/);
  assert.match(shortcuts, /"--tray-start"/);
  assert.match(shortcuts, /File\.Exists\(linkPath\) && !PointsToTarget\(linkPath, executable\)/);
  assert.match(shortcuts, /CreateShortcutIfOwned\(startupDirectory, "EvaluaPro", executable, root, "--tray-start"/);
});

test('solo archiva el acceso heredado de Codex cuando nombre, destino y argumento coinciden', () => {
  assert.match(shortcuts, /const string legacyShortcutName = "EvaluaPro docente-local \(bandeja\)\.lnk"/);
  assert.match(shortcuts, /IsLegacyCodexTrayTarget\(target\)[\s\S]*?ReadShortcutArguments\(link\), "--tray-start"/);
  assert.match(shortcuts, /segments\[0\]\.StartsWith\("OpenAI\.Codex_"/);
  assert.match(shortcuts, /"LocalCache"[\s\S]*?"Local"[\s\S]*?"EvaluaPro"[\s\S]*?"EvaluaPro\.exe"/);
  assert.match(shortcuts, /segments\.Length == 5/);
  assert.match(shortcuts, /preserved_unverified/);
  assert.match(shortcuts, /preserved_unreadable/);
  assert.match(shortcuts, /not_found/);
});

test('el archivo conserva bytes en backup y verifica SHA-256 antes de retirar el acceso de Inicio', () => {
  assert.match(shortcuts, /Backups", "startup-shortcuts"/);
  assert.match(shortcuts, /inspectedHash = Convert\.ToHexString\(SHA256\.HashData\(File\.ReadAllBytes\(shortcutPath\)\)\)/);
  assert.match(shortcuts, /preserved_changed_during_inspection/);
  assert.match(shortcuts, /File\.Move\(shortcutPath, backupPath\)/);
  assert.match(shortcuts, /SHA256\.HashData\(File\.ReadAllBytes\(backupPath\)\)/);
  assert.match(shortcuts, /preserved_hash_mismatch/);
  assert.match(shortcuts, /File\.Move\(backupPath, shortcutPath\)/);
  assert.match(shortcuts, /legacyStartupShortcutCleanup/);
});

test('docente-local desactiva el launcher PowerShell duplicado', () => {
  assert.match(window, /EnvironmentVariables\["DASHBOARD_TRAY_AUTOSTART"\] = "0"/);
});
