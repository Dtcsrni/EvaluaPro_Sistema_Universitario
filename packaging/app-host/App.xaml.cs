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
    private static readonly TimeSpan OrphanedInstanceMinimumAge = TimeSpan.FromSeconds(30);
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
        for (var attempt = 0; attempt < 2; attempt++)
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
                    if (ownsDesktopSingleton) return true;
                }
                catch (AbandonedMutexException)
                {
                    ownsDesktopSingleton = true;
                    return true;
                }

                // A crashed or hung App Host can retain the singleton while
                // exposing no window. Recover only the exact executable and
                // session after a startup grace period, then retry ownership.
                if (attempt == 0 && TryRecoverOrphanedInstance())
                {
                    DisposeUnownedSingleton();
                    Thread.Sleep(250);
                    continue;
                }

                return false;
            }
            catch (Exception ex)
            {
                LogException("DesktopSingleton.Acquire", ex);
                DisposeUnownedSingleton();
                return false;
            }
        }

        return false;
    }

    private static bool TryRecoverOrphanedInstance()
    {
        var currentProcess = Process.GetCurrentProcess();
        var currentPath = TryGetExecutablePath(currentProcess);

        try
        {
            foreach (var existingProcess in Process.GetProcessesByName("EvaluaPro"))
            {
                using (existingProcess)
                {
                    if (existingProcess.Id == currentProcess.Id ||
                        existingProcess.SessionId != currentProcess.SessionId ||
                        !PathsEqual(TryGetExecutablePath(existingProcess), currentPath))
                    {
                        continue;
                    }

                    existingProcess.Refresh();
                    if (existingProcess.MainWindowHandle != IntPtr.Zero)
                    {
                        return false;
                    }

                    var age = DateTime.UtcNow - existingProcess.StartTime.ToUniversalTime();
                    if (age < OrphanedInstanceMinimumAge)
                    {
                        LogDiagnostic("DesktopSingleton", $"Instancia sin ventana aún está dentro de la gracia de arranque ({age.TotalSeconds:F0}s).");
                        return false;
                    }

                    LogDiagnostic("DesktopSingleton", $"Recuperando instancia huérfana PID {existingProcess.Id} sin ventana tras {age.TotalSeconds:F0}s.");
                    existingProcess.Kill(entireProcessTree: true);
                    if (!existingProcess.WaitForExit(3_000))
                    {
                        LogDiagnostic("DesktopSingleton", $"No terminó la instancia huérfana PID {existingProcess.Id} dentro del límite.");
                        return false;
                    }

                    return true;
                }
            }
        }
        catch (Exception ex)
        {
            LogException("DesktopSingleton.Recover", ex);
        }

        return false;
    }

    private static string? TryGetExecutablePath(Process process)
    {
        try
        {
            return process.MainModule?.FileName;
        }
        catch
        {
            return null;
        }
    }

    private static bool PathsEqual(string? left, string? right)
    {
        if (string.IsNullOrWhiteSpace(left) || string.IsNullOrWhiteSpace(right)) return false;

        try
        {
            return string.Equals(
                Path.GetFullPath(left).TrimEnd(Path.DirectorySeparatorChar),
                Path.GetFullPath(right).TrimEnd(Path.DirectorySeparatorChar),
                StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static void DisposeUnownedSingleton()
    {
        try
        {
            if (desktopSingletonMutex is not null && !ownsDesktopSingleton)
            {
                desktopSingletonMutex.Dispose();
            }
        }
        catch (Exception ex)
        {
            LogException("DesktopSingleton.Dispose", ex);
        }
        finally
        {
            if (!ownsDesktopSingleton) desktopSingletonMutex = null;
        }
    }

    private static void FocusExistingWindow()
    {
        try
        {
            var currentProcessId = Environment.ProcessId;
            var currentProcess = Process.GetCurrentProcess();
            var currentPath = TryGetExecutablePath(currentProcess);
            var currentSessionId = currentProcess.SessionId;
            for (var attempt = 0; attempt < 12; attempt++)
            {
                foreach (var existingProcess in Process.GetProcessesByName("EvaluaPro"))
                {
                    using (existingProcess)
                    {
                        if (existingProcess.Id == currentProcessId ||
                            existingProcess.SessionId != currentSessionId ||
                            !PathsEqual(TryGetExecutablePath(existingProcess), currentPath))
                        {
                            continue;
                        }

                        existingProcess.Refresh();
                        var handle = existingProcess.MainWindowHandle;
                        if (handle != IntPtr.Zero)
                        {
                            ShowWindow(handle, SwRestore);
                            SetForegroundWindow(handle);
                            return;
                        }
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
        LogDiagnostic(source, ex?.ToString() ?? "Unknown error");
    }

    private static void LogDiagnostic(string source, string message)
    {
        try
        {
            var logPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvaluaPro", "logs", "app-host-error.log");
            Directory.CreateDirectory(Path.GetDirectoryName(logPath)!);
            File.AppendAllText(logPath, $"[{DateTime.UtcNow:u}] [{source}] {message}{Environment.NewLine}");
        }
        catch { }
    }
}
