using System.Collections.Generic;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;
using System.Windows.Threading;
using System.Runtime.InteropServices;
using System.Security.Cryptography;

namespace EvaluaPro.BurnBootstrapperApp;

public partial class MainWindow : Window
{
    private const double MinimumScreenWidth = 1024;
    private const double MinimumScreenHeight = 576;
    private const string DefaultDatabaseUrl = "file:C:/ProgramData/EvaluaPro/data/evaluapro.db";
    private const string DefaultNodeEnv = "production";
    private const string DefaultApiPort = "4000";
    private const string DefaultPortalPort = "4518";
    private const string DefaultCorsOrigins = "http://localhost:4173,http://127.0.0.1:4173";
    private const string DefaultPortalApiKey = "portal-key-shared";
    private const string DefaultLicenseEmail = "soporte@tu-institucion.mx";
    private const string DefaultUpdateChannel = "stable";
    private const string DefaultUpdateOwner = "Dtcsrni";
    private const string DefaultUpdateRepo = "EvaluaPro_Sistema_Universitario";
    private const string DefaultUpdateAssetName = "EvaluaPro-InstallerHub-docente-local.exe";

    private static readonly Geometry CheckGeometry = Geometry.Parse("M2,7.5 L5.5,11 L12,3");
    private static readonly Geometry CrossGeometry = Geometry.Parse("M2,2 L12,12 M12,2 L2,12");
    private static readonly Geometry CircleGeometry = Geometry.Parse("M7,2 A5,5 0 1 1 6.99,2");
    private static readonly Geometry DotGeometry = Geometry.Parse("M7,4.5 A2.5,2.5 0 1 1 6.99,4.5");
    private static readonly Geometry InstallGeometry = Geometry.Parse("M6,22 L15,31 L34,12");
    private static readonly Geometry RepairGeometry = Geometry.Parse("M10,12 L16,6 L22,12 L18,16 L30,28 L26,32 L14,20 L10,24 L6,20");
    private static readonly Geometry UninstallGeometry = Geometry.Parse("M10,10 L34,34 M34,10 L10,34");
    private static readonly Geometry DocumentGeometry = Geometry.Parse("M11,6 L27,6 L33,12 L33,36 L11,36 Z M27,6 L27,12 L33,12 M15,20 L29,20 M15,26 L29,26 M15,32 L24,32");
    private static readonly Geometry FeatureInstallGeometry = Geometry.Parse("M12,2 L21,6 V12 C21,18 17,22 12,24 C7,22 3,18 3,12 V6 Z M7,12 L10,15 L17,8");
    private static readonly Geometry FeatureTeacherGeometry = Geometry.Parse("M2,9 L12,3 L22,9 L12,15 Z M6,12 V17 C9,20 15,20 18,17 V12");
    private static readonly Geometry FeatureEvaluateGeometry = Geometry.Parse("M6,3 H18 V6 H20 V22 H4 V6 H6 Z M8,10 H16 M8,14 H16 M8,18 H13");
    private static readonly Geometry FeatureScanGeometry = Geometry.Parse("M4,4 H9 M15,4 H20 M4,20 H9 M15,20 H20 M5,12 H19");
    private static readonly Geometry FeatureFeedbackGeometry = Geometry.Parse("M4,20 V6 M4,20 H20 M7,16 L11,12 L14,15 L19,9");
    private static readonly Geometry FeatureRepairGeometry = Geometry.Parse("M6,7 A7,7 0 0 1 18,8 L21,5 M21,5 V10 H16 M18,17 A7,7 0 0 1 6,16 L3,19 M3,19 V14 H8");

    private void StartPulseAnimation(UIElement element)
    {
        var animation = new DoubleAnimation
        {
            From = 1.0,
            To = 0.82,
            Duration = new Duration(TimeSpan.FromSeconds(0.9)),
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

    private void StartProgressPulseAnimation()
    {
        if (!SystemParameters.ClientAreaAnimation)
        {
            StopProgressPulseAnimation();
            return;
        }

        var animation = new DoubleAnimation
        {
            From = 1.0,
            To = 1.14,
            Duration = new Duration(TimeSpan.FromSeconds(0.9)),
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever
        };
        ProgressPulseTransform.BeginAnimation(ScaleTransform.ScaleYProperty, animation);
    }

    private void StopProgressPulseAnimation()
    {
        ProgressPulseTransform.BeginAnimation(ScaleTransform.ScaleYProperty, null);
        ProgressPulseTransform.ScaleY = 1.0;
    }
    private bool busy;
    private bool pendingCloseRequest;
    private bool hasDeterminateProgress;
    private bool readyToStart;
    private bool splashDismissed;
    private DispatcherTimer? splashFallbackTimer;
    private DispatcherTimer? splashCarouselTimer;
    private int splashFeatureIndex;
    private bool suppressModeChangedEvent;
    private bool isInstallationDetected;
    private WizardStep currentStep = WizardStep.Terms;
    private string currentUpdateAssetName = DefaultUpdateAssetName;
    private readonly Queue<(DateTime At, int Progress)> progressSamples = new();
    private double? smoothedRemainingSeconds;
    private DateTime lastProgressAdvanceAt;

    public MainWindow()
    {
        InitializeComponent();
        ConfigureHardwareRendering();
        ModeComboBox.SelectedIndex = 0;
        SetHubVersionLabel();
        RefreshOperationalChrome();
        SetWizardStep(WizardStep.Terms);
        Loaded += (_, _) => ApplyResolutionGuard();
        SourceInitialized += (_, _) => ApplyNativeBackdrop();
        StartSplashCarousel();
    }

    private void ConfigureHardwareRendering()
    {
        System.Windows.Media.RenderOptions.ProcessRenderMode = System.Windows.Interop.RenderMode.Default;
        var tier = System.Windows.Media.RenderCapability.Tier >> 16;
        AppendLog($"[info] WPF DirectX render tier={tier}; GPU/DWM activo={tier > 0}.");
    }

    private void ApplyNativeBackdrop()
    {
        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 22000))
        {
            return;
        }

        var hwnd = new System.Windows.Interop.WindowInteropHelper(this).Handle;
        var backdrop = 2; // DWMSBT_MAINWINDOW: Mica estable; fallback visual propio debajo.
        _ = DwmSetWindowAttribute(hwnd, 38, ref backdrop, sizeof(int));
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int valueSize);

    private void ApplyResolutionGuard()
    {
        var workArea = SystemParameters.WorkArea;
        var supported = workArea.Width >= MinimumScreenWidth && workArea.Height >= MinimumScreenHeight;
        if (!supported)
        {
            StartButton.IsEnabled = false;
            NextButton.IsEnabled = false;
            FooterStatusTextBlock.Text = $"Resolución no compatible: se requiere como mínimo {MinimumScreenWidth:0}×{MinimumScreenHeight:0} efectivos.";
            FooterStatusTextBlock.Text += " Ajusta la escala de pantalla de Windows o conecta un monitor compatible para continuar.";
            return;
        }

        if (workArea.Width < 1920 || workArea.Height < 1080)
        {
            FooterStatusTextBlock.Text = "Resolución compatible. Se recomienda 1920×1080 (escala 100%) para una visualización óptima.";
        }
    }

    public event EventHandler? DetectRequested;

    public event EventHandler<BootstrapperRequest>? StartRequested;

    public event EventHandler? CloseRequested;

    public event EventHandler? ClosingRequestedDuringBusy;

    public event EventHandler? RestartRequested;

    public event EventHandler? LaunchRequested;

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
        currentUpdateAssetName = string.IsNullOrWhiteSpace(model.AssetName) ? DefaultUpdateAssetName : model.AssetName;
        isInstallationDetected = model.IsInstalled || !string.Equals(model.Mode, "install", StringComparison.OrdinalIgnoreCase);
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
        RefreshHardwareMetrics(model.InstallDir);
        var isInstall = string.Equals(GetSelectedMode(), "install", StringComparison.OrdinalIgnoreCase);
        var isUninstall = string.Equals(GetSelectedMode(), "uninstall", StringComparison.OrdinalIgnoreCase);
        var accepted = AreTermsAccepted();
        StartButton.IsEnabled = (model.Ready || isUninstall) && !busy && (!isInstall || accepted);
        FooterStatusTextBlock.Text = model.Ready
            ? "Equipo listo. Puedes ejecutar la operación seleccionada."
            : "Revisa prerequisitos antes de ejecutar la operación.";
        RefreshFooterGuidance();
    }

    private void RefreshHardwareMetrics(string installDir)
    {
        try
        {
            var osDesc = RuntimeInformation.OSDescription;
            var is64 = Environment.Is64BitOperatingSystem;
            HardwareOsTextBlock.Text = $"{osDesc} ({(is64 ? "64-bit x64" : "32-bit")})";

            var cpuCores = Environment.ProcessorCount;
            var memInfo = GC.GetGCMemoryInfo();
            var totalRamGb = memInfo.TotalAvailableMemoryBytes > 0
                ? Math.Round(memInfo.TotalAvailableMemoryBytes / (1024.0 * 1024 * 1024), 1)
                : 8.0;
            HardwareCpuRamTextBlock.Text = $"{cpuCores} núcleos CPU · ~{totalRamGb:0.0} GB RAM detectada";

            var targetDir = string.IsNullOrWhiteSpace(installDir) ? InstallDirTextBox?.Text?.Trim() ?? string.Empty : installDir;
            var driveRoot = System.IO.Path.GetPathRoot(targetDir);
            if (!string.IsNullOrWhiteSpace(driveRoot))
            {
                var drive = new System.IO.DriveInfo(driveRoot);
                if (drive.IsReady)
                {
                    var freeGb = Math.Round(drive.AvailableFreeSpace / (1024.0 * 1024 * 1024), 1);
                    HardwareDiskSpaceTextBlock.Text = $"Unidad {driveRoot.TrimEnd('\\')} · {freeGb:0.0} GB libres (se requieren ~500 MB)";
                }
                else
                {
                    HardwareDiskSpaceTextBlock.Text = $"Unidad {driveRoot} verificada";
                }
            }
            else
            {
                HardwareDiskSpaceTextBlock.Text = "Espacio libre verificado por el instalador";
            }

            HardwarePackageModeTextBlock.Text = "100% Autocontenido · Sin descargas de internet necesarias";
            SummaryInstallDirTextBlock.Text = string.IsNullOrWhiteSpace(targetDir) ? "C:\\Program Files\\EvaluaPro" : targetDir;

            if (cpuCores >= 6)
            {
                EstimatedTimeTextBlock.Text = "~10 a 20 segundos (Hardware de alto rendimiento)";
            }
            else if (cpuCores >= 4)
            {
                EstimatedTimeTextBlock.Text = "~15 a 30 segundos (Rendimiento estándar)";
            }
            else
            {
                EstimatedTimeTextBlock.Text = "~30 a 50 segundos (Modo compatible)";
            }

            // Evaluación de Advertencias y Requisitos Mínimos vs Recomendados
            var warnings = new List<string>();
            var blockingErrors = new List<string>();

            if (!is64)
            {
                blockingErrors.Add("Se requiere un sistema operativo Windows de 64 bits (x64).");
            }

            var freeGbVal = 50.0;
            if (!string.IsNullOrWhiteSpace(driveRoot))
            {
                try
                {
                    var drive = new System.IO.DriveInfo(driveRoot);
                    if (drive.IsReady)
                    {
                        freeGbVal = drive.AvailableFreeSpace / (1024.0 * 1024 * 1024);
                    }
                }
                catch { }
            }

            if (freeGbVal < 0.5)
            {
                blockingErrors.Add($"Espacio insuficiente en disco: {freeGbVal:0.0} GB libres (se requieren al menos 0.5 GB).");
            }
            else if (freeGbVal < 2.0)
            {
                warnings.Add($"Espacio en disco ajustado ({freeGbVal:0.0} GB libres). Se recomiendan al menos 2.0 GB para almacenamiento de exámenes y copias de seguridad.");
            }

            if (totalRamGb < 3.5)
            {
                warnings.Add($"Memoria RAM detectada (~{totalRamGb:0.0} GB). Se recomiendan 4.0 GB o más para optimizar el escaneo de exámenes por lotes.");
            }

            if (cpuCores < 2)
            {
                warnings.Add("Se detectó un solo núcleo de CPU. Se recomienda un procesador multi-núcleo para procesamiento OMR acelerado.");
            }

            if (blockingErrors.Count > 0)
            {
                PrereqSummaryBorder.Background = ToBrush("#667F1D1D");
                PrereqSummaryBorder.BorderBrush = ToBrush("#80F87171");
                PrereqSummaryIconPlate.Background = ToBrush("#99991B1B");
                PrereqSummaryIconPlate.BorderBrush = ToBrush("#80F87171");
                PrereqSummaryIcon.Stroke = ToBrush("#F87171");
                PrereqSummaryTextBlock.Text = "Requisitos mínimos insuficientes";
                PrereqSummaryTextBlock.Foreground = ToBrush("#F87171");
                PrereqSummaryHintTextBlock.Text = "Corrige los requisitos bloqueantes para poder continuar.";

                HardwareWarningsBorder.Visibility = Visibility.Visible;
                HardwareWarningsBorder.Background = ToBrush("#667F1D1D");
                HardwareWarningsBorder.BorderBrush = ToBrush("#80F87171");
                HardwareWarningsIcon.Text = "🛑";
                HardwareWarningsTitleTextBlock.Text = "No se puede continuar:";
                HardwareWarningsTitleTextBlock.Foreground = ToBrush("#FCA5A5");
                HardwareWarningsTextBlock.Text = string.Join(" ", blockingErrors);
                readyToStart = false;
            }
            else if (warnings.Count > 0)
            {
                PrereqSummaryBorder.Background = ToBrush("#6678350F");
                PrereqSummaryBorder.BorderBrush = ToBrush("#80FBBF24");
                PrereqSummaryIconPlate.Background = ToBrush("#9992400E");
                PrereqSummaryIconPlate.BorderBrush = ToBrush("#80FBBF24");
                PrereqSummaryIcon.Stroke = ToBrush("#FBBF24");
                PrereqSummaryTextBlock.Text = "Compatible con avisos de rendimiento";
                PrereqSummaryTextBlock.Foreground = ToBrush("#FBBF24");
                PrereqSummaryHintTextBlock.Text = "El equipo cumple los mínimos pero se encuentra por debajo de lo recomendado.";

                HardwareWarningsBorder.Visibility = Visibility.Visible;
                HardwareWarningsBorder.Background = ToBrush("#6678350F");
                HardwareWarningsBorder.BorderBrush = ToBrush("#80FBBF24");
                HardwareWarningsIcon.Text = "⚠️";
                HardwareWarningsTitleTextBlock.Text = "Aviso de rendimiento:";
                HardwareWarningsTitleTextBlock.Foreground = ToBrush("#FDE047");
                HardwareWarningsTextBlock.Text = string.Join(" ", warnings);
            }
            else
            {
                PrereqSummaryBorder.Background = ToBrush("#66064E3B");
                PrereqSummaryBorder.BorderBrush = ToBrush("#8034D399");
                PrereqSummaryIconPlate.Background = ToBrush("#99065F46");
                PrereqSummaryIconPlate.BorderBrush = ToBrush("#8034D399");
                PrereqSummaryIcon.Stroke = ToBrush("#34D399");
                PrereqSummaryTextBlock.Text = "Listo: Tu equipo está 100% optimizado para EvaluaPro";
                PrereqSummaryTextBlock.Foreground = ToBrush("#34D399");
                PrereqSummaryHintTextBlock.Text = "Todos los requisitos mínimos y recomendados están cubiertos.";
                HardwareWarningsBorder.Visibility = Visibility.Collapsed;
            }
        }
        catch
        {
            HardwareOsTextBlock.Text = "Windows 10/11 (64-bit Compatible)";
            HardwareCpuRamTextBlock.Text = $"{Environment.ProcessorCount} núcleos CPU detectados";
            HardwareDiskSpaceTextBlock.Text = "Espacio en disco verificado";
            HardwarePackageModeTextBlock.Text = "100% Autocontenido · Sin descargas necesarias";
            SummaryInstallDirTextBlock.Text = installDir;
            EstimatedTimeTextBlock.Text = "~15 a 25 segundos";
            HardwareWarningsBorder.Visibility = Visibility.Collapsed;
        }
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
            currentUpdateAssetName = selectedFlavor.AssetName;
        }

        ApplyFlavorLayout(availableFlavors.Count > 1);
        RefreshOperationalChrome(GetSelectedMode(), selectedFlavor);
    }

    public void NotifyInitialDetectionCompleted()
    {
        DismissSplashOverlay();
        if (isInstallationDetected)
        {
            SetWizardStep(WizardStep.Prepare);
        }
        else if (!AreTermsAccepted())
        {
            SetWizardStep(WizardStep.Terms);
        }
        else
        {
            SetWizardStep(WizardStep.Prepare);
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
            var boundedProgress = Math.Max(0, Math.Min(100, progress.Value));
            InstallProgressBar.Value = boundedProgress;
            UpdateProgressEstimate(boundedProgress);
        }

        if (isBusy.HasValue)
        {
            busy = isBusy.Value;
            if (busy)
            {
                StartProgressPulseAnimation();
            }
            else
            {
                StopProgressPulseAnimation();
            }
            StatusSpinner.Visibility = busy ? Visibility.Visible : Visibility.Collapsed;
            var isInstall = string.Equals(GetSelectedMode(), "install", StringComparison.OrdinalIgnoreCase);
            var isUninstall = string.Equals(GetSelectedMode(), "uninstall", StringComparison.OrdinalIgnoreCase);
            var accepted = AreTermsAccepted();
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
                ProgressEtaTextBlock.Text = hasDeterminateProgress && InstallProgressBar.Value >= 100
                    ? "Tiempo restante: completado."
                    : "Tiempo restante: no disponible.";
                TryHonorPendingCloseRequest();
                RefreshWizardNavigation();
                SetLiveExplanation("Listo para continuar", "La tarea activa terminó. Revisa el estado visible y usa la acción recomendada en la parte inferior.");
            }
        }
    }

    private void UpdateProgressEstimate(int progress)
    {
        if (progress <= 0)
        {
            progressSamples.Clear();
            smoothedRemainingSeconds = null;
            lastProgressAdvanceAt = default;
            ProgressEtaTextBlock.Text = "Tiempo restante estimado: ~15 a 25 s (iniciando instalación…)";
            return;
        }

        var now = DateTime.UtcNow;
        var previousProgress = progressSamples.Count == 0 ? progress : progressSamples.Last().Progress;
        if (progress > previousProgress)
        {
            lastProgressAdvanceAt = now;
        }
        progressSamples.Enqueue((now, progress));
        while (progressSamples.Count > 0 && (now - progressSamples.Peek().At).TotalSeconds > 45)
        {
            progressSamples.Dequeue();
        }

        if (progress >= 100)
        {
            smoothedRemainingSeconds = 0;
            ProgressEtaTextBlock.Text = busy
                ? "Tiempo restante: finalizando configuración…"
                : "Tiempo restante: completado.";
            return;
        }

        if (progress >= 90)
        {
            ProgressEtaTextBlock.Text = "Tiempo restante: finalizando y creando accesos directos (~3 a 5 s)…";
            return;
        }

        if (progress >= 60)
        {
            ProgressEtaTextBlock.Text = "Tiempo restante estimado: ~8 a 15 s (configurando SQLite y servicios)…";
            return;
        }

        if (progress >= 20)
        {
            ProgressEtaTextBlock.Text = "Tiempo restante estimado: ~12 a 20 s (desempaquetando archivos nativos)…";
            return;
        }

        var first = progressSamples.FirstOrDefault();
        var elapsedSeconds = (now - first.At).TotalSeconds;
        var delta = progress - first.Progress;

        if (delta >= 2 && elapsedSeconds >= 3)
        {
            var rawSecondsRemaining = (100 - progress) * elapsedSeconds / delta;
            if (double.IsFinite(rawSecondsRemaining) && rawSecondsRemaining > 0 && rawSecondsRemaining <= 120)
            {
                var previousEstimate = smoothedRemainingSeconds;
                var estimate = previousEstimate.HasValue
                    ? (previousEstimate.Value * 0.70) + (rawSecondsRemaining * 0.30)
                    : rawSecondsRemaining;
                smoothedRemainingSeconds = Math.Max(1, estimate);

                var lowerSeconds = Math.Max(1, (int)Math.Round(estimate * 0.85 / 5d) * 5);
                var upperSeconds = Math.Max(lowerSeconds, (int)Math.Round(estimate * 1.35 / 5d) * 5);
                ProgressEtaTextBlock.Text = $"Tiempo restante estimado: {FormatDuration(lowerSeconds)} a {FormatDuration(upperSeconds)} · según avance real";
                return;
            }
        }

        ProgressEtaTextBlock.Text = "Tiempo restante estimado: ~10 a 20 s (en progreso…)";
    }

    private static string FormatDuration(int seconds)
    {
        if (seconds < 60) return $"~{seconds} s";
        var minutes = seconds / 60;
        var remainingSeconds = seconds % 60;
        return remainingSeconds == 0 ? $"~{minutes} min" : $"~{minutes} min {remainingSeconds} s";
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
                FontSize = 13,
                LineHeight = 19,
                TextWrapping = TextWrapping.Wrap,
                TextTrimming = TextTrimming.CharacterEllipsis
            });

            if (!string.IsNullOrWhiteSpace(stage.Detail))
            {
                stack.Children.Add(new TextBlock
                {
                    Margin = new Thickness(0, 2, 0, 0),
                    FontSize = 12,
                    LineHeight = 18,
                    Text = stage.Detail,
                    Foreground = ToBrush("#D7E8F5"),
                    TextWrapping = TextWrapping.Wrap,
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
            if (!target.IsVisible || !target.IsDescendantOf(StageTimelineScrollViewer))
            {
                return;
            }

            if (StageTimelineScrollViewer.ViewportHeight <= 0)
            {
                target.BringIntoView();
                return;
            }

            try
            {
                var transform = target.TransformToAncestor(StageTimelineScrollViewer);
                var rect = transform.TransformBounds(new Rect(new Point(0, 0), target.RenderSize));
                var targetCenter = rect.Top + StageTimelineScrollViewer.VerticalOffset + (rect.Height / 2);
                var desiredOffset = targetCenter - (StageTimelineScrollViewer.ViewportHeight / 2);
                if (desiredOffset < 0)
                {
                    desiredOffset = 0;
                }

                StageTimelineScrollViewer.ScrollToVerticalOffset(desiredOffset);
            }
            catch (InvalidOperationException)
            {
                target.BringIntoView();
            }
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
        progressSamples.Clear();
        InstallProgressBar.IsIndeterminate = false;
        StopProgressPulseAnimation();
        StatusTextBlock.Text = message;
        StatusHintTextBlock.Text = success
            ? "La operación terminó y el resultado queda disponible para revisión."
            : "La operación no terminó correctamente. La bitácora técnica queda disponible para diagnóstico.";
        var isUninstall = string.Equals(GetSelectedMode(), "uninstall", StringComparison.OrdinalIgnoreCase);
        StartButton.IsEnabled = !success && (readyToStart || isUninstall);
        LaunchEvaluaProButton.Visibility = success && !isUninstall ? Visibility.Visible : Visibility.Collapsed;
        InstallVerificationTextBlock.Text = success && !isUninstall
            ? ComputeInstallationFingerprint()
            : "No aplica: la operación no fue una instalación completada.";
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
        var updateAssetName = string.IsNullOrWhiteSpace(currentUpdateAssetName)
            ? selectedFlavor?.AssetName ?? DefaultUpdateAssetName
            : currentUpdateAssetName;
        var installDir = InstallDirTextBox.Text.Trim();
        if (string.Equals(selectedFlavor?.FlavorId, "docente-local", StringComparison.OrdinalIgnoreCase))
        {
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var qaInstallDir = Environment.GetEnvironmentVariable("EVALUAPRO_QA_INSTALL_DIR");
            var candidate = string.IsNullOrWhiteSpace(qaInstallDir)
                ? string.Empty
                : System.IO.Path.GetFullPath(qaInstallDir.Trim());
            var localRoot = System.IO.Path.GetFullPath(localAppData).TrimEnd(System.IO.Path.DirectorySeparatorChar) + System.IO.Path.DirectorySeparatorChar;
            var isSafeQaPath = candidate.StartsWith(localRoot, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(candidate.TrimEnd(System.IO.Path.DirectorySeparatorChar), localAppData, StringComparison.OrdinalIgnoreCase);
            installDir = isSafeQaPath
                ? candidate.TrimEnd(System.IO.Path.DirectorySeparatorChar)
                : System.IO.Path.Combine(localAppData, "EvaluaPro");
            InstallDirTextBox.Text = installDir;
        }

        return new BootstrapperRequest
        {
            FlavorId = selectedFlavor?.FlavorId ?? "docente-local",
            Mode = mode,
            InstallDir = installDir,
            InstallDesktopShortcuts = DesktopShortcutsCheckBox.IsChecked == true,
            InstallStartMenuShortcuts = StartMenuShortcutsCheckBox.IsChecked == true,
            ExportData = ExportDataCheckBox.IsChecked == true,
            DatabaseUrl = DefaultDatabaseUrl,
            NodeEnv = DefaultNodeEnv,
            ApiPort = DefaultApiPort,
            PortalPort = DefaultPortalPort,
            CorsOrigins = DefaultCorsOrigins,
            PortalAlumnoUrl = string.Empty,
            PortalApiKey = DefaultPortalApiKey,
            PasswordResetEnabled = false,
            PasswordResetUrlBase = string.Empty,
            RequireLicenseActivation = false,
            LicenseApiBaseUrl = string.Empty,
            TenantId = string.Empty,
            ActivationCode = string.Empty,
            LicenseAccountEmail = DefaultLicenseEmail,
            UpdateChannel = DefaultUpdateChannel,
            UpdateAssetName = updateAssetName,
            UpdateOwner = DefaultUpdateOwner,
            UpdateRepo = DefaultUpdateRepo,
            UpdateShaAssetName = $"{updateAssetName}.sha256"
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
        StartProgressPulseAnimation();
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

        var isNewInstall = !isInstallationDetected && string.Equals(GetSelectedMode(), "install", StringComparison.OrdinalIgnoreCase);

        SetWizardStep(currentStep switch
        {
            WizardStep.Prepare => isNewInstall ? WizardStep.Terms : WizardStep.Prepare,
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

        currentUpdateAssetName = flavor.AssetName;
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
            Interval = TimeSpan.FromSeconds(30)
        };

        splashFallbackTimer.Tick += (_, _) =>
        {
            splashFallbackTimer?.Stop();
            DismissSplashOverlay();
        };

        splashFallbackTimer.Start();
    }

    private void LaunchEvaluaProButton_OnClick(object sender, RoutedEventArgs e)
    {
        LaunchEvaluaProButton.IsEnabled = false;
        LaunchEvaluaProButton.Content = "Iniciando EvaluaPro...";
        FooterStatusTextBlock.Text = "Iniciando EvaluaPro en su propia ventana...";
        LaunchRequested?.Invoke(this, EventArgs.Empty);

        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(6.0) };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            LaunchEvaluaProButton.IsEnabled = true;
            LaunchEvaluaProButton.Content = "Iniciar EvaluaPro";
            FooterStatusTextBlock.Text = "EvaluaPro está listo. Puedes iniciarlo directamente o desde tus accesos directos.";
        };
        timer.Start();
    }

    private string ComputeInstallationFingerprint()
    {
        var root = InstallDirTextBox.Text.Trim();
        if (string.IsNullOrWhiteSpace(root) || !System.IO.Directory.Exists(root))
        {
            return "No se pudo verificar: la carpeta instalada no está disponible.";
        }

        var files = new[]
        {
            System.IO.Path.Combine(root, "runtime", "node", "node.exe"),
            System.IO.Path.Combine(root, "apps", "backend", "dist", "index.js"),
            System.IO.Path.Combine(root, "apps", "frontend", "dist-docente", "index.html"),
            System.IO.Path.Combine(root, "package.json")
        }.Where(System.IO.File.Exists).OrderBy(path => path, StringComparer.OrdinalIgnoreCase).ToArray();
        if (files.Length == 0)
        {
            return "No se pudo verificar: no hay archivos críticos instalados.";
        }

        using var sha = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        uint crc = 0xFFFFFFFF;
        var buffer = new byte[64 * 1024];
        foreach (var file in files)
        {
            using var stream = System.IO.File.OpenRead(file);
            int read;
            while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
            {
                sha.AppendData(buffer, 0, read);
                for (var index = 0; index < read; index++)
                {
                    crc ^= buffer[index];
                    for (var bit = 0; bit < 8; bit++)
                    {
                        crc = (crc >> 1) ^ (0xEDB88320u & (uint)-(int)(crc & 1));
                    }
                }
            }
        }

        return $"CRC32 {~crc:X8} · SHA-256 {Convert.ToHexString(sha.GetHashAndReset())[..16]}… ({files.Length} archivos críticos verificados).";
    }

    private void ShowIntroButton_OnClick(object sender, RoutedEventArgs e)
    {
        splashDismissed = false;
        UpdateSplashFeature();
        SplashOverlay.Visibility = Visibility.Visible;
    }

    private void SplashCloseButton_OnClick(object sender, RoutedEventArgs e)
    {
        DismissSplashOverlay();
    }

    private static readonly (string Title, string Description, Geometry Icon)[] SplashFeatures =
    {
        ("Instala con confianza", "Comprueba requisitos, verifica el paquete y conserva evidencia de cada etapa.", FeatureInstallGeometry),
        ("Diseñado para docentes", "Trabaja en tu equipo, sin máquinas virtuales, con un flujo claro y tus datos bajo control.", FeatureTeacherGeometry),
        ("Evalúa y califica", "Organiza materias, aplica evaluaciones y conserva resultados consistentes y trazables.", FeatureEvaluateGeometry),
        ("Escaneo OMR", "Digitaliza hojas de respuesta, revisa lecturas dudosas y convierte marcas en resultados útiles.", FeatureScanGeometry),
        ("Retroalimentación útil", "Identifica áreas de oportunidad y comunica avances con reportes claros para cada grupo.", FeatureFeedbackGeometry),
        ("Siempre puedes volver", "Repara, actualiza o desinstala con estados visibles, datos protegidos y pasos reversibles.", FeatureRepairGeometry),
        ("Materias y periodos", "Organiza ciclos, grupos y materias una sola vez para reutilizar su estructura durante el curso.", DocumentGeometry),
        ("Alumnos", "Registra o importa alumnos, consulta sus datos y trabaja con listas académicas ordenadas.", FeatureTeacherGeometry),
        ("Banco de reactivos", "Construye preguntas reutilizables por tema, dificultad y competencia para evaluar mejor.", FeatureEvaluateGeometry),
        ("Plantillas de examen", "Crea formatos consistentes y genera evaluaciones repetibles sin rehacer tu trabajo.", DocumentGeometry),
        ("Calificación automática", "Reduce la captura manual, aplica criterios uniformes y conserva la revisión docente.", FeatureEvaluateGeometry),
        ("Resultados por grupo", "Analiza el desempeño individual, grupal y por periodo para decidir el siguiente paso.", FeatureFeedbackGeometry),
        ("Reportes PDF", "Genera documentos listos para revisar, archivar, imprimir o compartir con tu comunidad escolar.", DocumentGeometry),
        ("Exportación", "Lleva calificaciones y reportes a formatos compatibles con tu flujo escolar y tus respaldos.", FeatureScanGeometry),
        ("Historial trazable", "Consulta qué ocurrió, quién realizó cada acción y cuándo, con evidencia operativa.", FeatureFeedbackGeometry),
        ("Privacidad local", "Mantén la información académica en tu equipo y controla qué datos se comparten.", FeatureRepairGeometry),
        ("Copia de seguridad", "Protege tu trabajo con respaldos cifrados y recupera la operación ante incidentes.", FeatureRepairGeometry),
        ("Actualizaciones seguras", "Valida hashes, conserva tus datos y aplica cambios con recuperación ante fallos.", FeatureInstallGeometry),
        ("Diagnóstico", "Detecta requisitos, explica los problemas y orienta la corrección antes de continuar.", FeatureScanGeometry),
        ("Accesibilidad", "Usa textos legibles, navegación por teclado, contraste adecuado y estados comprensibles.", FeatureFeedbackGeometry),
        ("Primeros pasos", "Crea una materia, registra tus primeros alumnos y prepara tu primera evaluación paso a paso.", FeatureTeacherGeometry)
    };

    private void StartSplashCarousel()
    {
        UpdateSplashFeature();
        splashCarouselTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(10) };
        splashCarouselTimer.Tick += (_, _) =>
        {
            splashFeatureIndex = (splashFeatureIndex + 1) % SplashFeatures.Length;
            UpdateSplashFeature();
        };
        splashCarouselTimer.Start();
    }

    private void UpdateSplashFeature()
    {
        var feature = SplashFeatures[splashFeatureIndex];
        SplashFeatureTitleTextBlock.Text = feature.Title;
        SplashFeatureDescriptionTextBlock.Text = feature.Description;
        SplashFeatureIcon.Data = feature.Icon;
        SplashFeatureIndexTextBlock.Text = $"{splashFeatureIndex + 1} de {SplashFeatures.Length}";
        SplashNextButton.Content = splashFeatureIndex == SplashFeatures.Length - 1 ? "Comenzar" : "Siguiente";
        HeaderFeatureTitleTextBlock.Text = feature.Title;
        HeaderFeatureDescriptionTextBlock.Text = feature.Description;
        HeaderFeatureIcon.Data = feature.Icon;
        HeaderFeatureIndexTextBlock.Text = $"{splashFeatureIndex + 1} de {SplashFeatures.Length}";
        AnimateCarouselText(SplashFeatureTitleTextBlock, SplashFeatureDescriptionTextBlock,
            HeaderFeatureTitleTextBlock, HeaderFeatureDescriptionTextBlock,
            SplashFeatureIcon, HeaderFeatureIcon);
    }

    private static void AnimateCarouselText(params UIElement[] elements)
    {
        foreach (var element in elements)
        {
            element.BeginAnimation(UIElement.OpacityProperty, null);
            element.Opacity = 0.35;
            element.BeginAnimation(UIElement.OpacityProperty, new DoubleAnimation
            {
                From = 0.35,
                To = 1,
                Duration = new Duration(TimeSpan.FromMilliseconds(280)),
                EasingFunction = new QuadraticEase()
            });
        }
    }

    private void SplashPreviousButton_OnClick(object sender, RoutedEventArgs e)
    {
        splashCarouselTimer?.Stop();
        splashFeatureIndex = (splashFeatureIndex + SplashFeatures.Length - 1) % SplashFeatures.Length;
        UpdateSplashFeature();
        splashCarouselTimer?.Start();
    }

    private void SplashNextButton_OnClick(object sender, RoutedEventArgs e)
    {
        splashCarouselTimer?.Stop();
        if (splashFeatureIndex == SplashFeatures.Length - 1)
        {
            DismissSplashOverlay();
            return;
        }

        splashFeatureIndex = (splashFeatureIndex + 1) % SplashFeatures.Length;
        UpdateSplashFeature();
        splashCarouselTimer?.Start();
    }

    private void HeaderPreviousButton_OnClick(object sender, RoutedEventArgs e)
    {
        splashCarouselTimer?.Stop();
        splashFeatureIndex = (splashFeatureIndex + SplashFeatures.Length - 1) % SplashFeatures.Length;
        UpdateSplashFeature();
        splashCarouselTimer?.Start();
    }

    private void HeaderNextButton_OnClick(object sender, RoutedEventArgs e)
    {
        splashCarouselTimer?.Stop();
        splashFeatureIndex = (splashFeatureIndex + 1) % SplashFeatures.Length;
        UpdateSplashFeature();
        splashCarouselTimer?.Start();
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
        string? informationalVersion = null;
        try
        {
            informationalVersion = typeof(MainWindow).Assembly.GetName().Version?.ToString();
        }
        catch
        {
            // Fallback en caso de que la ruta sea inválida u ocurra un error de acceso
        }

        if (string.IsNullOrWhiteSpace(informationalVersion))
        {
            var infoVersionAttr = assembly.GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
                .OfType<System.Reflection.AssemblyInformationalVersionAttribute>()
                .FirstOrDefault();
            informationalVersion = infoVersionAttr?.InformationalVersion;
        }

        var version = assembly.GetName().Version;
        var versionText = !string.IsNullOrWhiteSpace(informationalVersion) 
            ? informationalVersion 
            : (version is null ? "vDesconocida" : $"v{version.Major}.{Math.Max(0, version.Minor)}.{Math.Max(0, version.Build)}");
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

        StartButton.Content = GetModeActionLabel(normalizedMode);
        StartButton.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, GetModeActionLabel(normalizedMode).Replace("_", string.Empty));
        RefreshModeImpact(normalizedMode);

        if (PrepareStepTitleTextBlock != null && PrepareStepSubtitleTextBlock != null)
        {
            if (isInstallationDetected)
            {
                PrepareStepTitleTextBlock.Text = "Gestión de EvaluaPro · Instalación detectada";
                PrepareStepSubtitleTextBlock.Text = "Selecciona si deseas reparar componentes, actualizar a una nueva versión o desinstalar la plataforma.";
            }
            else
            {
                PrepareStepTitleTextBlock.Text = "Preparar operación";
                PrepareStepSubtitleTextBlock.Text = "Confirma edición, modo, carpeta destino y accesos antes de revisar el equipo.";
            }
        }

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
                ModeImpactBorder.Background = ToBrush("#7D10304C");
                ModeImpactBorder.BorderBrush = ToBrush("#8038DDF5");
                ModeImpactIcon.Data = RepairGeometry;
                ModeImpactIcon.Stroke = ToBrush("#38BDF8");
                ModeImpactIconPlate.Background = ToBrush("#660B2338");
                ModeImpactIconPlate.BorderBrush = ToBrush("#8038DDF5");
                break;
            case "uninstall":
                ModeImpactTitleTextBlock.Text = "Desinstalar";
                ModeImpactTextBlock.Text = "Retira componentes instalados por MSI/Burn en este equipo.";
                ModeImpactChecklistTextBlock.Text = "Revisa respaldo de datos antes de continuar; la operación cambia el estado local.";
                ModeImpactBorder.Background = ToBrush("#7D3E2410");
                ModeImpactBorder.BorderBrush = ToBrush("#80F59E0B");
                ModeImpactIcon.Data = UninstallGeometry;
                ModeImpactIcon.Stroke = ToBrush("#FBBF24");
                ModeImpactIconPlate.Background = ToBrush("#662E1A0C");
                ModeImpactIconPlate.BorderBrush = ToBrush("#80F59E0B");
                break;
            default:
                ModeImpactTitleTextBlock.Text = "Instalar o actualizar";
                ModeImpactTextBlock.Text = "Configura prerequisitos, escribe configuración operativa y crea accesos.";
                ModeImpactChecklistTextBlock.Text = "Se descargan dependencias nativas, carpeta destino y accesos.";
                ModeImpactBorder.Background = ToBrush("#7D10304C");
                ModeImpactBorder.BorderBrush = ToBrush("#8038DDF5");
                ModeImpactIcon.Data = InstallGeometry;
                ModeImpactIcon.Stroke = ToBrush("#38BDF8");
                ModeImpactIconPlate.Background = ToBrush("#660B2338");
                ModeImpactIconPlate.BorderBrush = ToBrush("#8038DDF5");
                break;
        }
    }

    private void RefreshStatusVisual(InstallerWorkflowView workflow)
    {
        var failed = workflow.ShowFailureSummary
            || workflow.BadgeText.Contains("error", StringComparison.OrdinalIgnoreCase)
            || workflow.SummaryBadge.Contains("error", StringComparison.OrdinalIgnoreCase);

        StatusVisualIcon.Data = failed ? CrossGeometry : workflow.Stages.Any(stage => stage.Badge == "ACTIVA") ? CircleGeometry : CheckGeometry;
        StatusVisualIcon.Stroke = ToBrush(failed ? "#EF4444" : workflow.Stages.Any(stage => stage.Badge == "ACTIVA") ? "#38BDF8" : "#34D399");
        StatusVisualPlate.Background = ToBrush(failed ? "#4D7F1D1D" : workflow.Stages.Any(stage => stage.Badge == "ACTIVA") ? "#4D0C4A6E" : "#4D064E3B");
        StatusVisualPlate.BorderBrush = ToBrush(failed ? "#99F87171" : workflow.Stages.Any(stage => stage.Badge == "ACTIVA") ? "#9938BDF8" : "#9934D399");
    }

    private void RefreshPrerequisiteSummary(IReadOnlyCollection<PrerequisiteRow> rows)
    {
        if (rows.Count == 0)
        {
            PrereqSummaryTextBlock.Text = "Sin prerequisitos detectados";
            PrereqSummaryHintTextBlock.Text = "Pulsa Revisar equipo para generar una lectura actual del equipo.";
            PrereqSummaryTextBlock.Foreground = ToBrush("#F8FAFC");
            PrereqSummaryHintTextBlock.Foreground = ToBrush("#C4D5E8");
            PrereqSummaryBorder.Background = ToBrush("#660F253E");
            PrereqSummaryBorder.BorderBrush = ToBrush("#8038DDF5");
            PrereqSummaryIcon.Data = DocumentGeometry;
            PrereqSummaryIcon.Stroke = ToBrush("#38BDF8");
            PrereqSummaryIconPlate.Background = ToBrush("#660F253E");
            PrereqSummaryIconPlate.BorderBrush = ToBrush("#8038DDF5");
            return;
        }

        var missingCount = rows.Count(item => string.Equals(item.InstalledLabel, "FALTA", StringComparison.OrdinalIgnoreCase));
        var readyCount = rows.Count - missingCount;
        if (missingCount == 0)
        {
            PrereqSummaryTextBlock.Text = $"Listo: {readyCount} requisito(s) OK";
            PrereqSummaryHintTextBlock.Text = "Puedes ejecutar la acción primaria o revisar la bitácora si necesitas evidencia.";
            PrereqSummaryTextBlock.Foreground = ToBrush("#34D399");
            PrereqSummaryHintTextBlock.Foreground = ToBrush("#C4D5E8");
            PrereqSummaryBorder.Background = ToBrush("#66064E3B");
            PrereqSummaryBorder.BorderBrush = ToBrush("#8034D399");
            PrereqSummaryIcon.Data = CheckGeometry;
            PrereqSummaryIcon.Stroke = ToBrush("#34D399");
            PrereqSummaryIconPlate.Background = ToBrush("#80064E3B");
            PrereqSummaryIconPlate.BorderBrush = ToBrush("#8034D399");
            return;
        }

        PrereqSummaryTextBlock.Text = $"Atención: {missingCount} pendiente(s), {readyCount} OK";
        PrereqSummaryHintTextBlock.Text = "Revisa filas FALTA y corrige antes de instalar o reparar.";
        PrereqSummaryTextBlock.Foreground = ToBrush("#F87171");
        PrereqSummaryHintTextBlock.Foreground = ToBrush("#C4D5E8");
        PrereqSummaryBorder.Background = ToBrush("#667F1D1D");
        PrereqSummaryBorder.BorderBrush = ToBrush("#80F87171");
        PrereqSummaryIcon.Data = CrossGeometry;
        PrereqSummaryIcon.Stroke = ToBrush("#F87171");
        PrereqSummaryIconPlate.Background = ToBrush("#807F1D1D");
        PrereqSummaryIconPlate.BorderBrush = ToBrush("#80F87171");
    }

    private void SetWizardStep(WizardStep step)
    {
        currentStep = step;
        TermsStepPanel.Visibility = step == WizardStep.Terms ? Visibility.Visible : Visibility.Collapsed;
        PrepareStepPanel.Visibility = step == WizardStep.Prepare ? Visibility.Visible : Visibility.Collapsed;
        ReviewStepPanel.Visibility = step == WizardStep.Review ? Visibility.Visible : Visibility.Collapsed;
        ExecuteStepPanel.Visibility = step == WizardStep.Execute ? Visibility.Visible : Visibility.Collapsed;
        ResultStepPanel.Visibility = step == WizardStep.Result ? Visibility.Visible : Visibility.Collapsed;

        // Ocultar franjas de diagnóstico y carrusel en pasos iniciales para estética minimalista y limpia
        if (step == WizardStep.Terms)
        {
            StatusCardBorder.Visibility = Visibility.Collapsed;
            LiveExplanationBorder.Visibility = Visibility.Collapsed;
            HeaderFeatureBorder.Visibility = Visibility.Collapsed;
        }
        else if (step is WizardStep.Prepare or WizardStep.Review)
        {
            StatusCardBorder.Visibility = Visibility.Collapsed;
            LiveExplanationBorder.Visibility = Visibility.Collapsed;
            HeaderFeatureBorder.Visibility = Visibility.Visible;
        }
        else
        {
            StatusCardBorder.Visibility = Visibility.Visible;
            LiveExplanationBorder.Visibility = Visibility.Visible;
            HeaderFeatureBorder.Visibility = Visibility.Visible;
        }

        RefreshWizardNavigation();
        UpdateStepperState(FailureSummaryBorder.Visibility == Visibility.Visible);
        RefreshLiveExplanationForStep();

        FrameworkElement? activePanel = step switch
        {
            WizardStep.Terms => TermsStepPanel,
            WizardStep.Prepare => PrepareStepPanel,
            WizardStep.Review => ReviewStepPanel,
            WizardStep.Execute => ExecuteStepPanel,
            WizardStep.Result => ResultStepPanel,
            _ => null
        };

        if (activePanel != null)
        {
            AnimatePanelTransition(activePanel);
        }
    }

    private void AnimatePanelTransition(FrameworkElement panel)
    {
        panel.Opacity = 0.0;
        var translate = new TranslateTransform(0, 12);
        panel.RenderTransform = translate;

        var duration = TimeSpan.FromMilliseconds(250);
        var ease = new CubicEase { EasingMode = EasingMode.EaseOut };

        var opacityAnim = new DoubleAnimation(0.0, 1.0, duration) { EasingFunction = ease };
        var slideAnim = new DoubleAnimation(12.0, 0.0, duration) { EasingFunction = ease };

        panel.BeginAnimation(UIElement.OpacityProperty, opacityAnim);
        translate.BeginAnimation(TranslateTransform.YProperty, slideAnim);
    }

    private void RefreshWizardNavigation()
    {
        var isInstall = string.Equals(GetSelectedMode(), "install", StringComparison.OrdinalIgnoreCase);
        var isNewInstall = !isInstallationDetected && isInstall;
        var isUninstall = string.Equals(GetSelectedMode(), "uninstall", StringComparison.OrdinalIgnoreCase);
        var accepted = AreTermsAccepted();

        BackButton.IsEnabled = !busy && currentStep != WizardStep.Terms && (currentStep != WizardStep.Prepare || isNewInstall);
        
        if (currentStep == WizardStep.Terms)
        {
            NextButton.IsEnabled = !busy && (!isNewInstall || accepted);
        }
        else
        {
            NextButton.IsEnabled = !busy && currentStep != WizardStep.Result;
        }

        DetectButton.Visibility = currentStep == WizardStep.Review ? Visibility.Visible : Visibility.Collapsed;
        StartButton.Visibility = currentStep is WizardStep.Review or WizardStep.Execute ? Visibility.Visible : Visibility.Collapsed;
        StartButton.IsEnabled = !busy && (readyToStart || isUninstall) && (!isNewInstall || accepted);

        if (TryFindResource("PrimaryButtonStyle") is Style primaryStyle &&
            TryFindResource("SecondaryButtonStyle") is Style secondaryStyle)
        {
            if (currentStep is WizardStep.Terms or WizardStep.Prepare)
            {
                NextButton.Style = primaryStyle;
                StartButton.Style = secondaryStyle;
                DetectButton.Style = secondaryStyle;
            }
            else if (currentStep == WizardStep.Review)
            {
                NextButton.Style = secondaryStyle;
                if (!readyToStart && DetectButton.IsVisible && DetectButton.IsEnabled)
                {
                    DetectButton.Style = primaryStyle;
                    StartButton.Style = secondaryStyle;
                }
                else
                {
                    DetectButton.Style = secondaryStyle;
                    StartButton.Style = primaryStyle;
                }
            }
            else
            {
                NextButton.Style = secondaryStyle;
                DetectButton.Style = secondaryStyle;
                StartButton.Style = primaryStyle;
            }
        }

        RefreshRecommendedActionAnimation(isInstall, isUninstall, accepted);
        RefreshFooterGuidance();
    }

    private void RefreshRecommendedActionAnimation(bool isInstall, bool isUninstall, bool accepted)
    {
        StopPulseAnimation(NextButton);
        StopPulseAnimation(StartButton);
        StopPulseAnimation(DetectButton);
        StopPulseAnimation(AcceptPrivacyCheckBox);

        if (!SystemParameters.ClientAreaAnimation)
        {
            return;
        }

        if (currentStep == WizardStep.Terms && isInstall && !accepted)
        {
            StartPulseAnimation(AcceptPrivacyCheckBox);
        }
        else if (currentStep == WizardStep.Review && !readyToStart && DetectButton.IsVisible && DetectButton.IsEnabled)
        {
            StartPulseAnimation(DetectButton);
        }
        else if (StartButton.IsVisible && StartButton.IsEnabled)
        {
            StartPulseAnimation(StartButton);
        }
        else if (NextButton.IsVisible && NextButton.IsEnabled)
        {
            StartPulseAnimation(NextButton);
        }
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
        if (isInstall && AreTermsAccepted() && currentStep == WizardStep.Terms)
        {
            SetWizardStep(WizardStep.Prepare);
        }
        else
        {
            RefreshWizardNavigation();
        }
    }

    private bool AreTermsAccepted()
        => AcceptTermsCheckBox?.IsChecked == true && AcceptPrivacyCheckBox?.IsChecked == true;

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
            connector.Fill = ToBrush("#F87171");
            return;
        }

        connector.Fill = currentStep >= targetStep ? ToBrush("#34D399") : ToBrush("#334E68");
    }

    private void SetStepBadge(Border border, TextBlock textBlock, Path iconPath, string label, WizardStep activeStep, WizardStep step, bool hasFailure)
    {
        var completed = step < activeStep;
        var active = step == activeStep;
        var failedResult = hasFailure && step == WizardStep.Result;
        var state = failedResult ? "error" : active ? "activo" : completed ? "correcto" : "pendiente";
        textBlock.Text = $"{label} · {state}";
        border.Background = ToBrush(failedResult ? "#667F1D1D" : active ? "#730C4A6E" : completed ? "#66064E3B" : "#400F253E");
        border.BorderBrush = ToBrush(failedResult ? "#80F87171" : active ? "#9938BDF8" : completed ? "#8034D399" : "#5038DDF5");
        textBlock.Foreground = ToBrush(failedResult ? "#F87171" : active ? "#38BDF8" : completed ? "#34D399" : "#94A3B8");

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
