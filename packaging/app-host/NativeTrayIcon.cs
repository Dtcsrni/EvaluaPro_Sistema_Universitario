using System;
using System.Drawing;
using System.Windows.Forms;

namespace EvaluaPro.AppHost;

internal sealed class NativeTrayIcon : IDisposable
{
    private readonly Icon icon;
    private readonly ContextMenuStrip menu;
    private readonly NotifyIcon notifyIcon;
    private bool disposed;

    internal NativeTrayIcon(Action open, Action exit)
    {
        icon = LoadApplicationIcon();
        menu = new ContextMenuStrip();
        menu.Items.Add("Abrir EvaluaPro", null, (_, _) => open());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Salir", null, (_, _) => exit());

        notifyIcon = new NotifyIcon
        {
            Icon = icon,
            Text = "EvaluaPro · Plataforma docente",
            ContextMenuStrip = menu,
            Visible = true
        };
        notifyIcon.DoubleClick += (_, _) => open();
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        notifyIcon.Visible = false;
        notifyIcon.Dispose();
        menu.Dispose();
        icon.Dispose();
    }

    private static Icon LoadApplicationIcon()
    {
        try
        {
            var executablePath = Environment.ProcessPath;
            if (!string.IsNullOrWhiteSpace(executablePath))
            {
                var embedded = Icon.ExtractAssociatedIcon(executablePath);
                if (embedded is not null) return embedded;
            }
        }
        catch
        {
            // Use a system icon if Windows cannot read the executable resource.
        }

        return (Icon)SystemIcons.Application.Clone();
    }
}