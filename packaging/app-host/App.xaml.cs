using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using System.Windows.Threading;

namespace EvaluaPro.AppHost;

public partial class App : System.Windows.Application
{
    private const string DesktopSingletonMutexName = @"Local\EvaluaProDesktopSingleton";
    private const int SwRestore = 9;
    private static Mutex? desktopSingletonMutex;
    private static bool ownsDesktopSingleton;

    protected override void OnStartup(StartupEventArgs e)
    {
        if (!TryAcquireDesktopSingleton())
        {
            FocusExistingWindow();
            Shutdown();
            return;
        }

        base.OnStartup(e);
        Exit += App_Exit;

        AppDomain.CurrentDomain.UnhandledException += (s, args) =>
        {
            LogException("AppDomain", args.ExceptionObject as Exception);
        };

        DispatcherUnhandledException += (s, args) =>
        {
            LogException("Dispatcher", args.Exception);
            args.Handled = true;
            System.Windows.MessageBox.Show($"Error en EvaluaPro: {args.Exception.Message}\n\nRevisa logs/app-host-error.log", "EvaluaPro", MessageBoxButton.OK, MessageBoxImage.Error);
        };
    }

    private static bool TryAcquireDesktopSingleton()
    {
        try
        {
            desktopSingletonMutex = new Mutex(
                initiallyOwned: false,
                name: DesktopSingletonMutexName,
                createdNew: out _);
            try
            {
                ownsDesktopSingleton = desktopSingletonMutex.WaitOne(0);
                return ownsDesktopSingleton;
            }
            catch (AbandonedMutexException)
            {
                ownsDesktopSingleton = true;
                return true;
            }
        }
        catch (Exception ex)
        {
            LogException("DesktopSingleton", ex);
            return false;
        }
    }

    private static void FocusExistingWindow()
    {
        try
        {
            var currentProcessId = Environment.ProcessId;
            for (var attempt = 0; attempt < 12; attempt++)
            {
                using var existingProcess = Process.GetProcessesByName("EvaluaPro")
                    .FirstOrDefault(process => process.Id != currentProcessId);

                if (existingProcess is not null)
                {
                    existingProcess.Refresh();
                    var handle = existingProcess.MainWindowHandle;
                    if (handle != IntPtr.Zero)
                    {
                        ShowWindow(handle, SwRestore);
                        SetForegroundWindow(handle);
                        return;
                    }
                }

                Thread.Sleep(50);
            }
        }
        catch (Exception ex)
        {
            LogException("DesktopSingleton.Focus", ex);
        }
    }

    private void App_Exit(object? sender, ExitEventArgs e)
    {
        ReleaseDesktopSingleton();
    }

    private static void ReleaseDesktopSingleton()
    {
        try
        {
            if (desktopSingletonMutex is not null)
            {
                if (ownsDesktopSingleton)
                {
                    desktopSingletonMutex.ReleaseMutex();
                }

                desktopSingletonMutex.Dispose();
            }
        }
        catch (Exception ex)
        {
            LogException("DesktopSingleton.Release", ex);
        }
        finally
        {
            desktopSingletonMutex = null;
            ownsDesktopSingleton = false;
        }
    }

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

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
