using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace EvaluaPro.AppHost;

internal static class ShortcutReconciler
{
    private const uint ShcneUpdateItem = 0x00002000;
    private const uint ShcnfPathW = 0x0005;
    private const uint ShcnfFlush = 0x1000;

    internal static int Regenerate()
    {
        try { return Reconcile(); }
        catch (Exception ex)
        {
            WriteFailure(ex);
            return 1;
        }
    }

    internal static void EnsureCurrent()
    {
        try { Reconcile(); }
        catch (Exception ex) { WriteFailure(ex); }
    }

    private static int Reconcile()
    {
        var root = ResolveUserInstallRoot();
        var executable = Path.Combine(root, "EvaluaPro.exe");
        if (!File.Exists(executable)) throw new FileNotFoundException("No se encontró EvaluaPro.exe en la instalación canónica.", executable);

        var locations = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        var startMenu = Environment.GetFolderPath(Environment.SpecialFolder.StartMenu);
        if (!string.IsNullOrWhiteSpace(desktop)) locations.Add(desktop);
        var appStartMenu = string.IsNullOrWhiteSpace(startMenu)
            ? null
            : Path.Combine(startMenu, "Programs", "EvaluaPro");
        if (!string.IsNullOrWhiteSpace(appStartMenu)) locations.Add(appStartMenu);
        var oneDrive = Environment.GetEnvironmentVariable("OneDrive");
        if (!string.IsNullOrWhiteSpace(oneDrive)) locations.Add(Path.Combine(oneDrive, "Desktop"));

        if (!string.IsNullOrWhiteSpace(startMenu))
        {
            RemoveManagedRootShortcut(Path.Combine(startMenu, "Programs"), "EvaluaPro", executable);
            RemoveManagedRootShortcut(Path.Combine(startMenu, "Programs"), "EvaluaPro - Hub", executable);
        }

        var entries = new List<ShortcutResult>();
        foreach (var directory in locations)
        {
            if (string.IsNullOrWhiteSpace(directory)) continue;
            Directory.CreateDirectory(directory);
            entries.Add(CreateShortcutIfOwned(directory, "EvaluaPro", executable, root, string.Empty,
                ResolveIcon(root, "dashboard-prod.ico", executable)));
            entries.Add(CreateShortcutIfOwned(directory, "EvaluaPro - Hub", executable, root, "--installer-hub",
                ResolveIcon(root, "installer-canonical.ico", executable)));
        }

        var startupDirectory = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
        if (!string.IsNullOrWhiteSpace(startupDirectory))
        {
            Directory.CreateDirectory(startupDirectory);
            entries.Add(CreateShortcutIfOwned(startupDirectory, "EvaluaPro", executable, root, "--tray-start",
                ResolveIcon(root, "dashboard-prod.ico", executable)));
        }

        WriteSuccess(executable, entries);
        return 0;
    }

    private static string ResolveUserInstallRoot()
    {
        var canonicalRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvaluaPro");
        var canonicalExecutable = Path.Combine(canonicalRoot, "EvaluaPro.exe");
        if (File.Exists(canonicalExecutable)) return canonicalRoot;
        throw new FileNotFoundException("No existe una instalación canónica de EvaluaPro para crear accesos directos.", canonicalExecutable);
    }

    private static string ResolveIcon(string root, string iconName, string executable)
    {
        var iconPaths = new[]
        {
            Path.Combine(root, iconName),
            Path.Combine(root, "scripts", "icons", iconName)
        };
        foreach (var iconPath in iconPaths)
        {
            if (File.Exists(iconPath) && Has256PixelFrame(iconPath)) return iconPath;
        }
        return executable;
    }

    private static ShortcutResult CreateShortcutIfOwned(string directory, string name, string executable, string workingDirectory, string arguments, string iconPath)
    {
        var linkPath = Path.Combine(directory, name + ".lnk");
        if (File.Exists(linkPath) && !PointsToTarget(linkPath, executable))
            return new ShortcutResult(linkPath, executable, arguments, workingDirectory, iconPath, false);
        return CreateShortcut(directory, name, executable, workingDirectory, arguments, iconPath);
    }

    private static bool PointsToTarget(string shortcutPath, string executable)
    {
        object? shellLink = null;
        try
        {
            shellLink = new ShellLink();
            ((IPersistFile)shellLink).Load(shortcutPath, 0);
            return string.Equals(Path.GetFullPath(ReadShortcutTarget((IShellLinkW)shellLink)),
                Path.GetFullPath(executable), StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
        finally
        {
            if (shellLink is not null && Marshal.IsComObject(shellLink)) Marshal.FinalReleaseComObject(shellLink);
        }
    }

    private static bool Has256PixelFrame(string iconPath)
    {
        try
        {
            using var stream = File.OpenRead(iconPath);
            Span<byte> header = stackalloc byte[6];
            if (stream.Read(header) != header.Length ||
                BitConverter.ToUInt16(header.Slice(0, 2)) != 0 ||
                BitConverter.ToUInt16(header.Slice(2, 2)) != 1)
            {
                return false;
            }

            var count = BitConverter.ToUInt16(header.Slice(4, 2));
            if (count == 0) return false;
            Span<byte> entry = stackalloc byte[16];
            for (var index = 0; index < count; index++)
            {
                if (stream.Read(entry) != entry.Length) return false;
                if (entry[0] == 0 && entry[1] == 0) return true;
            }
        }
        catch
        {
            return false;
        }

        return false;
    }

    private static void RemoveManagedRootShortcut(string directory, string name, string executable)
    {
        var linkPath = Path.Combine(directory, name + ".lnk");
        if (!File.Exists(linkPath)) return;

        object? shellLink = null;
        try
        {
            shellLink = new ShellLink();
            ((IPersistFile)shellLink).Load(linkPath, 0);
            var target = ReadShortcutTarget((IShellLinkW)shellLink);
            if (!string.Equals(Path.GetFullPath(target), Path.GetFullPath(executable), StringComparison.OrdinalIgnoreCase)) return;
            File.Delete(linkPath);
            SHChangeNotify(ShcneUpdateItem, ShcnfPathW | ShcnfFlush, linkPath, IntPtr.Zero);
        }
        catch
        {
            // Preserve a link whose ownership or target cannot be verified.
        }
        finally
        {
            if (shellLink is not null && Marshal.IsComObject(shellLink)) Marshal.FinalReleaseComObject(shellLink);
        }
    }

    private static string ReadShortcutTarget(IShellLinkW link)
    {
        var path = new StringBuilder(32768);
        link.GetPath(path, path.Capacity, IntPtr.Zero, 0);
        return path.ToString();
    }

    private static ShortcutResult CreateShortcut(string directory, string name, string executable, string workingDirectory, string arguments, string iconPath)
    {
        var linkPath = Path.Combine(directory, name + ".lnk");
        object? shellLink = null;
        try
        {
            shellLink = new ShellLink();
            var link = (IShellLinkW)shellLink;
            link.SetPath(executable);
            link.SetArguments(arguments);
            link.SetWorkingDirectory(workingDirectory);
            link.SetDescription(name);
            link.SetIconLocation(iconPath, 0);
            link.SetShowCmd(1);
            ((IPersistFile)shellLink).Save(linkPath, true);
            SHChangeNotify(ShcneUpdateItem, ShcnfPathW | ShcnfFlush, linkPath, IntPtr.Zero);
            return new ShortcutResult(linkPath, executable, arguments, workingDirectory, iconPath, true);
        }
        finally
        {
            if (shellLink is not null && Marshal.IsComObject(shellLink)) Marshal.FinalReleaseComObject(shellLink);
        }
    }

    private static void WriteSuccess(string executable, List<ShortcutResult> entries)
    {
        try
        {
            var logDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvaluaPro", "logs");
            Directory.CreateDirectory(logDirectory);
            var serializedEntries = new StringBuilder();
            for (var index = 0; index < entries.Count; index++)
            {
                if (index > 0) serializedEntries.Append(',');
                var entry = entries[index];
                serializedEntries.Append("{\"path\":\"").Append(EscapeJson(entry.Path))
                    .Append("\",\"target\":\"").Append(EscapeJson(entry.Target))
                    .Append("\",\"arguments\":\"").Append(EscapeJson(entry.Arguments))
                    .Append("\",\"workingDirectory\":\"").Append(EscapeJson(entry.WorkingDirectory))
                    .Append("\",\"icon\":\"").Append(EscapeJson(entry.Icon))
                    .Append("\",\"success\":").Append(entry.Success ? "true" : "false").Append('}');
            }
            var success = entries.All(entry => entry.Success);
            var json = "{\"success\":" + (success ? "true" : "false") + ",\"state\":\"" + (success ? "ok" : "degraded") + "\",\"schemaVersion\":2,\"executable\":\"" +
                EscapeJson(executable) + "\",\"entries\":[" + serializedEntries + "]}";
            File.WriteAllText(Path.Combine(logDirectory, "shortcut-reconciliation.json"), json);
        }
        catch { }
    }

    private static void WriteFailure(Exception exception)
    {
        try
        {
            var logDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvaluaPro", "logs");
            Directory.CreateDirectory(logDirectory);
            var json = "{\"success\":false,\"state\":\"degraded\",\"schemaVersion\":2,\"error\":\"" +
                EscapeJson(exception.GetType().Name) + "\",\"message\":\"" + EscapeJson(exception.Message) + "\"}";
            File.WriteAllText(Path.Combine(logDirectory, "shortcut-reconciliation.json"), json);
        }
        catch { }
    }

    private static string EscapeJson(string value)
    {
        var escaped = new StringBuilder(value.Length + 8);
        foreach (var character in value)
        {
            switch (character)
            {
                case '"': escaped.Append("\\\""); break;
                case '\\': escaped.Append("\\\\"); break;
                case '\b': escaped.Append("\\b"); break;
                case '\f': escaped.Append("\\f"); break;
                case '\n': escaped.Append("\\n"); break;
                case '\r': escaped.Append("\\r"); break;
                case '\t': escaped.Append("\\t"); break;
                default:
                    if (character < 0x20) escaped.Append("\\u").Append(((int)character).ToString("x4"));
                    else escaped.Append(character);
                    break;
            }
        }
        return escaped.ToString();
    }

    private sealed record ShortcutResult(string Path, string Target, string Arguments, string WorkingDirectory, string Icon, bool Success);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern void SHChangeNotify(uint eventId, uint flags, string path, IntPtr item);

    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    private class ShellLink { }

    [ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellLinkW
    {
        void GetPath([MarshalAs(UnmanagedType.LPWStr)] StringBuilder file, int maxPath, IntPtr findData, uint flags);
        void GetIDList(out IntPtr itemIdList);
        void SetIDList(IntPtr itemIdList);
        void GetDescription(IntPtr name, int maxName);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetWorkingDirectory(IntPtr directory, int maxPath);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string directory);
        void GetArguments(IntPtr arguments, int maxPath);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string arguments);
        void GetHotkey(out short hotkey);
        void SetHotkey(short hotkey);
        void GetShowCmd(out int showCommand);
        void SetShowCmd(int showCommand);
        void GetIconLocation(IntPtr iconPath, int maxPath, out int iconIndex);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string iconPath, int iconIndex);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, uint reserved);
        void Resolve(IntPtr window, uint flags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
    }

    [ComImport, Guid("0000010b-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPersistFile
    {
        void GetClassID(out Guid classId);
        [PreserveSig] int IsDirty();
        void Load([MarshalAs(UnmanagedType.LPWStr)] string fileName, uint mode);
        void Save([MarshalAs(UnmanagedType.LPWStr)] string fileName, bool remember);
        void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string fileName);
        void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string fileName);
    }
}
