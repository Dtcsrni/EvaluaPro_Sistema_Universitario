using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
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

    public MainWindow()
    {
        InitializeComponent();
        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
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
        // 1. Probar si ya está respondiendo
        if (await ProbePortAsync("http://127.0.0.1:4173/"))
        {
            return true;
        }

        // 2. Localizar Node
        var nodeExe = Path.Combine(appRoot, "runtime", "node", "node.exe");
        if (!File.Exists(nodeExe))
        {
            nodeExe = "node";
        }

        var startScript = Path.Combine(appRoot, "scripts", "start-docente-native.mjs");
        if (!File.Exists(startScript))
        {
            var brokerScript = Path.Combine(appRoot, "scripts", "launcher-broker.ps1");
            if (File.Exists(brokerScript))
            {
                try
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
                catch { }
            }
        }
        else
        {
            try
            {
                backendProcess = Process.Start(new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = $"\"{startScript}\"",
                    WorkingDirectory = appRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                });
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"No se pudo iniciar Node directamente: {ex.Message}");
            }
        }

        // 3. Esperar hasta 25 segundos a que el puerto esté activo
        var cts = new CancellationTokenSource(TimeSpan.FromSeconds(25));
        while (!cts.IsCancellationRequested)
        {
            if (await ProbePortAsync("http://127.0.0.1:4173/"))
            {
                return true;
            }
            await Task.Delay(400);
        }

        return false;
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
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (isStopping) return;
        isStopping = true;

        try
        {
            if (backendProcess != null && !backendProcess.HasExited)
            {
                backendProcess.Kill(true);
            }
        }
        catch { }
    }
}
