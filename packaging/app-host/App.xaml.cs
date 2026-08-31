using System;
using System.IO;
using System.Windows;
using System.Windows.Threading;

namespace EvaluaPro.AppHost;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        AppDomain.CurrentDomain.UnhandledException += (s, args) =>
        {
            LogException("AppDomain", args.ExceptionObject as Exception);
        };

        DispatcherUnhandledException += (s, args) =>
        {
            LogException("Dispatcher", args.Exception);
            args.Handled = true;
            MessageBox.Show($"Error en EvaluaPro: {args.Exception.Message}\n\nRevisa logs/app-host-error.log", "EvaluaPro", MessageBoxButton.OK, MessageBoxImage.Error);
        };
    }

    private static void LogException(string source, Exception? ex)
    {
        try
        {
            var logPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvaluaPro", "logs", "app-host-error.log");
            Directory.CreateDirectory(Path.GetDirectoryName(logPath)!);
            File.AppendAllText(logPath, $"[{DateTime.UtcNow:u}] [{source}] {ex}\n");
        }
        catch { }
    }
}
