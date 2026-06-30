using System.Collections.Generic;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;
using System.Windows.Threading;

namespace EvaluaPro.BurnBootstrapperApp;

public partial class MainWindow : Window
{
    private static readonly Geometry CheckGeometry = Geometry.Parse("M2,7.5 L5.5,11 L12,3");
    private static readonly Geometry CrossGeometry = Geometry.Parse("M2,2 L12,12 M12,2 L2,12");
    private static readonly Geometry CircleGeometry = Geometry.Parse("M7,2 A5,5 0 1 1 6.99,2");
    private static readonly Geometry DotGeometry = Geometry.Parse("M7,4.5 A2.5,2.5 0 1 1 6.99,4.5");
    private static readonly Geometry InstallGeometry = Geometry.Parse("M6,22 L15,31 L34,12");
    private static readonly Geometry RepairGeometry = Geometry.Parse("M10,12 L16,6 L22,12 L18,16 L30,28 L26,32 L14,20 L10,24 L6,20");
    private static readonly Geometry UninstallGeometry = Geometry.Parse("M10,10 L34,34 M34,10 L10,34");
    private static readonly Geometry DocumentGeometry = Geometry.Parse("M11,6 L27,6 L33,12 L33,36 L11,36 Z M27,6 L27,12 L33,12 M15,20 L29,20 M15,26 L29,26 M15,32 L24,32");

    private void StartPulseAnimation(UIElement element)
    {
        var animation = new DoubleAnimation
        {
            From = 1.0,
            To = 0.35,
            Duration = new Duration(TimeSpan.FromSeconds(0.85)),
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever
        };
        element.BeginAnimation(UIElement.OpacityProperty, animation);
    }

    private void StopPulseAnimation(UIElement element)
    {
        element.BeginAnimation(UIElement.OpacityProperty, null);
        element.Opacity = 1.0;
    }
    private bool busy;
    private bool pendingCloseRequest;
    private bool hasDeterminateProgress;
    private bool readyToStart;
    private bool splashDismissed;
    private DispatcherTimer? splashFallbackTimer;
    private bool suppressModeChangedEvent;
    private WizardStep currentStep = WizardStep.Terms;

    public MainWindow()
    {
        InitializeComponent();
        ModeComboBox.SelectedIndex = 0;
        SetHubVersionLabel();
        RefreshOperationalChrome();
        SetWizardStep(WizardStep.Terms);
        StartSplashFallbackWatcher();
    }

    public event EventHandler? DetectRequested;

    public event EventHandler<BootstrapperRequest>? StartRequested;

    public event EventHandler? CloseRequested;

    public event EventHandler? ClosingRequestedDuringBusy;

    public event EventHandler? RestartRequested;

    public event EventHandler<ModeChangedEventArgs>? ModeChanged;

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
        RefreshOperationalChrome(model.Mode, FlavorComboBox.SelectedItem as FlavorItem);
        readyToStart = model.Ready;

        var rows = model.Prerequisites.Select(item => new PrerequisiteRow
        {
            Name = item.Name,
            InstalledLabel = item.Installed ? "OK" : "FALTA",
            ActualVersion = item.ActualVersion,
            Reason = item.Reason
        }).ToList();
        PrereqListView.ItemsSource = rows;
        RefreshPrerequisiteSummary(rows);
        var isInstall = string.Equals(GetSelectedMode(), "install", StringComparison.OrdinalIgnoreCase);
        var isUninstall = string.Equals(GetSelectedMode(), "uninstall", StringComparison.OrdinalIgnoreCase);
        var accepted = AcceptTermsCheckBox.IsChecked == true;
        StartButton.IsEnabled = (model.Ready || isUninstall) && !busy && (!isInstall || accepted);
        FooterStatusTextBlock.Text = model.Ready
            ? "Equipo listo. Puedes ejecutar la operación seleccionada."
            : "Revisa prerequisitos antes de ejecutar la operación.";
        RefreshFooterGuidance();
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
        RefreshOperationalChrome(GetSelectedMode(), selectedFlavor);
    }

    public void NotifyInitialDetectionCompleted()
    {
        DismissSplashOverlay();
        var isInstall = string.Equals(GetSelectedMode(), "install", StringComparison.OrdinalIgnoreCase);
        if (isInstall && AcceptTermsCheckBox.IsChecked != true)
        {
            SetWizardStep(WizardStep.Terms);
        }
        else
        {
            SetWizardStep(WizardStep.Review);
        }
        DetectButton.Focus();
    }

    public void UpdateState(string? statusText, int? progress, bool? isBusy)
    {
        if (!string.IsNullOrWhiteSpace(statusText))
        {
            StatusTextBlock.Text = statusText;
            SetLiveExplanation("Estado actualizado", $"El instalador reporta: {statusText}");
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
            StatusSpinner.Visibility = busy ? Visibility.Visible : Visibility.Collapsed;
            var isInstall = string.Equals(GetSelectedMode(), "install", StringComparison.OrdinalIgnoreCase);
            var isUninstall = string.Equals(GetSelectedMode(), "uninstall", StringComparison.OrdinalIgnoreCase);
            var accepted = AcceptTermsCheckBox.IsChecked == true;
            StartButton.IsEnabled = !busy && (readyToStart || isUninstall) && (!isInstall || accepted);
            RestartNowButton.IsEnabled = !busy;
            BackButton.IsEnabled = !busy && currentStep != WizardStep.Terms && (currentStep != WizardStep.Prepare || isInstall);
            NextButton.IsEnabled = !busy && currentStep != WizardStep.Result && (currentStep != WizardStep.Terms || !isInstall || accepted);

            if (busy && !progress.HasValue && !hasDeterminateProgress)
            {
                SetWizardStep(WizardStep.Execute);
                InstallProgressBar.IsIndeterminate = true;
                SetLiveExplanation("Operación en curso", "El asistente está ejecutando tareas del instalador. No cierres la ventana hasta que termine o se solicite reinicio.");
            }

            if (!busy)
            {
                InstallProgressBar.IsIndeterminate = false;
                TryHonorPendingCloseRequest();
                RefreshWizardNavigation();
                SetLiveExplanation("Listo para continuar", "La tarea activa terminó. Revisa el estado visible y usa la acción recomendada en la parte inferior.");
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
        RefreshStatusVisual(workflow);
        WorkflowHeaderTitleTextBlock.Text = workflow.WorkflowTitle;
        WorkflowHeaderHintTextBlock.Text = workflow.WorkflowHint;
        SetLiveExplanation(workflow.CurrentStageTitle, workflow.CurrentStageText);

        StageSummaryBorder.Background = ToBrush(workflow.SummaryBackground);
        StageSummaryBorder.BorderBrush = ToBrush(workflow.SummaryBorder);
        StageSummaryBadgeTextBlock.Text = workflow.SummaryBadge;
        StageSummaryBadgeTextBlock.Foreground = ToBrush(workflow.SummaryForeground);
        StageSummaryTitleTextBlock.Text = workflow.CurrentStageTitle;
        StageSummaryTextBlock.Text = workflow.CurrentStageText;
        StageSummaryTextBlock.Foreground = ToBrush(workflow.StageBodyForeground);

        StageTimelineHost.Children.Clear();

        var stageIndex = 0;
        var focusIndex = -1;
        var focusHasActive = false;
        var focusHasError = false;
        var timelineItems = new List<Border>();
        foreach (var stage in workflow.Stages)
        {
            var badge = stage.Badge ?? string.Empty;
            var border = new Border
            {
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(8),
                Margin = new Thickness(0, 0, 0, stageIndex < workflow.Stages.Count - 1 ? 6 : 0),
                Background = ToBrush(stage.Background),
                BorderBrush = ToBrush(stage.Border),
                BorderThickness = new Thickness(1)
            };

            var stack = new StackPanel();
            var headerStack = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 4) };
            
            var badgeIcon = new Path
            {
                Width = 14,
                Height = 14,
                StrokeThickness = 2,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(0, 0, 6, 0)
            };

            var textLabel = new TextBlock
            {
                Text = $"{stage.Label} · {badge.ToLowerInvariant()}",
                FontWeight = FontWeights.SemiBold,
                Foreground = ToBrush(stage.Foreground),
                VerticalAlignment = VerticalAlignment.Center,
                TextWrapping = TextWrapping.Wrap
            };

            if (badge == "ACTIVA")
            {
                badgeIcon.Data = CircleGeometry;
                badgeIcon.Stroke = ToBrush(stage.Foreground);
                StartPulseAnimation(badgeIcon);

                var rotateTransform = new RotateTransform();
                badgeIcon.RenderTransform = rotateTransform;
                badgeIcon.RenderTransformOrigin = new Point(0.5, 0.5);

                var spinnerAnimation = new DoubleAnimation
                {
                    From = 0,
                    To = 360,
                    Duration = new Duration(TimeSpan.FromSeconds(1.2)),
                    RepeatBehavior = RepeatBehavior.Forever
                };
                rotateTransform.BeginAnimation(RotateTransform.AngleProperty, spinnerAnimation);
            }
            else if (badge == "OK")
            {
                badgeIcon.Data = CheckGeometry;
                badgeIcon.Stroke = ToBrush(stage.Foreground);
                StopPulseAnimation(badgeIcon);
            }
            else if (badge == "ERROR")
            {
                badgeIcon.Data = CrossGeometry;
                badgeIcon.Stroke = ToBrush(stage.Foreground);
                StopPulseAnimation(badgeIcon);
            }
            else
            {
                badgeIcon.Data = DotGeometry;
                badgeIcon.Stroke = ToBrush(stage.Foreground);
                badgeIcon.Fill = badgeIcon.Stroke;
                StopPulseAnimation(badgeIcon);
            }

            headerStack.Children.Add(badgeIcon);
            headerStack.Children.Add(textLabel);
            stack.Children.Add(headerStack);

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
            StageTimelineHost.Children.Add(border);
            timelineItems.Add(border);

            if (badge.Equals("ACTIVA", StringComparison.OrdinalIgnoreCase))
            {
                focusIndex = stageIndex;
                focusHasActive = true;
            }
            else if (!focusHasActive && badge.Equals("ERROR", StringComparison.OrdinalIgnoreCase))
            {
                focusIndex = stageIndex;
                focusHasError = true;
            }
            else if (!focusHasActive && !focusHasError && badge.Equals("OK", StringComparison.OrdinalIgnoreCase))
            {
                focusIndex = stageIndex;
            }
            stageIndex++;
        }

        if (focusIndex >= 0 && focusIndex < timelineItems.Count)
        {
            CenterTimelineItem(timelineItems[focusIndex]);
        }

        FailureSummaryBorder.Visibility = workflow.ShowFailureSummary ? Visibility.Visible : Visibility.Collapsed;
        FailureSummaryTitleTextBlock.Text = workflow.FailureTitle;
        FailureSummaryTextBlock.Text = workflow.FailureText;
        if (workflow.ShowFailureSummary)
        {
            LogExpander.IsExpanded = true;
            SetWizardStep(WizardStep.Result);
        }

        UpdateStepperState(workflow.ShowFailureSummary);
    }

    private void CenterTimelineItem(Border? target)
    {
        if (target is null || StageTimelineScrollViewer is null || !StageTimelineScrollViewer.IsVisible)
        {
            return;
        }

        Dispatcher.BeginInvoke(() =>
        {
            if (StageTimelineScrollViewer.ViewportHeight <= 0)
            {
                target.BringIntoView();
                return;
            }

            var transform = target.TransformToAncestor(StageTimelineScrollViewer);
            var rect = transform.TransformBounds(new Rect(new Point(0, 0), target.RenderSize));
            var targetCenter = rect.Top + StageTimelineScrollViewer.VerticalOffset + (rect.Height / 2);
            var desiredOffset = targetCenter - (StageTimelineScrollViewer.ViewportHeight / 2);
            if (desiredOffset < 0)
            {
                desiredOffset = 0;
            }
            StageTimelineScrollViewer.ScrollToVerticalOffset(desiredOffset);
        }, DispatcherPriority.Background);
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
        StatusHintTextBlock.Text = success
            ? "La operación terminó y el resultado queda disponible para revisión."
            : "La operación no terminó correctamente. La bitácora técnica queda disponible para diagnóstico.";
        var isUninstall = string.Equals(GetSelectedMode(), "uninstall", StringComparison.OrdinalIgnoreCase);
        StartButton.IsEnabled = !success && (readyToStart || isUninstall);
        DetectButton.IsEnabled = true;
        RestartNowButton.IsEnabled = true;
        FooterStatusTextBlock.Text = success ? "Operación finalizada correctamente." : "Operación detenida. Revisa la evidencia técnica.";
        SetWizardStep(WizardStep.Result);
        SetLiveExplanation(
            success ? "Operación completada" : "Operación detenida",
            success
                ? "El flujo finalizó correctamente. Revisa si hay reinicio pendiente o cierra el asistente."
                : "Revisa el resumen de error y la bitácora técnica antes de volver a intentar.");
        TryHonorPendingCloseRequest();
    }

    public void SetRestartActionVisible(bool visible, string? message = null)
    {
        RestartNowButton.Visibility = visible ? Visibility.Visible : Visibility.Collapsed;
        RestartNowButton.IsEnabled = visible && !busy;
        if (visible && !string.IsNullOrWhiteSpace(message))
        {
            StatusHintTextBlock.Text = message;
            FooterStatusTextBlock.Text = message;
            SetWizardStep(WizardStep.Result);
            SetLiveExplanation("Reinicio requerido", "Windows necesita reiniciar para completar prerequisitos o retomar la instalación con el estado correcto.");
        }
    }

    public void NotifyBusyCloseBlocked()
    {
        pendingCloseRequest = true;
        ClosingRequestedDuringBusy?.Invoke(this, EventArgs.Empty);
        StatusTextBlock.Text = "Hay una operación en progreso; espera a que termine antes de cerrar.";
        StatusHintTextBlock.Text = "El cierre se bloqueó para proteger la transacción actual.";
        FooterStatusTextBlock.Text = "Cierre bloqueado mientras la operación está activa.";
        SetLiveExplanation("Cierre bloqueado", "El asistente conserva la ventana abierta para evitar una instalación, reparación o desinstalación incompleta.");
    }

    private void TryHonorPendingCloseRequest()
    {
        if (!pendingCloseRequest || busy)
        {
            return;
        }

        pendingCloseRequest = false;
        Dispatcher.BeginInvoke(() => CloseRequested?.Invoke(this, EventArgs.Empty), DispatcherPriority.Background);
    }

    private void SetMode(string mode)
    {
        var normalized = (mode ?? "install").Trim().ToLowerInvariant();
        suppressModeChangedEvent = true;
        try
        {
            var selected = false;
            foreach (var item in ModeComboBox.Items.OfType<ComboBoxItem>())
            {
                var tagValue = Convert.ToString(item.Tag);
                var contentValue = Convert.ToString(item.Content);
                if (string.Equals(tagValue, normalized, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(contentValue, normalized, StringComparison.OrdinalIgnoreCase))
                {
                    ModeComboBox.SelectedItem = item;
                    selected = true;
                    break;
                }
            }

            if (!selected)
            {
                ModeComboBox.SelectedIndex = 0;
            }
        }
        finally
        {
            suppressModeChangedEvent = false;
        }

        RefreshOperationalChrome(GetSelectedMode());
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
            ExportData = ExportDataCheckBox.IsChecked == true,
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
        SetWizardStep(WizardStep.Review);
        FooterStatusTextBlock.Text = "Revisando prerequisitos del equipo.";
        SetLiveExplanation("Revisión en curso", "Se están validando requisitos locales y el entorno nativo necesario para ejecutar EvaluaPro.");
        hasDeterminateProgress = false;
        InstallProgressBar.IsIndeterminate = true;
        InstallProgressBar.Value = 0;
        DetectRequested?.Invoke(this, EventArgs.Empty);
    }

    private void StartButton_OnClick(object sender, RoutedEventArgs e)
    {
        SetWizardStep(WizardStep.Execute);
        FooterStatusTextBlock.Text = "Ejecutando operación seleccionada.";
        SetLiveExplanation("Ejecución iniciada", "El asistente aplicará la acción seleccionada y actualizará la línea de tareas con cada etapa completada.");
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

    private void BackButton_OnClick(object sender, RoutedEventArgs e)
    {
        if (busy)
        {
            return;
        }

        var isInstall = string.Equals(GetSelectedMode(), "install", StringComparison.OrdinalIgnoreCase);

        SetWizardStep(currentStep switch
        {
            WizardStep.Prepare => isInstall ? WizardStep.Terms : WizardStep.Prepare,
            WizardStep.Review => WizardStep.Prepare,
            WizardStep.Execute => WizardStep.Review,
            WizardStep.Result => WizardStep.Execute,
            _ => WizardStep.Terms
        });
    }

    private void NextButton_OnClick(object sender, RoutedEventArgs e)
    {
        if (busy)
        {
            return;
        }

        SetWizardStep(currentStep switch
        {
            WizardStep.Terms => WizardStep.Prepare,
            WizardStep.Prepare => WizardStep.Review,
            WizardStep.Review => WizardStep.Execute,
            WizardStep.Execute => WizardStep.Result,
            _ => WizardStep.Result
        });
    }

    private void FlavorComboBox_OnSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (FlavorComboBox.SelectedItem is not FlavorItem flavor)
        {
            return;
        }

        UpdateAssetNameTextBox.Text = flavor.AssetName;
        RefreshOperationalChrome(GetSelectedMode(), flavor);
    }

    private void ModeComboBox_OnSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (suppressModeChangedEvent || busy)
        {
            return;
        }

        var modeItem = ModeComboBox.SelectedItem as ComboBoxItem;
        var mode = modeItem?.Tag?.ToString()
            ?? modeItem?.Content?.ToString()
            ?? "install";
        
        ExportDataCheckBox.Visibility = string.Equals(mode, "uninstall", StringComparison.OrdinalIgnoreCase) 
            ? Visibility.Visible : Visibility.Collapsed;
            
        RefreshOperationalChrome(mode, FlavorComboBox.SelectedItem as FlavorItem);
        ModeChanged?.Invoke(this, new ModeChangedEventArgs(mode));
        RefreshWizardNavigation();
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
        BrandVersionBadgeTextBlock.Text = $"{versionText} · Burn + MSI + helper";
    }

    private string GetSelectedMode()
    {
        var modeItem = ModeComboBox.SelectedItem as ComboBoxItem;
        return modeItem?.Tag?.ToString()
            ?? modeItem?.Content?.ToString()
            ?? "install";
    }

    private static string GetModeLabel(string mode)
    {
        return mode switch
        {
            "repair" => "Reparación",
            "uninstall" => "Desinstalación",
            _ => "Instalación"
        };
    }

    private static string GetModeActionLabel(string mode)
    {
        return mode switch
        {
            "repair" => "_Reparar",
            "uninstall" => "_Desinstalar",
            _ => "_Instalar"
        };
    }

    private void RefreshOperationalChrome(string? mode = null, FlavorItem? flavor = null)
    {
        var normalizedMode = string.IsNullOrWhiteSpace(mode) ? GetSelectedMode() : mode;
        var selectedFlavor = flavor ?? FlavorComboBox.SelectedItem as FlavorItem;

        BrandModeBadgeTextBlock.Text = GetModeLabel(normalizedMode);
        BrandFlavorBadgeTextBlock.Text = selectedFlavor?.DisplayName ?? "EvaluaPro";
        StartButton.Content = GetModeActionLabel(normalizedMode);
        StartButton.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, GetModeActionLabel(normalizedMode).Replace("_", string.Empty));
        RefreshModeImpact(normalizedMode);

        if (AcceptTermsCheckBox != null)
        {
            var isInstall = string.Equals(normalizedMode, "install", StringComparison.OrdinalIgnoreCase);
            AcceptTermsCheckBox.Visibility = isInstall ? Visibility.Visible : Visibility.Collapsed;
        }
    }

    private void RefreshModeImpact(string mode)
    {
        var normalized = string.IsNullOrWhiteSpace(mode) ? "install" : mode.Trim().ToLowerInvariant();
        switch (normalized)
        {
            case "repair":
                ModeImpactTitleTextBlock.Text = "Reparar instalación";
                ModeImpactTextBlock.Text = "Revalida runtime, restaura configuración/accesos y conserva datos locales.";
                ModeImpactChecklistTextBlock.Text = "No borra cursos ni base local; revisa prerequisitos antes de reparar.";
                ModeImpactBorder.Background = ToBrush("#EFF6FF");
                ModeImpactBorder.BorderBrush = ToBrush("#BFDBFE");
                ModeImpactIcon.Data = RepairGeometry;
                ModeImpactIcon.Stroke = ToBrush("#2563EB");
                ModeImpactIconPlate.Background = ToBrush("#EFF6FF");
                ModeImpactIconPlate.BorderBrush = ToBrush("#BFDBFE");
                break;
            case "uninstall":
                ModeImpactTitleTextBlock.Text = "Desinstalar";
                ModeImpactTextBlock.Text = "Retira componentes instalados por MSI/Burn en este equipo.";
                ModeImpactChecklistTextBlock.Text = "Revisa respaldo de datos antes de continuar; la operación cambia el estado local.";
                ModeImpactBorder.Background = ToBrush("#FFFBEB");
                ModeImpactBorder.BorderBrush = ToBrush("#FDE68A");
                ModeImpactIcon.Data = UninstallGeometry;
                ModeImpactIcon.Stroke = ToBrush("#B45309");
                ModeImpactIconPlate.Background = ToBrush("#FFFBEB");
                ModeImpactIconPlate.BorderBrush = ToBrush("#FDE68A");
                break;
            default:
                ModeImpactTitleTextBlock.Text = "Instalar o actualizar";
                ModeImpactTextBlock.Text = "Configura prerequisitos, escribe configuración operativa y crea accesos.";
                ModeImpactChecklistTextBlock.Text = "Se descargan dependencias nativas, carpeta destino y accesos.";
                ModeImpactBorder.Background = ToBrush("#EFF6FF");
                ModeImpactBorder.BorderBrush = ToBrush("#BFDBFE");
                ModeImpactIcon.Data = InstallGeometry;
                ModeImpactIcon.Stroke = ToBrush("#2563EB");
                ModeImpactIconPlate.Background = ToBrush("#EFF6FF");
                ModeImpactIconPlate.BorderBrush = ToBrush("#BFDBFE");
                break;
        }
    }

    private void RefreshStatusVisual(InstallerWorkflowView workflow)
    {
        var failed = workflow.ShowFailureSummary
            || workflow.BadgeText.Contains("error", StringComparison.OrdinalIgnoreCase)
            || workflow.SummaryBadge.Contains("error", StringComparison.OrdinalIgnoreCase);

        StatusVisualIcon.Data = failed ? CrossGeometry : workflow.Stages.Any(stage => stage.Badge == "ACTIVA") ? CircleGeometry : CheckGeometry;
        StatusVisualIcon.Stroke = ToBrush(failed ? "#B42318" : workflow.Stages.Any(stage => stage.Badge == "ACTIVA") ? "#2563EB" : "#15803D");
        StatusVisualPlate.Background = ToBrush(failed ? "#FEF2F2" : workflow.Stages.Any(stage => stage.Badge == "ACTIVA") ? "#EFF6FF" : "#ECFDF5");
        StatusVisualPlate.BorderBrush = ToBrush(failed ? "#FECACA" : workflow.Stages.Any(stage => stage.Badge == "ACTIVA") ? "#BFDBFE" : "#A7F3D0");
    }

    private void RefreshPrerequisiteSummary(IReadOnlyCollection<PrerequisiteRow> rows)
    {
        if (rows.Count == 0)
        {
            PrereqSummaryTextBlock.Text = "Sin prerequisitos detectados";
            PrereqSummaryHintTextBlock.Text = "Pulsa Revisar equipo para generar una lectura actual del equipo.";
            PrereqSummaryBorder.Background = ToBrush("#F8FAFC");
            PrereqSummaryBorder.BorderBrush = ToBrush("#D9E2EA");
            PrereqSummaryIcon.Data = DocumentGeometry;
            PrereqSummaryIcon.Stroke = ToBrush("#526173");
            PrereqSummaryIconPlate.Background = ToBrush("#F8FAFC");
            PrereqSummaryIconPlate.BorderBrush = ToBrush("#D9E2EA");
            return;
        }

        var missingCount = rows.Count(item => string.Equals(item.InstalledLabel, "FALTA", StringComparison.OrdinalIgnoreCase));
        var readyCount = rows.Count - missingCount;
        if (missingCount == 0)
        {
            PrereqSummaryTextBlock.Text = $"Listo: {readyCount} requisito(s) OK";
            PrereqSummaryHintTextBlock.Text = "Puedes ejecutar la acción primaria o revisar la bitácora si necesitas evidencia.";
            PrereqSummaryBorder.Background = ToBrush("#ECFDF5");
            PrereqSummaryBorder.BorderBrush = ToBrush("#A7F3D0");
            PrereqSummaryIcon.Data = CheckGeometry;
            PrereqSummaryIcon.Stroke = ToBrush("#15803D");
            PrereqSummaryIconPlate.Background = ToBrush("#ECFDF5");
            PrereqSummaryIconPlate.BorderBrush = ToBrush("#A7F3D0");
            return;
        }

        PrereqSummaryTextBlock.Text = $"Atención: {missingCount} pendiente(s), {readyCount} OK";
        PrereqSummaryHintTextBlock.Text = "Revisa filas FALTA y corrige antes de instalar o reparar.";
        PrereqSummaryBorder.Background = ToBrush("#FEF2F2");
        PrereqSummaryBorder.BorderBrush = ToBrush("#FECACA");
        PrereqSummaryIcon.Data = CrossGeometry;
        PrereqSummaryIcon.Stroke = ToBrush("#B42318");
        PrereqSummaryIconPlate.Background = ToBrush("#FEF2F2");
        PrereqSummaryIconPlate.BorderBrush = ToBrush("#FECACA");
    }

    private void SetWizardStep(WizardStep step)
    {
        currentStep = step;
        TermsStepPanel.Visibility = step == WizardStep.Terms ? Visibility.Visible : Visibility.Collapsed;
        PrepareStepPanel.Visibility = step == WizardStep.Prepare ? Visibility.Visible : Visibility.Collapsed;
        ReviewStepPanel.Visibility = step == WizardStep.Review ? Visibility.Visible : Visibility.Collapsed;
        ExecuteStepPanel.Visibility = step == WizardStep.Execute ? Visibility.Visible : Visibility.Collapsed;
        ResultStepPanel.Visibility = step == WizardStep.Result ? Visibility.Visible : Visibility.Collapsed;
        RefreshWizardNavigation();
        UpdateStepperState(FailureSummaryBorder.Visibility == Visibility.Visible);
        RefreshLiveExplanationForStep();
    }

    private void RefreshWizardNavigation()
    {
        var isInstall = string.Equals(GetSelectedMode(), "install", StringComparison.OrdinalIgnoreCase);
        var isUninstall = string.Equals(GetSelectedMode(), "uninstall", StringComparison.OrdinalIgnoreCase);
        var accepted = AcceptTermsCheckBox.IsChecked == true;

        BackButton.IsEnabled = !busy && currentStep != WizardStep.Terms && (currentStep != WizardStep.Prepare || isInstall);
        
        if (currentStep == WizardStep.Terms)
        {
            NextButton.IsEnabled = !busy && (!isInstall || accepted);
        }
        else
        {
            NextButton.IsEnabled = !busy && currentStep != WizardStep.Result;
        }

        DetectButton.Visibility = currentStep == WizardStep.Review ? Visibility.Visible : Visibility.Collapsed;
        StartButton.Visibility = currentStep is WizardStep.Review or WizardStep.Execute ? Visibility.Visible : Visibility.Collapsed;
        StartButton.IsEnabled = !busy && (readyToStart || isUninstall) && (!isInstall || accepted);
        RefreshFooterGuidance();
    }

    private void RefreshFooterGuidance()
    {
        FooterNextActionTextBlock.Text = currentStep switch
        {
            WizardStep.Terms => "Qué sigue: acepta términos para continuar con instalación o configuración.",
            WizardStep.Prepare => "Qué sigue: confirma modo, ruta y accesos; luego avanza a revisión.",
            WizardStep.Review when readyToStart => "Qué sigue: equipo listo; ejecuta la acción primaria.",
            WizardStep.Review => "Qué sigue: pulsa Revisar equipo o corrige prerequisitos pendientes.",
            WizardStep.Execute => "Qué sigue: mantén esta ventana abierta mientras termina la operación.",
            WizardStep.Result => "Qué sigue: revisa resultado, reinicio pendiente y bitácora técnica.",
            _ => "Sigue el paso activo del asistente."
        };
    }

    private void RefreshLiveExplanationForStep()
    {
        if (busy)
        {
            return;
        }

        switch (currentStep)
        {
            case WizardStep.Terms:
                SetLiveExplanation("Leyendo términos", "El instalador espera confirmación legal antes de modificar archivos, servicios o configuración local.");
                break;
            case WizardStep.Prepare:
                SetLiveExplanation("Preparando operación", "Aquí defines edición, modo y rutas. Todavía no se ejecutan cambios de instalación.");
                break;
            case WizardStep.Review when readyToStart:
                SetLiveExplanation("Equipo validado", "Los prerequisitos detectados permiten continuar. La acción primaria ejecutará el modo seleccionado.");
                break;
            case WizardStep.Review:
                SetLiveExplanation("Revisando equipo", "Este paso compara prerequisitos instalados contra lo necesario y explica qué falta corregir.");
                break;
            case WizardStep.Execute:
                SetLiveExplanation("Ejecutando cambios", "El instalador está aplicando tareas. La barra y la línea de tareas indican avance y etapa actual.");
                break;
            case WizardStep.Result:
                SetLiveExplanation("Resultado disponible", "El flujo terminó o requiere atención. Usa el resumen, reinicio pendiente y bitácora para decidir el siguiente paso.");
                break;
        }
    }

    private void SetLiveExplanation(string title, string description)
    {
        LiveExplanationTitleTextBlock.Text = string.IsNullOrWhiteSpace(title) ? "Qué está pasando" : title;
        LiveExplanationTextBlock.Text = string.IsNullOrWhiteSpace(description)
            ? "El asistente está esperando el siguiente paso disponible."
            : description;
    }

    private void AcceptTermsCheckBox_OnClick(object sender, RoutedEventArgs e)
    {
        var isInstall = string.Equals(GetSelectedMode(), "install", StringComparison.OrdinalIgnoreCase);
        if (isInstall && AcceptTermsCheckBox.IsChecked == true && currentStep == WizardStep.Terms)
        {
            SetWizardStep(WizardStep.Prepare);
        }
        else
        {
            RefreshWizardNavigation();
        }
    }

    private void UpdateStepperState(bool hasFailure = false)
    {
        SetStepBadge(TermsStepBorder, TermsStepTextBlock, TermsStepIcon, "1 Términos", currentStep, WizardStep.Terms, hasFailure);
        SetStepBadge(PrepareStepBorder, PrepareStepTextBlock, PrepareStepIcon, "2 Preparar", currentStep, WizardStep.Prepare, hasFailure);
        SetStepBadge(ReviewStepBorder, ReviewStepTextBlock, ReviewStepIcon, "3 Revisar", currentStep, WizardStep.Review, hasFailure);
        SetStepBadge(ExecuteStepBorder, ExecuteStepTextBlock, ExecuteStepIcon, "4 Ejecutar", currentStep, WizardStep.Execute, hasFailure);
        SetStepBadge(ResultStepBorder, ResultStepTextBlock, ResultStepIcon, "5 Resultado", currentStep, WizardStep.Result, hasFailure);
        RefreshStepConnectors(hasFailure);
    }

    private void RefreshStepConnectors(bool hasFailure)
    {
        SetStepConnector(StepConnectorTermsPrepare, WizardStep.Prepare, hasFailure);
        SetStepConnector(StepConnectorPrepareReview, WizardStep.Review, hasFailure);
        SetStepConnector(StepConnectorReviewExecute, WizardStep.Execute, hasFailure);
        SetStepConnector(StepConnectorExecuteResult, WizardStep.Result, hasFailure);
    }

    private void SetStepConnector(Rectangle connector, WizardStep targetStep, bool hasFailure)
    {
        if (hasFailure && targetStep == WizardStep.Result)
        {
            connector.Fill = ToBrush("#FECACA");
            return;
        }

        connector.Fill = currentStep >= targetStep ? ToBrush("#A7F3D0") : ToBrush("#D9E2EA");
    }

    private void SetStepBadge(Border border, TextBlock textBlock, Path iconPath, string label, WizardStep activeStep, WizardStep step, bool hasFailure)
    {
        var completed = step < activeStep;
        var active = step == activeStep;
        var failedResult = hasFailure && step == WizardStep.Result;
        var state = failedResult ? "error" : active ? "activo" : completed ? "correcto" : "pendiente";
        textBlock.Text = $"{label} · {state}";
        border.Background = ToBrush(failedResult ? "#FEF2F2" : active ? "#EFF6FF" : completed ? "#ECFDF5" : "#F8FAFC");
        border.BorderBrush = ToBrush(failedResult ? "#FECACA" : active ? "#BFDBFE" : completed ? "#A7F3D0" : "#D9E2EA");
        textBlock.Foreground = ToBrush(failedResult ? "#B42318" : active ? "#2563EB" : completed ? "#15803D" : "#526173");

        iconPath.Stroke = textBlock.Foreground;
        iconPath.Fill = null;

        if (failedResult)
        {
            iconPath.Data = CrossGeometry;
            iconPath.Visibility = Visibility.Visible;
            StopPulseAnimation(iconPath);
        }
        else if (active)
        {
            iconPath.Data = CircleGeometry;
            iconPath.Visibility = Visibility.Visible;
            StartPulseAnimation(iconPath);
        }
        else if (completed)
        {
            iconPath.Data = CheckGeometry;
            iconPath.Visibility = Visibility.Visible;
            StopPulseAnimation(iconPath);
        }
        else
        {
            iconPath.Data = DotGeometry;
            iconPath.Fill = iconPath.Stroke;
            iconPath.Visibility = Visibility.Visible;
            StopPulseAnimation(iconPath);
        }
    }

    private static SolidColorBrush ToBrush(string hex)
    {
        return (SolidColorBrush)new BrushConverter().ConvertFrom(hex)!;
    }
}

internal enum WizardStep
{
    Terms = 0,
    Prepare = 1,
    Review = 2,
    Execute = 3,
    Result = 4
}

internal sealed class PrerequisiteRow
{
    public string Name { get; set; } = string.Empty;

    public string InstalledLabel { get; set; } = string.Empty;

    public string ActualVersion { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string ToolTipText => $"{Name}: {InstalledLabel}. Versión: {ActualVersion}. {Reason}";

    public string AccessibleSummary => $"{Name}, {InstalledLabel}, versión {ActualVersion}. {Reason}";
}

public sealed class ModeChangedEventArgs : EventArgs
{
    public ModeChangedEventArgs(string mode)
    {
        Mode = mode;
    }

    public string Mode { get; }
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
    public string WorkflowTitle { get; set; } = "Trazabilidad y progreso";
    public string WorkflowHint { get; set; } = "Resumen en vivo de la operación seleccionada.";
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
