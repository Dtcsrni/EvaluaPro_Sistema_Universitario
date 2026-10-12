using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using Forms = System.Windows.Forms;
using System.Windows.Input;
using System.Windows.Media.Animation;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using WpfMessageBox = System.Windows.MessageBox;

namespace EvaluaPro.AppHost;

public partial class MainWindow : Window
{
    private static readonly HttpClient HttpClient = new() { Timeout = TimeSpan.FromSeconds(2) };
    private readonly SemaphoreSlim startupSemaphore = new(1, 1);
    private Process? dashboardProcess;
    private DateTime? dashboardProcessStartTimeUtc;
    private bool isStopping;
    private string appRoot = string.Empty;
    private const int DashboardPortFallback = 4519;
    private static readonly TimeSpan ServiceStartupTimeout = TimeSpan.FromSeconds(60);
    public MainWindow()
    {
        InitializeComponent();
        ConfigureInitialWindowBounds();
        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
    }

    private void ConfigureInitialWindowBounds()
    {
        // Cubre el marco de acceso sin ocupar innecesariamente toda la pantalla.
        // El ancho conserva presencia visual; la altura queda acotada al contenido inicial.
        var workArea = SystemParameters.WorkArea;
        Width = Math.Max(MinWidth, Math.Min(workArea.Width, Math.Floor(workArea.Width * 0.90)));
        Height = Math.Max(MinHeight, Math.Min(workArea.Height, Math.Floor(Math.Min(workArea.Height * 0.92, 1040))));
        Left = workArea.Left + Math.Max(0, (workArea.Width - Width) / 2);
        Top = workArea.Top + Math.Max(0, (workArea.Height - Height) / 2);
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        await StartApplicationFlowAsync();
    }

    private async Task StartApplicationFlowAsync()
    {
        if (!await startupSemaphore.WaitAsync(0))
        {
            WriteStartupDiagnostic("Se ignoró un segundo intento mientras el ciclo de inicio ya estaba activo.");
            return;
        }

        try
        {
            await StartApplicationFlowCoreAsync();
        }
        finally
        {
            startupSemaphore.Release();
        }
    }

    private async Task StartApplicationFlowCoreAsync()
    {
        SplashOverlay.Visibility = Visibility.Visible;
        ErrorOverlay.Visibility = Visibility.Collapsed;
        SplashStatusTextBlock.Text = "Iniciando servicios locales...";

        ResolveAppRoot();
        await ReconcileShortcutsAsync();

        try
        {
            var isReady = await EnsureBackendRunningAsync();
            if (!isReady)
            {
                WriteStartupDiagnostic("El servicio local no alcanzó salud web/API dentro del tiempo límite.");
                ShowError("No se pudo iniciar la plataforma local. Revisa logs/app-host.log y vuelve a intentar.");
                return;
            }

            SplashStatusTextBlock.Text = "Cargando interfaz docente...";

            var envOptions = new CoreWebView2EnvironmentOptions
            {
                AllowSingleSignOnUsingOSPrimaryAccount = true
            };
            var userDataFolder = ResolveWebView2UserDataFolder();
            
            var webViewEnvironment = await CoreWebView2Environment.CreateAsync(null, userDataFolder, envOptions);
            await AppWebView.EnsureCoreWebView2Async(webViewEnvironment);

            AppWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            AppWebView.CoreWebView2.Settings.AreDevToolsEnabled = Environment.GetEnvironmentVariable("EVALUAPRO_DEBUG") == "1";
            AppWebView.CoreWebView2.Settings.IsZoomControlEnabled = true;
            AppWebView.CoreWebView2.WebMessageReceived += AppWebView_WebMessageReceived;

            AppWebView.NavigationCompleted += AppWebView_NavigationCompleted;
            AppWebView.Source = new Uri("http://127.0.0.1:4173/");
        }
        catch (Exception ex)
        {
            ShowError($"Error al inicializar la ventana: {ex.Message}");
        }
    }

    private static string ResolveWebView2UserDataFolder()
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var stableProfile = Path.Combine(localAppData, "EvaluaPro-UserData", "webview2-profile");
        if (Directory.Exists(stableProfile)) return stableProfile;

        return Path.Combine(localAppData, "EvaluaPro", "webview2-profile");
    }

    private void AppWebView_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        AppWebView.NavigationCompleted -= AppWebView_NavigationCompleted;

        if (e.IsSuccess)
        {
            AppWebView.Visibility = Visibility.Visible;
            var fadeOut = new DoubleAnimation(1.0, 0.0, TimeSpan.FromMilliseconds(300));
            fadeOut.Completed += (_, _) => SplashOverlay.Visibility = Visibility.Collapsed;
            SplashOverlay.BeginAnimation(OpacityProperty, fadeOut);
        }
        else
        {
            ShowError("La conexión con la plataforma docente fue rechazada.");
        }
    }

    private void ResolveAppRoot()
    {
        var baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        var canonicalRoot = ResolveCanonicalInstallRoot();
        if (!string.IsNullOrWhiteSpace(canonicalRoot) && !PathsEqual(baseDir, canonicalRoot))
        {
            appRoot = canonicalRoot;
            WriteStartupDiagnostic($"Se ignoró una copia no canónica: base='{baseDir}', canónica='{appRoot}'.");
            return;
        }

        var candidates = new[]
        {
            baseDir,
            Path.GetFullPath(Path.Combine(baseDir, "..")),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..")),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..")),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvaluaPro")
        };

        foreach (var dir in candidates)
        {
            if (File.Exists(Path.Combine(dir, "scripts", "start-docente-native.mjs")) ||
                File.Exists(Path.Combine(dir, "scripts", "launcher-broker.ps1")))
            {
                appRoot = dir;
                return;
            }
        }

        appRoot = baseDir;
        WriteStartupDiagnostic($"No se encontró un payload completo; se usará baseDir='{appRoot}'.");
    }

    private static string? ResolveCanonicalInstallRoot()
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (string.IsNullOrWhiteSpace(localAppData)) return null;

        var candidate = Path.Combine(localAppData, "EvaluaPro");
        return HasNativePayload(candidate) ? candidate : null;
    }

    private static bool HasNativePayload(string root)
    {
        return File.Exists(Path.Combine(root, "scripts", "start-docente-native.mjs")) &&
               File.Exists(Path.Combine(root, "scripts", "launcher-dashboard.mjs"));
    }

    private static bool PathsEqual(string left, string right)
    {
        return string.Equals(
            Path.GetFullPath(left).TrimEnd(Path.DirectorySeparatorChar),
            Path.GetFullPath(right).TrimEnd(Path.DirectorySeparatorChar),
            StringComparison.OrdinalIgnoreCase);
    }

    private async Task ReconcileShortcutsAsync()
    {
        var shortcutScript = Path.Combine(appRoot, "scripts", "create-shortcuts.ps1");
        if (!File.Exists(shortcutScript))
        {
            WriteStartupDiagnostic($"No existe el reconciliador de accesos: '{shortcutScript}'.");
            return;
        }

        try
        {
            var powershell = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe");
            if (!File.Exists(powershell)) powershell = "powershell.exe";

            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = powershell,
                Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{shortcutScript}\" -Force -Port {DashboardPortFallback}",
                WorkingDirectory = appRoot,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            });

            if (process is null)
            {
                WriteStartupDiagnostic("No se pudo crear el proceso de reconciliación de accesos.");
                return;
            }

            await Task.Run(() => process.WaitForExit(10_000));
            if (!process.HasExited)
            {
                try { process.Kill(entireProcessTree: true); } catch { }
                WriteStartupDiagnostic("La reconciliación de accesos excedió 10 segundos.");
                return;
            }

            WriteStartupDiagnostic($"Reconciliación de accesos finalizada con código {process.ExitCode}.");
        }
        catch (Exception ex)
        {
            WriteStartupDiagnostic($"Falló la reconciliación de accesos: {ex.Message}");
        }
    }

    private void WriteStartupDiagnostic(string message)
    {
        try
        {
            var logDir = Path.Combine(appRoot, "logs");
            Directory.CreateDirectory(logDir);
            var logPath = Path.Combine(logDir, "app-host.log");
            File.AppendAllText(logPath, $"[{DateTimeOffset.Now:O}] {message}{Environment.NewLine}");
        }
        catch
        {
            Debug.WriteLine(message);
        }
    }

    private async Task<bool> EnsureBackendRunningAsync()
    {
        const string webHealthUrl = "http://127.0.0.1:4173/";
        const string apiHealthUrl = "http://127.0.0.1:4000/api/salud";
        var dashboardPort = ReadDashboardPort();
        WriteStartupDiagnostic($"Validando servicios: root='{appRoot}', dashboardPort={dashboardPort}.");

        // La ventana puede abrirse mientras el dashboard y la API ya responden
        // (por ejemplo, tras un cierre anormal anterior). Adoptar únicamente
        // el dashboard cuya identidad coincide con esta instalación permite
        // cerrar su árbol al salir sin tocar procesos ajenos.
        await TryAdoptDashboardAsync(dashboardPort);

        // La ventana solo se considera lista cuando web y API responden. Una
        // página estática viva no garantiza que las operaciones funcionen.
        var webResponds = await ProbePortAsync(webHealthUrl);
        var apiResponds = await ProbePortAsync(apiHealthUrl);
        if (webResponds && apiResponds)
        {
            if (dashboardProcess != null && await VerifyDashboardIdentityAsync(dashboardProcess, dashboardPort)) return true;
            WriteStartupDiagnostic("Web/API responden sin identidad de dashboard verificada; no se adoptan ni se inicia sobre esos puertos.");
            return false;
        }

        // Si el dashboard ya existe, pídele reconciliar su supervisor en vez
        // de abrir otra instancia. Esto recupera una API caída conservando
        // singleton y evitando colisiones de puertos.
        var dashboardUrl = $"http://127.0.0.1:{dashboardPort}";
        if (dashboardProcess != null && await ProbePortAsync(dashboardUrl))
        {
            if (!await VerifyDashboardIdentityAsync(dashboardProcess, dashboardPort))
            {
                WriteStartupDiagnostic("El puerto dashboard responde con identidad distinta; se aborta la reconciliación.");
                return false;
            }
            await RequestDashboardReconcileAsync(dashboardUrl);
        }
        else
        {
            StartDashboard();
        }

        // El primer arranque puede ejecutar el smoke OMR y levantar SQLite;
        // mantener un límite finito evita falsos negativos sin esperar indefinidamente.
        var cts = new CancellationTokenSource(ServiceStartupTimeout);
        while (!cts.IsCancellationRequested)
        {
            if (await ProbePortAsync(webHealthUrl) && await ProbePortAsync(apiHealthUrl) &&
                dashboardProcess != null && await VerifyDashboardIdentityAsync(dashboardProcess, dashboardPort))
            {
                return true;
            }
            await Task.Delay(300);
        }

        WriteStartupDiagnostic("Timeout esperando web/API locales.");
        return false;
    }

    private void StartDashboard()
    {
        // Localizar Node únicamente cuando no existe un dashboard operativo.
        var nodeExe = Path.Combine(appRoot, "runtime", "node", "node.exe");
        if (!File.Exists(nodeExe))
        {
            WriteStartupDiagnostic($"Runtime Node embebido ausente; se rechaza usar un Node global: {nodeExe}");
            return;
        }

        var dashboardScript = Path.Combine(appRoot, "scripts", "launcher-dashboard.mjs");
        WriteStartupDiagnostic($"Iniciando dashboard: node='{nodeExe}', script='{dashboardScript}', cwd='{appRoot}'.");

        try
        {
            if (File.Exists(dashboardScript))
            {
                var psi = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = $"\"{dashboardScript}\" --mode prod --port 4519 --no-open",
                    WorkingDirectory = appRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                psi.EnvironmentVariables["NODE_ENV"] = "production";
                psi.EnvironmentVariables["EVALUAPRO_FLAVOR"] = "docente-local";
                dashboardProcess = Process.Start(psi);
                dashboardProcessStartTimeUtc = dashboardProcess?.StartTime.ToUniversalTime();
            }
            else
            {
                WriteStartupDiagnostic($"Launcher dashboard ausente: {dashboardScript}. No se ejecutará un broker alterno.");
            }
        }
        catch (Exception ex)
        {
            WriteStartupDiagnostic($"Error al iniciar dashboard: {ex.Message}");
            Debug.WriteLine($"Error al iniciar backend: {ex.Message}");
        }
    }

    private async Task TryAdoptDashboardAsync(int dashboardPort)
    {
        try
        {
            var lockPath = Path.Combine(appRoot, "logs", "dashboard.lock.json");
            if (!File.Exists(lockPath)) return;

            using var lockDocument = JsonDocument.Parse(File.ReadAllText(lockPath));
            var lockRoot = lockDocument.RootElement;
            if (!lockRoot.TryGetProperty("pid", out var pidElement) ||
                !pidElement.TryGetInt32(out var pid) || pid <= 0 ||
                !lockRoot.TryGetProperty("port", out var portElement) ||
                !portElement.TryGetInt32(out var lockPort) || lockPort != dashboardPort ||
                !lockRoot.TryGetProperty("startedAt", out var lockStartedAtElement) ||
                lockStartedAtElement.ValueKind != JsonValueKind.String ||
                !DateTimeOffset.TryParse(lockStartedAtElement.GetString(), out var lockStartedAt))
            {
                return;
            }

            using var response = await HttpClient.GetAsync($"http://127.0.0.1:{dashboardPort}/api/install");
            if (!response.IsSuccessStatusCode) return;

            using var statusDocument = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var status = statusDocument.RootElement;
            if (!TryGetDashboardIdentity(status, out var statusPid, out var statusPort, out var statusRoot, out var statusStartedAt, out var statusInstanceId) ||
                statusPid != pid || statusPort != dashboardPort || !PathsEqual(statusRoot, appRoot) ||
                Math.Abs((statusStartedAt - lockStartedAt).TotalSeconds) > 30)
            {
                return;
            }
            if (statusInstanceId.HasValue &&
                (!lockRoot.TryGetProperty("instanceId", out var lockInstanceElement) ||
                 !Guid.TryParse(lockInstanceElement.GetString(), out var lockInstanceId) || lockInstanceId != statusInstanceId.Value))
            {
                return;
            }

            var process = Process.GetProcessById(pid);
            if (process.HasExited || !IsExpectedDashboardProcess(process) ||
                Math.Abs((process.StartTime.ToUniversalTime() - lockStartedAt.UtcDateTime).TotalSeconds) > 30)
            {
                process.Dispose();
                return;
            }

            dashboardProcess = process;
            dashboardProcessStartTimeUtc = process.StartTime.ToUniversalTime();
            WriteStartupDiagnostic($"Se adoptó el dashboard de esta instalación (PID {pid}) para controlar su ciclo de vida.");
        }
        catch (Exception ex)
        {
            WriteStartupDiagnostic($"No se pudo validar/adoptar el dashboard existente: {ex.Message}");
        }
    }

    private async Task<bool> VerifyDashboardIdentityAsync(Process process, int expectedPort)
    {
        try
        {
            if (process.HasExited || !IsExpectedDashboardProcess(process) || dashboardProcessStartTimeUtc is null ||
                Math.Abs((process.StartTime.ToUniversalTime() - dashboardProcessStartTimeUtc.Value).TotalSeconds) > 1)
            {
                return false;
            }

            var lockPath = Path.Combine(appRoot, "logs", "dashboard.lock.json");
            using var lockDocument = JsonDocument.Parse(await File.ReadAllTextAsync(lockPath));
            var lockRoot = lockDocument.RootElement;
            if (!lockRoot.TryGetProperty("pid", out var lockPidElement) || !lockPidElement.TryGetInt32(out var lockPid) || lockPid != process.Id ||
                !lockRoot.TryGetProperty("port", out var lockPortElement) || !lockPortElement.TryGetInt32(out var lockPort) || lockPort != expectedPort ||
                !lockRoot.TryGetProperty("startedAt", out var lockStartedAtElement) ||
                !DateTimeOffset.TryParse(lockStartedAtElement.GetString(), out var lockStartedAt) ||
                Math.Abs((process.StartTime.ToUniversalTime() - lockStartedAt.UtcDateTime).TotalSeconds) > 30)
            {
                return false;
            }

            using var response = await HttpClient.GetAsync($"http://127.0.0.1:{expectedPort}/api/install");
            if (!response.IsSuccessStatusCode) return false;
            using var statusDocument = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return TryGetDashboardIdentity(statusDocument.RootElement, out var statusPid, out var statusPort, out var statusRoot, out var statusStartedAt, out var statusInstanceId) &&
                statusPid == process.Id && statusPort == expectedPort && PathsEqual(statusRoot, appRoot) &&
                (!statusInstanceId.HasValue ||
                 (lockRoot.TryGetProperty("instanceId", out var lockInstanceElement) && Guid.TryParse(lockInstanceElement.GetString(), out var lockInstanceId) && lockInstanceId == statusInstanceId.Value)) &&
                Math.Abs((statusStartedAt - lockStartedAt).TotalSeconds) <= 30;
        }
        catch (Exception ex)
        {
            WriteStartupDiagnostic($"No se pudo confirmar identidad/readiness del dashboard: {ex.GetType().Name}");
            return false;
        }
    }

    private bool IsExpectedDashboardProcess(Process process)
    {
        try
        {
            var expectedNode = Path.GetFullPath(Path.Combine(appRoot, "runtime", "node", "node.exe"));
            var actualImage = Path.GetFullPath(process.MainModule?.FileName ?? string.Empty);
            return PathsEqual(actualImage, expectedNode);
        }
        catch
        {
            return false;
        }
    }

    private static bool TryGetDashboardIdentity(JsonElement status, out int pid, out int port, out string root, out DateTimeOffset startedAt, out Guid? instanceId)
    {
        pid = 0;
        port = 0;
        root = string.Empty;
        startedAt = default;
        instanceId = null;
        if (!status.TryGetProperty("dashboard", out var dashboard) ||
            !dashboard.TryGetProperty("pid", out var pidElement) || !pidElement.TryGetInt32(out pid) || pid <= 0 ||
            !dashboard.TryGetProperty("port", out var portElement) || !portElement.TryGetInt32(out port) || port is <= 0 or > 65535 ||
            !dashboard.TryGetProperty("startedAt", out var startedElement) ||
            !status.TryGetProperty("paths", out var paths) || !paths.TryGetProperty("root", out var rootElement) ||
            rootElement.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        if (dashboard.TryGetProperty("contractVersion", out var contractVersionElement))
        {
            if (!contractVersionElement.TryGetInt32(out var contractVersion) || contractVersion != 1 ||
                !dashboard.TryGetProperty("instanceId", out var instanceIdElement) ||
                !Guid.TryParse(instanceIdElement.GetString(), out var parsedInstanceId) ||
                !dashboard.TryGetProperty("state", out var stateElement) || stateElement.GetString() != "ready")
            {
                return false;
            }
            instanceId = parsedInstanceId;
        }

        if (startedElement.ValueKind == JsonValueKind.Number)
        {
            try { startedAt = DateTimeOffset.FromUnixTimeMilliseconds(startedElement.GetInt64()); }
            catch (ArgumentOutOfRangeException) { return false; }
        }
        else if (startedElement.ValueKind != JsonValueKind.String || !DateTimeOffset.TryParse(startedElement.GetString(), out startedAt))
        {
            return false;
        }

        root = rootElement.GetString() ?? string.Empty;
        return !string.IsNullOrWhiteSpace(root);
    }

    private static async Task<bool> RequestDashboardReconcileAsync(string dashboardUrl)
    {
        try
        {
            using var response = await HttpClient.PostAsync($"{dashboardUrl}/api/lifecycle/reconcile", content: null);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private static async Task<bool> ProbePortAsync(string url)
    {
        try
        {
            var response = await HttpClient.GetAsync(url);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private void ShowError(string message)
    {
        SplashOverlay.Visibility = Visibility.Collapsed;
        ErrorOverlay.Visibility = Visibility.Visible;
        ErrorMessageTextBlock.Text = message;
    }

    private async void RetryButton_Click(object sender, RoutedEventArgs e)
    {
        await StartApplicationFlowAsync();
    }

    private void TitleBar_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton == MouseButton.Left)
        {
            DragMove();
        }
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void MaximizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
        MaximizeBtn.Content = WindowState == WindowState.Maximized ? "🗗" : "🗖";
        MaximizeBtn.ToolTip = WindowState == WindowState.Maximized ? "Restaurar" : "Maximizar";
    }

    private async void AppWebView_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!e.Source.StartsWith("http://127.0.0.1:4173/", StringComparison.OrdinalIgnoreCase)) return;

        try
        {
            using var documento = JsonDocument.Parse(e.WebMessageAsJson);
            if (!documento.RootElement.TryGetProperty("type", out var tipo)) return;
            if (tipo.GetString() == "EVALUAPRO_UPDATE_HUB")
            {
                var version = documento.RootElement.TryGetProperty("version", out var versionElement)
                    ? versionElement.GetString()
                    : null;
                await DownloadAndOpenLatestInstallerHubAsync(version ?? string.Empty);
                return;
            }
            if (tipo.GetString() != "EVALUAPRO_SELECT_SYNC_FOLDER") return;

            using var dialogo = new Forms.FolderBrowserDialog
            {
                Description = "Selecciona la carpeta local que OneDrive sincroniza entre tus equipos",
                ShowNewFolderButton = true,
                UseDescriptionForTitle = true
            };
            var resultado = dialogo.ShowDialog();
            var respuesta = JsonSerializer.Serialize(new
            {
                type = "EVALUAPRO_SYNC_FOLDER_SELECTED",
                path = resultado == Forms.DialogResult.OK ? dialogo.SelectedPath : null,
                cancelled = resultado != Forms.DialogResult.OK
            });
            AppWebView.CoreWebView2.PostWebMessageAsJson(respuesta);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Error al seleccionar la carpeta de sincronización: {ex.Message}");
        }
    }

    private async Task DownloadAndOpenLatestInstallerHubAsync(string requestedVersion)
    {
        if (!Version.TryParse(requestedVersion, out var requested) || requestedVersion.Contains('-'))
        {
            WpfMessageBox.Show(this, "La versión de actualización recibida no es válida.", "EvaluaPro · Actualización", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        var updateRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvaluaPro", "updates", requestedVersion);
        var targetPath = Path.Combine(updateRoot, $"EvaluaPro-InstallerHub-docente-local-v{requestedVersion}.exe");
        var partialPath = targetPath + ".partial";
        try
        {
            using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = true }) { Timeout = TimeSpan.FromMinutes(10) };
            client.DefaultRequestHeaders.UserAgent.ParseAdd("EvaluaPro-AppHost");
            client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
            using var latestResponse = await client.GetAsync(
                "https://api.github.com/repos/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest",
                HttpCompletionOption.ResponseHeadersRead);
            latestResponse.EnsureSuccessStatusCode();
            using var releaseJson = await JsonDocument.ParseAsync(await latestResponse.Content.ReadAsStreamAsync());
            var release = releaseJson.RootElement;
            var tag = release.TryGetProperty("tag_name", out var tagElement) ? tagElement.GetString() ?? string.Empty : string.Empty;
            var releaseVersion = tag.TrimStart('v', 'V');
            if (!Version.TryParse(releaseVersion, out var latest) || latest != requested)
                throw new InvalidOperationException("La release cambió desde que se mostró el aviso. Vuelve a buscar actualizaciones.");
            var installedVersion = ReadInstalledVersion();
            if (latest <= installedVersion)
            {
                WpfMessageBox.Show(this, "Esta instalación ya está en la versión estable más reciente.", "EvaluaPro · Al día", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            if (release.TryGetProperty("draft", out var draft) && draft.GetBoolean())
                throw new InvalidOperationException("La release está en borrador y no se puede instalar.");
            if (release.TryGetProperty("prerelease", out var prerelease) && prerelease.GetBoolean())
                throw new InvalidOperationException("La release es beta y no corresponde al canal estable.");
            var releaseUrl = release.TryGetProperty("html_url", out var htmlElement) ? htmlElement.GetString() ?? string.Empty : string.Empty;
            if (releaseUrl != $"https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/tag/{tag}")
                throw new InvalidOperationException("La release no pertenece al repositorio oficial.");

            var assets = release.GetProperty("assets").EnumerateArray().ToArray();
            var installerName = $"EvaluaPro-InstallerHub-docente-local-v{releaseVersion}.exe";
            var installer = ResolveReleaseAsset(assets, installerName);
            var checksum = ResolveReleaseAsset(assets, $"{installerName}.sha256");
            var answer = WpfMessageBox.Show(
                this,
                $"Se encontró EvaluaPro v{releaseVersion}. Se descargará y verificará el Installer Hub firmado; después podrás revisar y confirmar la actualización en el Hub.\n\n¿Continuar?",
                "EvaluaPro · Actualización disponible",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);
            if (answer != MessageBoxResult.Yes) return;

            Directory.CreateDirectory(updateRoot);
            var expectedHash = await ReadExpectedHashAsync(client, checksum);
            if (!File.Exists(targetPath) || !HashMatches(targetPath, expectedHash))
            {
                if (File.Exists(partialPath)) File.Delete(partialPath);
                using var response = await client.GetAsync(installer, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();
                if (response.RequestMessage?.RequestUri is not Uri finalUri || !IsAllowedReleaseHost(finalUri.Host))
                    throw new InvalidOperationException("La descarga salió de los dominios permitidos de GitHub.");
                await using (var target = new FileStream(partialPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 1024 * 128, useAsync: true))
                await using (var source = await response.Content.ReadAsStreamAsync())
                    await source.CopyToAsync(target);
                if (!HashMatches(partialPath, expectedHash))
                    throw new InvalidOperationException("La suma SHA-256 del instalador no coincide.");
                File.Move(partialPath, targetPath, overwrite: true);
            }

            VerifySameTrustedPublisher(targetPath);
            var startInfo = new ProcessStartInfo
            {
                FileName = targetPath,
                WorkingDirectory = updateRoot,
                UseShellExecute = true
            };
            Process.Start(startInfo);
            Close();
        }
        catch (Exception ex)
        {
            try { if (File.Exists(partialPath)) File.Delete(partialPath); } catch { }
            WriteStartupDiagnostic($"Falló la actualización segura del Installer Hub: {ex.Message}");
            WpfMessageBox.Show(this, "No se pudo preparar la actualización. La instalación actual no se modificó. Revisa conexión, firma del editor o el registro local de EvaluaPro.", "EvaluaPro · Actualización no disponible", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private static Uri ResolveReleaseAsset(JsonElement[] assets, string expectedName)
    {
        foreach (var asset in assets)
        {
            if (!asset.TryGetProperty("name", out var name) || name.GetString() != expectedName) continue;
            if (!asset.TryGetProperty("browser_download_url", out var urlElement) ||
                !Uri.TryCreate(urlElement.GetString(), UriKind.Absolute, out var url) ||
                url.Scheme != Uri.UriSchemeHttps || !string.Equals(url.Host, "github.com", StringComparison.OrdinalIgnoreCase))
                break;
            return url;
        }
        throw new InvalidOperationException($"La release no incluye el asset oficial requerido: {expectedName}.");
    }

    private static async Task<string> ReadExpectedHashAsync(HttpClient client, Uri checksumUrl)
    {
        using var response = await client.GetAsync(checksumUrl, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        if (response.RequestMessage?.RequestUri is not Uri finalUri || !IsAllowedReleaseHost(finalUri.Host))
            throw new InvalidOperationException("El checksum salió de los dominios permitidos de GitHub.");
        var content = await response.Content.ReadAsStringAsync();
        var match = Regex.Match(content, @"^\s*([a-f0-9]{64})(?:\s+[* ].*)?\s*$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        if (!match.Success) throw new InvalidOperationException("El archivo de suma SHA-256 está mal formado.");
        return match.Groups[1].Value.ToLowerInvariant();
    }

    private Version ReadInstalledVersion()
    {
        var packagePath = Path.Combine(appRoot, "package.json");
        using var package = JsonDocument.Parse(File.ReadAllText(packagePath));
        var version = package.RootElement.TryGetProperty("version", out var versionElement)
            ? versionElement.GetString()
            : null;
        if (string.IsNullOrWhiteSpace(version) || !Version.TryParse(version, out var parsed))
            throw new InvalidOperationException("No se pudo leer la versión instalada para bloquear degradaciones.");
        return parsed;
    }

    private static bool HashMatches(string path, string expectedHash)
    {
        if (!File.Exists(path)) return false;
        using var stream = File.OpenRead(path);
        return string.Equals(Convert.ToHexString(SHA256.HashData(stream)), expectedHash, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsAllowedReleaseHost(string host) =>
        string.Equals(host, "github.com", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(host, "release-assets.githubusercontent.com", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(host, "objects.githubusercontent.com", StringComparison.OrdinalIgnoreCase);

    private static void VerifySameTrustedPublisher(string installerPath)
    {
        var installedHubPath = ResolveInstalledHubPath();
        if (!VerifyAuthenticode(installedHubPath) || !VerifyAuthenticode(installerPath))
            throw new InvalidOperationException("Windows no validó la firma Authenticode del Hub instalado o del instalador descargado.");
        using var installedCert = new X509Certificate2(X509Certificate.CreateFromSignedFile(installedHubPath));
        using var updateCert = new X509Certificate2(X509Certificate.CreateFromSignedFile(installerPath));
        if (!string.Equals(installedCert.Thumbprint, updateCert.Thumbprint, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("El instalador está firmado por un editor distinto al del Hub instalado.");
    }

    private static string ResolveInstalledHubPath()
    {
        foreach (var registryRoot in new[] { Registry.CurrentUser, Registry.LocalMachine })
        {
            try
            {
                using var uninstallKey = registryRoot.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall");
                if (uninstallKey is null) continue;
                foreach (var subKeyName in uninstallKey.GetSubKeyNames())
                {
                    try
                    {
                        using var bundleKey = uninstallKey.OpenSubKey(subKeyName);
                        var displayName = Convert.ToString(bundleKey?.GetValue("DisplayName")) ?? string.Empty;
                        var cachedBundle = Convert.ToString(bundleKey?.GetValue("BundleCachePath")) ?? string.Empty;
                        if (!displayName.Contains("EvaluaPro", StringComparison.OrdinalIgnoreCase) ||
                            !Path.IsPathFullyQualified(cachedBundle) || !File.Exists(cachedBundle)) continue;

                        var fileName = Path.GetFileName(cachedBundle);
                        if (!fileName.StartsWith("EvaluaPro-InstallerHub-docente-local", StringComparison.OrdinalIgnoreCase) ||
                            !fileName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) continue;
                        return cachedBundle;
                    }
                    catch (IOException) { }
                    catch (UnauthorizedAccessException) { }
                }
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }

        throw new InvalidOperationException("No se encontró en el registro el Installer Hub instalado para fijar la identidad del editor.");
    }

    private static bool VerifyAuthenticode(string path)
    {
        var fileInfo = new WinTrustFileInfo(path);
        var fileInfoPointer = Marshal.AllocHGlobal(Marshal.SizeOf<WinTrustFileInfo>());
        try
        {
            Marshal.StructureToPtr(fileInfo, fileInfoPointer, false);
            var trustData = new WinTrustData(fileInfoPointer);
            return WinVerifyTrust(IntPtr.Zero, new Guid("00AAC56B-CD44-11D0-8CC2-00C04FC295EE"), ref trustData) == 0;
        }
        finally
        {
            Marshal.DestroyStructure<WinTrustFileInfo>(fileInfoPointer);
            Marshal.FreeHGlobal(fileInfoPointer);
        }
    }

    [DllImport("wintrust.dll", ExactSpelling = true, PreserveSig = true)]
    private static extern uint WinVerifyTrust(IntPtr hwnd, [MarshalAs(UnmanagedType.LPStruct)] Guid actionId, ref WinTrustData trustData);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private sealed class WinTrustFileInfo
    {
        public uint StructSize = (uint)Marshal.SizeOf<WinTrustFileInfo>();
        [MarshalAs(UnmanagedType.LPWStr)] public string FilePath;
        public IntPtr FileHandle;
        public IntPtr KnownSubject;
        public WinTrustFileInfo(string filePath) => FilePath = filePath;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct WinTrustData
    {
        public uint StructSize;
        public IntPtr PolicyCallbackData;
        public IntPtr SipClientData;
        public uint UiChoice;
        public uint RevocationChecks;
        public uint UnionChoice;
        public IntPtr FileInfo;
        public uint StateAction;
        public IntPtr StateData;
        public IntPtr UrlReference;
        public uint ProviderFlags;
        public uint UiContext;
        public IntPtr SignatureSettings;

        public WinTrustData(IntPtr fileInfo)
        {
            StructSize = (uint)Marshal.SizeOf<WinTrustData>();
            PolicyCallbackData = IntPtr.Zero;
            SipClientData = IntPtr.Zero;
            UiChoice = 2;
            RevocationChecks = 1;
            UnionChoice = 1;
            FileInfo = fileInfo;
            StateAction = 0;
            StateData = IntPtr.Zero;
            UrlReference = IntPtr.Zero;
            ProviderFlags = 0x00000080;
            UiContext = 0;
            SignatureSettings = IntPtr.Zero;
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private int ReadDashboardPort()
    {
        try
        {
            var lockPath = Path.Combine(appRoot, "logs", "dashboard.lock.json");
            if (!File.Exists(lockPath)) return DashboardPortFallback;

            using var document = JsonDocument.Parse(File.ReadAllText(lockPath));
            if (document.RootElement.TryGetProperty("port", out var portElement) &&
                portElement.TryGetInt32(out var port) &&
                port > 0 && port <= 65535)
            {
                return port;
            }
        }
        catch
        {
            // Use the production default when the lock is absent or invalid.
        }

        return DashboardPortFallback;
    }

    private async Task ShutdownServicesAsync()
    {
        if (dashboardProcess == null)
        {
            WriteStartupDiagnostic("No se detienen servicios: esta ventana no inició ni pudo identificar el dashboard de la instalación.");
            return;
        }

        var dashboardPort = ReadDashboardPort();

        try
        {
            if (await VerifyDashboardIdentityAsync(dashboardProcess, dashboardPort))
            {
                using var response = await HttpClient.PostAsync(
                    $"http://127.0.0.1:{dashboardPort}/api/shutdown",
                    content: null);

                if (response.IsSuccessStatusCode)
                {
                    await Task.Delay(500);
                }
            }
            else
            {
                WriteStartupDiagnostic("Se omitió /api/shutdown porque la identidad del dashboard ya no coincide.");
            }
        }
        catch
        {
            // The owned-process fallback below handles a dashboard started by this host.
        }

        try
        {
            if (!dashboardProcess.HasExited && IsExpectedDashboardProcess(dashboardProcess) && dashboardProcessStartTimeUtc is not null &&
                Math.Abs((dashboardProcess.StartTime.ToUniversalTime() - dashboardProcessStartTimeUtc.Value).TotalSeconds) <= 1)
            {
                // La petición anterior es un cierre ordenado; el kill del árbol
                // es el respaldo determinista contra hijos que sobrevivan.
                dashboardProcess.Kill(entireProcessTree: true);
                await Task.Run(() => dashboardProcess.WaitForExit(3_000));
            }
        }
        catch
        {
            // Closing the desktop window must not be blocked by a stale child process.
        }
    }

    private async void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (isStopping) return;
        isStopping = true;
        e.Cancel = true;

        await ShutdownServicesAsync();
        Close();
    }
}
