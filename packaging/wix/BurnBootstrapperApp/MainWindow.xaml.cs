using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;

namespace EvaluaPro.BurnBootstrapperApp;

public partial class MainWindow : Window
{
    private bool busy;
    private bool hasDeterminateProgress;
    private bool readyToStart;
    private bool splashDismissed;
    private DispatcherTimer? splashFallbackTimer;

    public MainWindow()
    {
        InitializeComponent();
        ModeComboBox.SelectedIndex = 0;
        SetHubVersionLabel();
        StartSplashFallbackWatcher();
    }

    public event EventHandler? DetectRequested;

    public event EventHandler<BootstrapperRequest>? StartRequested;

    public event EventHandler? CloseRequested;

    public event EventHandler? ClosingRequestedDuringBusy;

    public event EventHandler? RestartRequested;

    public void ApplyDetectionModel(WindowDetectionModel model)
    {
        if (FlavorComboBox.Items.Count == 0 && model.AvailableFlavors.Count > 0)
        {
            ConfigureInitialFlavorLayout(model.AvailableFlavors, model.FlavorId);
        }

        FlavorComboBox.SelectedItem = FlavorComboBox.Items.OfType<FlavorItem>().FirstOrDefault(item => item.FlavorId == model.FlavorId);

        InstallDirTextBox.Text = model.InstallDir;
        DetectionSummaryTextBlock.Text = model.Summary;
        UpdateAssetNameTextBox.Text = model.AssetName;
        SetMode(model.Mode);
        readyToStart = model.Ready;

        var rows = model.Prerequisites.Select(item => new PrerequisiteRow
        {
            Name = item.Name,
            InstalledLabel = item.Installed ? "OK" : "FALTA",
            ActualVersion = item.ActualVersion,
            Reason = item.Reason
        }).ToList();
        PrereqListView.ItemsSource = rows;
        StartButton.IsEnabled = model.Ready && !busy;
    }

    public void ConfigureInitialFlavorLayout(IReadOnlyList<FlavorItem> availableFlavors, string requestedFlavorId)
    {
        if (availableFlavors.Count == 0)
        {
            availableFlavors = [new FlavorItem("docente-local", "EvaluaPro", "EvaluaPro-InstallerHub-docente-local.exe")];
        }

        if (FlavorComboBox.Items.Count == 0)
        {
            foreach (var flavor in availableFlavors)
            {
                FlavorComboBox.Items.Add(flavor);
            }

            FlavorComboBox.DisplayMemberPath = nameof(FlavorItem.DisplayName);
        }

        var selectedFlavor = FlavorComboBox.Items
            .OfType<FlavorItem>()
            .FirstOrDefault(item => string.Equals(item.FlavorId, requestedFlavorId, StringComparison.OrdinalIgnoreCase))
            ?? FlavorComboBox.Items.OfType<FlavorItem>().FirstOrDefault();

        FlavorComboBox.SelectedItem = selectedFlavor;
        if (!string.IsNullOrWhiteSpace(selectedFlavor?.AssetName))
        {
            UpdateAssetNameTextBox.Text = selectedFlavor.AssetName;
        }

        ApplyFlavorLayout(availableFlavors.Count > 1);
    }

    public void NotifyInitialDetectionCompleted()
    {
        DismissSplashOverlay();
    }

    public void UpdateState(string? statusText, int? progress, bool? isBusy)
    {
        if (!string.IsNullOrWhiteSpace(statusText))
        {
            StatusTextBlock.Text = statusText;
        }

        if (progress.HasValue)
        {
            hasDeterminateProgress = true;
            InstallProgressBar.IsIndeterminate = false;
            InstallProgressBar.Value = Math.Max(0, Math.Min(100, progress.Value));
        }

        if (isBusy.HasValue)
        {
            busy = isBusy.Value;
            DetectButton.IsEnabled = !busy;
            StartButton.IsEnabled = !busy && readyToStart;
            RestartNowButton.IsEnabled = !busy;

            if (busy && !progress.HasValue && !hasDeterminateProgress)
            {
                InstallProgressBar.IsIndeterminate = true;
            }

            if (!busy)
            {
                InstallProgressBar.IsIndeterminate = false;
            }
        }
    }

    internal void UpdateWorkflow(InstallerWorkflowView workflow)
    {
        StatusTextBlock.Text = workflow.StatusText;
        StatusHintTextBlock.Text = workflow.HintText;
        StatusBadgeTextBlock.Text = workflow.BadgeText;
        StatusCardBorder.Background = ToBrush(workflow.HeaderBackground);
        StatusBadgeTextBlock.Foreground = ToBrush(workflow.HeaderForeground);
        StatusTextBlock.Foreground = ToBrush(workflow.HeaderForeground);
        StatusHintTextBlock.Foreground = ToBrush(workflow.HeaderForeground);

        StageSummaryBorder.Background = ToBrush(workflow.SummaryBackground);
        StageSummaryBorder.BorderBrush = ToBrush(workflow.SummaryBorder);
        StageSummaryBadgeTextBlock.Text = workflow.SummaryBadge;
        StageSummaryBadgeTextBlock.Foreground = ToBrush(workflow.SummaryForeground);
        StageSummaryTitleTextBlock.Text = workflow.CurrentStageTitle;
        StageSummaryTextBlock.Text = workflow.CurrentStageText;
        StageSummaryTextBlock.Foreground = ToBrush(workflow.StageBodyForeground);

        StageTimelineHost.Children.Clear();
        StageTimelineHost.RowDefinitions.Clear();

        var stageCount = Math.Max(1, workflow.Stages.Count);
        for (var rowIndex = 0; rowIndex < stageCount; rowIndex++)
        {
            StageTimelineHost.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        }

        var stageIndex = 0;
        foreach (var stage in workflow.Stages)
        {
            var border = new Border
            {
                CornerRadius = new CornerRadius(12),
                Padding = new Thickness(8),
                Margin = new Thickness(0, 0, 0, stageIndex < workflow.Stages.Count - 1 ? 6 : 0),
                Background = ToBrush(stage.Background),
                BorderBrush = ToBrush(stage.Border),
                BorderThickness = new Thickness(1)
            };

            var stack = new StackPanel();
            stack.Children.Add(new TextBlock
            {
                Text = $"{stage.Label} · {stage.Badge}",
                FontWeight = FontWeights.SemiBold,
                Foreground = ToBrush(stage.Foreground),
                TextWrapping = TextWrapping.Wrap
            });
            stack.Children.Add(new TextBlock
            {
                Margin = new Thickness(0, 2, 0, 0),
                Text = stage.Summary,
                Foreground = ToBrush(stage.Foreground),
                TextWrapping = TextWrapping.NoWrap,
                TextTrimming = TextTrimming.CharacterEllipsis
            });

            if (!string.IsNullOrWhiteSpace(stage.Detail))
            {
                stack.Children.Add(new TextBlock
                {
                    Margin = new Thickness(0, 2, 0, 0),
                    FontSize = 10,
                    Text = stage.Detail,
                    Foreground = ToBrush("#49616F"),
                    TextWrapping = TextWrapping.NoWrap,
                    TextTrimming = TextTrimming.CharacterEllipsis
                });
            }

            border.Child = stack;
            Grid.SetRow(border, stageIndex);
            StageTimelineHost.Children.Add(border);
            stageIndex++;
        }

        FailureSummaryBorder.Visibility = workflow.ShowFailureSummary ? Visibility.Visible : Visibility.Collapsed;
        FailureSummaryTitleTextBlock.Text = workflow.FailureTitle;
        FailureSummaryTextBlock.Text = workflow.FailureText;
    }

    public void AppendLog(string line)
    {
        LogTextBox.AppendText(line + Environment.NewLine);
        LogTextBox.ScrollToEnd();
    }

    public void MarkCompleted(bool success, string message)
    {
        busy = false;
        hasDeterminateProgress = false;
        InstallProgressBar.IsIndeterminate = false;
        StatusTextBlock.Text = message;
        StartButton.IsEnabled = readyToStart;
        DetectButton.IsEnabled = true;
        RestartNowButton.IsEnabled = true;
    }

    public void SetRestartActionVisible(bool visible, string? message = null)
    {
        RestartNowButton.Visibility = visible ? Visibility.Visible : Visibility.Collapsed;
        RestartNowButton.IsEnabled = visible && !busy;
        if (visible && !string.IsNullOrWhiteSpace(message))
        {
            StatusHintTextBlock.Text = message;
        }
    }

    public void NotifyBusyCloseBlocked()
    {
        ClosingRequestedDuringBusy?.Invoke(this, EventArgs.Empty);
        StatusTextBlock.Text = "Hay una operación en progreso; espera a que termine antes de cerrar.";
        StatusHintTextBlock.Text = "El cierre se bloqueó para proteger la transacción actual.";
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
        hasDeterminateProgress = false;
        InstallProgressBar.IsIndeterminate = true;
        InstallProgressBar.Value = 0;
        DetectRequested?.Invoke(this, EventArgs.Empty);
    }

    private void StartButton_OnClick(object sender, RoutedEventArgs e)
    {
        hasDeterminateProgress = false;
        InstallProgressBar.IsIndeterminate = true;
        InstallProgressBar.Value = 0;
        StartRequested?.Invoke(this, BuildRequest());
    }

    private void CloseButton_OnClick(object sender, RoutedEventArgs e)
    {
        CloseRequested?.Invoke(this, EventArgs.Empty);
    }

    private void RestartNowButton_OnClick(object sender, RoutedEventArgs e)
    {
        RestartRequested?.Invoke(this, EventArgs.Empty);
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

    private void ApplyFlavorLayout(bool hasMultipleFlavors)
    {
        FlavorComboBox.IsEnabled = hasMultipleFlavors;
        FlavorPanel.Visibility = hasMultipleFlavors ? Visibility.Visible : Visibility.Collapsed;
        Grid.SetColumn(ModePanel, hasMultipleFlavors ? 1 : 0);
        Grid.SetColumnSpan(ModePanel, hasMultipleFlavors ? 1 : 2);
        ModePanel.Margin = hasMultipleFlavors ? new Thickness(12, 0, 0, 0) : new Thickness(0);
    }

    private void StartSplashFallbackWatcher()
    {
        splashFallbackTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(15)
        };

        splashFallbackTimer.Tick += (_, _) =>
        {
            splashFallbackTimer?.Stop();
            DismissSplashOverlay();
        };

        splashFallbackTimer.Start();
    }

    private void DismissSplashOverlay()
    {
        if (splashDismissed)
        {
            return;
        }

        splashDismissed = true;
        splashFallbackTimer?.Stop();
        SplashOverlay.Visibility = Visibility.Collapsed;
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

    private static SolidColorBrush ToBrush(string hex)
    {
        return (SolidColorBrush)new BrushConverter().ConvertFrom(hex)!;
    }
}

internal sealed class PrerequisiteRow
{
    public string Name { get; set; } = string.Empty;

    public string InstalledLabel { get; set; } = string.Empty;

    public string ActualVersion { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;
}

internal sealed class InstallerWorkflowView
{
    public string BadgeText { get; set; } = "Estado activo";
    public string StatusText { get; set; } = "Analizando prerequisitos...";
    public string HintText { get; set; } = "La operación todavía no termina.";
    public string HeaderBackground { get; set; } = "#E5B85C";
    public string HeaderForeground { get; set; } = "#2E2413";
    public string SummaryBackground { get; set; } = "#E6F4F8";
    public string SummaryBorder { get; set; } = "#9BD2DF";
    public string SummaryForeground { get; set; } = "#0B4A5A";
    public string StageBodyForeground { get; set; } = "#37576A";
    public string SummaryBadge { get; set; } = "En curso";
    public string CurrentStageTitle { get; set; } = "Etapa actual: detección";
    public string CurrentStageText { get; set; } = "El asistente está preparando la validación inicial.";
    public IReadOnlyList<InstallerStageView> Stages { get; set; } = [];
    public bool ShowFailureSummary { get; set; }
    public string FailureTitle { get; set; } = "Resumen de error";
    public string FailureText { get; set; } = string.Empty;
}

internal sealed class InstallerStageView
{
    public string Label { get; set; } = string.Empty;
    public string Badge { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public string Background { get; set; } = "#F8FAFC";
    public string Border { get; set; } = "#D7DEE5";
    public string Foreground { get; set; } = "#0F172A";
}
