/**
 * app-host-shutdown.contract.test
 *
 * Responsabilidad: proteger el contrato de cierre coordinado de la app nativa.
 * Limites: valida la integración estática entre el host WPF y el dashboard local.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const dashboardSource = fs.readFileSync(
  path.join(root, 'scripts', 'launcher-dashboard.mjs'),
  'utf8'
);
const hostSource = fs.readFileSync(
  path.join(root, 'packaging', 'app-host', 'MainWindow.xaml.cs'),
  'utf8'
);
const appSource = fs.readFileSync(
  path.join(root, 'packaging', 'app-host', 'App.xaml.cs'),
  'utf8'
);
const windowSource = fs.readFileSync(
  path.join(root, 'packaging', 'app-host', 'MainWindow.xaml'),
  'utf8'
);
const installerE2ESource = fs.readFileSync(
  path.join(root, 'scripts', 'tests', 'installer-hub-e2e-docente.ps1'),
  'utf8'
);

test('el cierre nativo detiene el árbol completo del dashboard', () => {
  assert.match(dashboardSource, /pathName === '\/api\/shutdown'/);
  assert.match(dashboardSource, /stopAllManagedTasks\(\)/);
  assert.match(dashboardSource, /taskkill', \['\/T', '\/F', '\/PID'/);
  assert.match(hostSource, /PostAsync\(/);
  assert.match(hostSource, /\/api\/shutdown/);
  assert.match(hostSource, /e\.Cancel = true/);
  assert.match(hostSource, /process\.Kill\(entireProcessTree: true\)/);
  assert.match(hostSource, /if \(dashboardProcess == null\) return true;/);
});

test('el cierre asíncrono evita reentrada y cierra después de limpiar servicios', () => {
  const closingHandler = hostSource.match(/private void MainWindow_Closing[\s\S]*?\n    }/)?.[0];
  const closePrompt = hostSource.match(/private async Task ShowCloseConfirmationAsync\(\)[\s\S]*?\n    }/)?.[0];
  assert.ok(closingHandler, 'debe existir el manejador de cierre del App Host');
  assert.ok(closePrompt, 'debe existir el flujo diferido de confirmación de cierre');
  assert.match(hostSource, /private bool closeAuthorized;/);
  assert.match(hostSource, /private bool closePromptPending;/);

  const shutdownReentryCheck = closingHandler.indexOf('if (shutdownCompleted) return;');
  const hubCloseCheck = closingHandler.indexOf('if (App.IsInstallerHubInvocation) return;');
  const authorizeCheck = closingHandler.indexOf('if (closeAuthorized) return;');
  const cancelRequest = closingHandler.indexOf('e.Cancel = true;');
  const duplicateRequestCheck = closingHandler.indexOf('if (isStopping || closePromptPending) return;');
  const deferPrompt = closingHandler.indexOf('Dispatcher.BeginInvoke(new Action(() => _ = ShowCloseConfirmationAsync()))');

  assert.ok(shutdownReentryCheck >= 0 && shutdownReentryCheck < hubCloseCheck && hubCloseCheck < authorizeCheck,
    'el cierre repetido y el modo Hub oculto deben terminar sin abrir la confirmación docente');
  assert.ok(authorizeCheck >= 0 && authorizeCheck < cancelRequest,
    'el cierre final autorizado debe pasar sin cancelarse');
  assert.ok(cancelRequest >= 0 && cancelRequest < duplicateRequestCheck,
    'cada solicitud concurrente debe cancelarse antes de omitir el trabajo duplicado');
  assert.ok(duplicateRequestCheck < deferPrompt,
    'la ventana debe diferir el diálogo hasta que el evento Closing haya terminado');
  assert.doesNotMatch(closingHandler, /WpfMessageBox\.Show\s*\(|\.ShowDialog\s*\(|new WindowInteropHelper\s*\(|\.Close\s*\(/,
    'el evento Closing no debe abrir ventanas ni reentrar al cerrar el Window');
  const closeConfirmation = closePrompt.match(/var choice = WpfMessageBox\.Show\([\s\S]*?MessageBoxImage\.Question\);/)?.[0];
  assert.ok(closeConfirmation, 'debe existir una confirmación de cierre identificable');
  assert.match(closeConfirmation, /WpfMessageBox\.Show\(\s*"¿Cerrar EvaluaPro\?/,
    'el diálogo de confirmación no toma como owner la ventana que está cerrando');
  assert.doesNotMatch(closeConfirmation, /WpfMessageBox\.Show\(\s*this,/,
    'el diálogo no consulta el handle o la visibilidad de la ventana en transición');
  assert.match(closePrompt, /if \(choice == MessageBoxResult\.Cancel\) return;/,
    'Cancelar conserva la ventana abierta');
  const noChoice = closePrompt.match(/if \(choice == MessageBoxResult\.No\)[\s\S]*?\n            }/)?.[0];
  assert.match(noChoice ?? '', /app\.EnterTrayMode\(this\);[\s\S]*?return;/,
    'No conserva los servicios y delega el ocultamiento a la transición de bandeja');
  assert.doesNotMatch(noChoice ?? '', /closeAuthorized\s*=\s*true|\.Close\(|\.Shutdown\(/,
    'No no detiene el host ni cierra la ventana desde el diálogo modal');
  assert.match(closingHandler, /if \(isStopping \|\| closePromptPending\) return;/,
    'el diálogo de cierre no debe abrirse de nuevo mientras sigue pendiente');
  const cleanup = closePrompt.indexOf('var stopped = await ShutdownServicesAsync();');
  const cleanupFailure = closePrompt.indexOf('if (!stopped)');
  const finalClose = closePrompt.lastIndexOf('Dispatcher.BeginInvoke(new Action(() => System.Windows.Application.Current.Shutdown()))');
  assert.ok(cleanup >= 0 && cleanupFailure > cleanup && cleanupFailure < finalClose,
    'el cierre explícito de la aplicación se difiere al Dispatcher después de limpiar servicios');
  assert.match(closePrompt, /if \(!stopped\)[\s\S]*?return;/,
    'si la identidad de los servicios no puede verificarse, la ventana debe permanecer abierta');
  assert.match(closePrompt, /System\.Windows\.Application\.Current\.Shutdown\(\)/,
    'el cierre explícito termina WPF si la ventana ya había pasado a OnExplicitShutdown por el modo bandeja');
  assert.match(closePrompt, /finally\s*\{\s*closePromptPending = false;/,
    'la espera modal se libera también si el usuario cancela o falla la limpieza');
  assert.match(hostSource, /WPF no permite abrir otro Window\/MessageBox mientras el Window que[\s\S]*?mostrar el prompt después del evento/,
    'la causa de la regresión WPF queda documentada junto a la transición diferida');
});

test('el App Host admite cierre sin GUI autenticado al usuario y sesión actuales', () => {
  assert.match(appSource, /"--shutdown"/);
  assert.match(appSource, /var exitCode = await RequestHeadlessShutdownAsync\(\);[\s\S]*?Environment\.Exit\(exitCode\);/,
    'el cliente headless termina aunque WPF no haya abierto el bucle normal de interfaz');
  assert.match(appSource, /NamedPipeServerStream\([\s\S]*?PipeOptions\.CurrentUserOnly/);
  assert.match(appSource, /Canal local listo para órdenes del mismo usuario y sesión/);
  assert.match(appSource, /NamedPipeClientStream\([\s\S]*?GetDesktopControlPipeName\(\)/);
  assert.match(appSource, /candidate\.SessionId == self\.SessionId[\s\S]*?PathsEqual\(TryGetExecutablePath\(candidate\), TryGetExecutablePath\(self\)\)/);
  assert.match(appSource, /ShutdownFromTrayAsync\(\)/);
  assert.match(installerE2ESource, /MainWindowHandle -eq \[IntPtr\]::Zero[\s\S]*?ArgumentList '--shutdown'[\s\S]*?WaitForExit\(\(\$TimeoutSec \+ 20\) \* 1000\)[\s\S]*?APP_HOST_SHUTDOWN_DIAGNOSTIC[\s\S]*?headless-shutdown/,
    'el runner espera con límite, conserva los logs y evita bloquearse indefinidamente en Start-Process -Wait');
});

test('el E2E detecta y confirma el diálogo de cierre del App Host', () => {
  assert.match(installerE2ESource, /function Get-AppHostTopLevelWindows/);
  assert.match(installerE2ESource, /function Request-AppHostWindowClose/);
  assert.match(installerE2ESource, /PostMessage\(hWnd, 0x0010, IntPtr\.Zero, IntPtr\.Zero\)/);
  assert.match(installerE2ESource, /RequestClose\(\[IntPtr\]\(\[int64\]\$window\.Handle\)\)/);
  assert.match(installerE2ESource, /GetCurrentPattern\(\[System\.Windows\.Automation\.WindowPattern\]::Pattern\)/);
  assert.match(installerE2ESource, /windowPattern\.Close\(\)/);
  assert.match(installerE2ESource, /No se pudo solicitar el cierre del App Host PID=/);
  assert.match(installerE2ESource, /function Wait-AppHostCloseConfirmation/);
  assert.match(installerE2ESource, /function Wait-AppHostMainWindow/);
  assert.match(installerE2ESource, /Wait-AppHostMainWindow -ProcessId \$process\.Id/);
  assert.match(installerE2ESource, /App Host diagnostic:/);
  assert.match(installerE2ESource, /function Invoke-AppHostCloseConfirmationYes/);
  assert.match(installerE2ESource, /function Invoke-AppHostCloseConfirmationNo/);
  assert.match(installerE2ESource, /Wait-AppHostCloseConfirmation -ProcessId/);
  assert.match(installerE2ESource, /close-confirmation-yes/);
  assert.match(installerE2ESource, /close-confirmation-no/);
  assert.match(installerE2ESource, /app-host-error\.log/);
  assert.match(installerE2ESource, /\$errorLogLengthAfterClose -gt \$errorLogLengthBeforeClose/);
  assert.match(installerE2ESource, /Copy-ArtifactIfExists -Path \$appHostErrorLog -Name 'app-host-error-close-window\.log'/);
  assert.match(installerE2ESource, /El App Host PID \$\(\$identity\.Id\) terminó al elegir No; debía mantenerse en bandeja/);
  assert.match(installerE2ESource, /close-hides-window-keeps-host/);
  assert.match(installerE2ESource, /no debe cerrar los servicios Node|debía dejar el runtime en segundo plano/);
  assert.match(installerE2ESource, /\.Name -ne 'EvaluaPro · Cerrar' -and \$_.NativeTitle -ne 'EvaluaPro · Cerrar'/);
  assert.match(installerE2ESource, /\$visibleWindows\.Count -eq 0/);
  assert.match(installerE2ESource, /close-window-only'[\s\S]*?reopen-dashboard-/);
  assert.match(installerE2ESource, /no-keeps-services-healthy/);
  assert.match(installerE2ESource, /restored-from-tray state=healthy/);
});

test('el App Host omite candidatos obsoletos y busca un Hub local registrado por hash', () => {
  const resolver = hostSource.match(/private string ResolveHubPathForLaunch\(\)[\s\S]*?\n    \}/)?.[0];
  assert.ok(resolver, 'debe existir el resolver del Installer Hub');
  assert.match(resolver, /GetTrustedStagedHubPaths\(\)/);
  assert.match(resolver, /EnumerateInstalledHubPaths\(\)/);
  const trustCheck = resolver.indexOf('if (IsTrustedInstallerHub(fullPath)) return fullPath;');
  const rejectedCandidateDiagnostic = resolver.indexOf('Se omitió un candidato de Hub sin confianza');
  assert.ok(trustCheck >= 0 && rejectedCandidateDiagnostic > trustCheck,
    'cada ruta debe validarse antes de elegirla y los candidatos no confiables deben permitir continuar');
  assert.match(resolver, /Se omitió un candidato de Hub sin confianza/);
  assert.doesNotMatch(resolver, /File\.Exists\(candidate\)\) return Path\.GetFullPath\(candidate\)/);
  assert.match(hostSource, /"installer-hub", "trusted-bundle\.json"/);
  assert.match(hostSource, /repository\.ValueKind != JsonValueKind\.String/);
  assert.match(hostSource, /File\.Exists\(candidate\) && HashMatches\(candidate, sha256\)/);
  assert.match(hostSource, /throw new InvalidOperationException\("No se encontró un Installer Hub existente que coincida con firma o SHA-256 oficial registrado\."\)/);
});

test('el host adopta servicios sanos antes del retorno temprano y solo si coinciden con la instalación', () => {
  assert.match(hostSource, /await TryAdoptDashboardAsync\(dashboardPort\);[\s\S]*?var webResponds = await ProbePortAsync\(webHealthUrl\);[\s\S]*?var apiResponds = await ProbePortAsync\(apiHealthUrl\);[\s\S]*?if \(webResponds && apiResponds\)/);
  assert.match(hostSource, /lockRoot\.TryGetProperty\("pid"/);
  assert.match(hostSource, /lockPort != dashboardPort/);
  assert.match(hostSource, /PathsEqual\(statusRoot, appRoot\)/);
  assert.match(hostSource, /statusPort != dashboardPort/);
  assert.match(hostSource, /dashboardProcess = process/);
  assert.match(hostSource, /dashboardProcess = Process\.Start\(psi\)/);
  assert.match(hostSource, /dashboardProcess != null && await VerifyDashboardIdentityAsync\(dashboardProcess, dashboardPort\)\) return true/);
  assert.match(hostSource, /sin identidad de dashboard verificada; no se adoptan ni se inicia sobre esos puertos/);
});

test('entrar a bandeja espera y reintenta cambios de visibilidad tras la transición de cierre', () => {
  const enterTray = appSource.match(/internal void EnterTrayMode\(MainWindow window\)[\s\S]*?\n    }/)?.[0];
  assert.ok(enterTray, 'debe existir la transición explícita a la bandeja');
  assert.match(enterTray, /new DispatcherTimer\(DispatcherPriority\.Background, window\.Dispatcher\)/,
    'la ocultación se difiere fuera del diálogo modal y de la transición Closing');
  assert.match(enterTray, /catch \(InvalidOperationException ex\) when \(retriesRemaining > 0\)[\s\S]*?ScheduleHide\(retriesRemaining - 1\)/,
    'una transición de cierre transitoria se reintenta con límite');
  assert.match(enterTray, /LogLifecycleDiagnostic\("Tray\.HideWindow\.Deferred"/,
    'los reintentos esperables quedan en el log operativo y no se reportan como excepción');
  assert.match(enterTray, /LogLifecycleDiagnostic\("Tray", "Ventana oculta/,
    'el cierre exitoso se registra en app-host.log, fuera del registro reservado a errores');
  assert.match(enterTray, /ScheduleHide\(retriesRemaining: 5\)/,
    'la espera inicial usa un número acotado de reintentos');
  assert.match(enterTray, /HasShutdownStarted \|\| window\.Dispatcher\.HasShutdownFinished/,
    'la acción diferida debe ignorar un Dispatcher que ya terminó');
  assert.match(enterTray, /if \(window\.IsVisible\) window\.Hide\(\)/,
    'la ventana solo se oculta si sigue visible');
});

test('elegir No conserva el proceso y programa el modo bandeja sin cerrar la ventana en línea', () => {
  const closePrompt = hostSource.match(/private async Task ShowCloseConfirmationAsync\(\)[\s\S]*?\n    }/)?.[0];
  const noChoice = closePrompt?.match(/if \(choice == MessageBoxResult\.No\)[\s\S]*?\n            }/)?.[0];
  assert.ok(noChoice, 'debe existir la rama No del diálogo de cierre');
  assert.match(noChoice, /app\.EnterTrayMode\(this\)/);
  assert.doesNotMatch(noChoice, /\.Hide\(|\.Close\(|ShowDialog\(|WindowInteropHelper/,
    'la rama No delega la transición diferida y no manipula el Window en cierre');
});

test('el host nativo mantiene una sola ventana EvaluaPro y enfoca la existente', () => {
  const appXaml = fs.readFileSync(path.join(root, 'packaging', 'app-host', 'App.xaml'), 'utf8');
  assert.doesNotMatch(appXaml, /StartupUri\s*=/,
    'la ventana se crea explícitamente tras adquirir el singleton, no por XAML antes del guard');
  assert.match(appSource, /EvaluaProDesktopSingleton/);
  assert.match(appSource, /new Mutex\(/);
  assert.match(appSource, /WaitOne\(0\)/);
  assert.match(appSource, /FocusExistingWindow\(\)/);
  assert.match(appSource, /if \(!IsInstallerHubInvocation && !TryAcquireDesktopSingleton\(\)\)[\s\S]*?FocusExistingWindow\(\);[\s\S]*?Shutdown\(\);[\s\S]*?MainWindow = new MainWindow\(\);[\s\S]*?MainWindow\.Show\(\);/,
    'la instancia duplicada sale antes de crear la ventana; solo el dueño crea la ventana principal');
  assert.match(appSource, /Shutdown\(\)/);
  assert.match(appSource, /Process\.GetProcessesByName\("EvaluaPro"\)/);
  assert.match(appSource, /ShowWindow\(handle, SwRestore\)/);
  assert.match(appSource, /if \(handle == IntPtr\.Zero\)\s*handle = FindTopLevelWindow\(existingProcess\.Id\)/);
  assert.match(appSource, /GetWindowThreadProcessId\(handle, out var ownerProcessId\)/);
  assert.match(appSource, /SetForegroundWindow\(handle\)/);
  assert.match(appSource, /ReleaseDesktopSingleton\(\)/);
});

test('el singleton recupera únicamente un App Host huérfano y reintenta la adquisición', () => {
  assert.match(appSource, /OrphanedInstanceMinimumAge = TimeSpan\.FromSeconds\(30\)/);
  assert.match(appSource, /if \(attempt == 0 && TryRecoverOrphanedInstance\(\)\)[\s\S]*?continue;/);
  assert.match(appSource, /existingProcess\.SessionId != currentProcess\.SessionId/);
  assert.match(appSource, /PathsEqual\(TryGetExecutablePath\(existingProcess\), currentPath\)/);
  assert.match(appSource, /existingProcess\.MainWindowHandle != IntPtr\.Zero \|\|\s*FindTopLevelWindow\(existingProcess\.Id\) != IntPtr\.Zero/,
    'una ventana oculta en bandeja también cuenta como host vivo y no debe recuperarse como huérfano');
  assert.match(appSource, /LogLifecycleDiagnostic\("DesktopSingleton\.OrphanGuard"/,
    'la protección de instancias ocultas deja una traza operativa sin registrarla como excepción');
  assert.match(appSource, /age < OrphanedInstanceMinimumAge/);
  assert.match(appSource, /existingProcess\.Kill\(entireProcessTree: true\)/);
  assert.match(appSource, /existingProcess\.WaitForExit\(3_000\)/);
  assert.match(appSource, /LogDiagnostic\("DesktopSingleton",/);
});

test('la ventana nativa inicia grande, centrada y redimensionable para cubrir el acceso completo', () => {
  assert.match(windowSource, /WindowState="Normal"/);
  assert.match(windowSource, /ResizeMode="CanResize"/);
  assert.match(windowSource, /x:Name="MaximizeBtn"[\s\S]*Content="🗖"/);
  assert.match(hostSource, /SystemParameters\.WorkArea/);
  assert.match(hostSource, /0\.90/);
  assert.match(hostSource, /0\.92/);
  assert.match(hostSource, /1040/);
  assert.match(windowSource, /WindowStyle="SingleBorderWindow"/);
});

