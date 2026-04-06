using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;

namespace EvaluaPro.BurnBootstrapperApp;

public partial class MainWindow : Window
{
    private bool busy;

    public MainWindow()
    {
        InitializeComponent();
        ModeComboBox.SelectedIndex = 0;
        SetHubVersionLabel();
        StartSplashSequence();
    }

    public event EventHandler? DetectRequested;

    public event EventHandler<BootstrapperRequest>? StartRequested;

    public event EventHandler? CloseRequested;

    public event EventHandler? ClosingRequestedDuringBusy;

    public void ApplyDetectionModel(WindowDetectionModel model)
    {
        var hasMultipleFlavors = model.AvailableFlavors.Count > 1;

        if (FlavorComboBox.Items.Count == 0)
        {
            foreach (var flavor in model.AvailableFlavors)
            {
                FlavorComboBox.Items.Add(flavor);
            }
            FlavorComboBox.DisplayMemberPath = nameof(FlavorItem.DisplayName);
        }

        FlavorComboBox.SelectedItem = FlavorComboBox.Items.OfType<FlavorItem>().FirstOrDefault(item => item.FlavorId == model.FlavorId);
        FlavorComboBox.IsEnabled = hasMultipleFlavors;
        FlavorPanel.Visibility = hasMultipleFlavors ? Visibility.Visible : Visibility.Collapsed;
        Grid.SetColumn(ModePanel, hasMultipleFlavors ? 1 : 0);
        Grid.SetColumnSpan(ModePanel, hasMultipleFlavors ? 1 : 2);
        ModePanel.Margin = hasMultipleFlavors ? new Thickness(12, 0, 0, 0) : new Thickness(0);

        InstallDirTextBox.Text = model.InstallDir;
        DetectionSummaryTextBlock.Text = model.Summary;
        UpdateAssetNameTextBox.Text = model.AssetName;
        SetMode(model.Mode);

        var rows = model.Prerequisites.Select(item => new PrerequisiteRow
        {
            Name = item.Name,
            InstalledLabel = item.Installed ? "OK" : "FALTA",
            ActualVersion = item.ActualVersion,
            Reason = item.Reason
        }).ToList();
        PrereqListView.ItemsSource = rows;
        StartButton.IsEnabled = model.Ready;
    }

    public void UpdateState(string? statusText, int? progress, bool? isBusy)
    {
        if (!string.IsNullOrWhiteSpace(statusText))
        {
            StatusTextBlock.Text = statusText;
        }

        if (progress.HasValue)
        {
            InstallProgressBar.Value = Math.Max(0, Math.Min(100, progress.Value));
        }

        if (isBusy.HasValue)
        {
            busy = isBusy.Value;
            DetectButton.IsEnabled = !busy;
            StartButton.IsEnabled = !busy;
        }
    }

    public void AppendLog(string line)
    {
        LogTextBox.AppendText(line + Environment.NewLine);
        LogTextBox.ScrollToEnd();
    }

    public void MarkCompleted(bool success, string message)
    {
        busy = false;
        StatusTextBlock.Text = message;
        StartButton.IsEnabled = success;
        DetectButton.IsEnabled = true;
    }

    public void NotifyBusyCloseBlocked()
    {
        ClosingRequestedDuringBusy?.Invoke(this, EventArgs.Empty);
        StatusTextBlock.Text = "Hay una operación en progreso; espera a que termine antes de cerrar.";
    }

    private void SetMode(string mode)
    {
        var normalized = (mode ?? "install").Trim().ToLowerInvariant();
        foreach (var item in ModeComboBox.Items.OfType<ComboBoxItem>())
        {
            var tagValue = Convert.ToString(item.Tag);
            var contentValue = Convert.ToString(item.Content);
            if (string.Equals(tagValue, normalized, StringComparison.OrdinalIgnoreCase)
                || string.Equals(contentValue, normalized, StringComparison.OrdinalIgnoreCase))
            {
                ModeComboBox.SelectedItem = item;
                return;
            }
        }

        ModeComboBox.SelectedIndex = 0;
    }

    private BootstrapperRequest BuildRequest()
    {
        var selectedFlavor = FlavorComboBox.SelectedItem as FlavorItem;
        var modeItem = ModeComboBox.SelectedItem as ComboBoxItem;
        var mode = modeItem?.Tag?.ToString()
            ?? modeItem?.Content?.ToString()
            ?? "install";
        var ownerRepo = (UpdateOwnerRepoTextBox.Text ?? string.Empty).Split('/', 2, StringSplitOptions.TrimEntries);

        return new BootstrapperRequest
        {
            FlavorId = selectedFlavor?.FlavorId ?? "docente-local",
            Mode = mode,
            InstallDir = InstallDirTextBox.Text.Trim(),
            InstallDesktopShortcuts = DesktopShortcutsCheckBox.IsChecked == true,
            InstallStartMenuShortcuts = StartMenuShortcutsCheckBox.IsChecked == true,
            MongoUri = MongoUriTextBox.Text.Trim(),
            NodeEnv = NodeEnvTextBox.Text.Trim(),
            ApiPort = ApiPortTextBox.Text.Trim(),
            PortalPort = PortalPortTextBox.Text.Trim(),
            CorsOrigins = CorsOriginsTextBox.Text.Trim(),
            PortalAlumnoUrl = PortalAlumnoUrlTextBox.Text.Trim(),
            PortalApiKey = PortalApiKeyTextBox.Text.Trim(),
            PasswordResetEnabled = PasswordResetEnabledCheckBox.IsChecked == true,
            PasswordResetUrlBase = PasswordResetUrlBaseTextBox.Text.Trim(),
            RequireLicenseActivation = RequireLicenseCheckBox.IsChecked == true,
            LicenseApiBaseUrl = LicenseApiBaseUrlTextBox.Text.Trim(),
            TenantId = TenantIdTextBox.Text.Trim(),
            ActivationCode = ActivationCodeTextBox.Text.Trim(),
            LicenseAccountEmail = LicenseEmailTextBox.Text.Trim(),
            UpdateChannel = UpdateChannelTextBox.Text.Trim(),
            UpdateAssetName = UpdateAssetNameTextBox.Text.Trim(),
            UpdateOwner = ownerRepo.Length > 0 ? ownerRepo[0] : "Dtcsrni",
            UpdateRepo = ownerRepo.Length > 1 ? ownerRepo[1] : "EvaluaPro_Sistema_Universitario",
            UpdateShaAssetName = $"{UpdateAssetNameTextBox.Text.Trim()}.sha256"
        };
    }

    private void DetectButton_OnClick(object sender, RoutedEventArgs e)
    {
        DetectRequested?.Invoke(this, EventArgs.Empty);
    }

    private void StartButton_OnClick(object sender, RoutedEventArgs e)
    {
        StartRequested?.Invoke(this, BuildRequest());
    }

    private void CloseButton_OnClick(object sender, RoutedEventArgs e)
    {
        CloseRequested?.Invoke(this, EventArgs.Empty);
    }

    private void FlavorComboBox_OnSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (FlavorComboBox.SelectedItem is not FlavorItem flavor)
        {
            return;
        }

        UpdateAssetNameTextBox.Text = flavor.AssetName;
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (busy)
        {
            e.Cancel = true;
            NotifyBusyCloseBlocked();
            return;
        }

        base.OnClosing(e);
    }

    private void StartSplashSequence()
    {
        var timer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(1800)
        };

        timer.Tick += (_, _) =>
        {
            timer.Stop();
            SplashOverlay.Visibility = Visibility.Collapsed;
        };

        timer.Start();
    }

    private void SetHubVersionLabel()
    {
        var assembly = typeof(MainWindow).Assembly;
        var version = assembly.GetName().Version;
        var versionText = version is null
            ? "v1.0.0"
            : $"v{version.Major}.{Math.Max(0, version.Minor)}.{Math.Max(0, version.Build)}";
        HubVersionTextBlock.Text = versionText;
    }
}

internal sealed class PrerequisiteRow
{
    public string Name { get; set; } = string.Empty;

    public string InstalledLabel { get; set; } = string.Empty;

    public string ActualVersion { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;
}
