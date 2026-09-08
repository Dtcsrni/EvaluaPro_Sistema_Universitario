using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using Forms = System.Windows.Forms;
using System.Windows.Input;
using System.Windows.Media.Animation;
using Microsoft.Web.WebView2.Core;

namespace EvaluaPro.AppHost;

public partial class MainWindow : Window
{
    private static readonly HttpClient HttpClient = new() { Timeout = TimeSpan.FromSeconds(2) };
    private Process? backendProcess;
    private bool isStopping;
    private string appRoot = string.Empty;
    private const int DashboardPortFallback = 4519;
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
        SplashOverlay.Visibility = Visibility.Visible;
        ErrorOverlay.Visibility = Visibility.Collapsed;
        SplashStatusTextBlock.Text = "Iniciando servicios locales...";

        ResolveAppRoot();

        try
        {
            var isReady = await EnsureBackendRunningAsync();
            if (!isReady)
            {
                ShowError("No se pudo iniciar la plataforma local. Revisa los logs de instalación.");
                return;
            }

            SplashStatusTextBlock.Text = "Cargando interfaz docente...";

            var envOptions = new CoreWebView2EnvironmentOptions
            {
                AllowSingleSignOnUsingOSPrimaryAccount = true
            };
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "EvaluaPro",
                "webview2-profile");
            
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
    }

    private async Task<bool> EnsureBackendRunningAsync()
    {
        const string webHealthUrl = "http://127.0.0.1:4173/";
        const string apiHealthUrl = "http://127.0.0.1:4000/api/salud";
        var dashboardPort = ReadDashboardPort();

        // La ventana solo se considera lista cuando web y API responden. Una
        // página estática viva no garantiza que las operaciones funcionen.
        if (await ProbePortAsync(webHealthUrl) && await ProbePortAsync(apiHealthUrl))
        {
            return true;
        }

        // Si el dashboard ya existe, pídele reconciliar su supervisor en vez
        // de abrir otra instancia. Esto recupera una API caída conservando
        // singleton y evitando colisiones de puertos.
        var dashboardUrl = $"http://127.0.0.1:{dashboardPort}";
        if (await ProbePortAsync(dashboardUrl))
        {
            await RequestDashboardReconcileAsync(dashboardUrl);
        }
        else
        {
            StartDashboard();
        }

        // Esperar hasta 25 segundos a que web y API estén activas.
        var cts = new CancellationTokenSource(TimeSpan.FromSeconds(25));
        while (!cts.IsCancellationRequested)
        {
            if (await ProbePortAsync(webHealthUrl) && await ProbePortAsync(apiHealthUrl))
            {
                return true;
            }
            await Task.Delay(300);
        }

        return false;
    }

    private void StartDashboard()
    {
        // Localizar Node únicamente cuando no existe un dashboard operativo.
        var nodeExe = Path.Combine(appRoot, "runtime", "node", "node.exe");
        if (!File.Exists(nodeExe))
        {
            nodeExe = "node";
        }

        var dashboardScript = Path.Combine(appRoot, "scripts", "launcher-dashboard.mjs");
        var brokerScript = Path.Combine(appRoot, "scripts", "launcher-broker.ps1");

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
                backendProcess = Process.Start(psi);
            }
            else if (File.Exists(brokerScript))
            {
                backendProcess = Process.Start(new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{brokerScript}\" -Action open-dashboard -Mode prod -Port 4519 -NoOpen",
                    WorkingDirectory = appRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                });
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Error al iniciar backend: {ex.Message}");
        }
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

    private void AppWebView_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!e.Source.StartsWith("http://127.0.0.1:4173/", StringComparison.OrdinalIgnoreCase)) return;

        try
        {
            using var documento = JsonDocument.Parse(e.WebMessageAsJson);
            if (!documento.RootElement.TryGetProperty("type", out var tipo) ||
                tipo.GetString() != "EVALUAPRO_SELECT_SYNC_FOLDER") return;

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
        var dashboardPort = ReadDashboardPort();

        try
        {
            using var response = await HttpClient.PostAsync(
                $"http://127.0.0.1:{dashboardPort}/api/shutdown",
                content: null);

            if (response.IsSuccessStatusCode)
            {
                await Task.Delay(500);
            }
        }
        catch
        {
            // The owned-process fallback below handles a dashboard started by this host.
        }

        try
        {
            if (backendProcess != null && !backendProcess.HasExited)
            {
                backendProcess.Kill(entireProcessTree: true);
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
