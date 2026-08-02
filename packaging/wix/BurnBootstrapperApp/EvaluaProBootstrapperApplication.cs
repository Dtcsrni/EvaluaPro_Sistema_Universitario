using System.Diagnostics;
using System.ComponentModel;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Threading;
using WixToolset.BootstrapperApplicationApi;

namespace EvaluaPro.BurnBootstrapperApp;

internal sealed class EvaluaProBootstrapperApplication : BootstrapperApplication
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };
    private const string HelperProgressPrefix = "EVALUAPRO_PROGRESS:";
    private const string StageDetection = "detection";
    private const string StageRemediation = "remediation";
    private const string StagePlanning = "planning";
    private const string StageMsi = "msi";
    private const string StagePostInstall = "postinstall";
    private const string StageFinalize = "finalize";
    private const string HubSingletonMutexName = @"Global\EvaluaProInstallerHubSingleton";

    private readonly object sync = new();
    private readonly TaskCompletionSource<bool> uiReady = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource<int> operationFinished = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly List<InstallerStageState> workflowStages = CreateDefaultWorkflowStages();

    private IEngine? engineHandle;
    private IBootstrapperCommand? command;
    private MainWindow? window;
    private Thread? uiThread;
    private Mutex? hubSingletonMutex;
    private bool ownsHubSingleton;
    private string payloadRoot = string.Empty;
    private string sessionRoot = string.Empty;
    private string sessionLogPath = string.Empty;
    private string requestRoot = string.Empty;
    private string resumeStatePath = string.Empty;
    private bool headless;
    private bool burnDetectionComplete;
    private bool helperDetectionComplete;
    private bool startRequested;
    private bool applyInFlight;
    private bool helperInFlight;
    private bool helperDetectionLogsFlushed;
    private bool autoRemediationInFlight;
    private bool autoRemediationAttempted;
    private bool autoResumeRequested;
    private bool applySawPackageFailure;
    private int requestedExitCode;
    private int? lastFailedPackageStatus;
    private string currentOperation = "install";
    private string? lastFailedPackageId;
    private DetectionPayload? detectionPayload;
    private HelperEnvelope<DetectionPayload>? helperDetectionResponse;
    private BootstrapperRequest? currentRequest;
    private FailureDisplay? failureDisplay;
    private ResumeState? resumeState;
    private bool msiInstalled;

    protected override void Run()
    {
        var exitCode = operationFinished.Task.GetAwaiter().GetResult();
        engineHandle?.Quit(exitCode);

        if (uiThread is { IsAlive: true })
        {
            uiThread.Join(TimeSpan.FromSeconds(2));
        }

        ReleaseUiSingleton();
    }

    protected override void OnCreate(CreateEventArgs args)
    {
        base.OnCreate(args);

        engineHandle = args.Engine;
        command = args.Command;
        payloadRoot = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        InitializeSessionPaths();
        resumeState = TryLoadResumeState();
        autoResumeRequested = resumeState?.AutoStart == true;
        if (autoResumeRequested)
        {
            Log("info", $"Resume detectado. flavor={resumeState?.FlavorId} phase={resumeState?.RemediationPhase} token={resumeState?.ResumeToken}");
            if (!string.IsNullOrWhiteSpace(resumeState?.InstallDir))
            {
                Environment.SetEnvironmentVariable("EVALUAPRO_BURN_INSTALLDIR", resumeState?.InstallDir);
            }
            if (!string.IsNullOrWhiteSpace(resumeState?.FlavorId))
            {
                Environment.SetEnvironmentVariable("EVALUAPRO_FLAVOR_ID", resumeState?.FlavorId);
            }
        }
        Log("info", $"Burn bootstrapper iniciado. Action={command?.Action} Display={command?.Display}");

        // Burn puede lanzar instancias secundarias en modo Embedded (por ejemplo,
        // para transacciones relacionadas de uninstall/upgrade). Esas instancias no
        // deben abrir otra ventana del Hub.
        headless =
            command?.Display == Display.None
            || command?.Display == Display.Embedded
            || IsTruthy(Environment.GetEnvironmentVariable("EVALUAPRO_BURN_HEADLESS"));

        if (!headless && !TryAcquireUiSingleton())
        {
            Log("warn", "Instancia adicional detectada: se mantiene singleton y se enfoca la ventana existente.");
            FocusExistingHubWindow();
            operationFinished.TrySetResult(0);
            return;
        }

        if (!headless)
        {
            StartUiThread();
        }

        _ = RunHelperDetectionAsync();
        engineHandle?.Detect();
    }

    protected override void OnDetectComplete(DetectCompleteEventArgs args)
    {
        base.OnDetectComplete(args);
        burnDetectionComplete = true;
        Log(args.Status == 0 ? "info" : "error", $"DetectComplete status={args.Status}");
        EvaluateDetectionState();
    }

    protected override void OnDetectPackageComplete(DetectPackageCompleteEventArgs args)
    {
        base.OnDetectPackageComplete(args);
        if (args.PackageId == "EvaluaProMsi")
        {
            msiInstalled = args.State == PackageState.Present;
            Log("info", $"DetectPackageComplete package=EvaluaProMsi state={args.State} msiInstalled={msiInstalled}");
        }
    }

    protected override void OnPlanComplete(PlanCompleteEventArgs args)
    {
        base.OnPlanComplete(args);
        if (args.Status != 0)
        {
            SetStageState(StagePlanning, InstallerStageStatus.Error, "La planificación del bundle falló.", FormatWindowsStatus(args.Status));
            FinalizeFailure("accion_producto", 30, $"La planificacion del bundle fallo con status={args.Status}.");
            return;
        }

        applySawPackageFailure = false;
        lastFailedPackageStatus = null;
        lastFailedPackageId = null;
        applyInFlight = true;
        SetStageState(StagePlanning, InstallerStageStatus.Ok, "Planificación completada.", "El bundle ya comenzó la transacción principal.");
        SetStageState(StageMsi, InstallerStageStatus.Running, "Ejecutando MSI principal.", $"La {GetOperationNoun()} base de EvaluaPro está en progreso.");
        UpdateUiState(statusText: $"{GetOperationProgressVerb()} componentes de EvaluaPro. Esto puede tardar algunos minutos...", progress: 0, busy: true);
        engineHandle?.Apply(GetWindowHandle());
    }

    protected override void OnProgress(ProgressEventArgs args)
    {
        base.OnProgress(args);
        SetStageState(StageMsi, InstallerStageStatus.Running, $"Ejecutando MSI principal ({Math.Max(0, Math.Min(100, args.OverallPercentage))}%).", $"La {GetOperationNoun()} base de EvaluaPro sigue en progreso.");
        UpdateUiState(statusText: $"{GetOperationProgressVerb()} componentes... {Math.Max(0, Math.Min(100, args.OverallPercentage))}%", progress: args.OverallPercentage, busy: true);
    }

    protected override void OnExecutePackageComplete(ExecutePackageCompleteEventArgs args)
    {
        base.OnExecutePackageComplete(args);
        if (IsSuccessStatus(args.Status))
        {
            Log("info", $"ExecutePackageComplete package={args.PackageId} status={args.Status}");
            return;
        }

        applySawPackageFailure = true;
        lastFailedPackageStatus ??= args.Status;
        lastFailedPackageId ??= args.PackageId;
        SetStageState(StageMsi, InstallerStageStatus.Error, $"Falló el paquete MSI '{args.PackageId}'.", FormatWindowsStatus(args.Status));
        Log("warn", $"ExecutePackageComplete package={args.PackageId} status={args.Status} ({FormatWindowsStatus(args.Status)})");
    }

    protected override void OnApplyComplete(ApplyCompleteEventArgs args)
    {
        base.OnApplyComplete(args);
        applyInFlight = false;

        if (!IsSuccessStatus(args.Status))
        {
            var wixMsiLogPath = ReadEngineVariableString("WixBundleLog_EvaluaProMsi");
            var parsedReason = TryExtractMsiFailureReason(wixMsiLogPath);
            var failureMessage = parsedReason ?? "El MSI devolvió un error fatal.";
            failureDisplay = BuildFailureDisplay(
                "Fallo en la ejecución MSI",
                lastFailedPackageId ?? "EvaluaProMsi",
                args.Status,
                wixMsiLogPath,
                sessionLogPath,
                failureMessage);
            SetStageState(StageMsi, InstallerStageStatus.Error, "La ejecución MSI falló.", failureMessage);
            SetStageState(StageFinalize, InstallerStageStatus.Error, "La operación terminó con error.", "La transacción MSI no pudo completarse.");
            var detail = $"La ejecucion del bundle fallo con status={args.Status} ({FormatWindowsStatus(args.Status)}).";
            if (applySawPackageFailure && !string.IsNullOrWhiteSpace(lastFailedPackageId) && lastFailedPackageStatus.HasValue)
            {
                detail += $" Ultimo paquete con error: {lastFailedPackageId} ({lastFailedPackageStatus.Value}, {FormatWindowsStatus(lastFailedPackageStatus.Value)}).";
            }
            if (!string.IsNullOrWhiteSpace(wixMsiLogPath))
            {
                detail += $" Log MSI: {wixMsiLogPath}.";
            }
            if (!string.IsNullOrWhiteSpace(parsedReason))
            {
                detail += $" Motivo visible: {parsedReason}.";
            }
            detail += $" Revisa log BA: {sessionLogPath}";
            FinalizeFailure("accion_producto", 30, detail);
            return;
        }

        SetStageState(StageMsi, InstallerStageStatus.Ok, "MSI completado.", $"La {GetOperationNoun()} base terminó y continúa la verificación final.");
        SetStageState(StagePostInstall, InstallerStageStatus.Running, GetPostOperationStageTitle(), GetPostOperationStageDetail());
        UpdateUiState(statusText: $"{GetOperationProgressVerb()} componentes. Ejecutando verificación final...", progress: 95, busy: true);
        _ = RunPostInstallHelperAsync();
    }

    private void InitializeSessionPaths()
    {
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "EvaluaPro", "installer-hub", "logs");
        Directory.CreateDirectory(root);
        resumeStatePath = Path.Combine(Path.GetDirectoryName(root) ?? root, "resume-state.json");
        var sessionId = $"burn-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}".ToLowerInvariant();
        sessionRoot = Path.Combine(root, sessionId);
        Directory.CreateDirectory(sessionRoot);
        requestRoot = Path.Combine(sessionRoot, "requests");
        Directory.CreateDirectory(requestRoot);
        sessionLogPath = Path.Combine(sessionRoot, "burn-bootstrapper.log");
    }

    private void StartUiThread()
    {
        uiThread = new Thread(() =>
        {
            try
            {
                var application = new Application
                {
                    ShutdownMode = ShutdownMode.OnMainWindowClose
                };

                application.DispatcherUnhandledException += (_, eventArgs) =>
                {
                    Log("error", $"UI DispatcherUnhandledException: {eventArgs.Exception}");
                    if (!headless)
                    {
                        MessageBox.Show(
                            $"Ocurrió un error inesperado en la interfaz:\n\n{eventArgs.Exception.Message}",
                            "Error de interfaz",
                            MessageBoxButton.OK,
                            MessageBoxImage.Warning);
                    }
                    eventArgs.Handled = true;
                    requestedExitCode = 50;
                    UpdateUiState(statusText: "El instalador detectó un error de UI. Revisa los logs.", busy: false);
                };

                AppDomain.CurrentDomain.UnhandledException += (_, eventArgs) =>
                {
                    var exception = eventArgs.ExceptionObject as Exception;
                    var msg = exception?.Message ?? eventArgs.ExceptionObject?.ToString() ?? "Desconocido";
                    Log("error", $"UI UnhandledException: {msg}");
                    if (!headless)
                    {
                        MessageBox.Show(
                            $"Ocurrió un error no controlado en el instalador:\n\n{msg}",
                            "Error crítico no controlado",
                            MessageBoxButton.OK,
                            MessageBoxImage.Error);
                    }
                    requestedExitCode = 50;
                };

                var createdWindow = new MainWindow();
                var availableFlavors = LoadFlavorItems();
                createdWindow.ConfigureInitialFlavorLayout(availableFlavors, ResolveRequestedFlavorId());
                createdWindow.DetectRequested += (_, _) => _ = RunHelperDetectionAsync(force: true);
                createdWindow.ModeChanged += (_, args) =>
                {
                    if (applyInFlight || helperInFlight || startRequested)
                    {
                        return;
                    }

                    currentOperation = NormalizeMode(args.Mode);
                    RenderWorkflow();
                };
                createdWindow.StartRequested += (_, request) => _ = StartBundleOperationAsync(request);
                createdWindow.CloseRequested += (_, _) => RequestQuit();
                createdWindow.RestartRequested += (_, _) => RequestSystemRestart();
                createdWindow.LaunchRequested += (_, _) => LaunchInstalledEvaluaPro();
                createdWindow.ClosingRequestedDuringBusy += (_, _) => Log("warn", "Se intento cerrar la ventana durante una operacion en progreso.");

                window = createdWindow;
                createdWindow.Loaded += (_, _) =>
                {
                    Log("info", "UI Loaded");
                    uiReady.TrySetResult(true);
                };
                createdWindow.Closed += (_, _) =>
                {
                    Log("info", "UI Closed");
                    if (!operationFinished.Task.IsCompleted)
                    {
                        operationFinished.TrySetResult(requestedExitCode);
                    }

                    Dispatcher.CurrentDispatcher.BeginInvokeShutdown(DispatcherPriority.Background);
                };

                RenderWorkflow("Inicializando Installer Hub...", "Preparando la detección inicial de prerequisitos.");
                application.Run(createdWindow);
            }
            catch (Exception ex)
            {
                Log("error", $"StartUiThread fatal exception: {ex}");
                try
                {
                    var fatalPath = Path.Combine(Path.GetTempPath(), "EvaluaPro-InstallerHub-fatal.log");
                    File.WriteAllText(fatalPath, $"{DateTimeOffset.UtcNow:u}{Environment.NewLine}{ex}", Encoding.UTF8);
                }
                catch
                {
                    // La traza de diagnóstico no debe ocultar ni reemplazar el error original.
                }
                if (!headless)
                {
                    MessageBox.Show(
                        $"El instalador detectó un error crítico y no puede continuar.\n\nDetalle: {ex.Message}\n\nRevisa los logs para más detalles.",
                        "Error fatal de EvaluaPro Installer Hub",
                        MessageBoxButton.OK,
                        MessageBoxImage.Error);
                }
                requestedExitCode = 50;
                operationFinished.TrySetResult(requestedExitCode);
            }
        });

        uiThread.SetApartmentState(ApartmentState.STA);
        uiThread.IsBackground = true;
        uiThread.Start();
    }

    private void LaunchInstalledEvaluaPro()
    {
        var installDir = currentRequest?.InstallDir;
        if (string.IsNullOrWhiteSpace(installDir))
        {
            Log("warn", "No se pudo iniciar EvaluaPro: ruta instalada vacía.");
            return;
        }

        var launcher = Path.Combine(installDir, "scripts", "launcher-broker.ps1");
        if (!File.Exists(launcher))
        {
            Log("warn", $"No se pudo iniciar EvaluaPro: falta {launcher}.");
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = Environment.GetEnvironmentVariable("ComSpec") ?? "powershell.exe",
                Arguments = $"/c powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"{launcher}\" -Action open-dashboard -Mode prod",
                WorkingDirectory = installDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            });
            Log("info", $"EvaluaPro solicitado desde la pantalla final: {installDir}");
        }
        catch (Exception ex)
        {
            Log("error", $"No se pudo iniciar EvaluaPro desde el Hub: {ex.Message}");
        }
    }

    private static List<InstallerStageState> CreateDefaultWorkflowStages()
    {
        return
        [
            new InstallerStageState(StageDetection, "Detección", "Pendiente de iniciar."),
            new InstallerStageState(StageRemediation, "Remediación de prerequisitos", "Solo se ejecuta si hace falta."),
            new InstallerStageState(StagePlanning, "Planificación", "Aún no se solicitó la operación."),
            new InstallerStageState(StageMsi, "Ejecución MSI", "Esperando la transacción del MSI."),
            new InstallerStageState(StagePostInstall, "Configuración final", "Esperando verificación o configuración final."),
            new InstallerStageState(StageFinalize, "Finalización", "Pendiente de terminar.")
        ];
    }

    private void ResetWorkflow(bool keepDetectionStage = false)
    {
        foreach (var stage in workflowStages)
        {
            stage.State = InstallerStageStatus.Pending;
            stage.Summary = stage.Id == StageDetection && keepDetectionStage
                ? "Detección lista."
                : stage.Id == StageRemediation
                    ? "Solo se ejecuta si hace falta."
                    : stage.Id == StagePlanning
                        ? "Aún no se solicitó la operación."
                        : stage.Id == StageMsi
                            ? "Esperando la transacción del MSI."
                            : stage.Id == StagePostInstall
                                ? "Esperando verificación o configuración final."
                                : "Pendiente de terminar.";
            stage.Detail = string.Empty;
        }

        if (keepDetectionStage)
        {
            var detection = workflowStages.First(stage => stage.Id == StageDetection);
            detection.State = InstallerStageStatus.Ok;
        }

        failureDisplay = null;
        RenderWorkflow();
    }

    private void SetStageState(string stageId, InstallerStageStatus state, string summary, string? detail = null)
    {
        var stage = workflowStages.FirstOrDefault(item => item.Id == stageId);
        if (stage is null)
        {
            return;
        }

        stage.State = state;
        stage.Summary = summary;
        stage.Detail = detail ?? string.Empty;
        RenderWorkflow();
    }

    private void RenderWorkflow(string? overrideStatusText = null, string? overrideHint = null)
    {
        if (headless)
        {
            return;
        }

        var runningStage = workflowStages.FirstOrDefault(stage => stage.State == InstallerStageStatus.Running);
        var failedStage = workflowStages.FirstOrDefault(stage => stage.State == InstallerStageStatus.Error);
        var currentStage = failedStage
            ?? runningStage
            ?? workflowStages.LastOrDefault(stage => stage.State == InstallerStageStatus.Ok)
            ?? workflowStages.First();

        var finalizeStageOk = workflowStages.FirstOrDefault(stage => stage.Id == StageFinalize)?.State == InstallerStageStatus.Ok;
        var prerequisitesReady =
            workflowStages.FirstOrDefault(stage => stage.Id == StageDetection)?.State == InstallerStageStatus.Ok &&
            workflowStages.FirstOrDefault(stage => stage.Id == StageRemediation)?.State == InstallerStageStatus.Ok;

        var severity = failedStage is not null
            ? InstallerUiSeverity.Error
            : runningStage is not null
                ? InstallerUiSeverity.Active
                : finalizeStageOk || prerequisitesReady
                    ? InstallerUiSeverity.Success
                    : InstallerUiSeverity.Warning;

        var view = new InstallerWorkflowView
        {
            BadgeText = severity switch
            {
                InstallerUiSeverity.Error => "Estado con error",
                InstallerUiSeverity.Success => "Estado completado",
                InstallerUiSeverity.Warning => "Estado pendiente",
                _ => "Estado activo"
            },
            StatusText = overrideStatusText ?? currentStage.Summary,
            HintText = overrideHint ?? BuildHintText(severity, currentStage),
            HeaderBackground = severity switch
            {
                InstallerUiSeverity.Error => "#B4234D",
                InstallerUiSeverity.Success => "#087F66",
                InstallerUiSeverity.Warning => "#7A4B0A",
                _ => "#0B7285"
            },
            HeaderForeground = "#F8FAFC",
            SummaryBackground = severity switch
            {
                InstallerUiSeverity.Error => "#4A1D2B",
                InstallerUiSeverity.Success => "#123F35",
                InstallerUiSeverity.Warning => "#4A3213",
                _ => "#123E53"
            },
            SummaryBorder = severity switch
            {
                InstallerUiSeverity.Error => "#F08AA7",
                InstallerUiSeverity.Success => "#64D8BA",
                InstallerUiSeverity.Warning => "#F2B84B",
                _ => "#55D6ED"
            },
            SummaryForeground = severity switch
            {
                InstallerUiSeverity.Error => "#FFE8EE",
                InstallerUiSeverity.Success => "#D8FFF1",
                InstallerUiSeverity.Warning => "#FFF1C7",
                _ => "#E6FAFF"
            },
            StageBodyForeground = severity switch
            {
                InstallerUiSeverity.Error => "#FFD6E2",
                InstallerUiSeverity.Success => "#C4F5E4",
                InstallerUiSeverity.Warning => "#FFE5A3",
                _ => "#CBEFFF"
            },
            WorkflowTitle = $"Trazabilidad y progreso · {GetOperationTitle()}",
            WorkflowHint = GetWorkflowHint(),
            SummaryBadge = runningStage is not null
                ? "En curso"
                : failedStage is not null
                    ? "Fallo detectado"
                    : finalizeStageOk || prerequisitesReady
                        ? "Completado"
                        : "Pendiente",
            CurrentStageTitle = $"Etapa destacada: {GetStageDisplayLabel(currentStage.Id)}",
            CurrentStageText = string.IsNullOrWhiteSpace(currentStage.Detail)
                ? currentStage.Summary
                : $"{currentStage.Summary} {currentStage.Detail}".Trim(),
            Stages = workflowStages.Select(MapStageToView).ToList(),
            ShowFailureSummary = failureDisplay is not null,
            FailureTitle = failureDisplay?.Title ?? "Resumen de error",
            FailureText = failureDisplay?.Body ?? string.Empty
        };

        DispatchToUi(() => window?.UpdateWorkflow(view));
    }

    private static string BuildHintText(InstallerUiSeverity severity, InstallerStageState currentStage)
    {
        return severity switch
        {
            InstallerUiSeverity.Error => "La operación se detuvo. Revisa el resumen de error y usa las rutas de log mostradas.",
            InstallerUiSeverity.Success => "Todas las etapas terminaron correctamente.",
            InstallerUiSeverity.Warning => "El asistente todavía no ha ejecutado la operación o requiere una nueva acción manual.",
            _ => $"Etapa activa: {currentStage.Label}."
        };
    }

    private InstallerStageView MapStageToView(InstallerStageState stage)
    {
        return stage.State switch
        {
            InstallerStageStatus.Running => new InstallerStageView
            {
                Label = GetStageDisplayLabel(stage.Id),
                Badge = "ACTIVA",
                Summary = stage.Summary,
                Detail = stage.Detail,
                Background = "#123E53",
                Border = "#55D6ED",
                Foreground = "#E6FAFF"
            },
            InstallerStageStatus.Ok => new InstallerStageView
            {
                Label = GetStageDisplayLabel(stage.Id),
                Badge = "OK",
                Summary = stage.Summary,
                Detail = stage.Detail,
                Background = "#123F35",
                Border = "#64D8BA",
                Foreground = "#D8FFF1"
            },
            InstallerStageStatus.Error => new InstallerStageView
            {
                Label = GetStageDisplayLabel(stage.Id),
                Badge = "ERROR",
                Summary = stage.Summary,
                Detail = stage.Detail,
                Background = "#4A1D2B",
                Border = "#F08AA7",
                Foreground = "#FFE8EE"
            },
            _ => new InstallerStageView
            {
                Label = GetStageDisplayLabel(stage.Id),
                Badge = "PENDIENTE",
                Summary = stage.Summary,
                Detail = stage.Detail,
                Background = "#172A3E",
                Border = "#6E8BA6",
                Foreground = "#D7E6F5"
            }
        };
    }

    private async Task RunHelperDetectionAsync(bool force = false)
    {
        try
        {
            if (!headless)
            {
                await uiReady.Task.ConfigureAwait(false);
            }

            if (helperDetectionComplete && !force)
            {
                return;
            }

            if (force)
            {
                autoRemediationInFlight = false;
                autoRemediationAttempted = false;
                ResetWorkflow();
            }

            SetStageState(StageDetection, InstallerStageStatus.Running, "Analizando prerequisitos del equipo.", "Validando flavor, runtime y rutas de instalación.");
            UpdateUiState(statusText: "Analizando prerequisitos...", busy: true);
            var request = new Dictionary<string, object?>
            {
                ["flavorId"] = ResolveRequestedFlavorId(),
                ["installDir"] = Environment.GetEnvironmentVariable("EVALUAPRO_BURN_INSTALLDIR") ?? string.Empty
            };

            var response = await InvokeHelperAsync<DetectionPayload>("detect-prereqs", request).ConfigureAwait(false);
            helperDetectionResponse = response;
            helperDetectionLogsFlushed = false;
            detectionPayload = response.Data;
            helperDetectionComplete = true;
            EvaluateDetectionState();
        }
        catch (Exception ex)
        {
            SetStageState(StageDetection, InstallerStageStatus.Error, "La detección de prerequisitos falló.", ex.Message);
            helperDetectionComplete = true;
            FinalizeFailure("analisis_requisitos", 10, $"Fallo la deteccion de prerequisitos: {ex.Message}");
        }
    }

    private void EvaluateDetectionState()
    {
        if (!burnDetectionComplete || !helperDetectionComplete)
        {
            return;
        }

        if (helperDetectionResponse is null || !helperDetectionResponse.Ok || detectionPayload is null)
        {
            FinalizeFailure("analisis_requisitos", 10, helperDetectionResponse?.Message ?? "No se pudo obtener el estado de prerequisitos.");
            return;
        }

        UpdateWindowFromDetection(detectionPayload);
        DispatchToUi(() => window?.NotifyInitialDetectionCompleted());

        var effectiveMode = ResolveDetectedOperationMode(detectionPayload);
        if (!detectionPayload.Ready && effectiveMode != "uninstall")
        {
            if (!headless && !startRequested && !autoRemediationAttempted && !autoRemediationInFlight)
            {
                _ = RunAutomaticRemediationFromDetectionAsync();
            }
            return;
        }

        SetStageState(StageRemediation, InstallerStageStatus.Ok, "No fue necesaria la remediación automática.", string.Empty);
        UpdateUiState(statusText: "Prerequisitos verificados.", busy: false);
        DispatchToUi(() => window?.SetRestartActionVisible(false));

        if (headless && !startRequested)
        {
            _ = StartBundleOperationAsync(BuildHeadlessRequest(detectionPayload));
            return;
        }

        if (autoResumeRequested && !startRequested)
        {
            _ = StartBundleOperationAsync(BuildHeadlessRequest(detectionPayload));
        }
    }

    private string ResolveDetectedOperationMode(DetectionPayload payload)
    {
        return NormalizeMode(command?.Action switch
        {
            LaunchAction.Repair => "repair",
            LaunchAction.Uninstall or LaunchAction.UnsafeUninstall => "uninstall",
            _ => msiInstalled ? "repair" : payload.RecommendedMode
        });
    }

    private BootstrapperRequest BuildHeadlessRequest(DetectionPayload payload)
    {
        var productName = payload.Flavor?.ProductName ?? "EvaluaPro";
        var installFolderName = payload.Flavor?.InstallFolderName ?? productName;
        var installDir = Environment.GetEnvironmentVariable("EVALUAPRO_BURN_INSTALLDIR");
        if (string.IsNullOrWhiteSpace(installDir))
        {
            installDir = payload.Installation?.InstallLocation;
        }

        // El flavor nativo docente nunca debe reutilizar una instalación per-machine
        // detectada en Program Files; esa ruta puede ser un remanente de una versión
        // anterior y provocaría que Burn omita o redirija el payload local.
        if (string.Equals(payload.Flavor?.FlavorId, "docente-local", StringComparison.OrdinalIgnoreCase))
        {
            var docenteRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                installFolderName);
            if (string.IsNullOrWhiteSpace(installDir)
                || !string.Equals(
                    Path.GetFullPath(installDir).TrimEnd(Path.DirectorySeparatorChar),
                    Path.GetFullPath(docenteRoot).TrimEnd(Path.DirectorySeparatorChar),
                    StringComparison.OrdinalIgnoreCase))
            {
                installDir = docenteRoot;
            }
        }

        if (string.IsNullOrWhiteSpace(installDir))
        {
            installDir = Path.Combine(
                string.Equals(payload.Flavor?.FlavorId, "docente-local", StringComparison.OrdinalIgnoreCase)
                    ? Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)
                    : Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                installFolderName);
        }

        var requireLicense = IsTruthy(Environment.GetEnvironmentVariable("EVALUAPRO_REQUIRE_LICENSE_ACTIVATION"));
        var tenantId = Environment.GetEnvironmentVariable("EVALUAPRO_LICENSE_TENANT_ID") ?? string.Empty;
        var activationCode = Environment.GetEnvironmentVariable("EVALUAPRO_LICENSE_ACTIVATION_CODE") ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(tenantId) && !string.IsNullOrWhiteSpace(activationCode))
        {
            requireLicense = true;
        }

        return new BootstrapperRequest
        {
            FlavorId = payload.Flavor?.FlavorId ?? "docente-local",
            Mode = !string.IsNullOrWhiteSpace(resumeState?.Mode)
                ? NormalizeMode(resumeState.Mode)
                : NormalizeMode(command?.Action switch
                {
                    LaunchAction.Repair => "repair",
                    LaunchAction.Uninstall or LaunchAction.UnsafeUninstall => "uninstall",
                    _ => msiInstalled ? "repair" : payload.RecommendedMode
                }),
            InstallDir = installDir,
            InstallDesktopShortcuts = !IsFalsy(Environment.GetEnvironmentVariable("EVALUAPRO_INSTALL_DESKTOP_SHORTCUTS")),
            InstallStartMenuShortcuts = !IsFalsy(Environment.GetEnvironmentVariable("EVALUAPRO_INSTALL_STARTMENU_SHORTCUTS")),
            DatabaseUrl = Environment.GetEnvironmentVariable("EVALUAPRO_DATABASE_URL") ?? "file:C:/ProgramData/EvaluaPro/data/evaluapro.db",
            NodeEnv = Environment.GetEnvironmentVariable("EVALUAPRO_NODE_ENV") ?? "production",
            ApiPort = Environment.GetEnvironmentVariable("EVALUAPRO_API_PORT") ?? "4000",
            PortalPort = Environment.GetEnvironmentVariable("EVALUAPRO_PORTAL_PORT") ?? "4518",
            CorsOrigins = Environment.GetEnvironmentVariable("EVALUAPRO_CORS_ORIGINS") ?? "http://localhost:4173,http://127.0.0.1:4173",
            PortalAlumnoUrl = Environment.GetEnvironmentVariable("EVALUAPRO_PORTAL_ALUMNO_URL") ?? string.Empty,
            PortalApiKey = Environment.GetEnvironmentVariable("EVALUAPRO_PORTAL_API_KEY") ?? "portal-key-shared",
            PasswordResetEnabled = IsTruthy(Environment.GetEnvironmentVariable("EVALUAPRO_PASSWORD_RESET_ENABLED")),
            PasswordResetUrlBase = Environment.GetEnvironmentVariable("EVALUAPRO_PASSWORD_RESET_URL_BASE") ?? string.Empty,
            RequireLicenseActivation = requireLicense,
            LicenseApiBaseUrl = Environment.GetEnvironmentVariable("EVALUAPRO_LICENSE_API_BASE_URL") ?? string.Empty,
            TenantId = tenantId,
            ActivationCode = activationCode,
            LicenseAccountEmail = Environment.GetEnvironmentVariable("EVALUAPRO_LICENSE_ACCOUNT_EMAIL") ?? "soporte@tu-institucion.mx",
            UpdateChannel = Environment.GetEnvironmentVariable("EVALUAPRO_UPDATE_CHANNEL") ?? "stable",
            UpdateOwner = Environment.GetEnvironmentVariable("EVALUAPRO_UPDATE_OWNER") ?? "Dtcsrni",
            UpdateRepo = Environment.GetEnvironmentVariable("EVALUAPRO_UPDATE_REPO") ?? "EvaluaPro_Sistema_Universitario",
            UpdateAssetName = payload.Flavor?.InstallerHubExeName ?? "EvaluaPro-InstallerHub-docente-local.exe",
            UpdateShaAssetName = string.Concat(payload.Flavor?.InstallerHubExeName ?? "EvaluaPro-InstallerHub-docente-local.exe", ".sha256")
        };
    }

    private async Task StartBundleOperationAsync(BootstrapperRequest request)
    {
        if (startRequested || engineHandle is null)
        {
            return;
        }

        var normalizedOperation = NormalizeMode(request.Mode);
        if (detectionPayload is { Ready: false } && normalizedOperation != "uninstall")
        {
            var remediationOk = await EnsurePrerequisitesReadyAsync(request.FlavorId, request.InstallDir, normalizedOperation).ConfigureAwait(false);
            if (!remediationOk)
            {
                return;
            }
        }
        else
        {
            SetStageState(StageRemediation, InstallerStageStatus.Ok, "No fue necesaria la remediación automática.", string.Empty);
        }

        startRequested = true;
        currentRequest = request;
        currentOperation = normalizedOperation;

        SetStageState(StagePlanning, InstallerStageStatus.Running, "Planificando la transacción del bundle.", "Preparando variables MSI y acción solicitada.");
        UpdateUiState(statusText: $"Planificando {GetOperationNoun()}...", progress: 0, busy: true);
        engineHandle.SetVariableString("InstallFolder", request.InstallDir, false);
        engineHandle.SetVariableString("SelectedFlavorId", request.FlavorId, false);
        engineHandle.SetVariableNumeric("InstallDesktopShortcuts", request.InstallDesktopShortcuts ? 1 : 0);
        engineHandle.SetVariableNumeric("InstallStartMenuShortcuts", request.InstallStartMenuShortcuts ? 1 : 0);
        Log(
            "info",
            $"Snapshot MSI vars: InstallFolder='{request.InstallDir}', SelectedFlavorId='{request.FlavorId}', " +
            $"InstallDesktopShortcuts={(request.InstallDesktopShortcuts ? 1 : 0)}, InstallStartMenuShortcuts={(request.InstallStartMenuShortcuts ? 1 : 0)}, " +
            "REQUIRE_INSTALLER_HUB=1 (Bundle->MsiProperty)");

        if (IsTruthy(Environment.GetEnvironmentVariable("EVALUAPRO_INSTALLER_UI_QA_NO_PRODUCT_ACTION")))
        {
            Log("warn", "UI QA mode activo: se simula la accion de producto sin ejecutar Burn Plan/Apply.");
            _ = SimulateUiQaProductActionAsync();
            return;
        }

        var action = currentOperation switch
        {
            "repair" => LaunchAction.Repair,
            "uninstall" => LaunchAction.Uninstall,
            _ => LaunchAction.Install
        };

        engineHandle.Plan(action);
    }

    private async Task SimulateUiQaProductActionAsync()
    {
        try
        {
            SetStageState(StagePlanning, InstallerStageStatus.Ok, "Planificacion simulada para QA UI.", "No se ejecuto la transaccion Burn/MSI.");
            SetStageState(StageMsi, InstallerStageStatus.Running, "Simulando ejecucion MSI para QA UI.", "Validando estado busy, progreso y bloqueo de cierre.");
            UpdateUiState(statusText: "Simulando accion de producto para QA UI...", progress: 25, busy: true);
            await Task.Delay(TimeSpan.FromSeconds(2)).ConfigureAwait(false);
            UpdateUiState(statusText: "Simulacion QA UI en progreso...", progress: 70, busy: true);
            await Task.Delay(TimeSpan.FromSeconds(2)).ConfigureAwait(false);
            SetStageState(StageMsi, InstallerStageStatus.Ok, "Ejecucion MSI simulada.", "El producto real no fue modificado.");
            SetStageState(StagePostInstall, InstallerStageStatus.Ok, "Verificacion final simulada.", "Contrato visual validado sin tocar la instalacion.");
            SetStageState(StageFinalize, InstallerStageStatus.Ok, "Operacion simulada finalizada.", "Cierra el asistente para terminar la prueba.");
            UpdateUiState(statusText: "Simulacion QA UI completada.", progress: 100, busy: false);
            DispatchToUi(() => window?.MarkCompleted(true, "Simulacion QA UI completada sin modificar el producto."));
            requestedExitCode = 0;
        }
        catch (Exception ex)
        {
            SetStageState(StageFinalize, InstallerStageStatus.Error, "La simulacion QA UI fallo.", ex.Message);
            FinalizeFailure("qa_ui", 50, $"Fallo la simulacion QA UI: {ex.Message}");
        }
    }

    private async Task RunAutomaticRemediationFromDetectionAsync()
    {
        if (autoRemediationInFlight || autoRemediationAttempted)
        {
            return;
        }

        var payload = detectionPayload;
        if (payload is null || payload.Ready)
        {
            return;
        }

        var mode = ResolveDetectedOperationMode(payload);
        if (mode == "uninstall")
        {
            return;
        }

        autoRemediationInFlight = true;
        autoRemediationAttempted = true;
        try
        {
            var installDir = payload.Installation?.InstallLocation;
            if (string.IsNullOrWhiteSpace(installDir))
            {
                installDir = Path.Combine(
                    string.Equals(payload.Flavor?.FlavorId, "docente-local", StringComparison.OrdinalIgnoreCase)
                        ? Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)
                        : Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                    payload.Flavor?.InstallFolderName ?? payload.Flavor?.ProductName ?? "EvaluaPro");
            }

            await EnsurePrerequisitesReadyAsync(payload.Flavor?.FlavorId ?? "docente-local", installDir, mode).ConfigureAwait(false);
        }
        finally
        {
            autoRemediationInFlight = false;
        }
    }

    private async Task<bool> EnsurePrerequisitesReadyAsync(string flavorId, string installDir, string operationMode)
    {
        try
        {
            ResetWorkflow(keepDetectionStage: true);
            SetStageState(StageRemediation, InstallerStageStatus.Running, "Resolviendo prerequisitos automáticamente.", "Preparando bootstrap guiado o semiautomático.");
            UpdateUiState(statusText: "Resolviendo prerequisitos automaticamente...", progress: 0, busy: true);
            Log("info", "Iniciando remediacion automatica de prerequisitos.");
            var remediationRequest = new Dictionary<string, object?>
            {
                ["flavorId"] = flavorId,
                ["installDir"] = installDir,
                ["autoRemediate"] = true
            };
            if (!string.IsNullOrWhiteSpace(resumeState?.ResumeToken))
            {
                remediationRequest["resumeToken"] = resumeState.ResumeToken;
            }
            var remediationResponse = await InvokeHelperAsync<DetectionPayload>(
                "detect-prereqs",
                remediationRequest,
                progressEvent =>
                {
                    var progressValue = Math.Max(0, Math.Min(100, progressEvent.Percent));
                    var statusText = string.IsNullOrWhiteSpace(progressEvent.Status)
                        ? "Resolviendo prerequisitos automaticamente..."
                        : progressEvent.Status;
                    SetStageState(StageRemediation, InstallerStageStatus.Running, "Resolviendo prerequisitos automáticamente.", statusText);
                    UpdateUiState(statusText: statusText, progress: progressValue, busy: true);
                }).ConfigureAwait(false);
            FlushHelperLogs(remediationResponse.Logs);
            helperDetectionLogsFlushed = true;
            helperDetectionResponse = remediationResponse;
            detectionPayload = remediationResponse.Data;
            SetStageState(StageRemediation, InstallerStageStatus.Ok, "Remediación concluida.", remediationResponse.Message ?? "Los prerequisitos ya se reevaluaron.");

            if (detectionPayload is not null)
            {
                UpdateWindowFromDetection(detectionPayload);
            }
        }
        catch (Exception ex)
        {
            SetStageState(StageRemediation, InstallerStageStatus.Error, "La remediación automática falló.", ex.Message);
            FinalizeFailure("prerequisitos", 10, $"No se pudo ejecutar la remediacion automatica de prerequisitos: {ex.Message}");
            return false;
        }

        if (detectionPayload?.Remediation?.RequiresRestart == true)
        {
            var restartMessage = detectionPayload.Remediation.RestartReason;
            if (string.IsNullOrWhiteSpace(restartMessage))
            {
                restartMessage = "La remediación automática requiere reiniciar Windows para continuar.";
            }
            PersistResumeState(
                flavorId,
                installDir,
                operationMode,
                detectionPayload.Remediation.ResumeToken,
                detectionPayload.Remediation.Phase,
                restartMessage);
            RegisterRunOnceForResume();
            SetStageState(StageRemediation, InstallerStageStatus.Pending, "Reinicio requerido para continuar automáticamente.", restartMessage);
            SetStageState(StageFinalize, InstallerStageStatus.Pending, "Pendiente de reinicio del sistema.", "Presiona \"Reiniciar ahora\" para reanudar la operación.");
            UpdateUiState(statusText: restartMessage, busy: false);
            DispatchToUi(() => window?.SetRestartActionVisible(true, restartMessage));
            requestedExitCode = 3010;
            Log("warn", restartMessage);
            return false;
        }

        if (detectionPayload is { Ready: false })
        {
            SetStageState(StageRemediation, InstallerStageStatus.Error, "La remediación terminó, pero el equipo sigue incompleto.", "Todavía falta una acción manual o un runtime válido.");
            FinalizeFailure("prerequisitos", 10, "El equipo no cumple los prerequisitos detectados por el bootstrapper.");
            return false;
        }

        DispatchToUi(() => window?.SetRestartActionVisible(false));

        return true;
    }

    private async Task RunPostInstallHelperAsync()
    {
        if (currentRequest is null)
        {
            FinalizeFailure("configuracion_operativa", 35, "No existe configuracion de solicitud para el helper post-install.");
            return;
        }

        try
        {
            helperInFlight = true;
            SetStageState(StagePostInstall, InstallerStageStatus.Running, GetPostOperationStageTitle(), GetPostOperationStageDetail());
            var requestObject = new Dictionary<string, object?>
            {
                ["mode"] = currentOperation,
                ["flavorId"] = currentRequest.FlavorId,
                ["installDir"] = currentRequest.InstallDir,
                ["exportData"] = currentRequest.ExportData ? "1" : "0",
                ["dataDir"] = Path.Combine(currentRequest.InstallDir, "data"),
                ["config"] = new Dictionary<string, object?>
                {
                    ["databaseUrl"] = currentRequest.DatabaseUrl,
                    ["nodeEnv"] = currentRequest.NodeEnv,
                    ["puertoApi"] = currentRequest.ApiPort,
                    ["puertoPortal"] = currentRequest.PortalPort,
                    ["corsOrigenes"] = currentRequest.CorsOrigins,
                    ["portalAlumnoUrl"] = currentRequest.PortalAlumnoUrl,
                    ["portalAlumnoApiKey"] = currentRequest.PortalApiKey,
                    ["portalApiKey"] = currentRequest.PortalApiKey,
                    ["passwordResetEnabled"] = currentRequest.PasswordResetEnabled ? "1" : "0",
                    ["passwordResetUrlBase"] = currentRequest.PasswordResetUrlBase,
                    ["requireLicenseActivation"] = currentRequest.RequireLicenseActivation ? "1" : "0",
                    ["apiComercialBaseUrl"] = currentRequest.LicenseApiBaseUrl,
                    ["tenantId"] = currentRequest.TenantId,
                    ["codigoActivacion"] = currentRequest.ActivationCode,
                    ["licenciaAccountEmail"] = currentRequest.LicenseAccountEmail,
                    ["flavorId"] = currentRequest.FlavorId,
                    ["updateChannel"] = currentRequest.UpdateChannel,
                    ["updateOwner"] = currentRequest.UpdateOwner,
                    ["updateRepo"] = currentRequest.UpdateRepo,
                    ["updateAssetName"] = currentRequest.UpdateAssetName,
                    ["updateShaAssetName"] = currentRequest.UpdateShaAssetName,
                    ["updateRequireSha256"] = "1"
                }
            };

            var helperMode = string.Equals(currentOperation, "uninstall", StringComparison.OrdinalIgnoreCase)
                ? "uninstall"
                : "post-install";
            var envelope = await InvokeHelperAsync<Dictionary<string, object?>>(
                helperMode,
                requestObject,
                onProgress: progressEvent =>
                {
                    var scaledProgress = 95 + (int)Math.Round((progressEvent.Percent / 100.0) * 4);
                    var currentText = string.IsNullOrWhiteSpace(progressEvent.Status) ? GetPostOperationStageDetail() : progressEvent.Status;
                    UpdateUiState(statusText: currentText, progress: Math.Min(99, Math.Max(95, scaledProgress)), busy: true);
                }).ConfigureAwait(false);
            helperInFlight = false;
            FlushHelperLogs(envelope.Logs);

            if (!envelope.Ok)
            {
                SetStageState(StagePostInstall, InstallerStageStatus.Error, GetPostOperationFailureTitle(), envelope.Message ?? "No se completó la verificación final.");
                FinalizeFailure(envelope.Phase ?? "helper_post_install", envelope.ExitCode == 0 ? 50 : envelope.ExitCode, envelope.Message ?? "El helper final devolvio error.");
                return;
            }

            SetStageState(StagePostInstall, InstallerStageStatus.Ok, GetPostOperationSuccessTitle(), envelope.Message ?? GetPostOperationSuccessDetail());
            SetStageState(StageFinalize, InstallerStageStatus.Ok, GetOperationCompletedTitle(), GetOperationCompletedDetail());
            UpdateUiState(statusText: GetOperationCompletedTitle(), progress: 100, busy: false);
            requestedExitCode = 0;
            ClearResumeState();

            foreach (var warning in envelope.Warnings ?? [])
            {
                Log("warn", warning);
            }

            if (headless)
            {
                operationFinished.TrySetResult(0);
                return;
            }

            DispatchToUi(() => window?.MarkCompleted(success: true, envelope.Message ?? "EvaluaPro listo para usarse."));
            ScheduleAutoCloseIfRequested();
        }
        catch (TimeoutException ex)
        {
            var detail = $"El helper final no respondio a tiempo. {ex.Message}";
            SetStageState(StagePostInstall, InstallerStageStatus.Error, GetPostOperationTimeoutTitle(), detail);
            FinalizeFailure("helper_timeout", 124, detail);
        }
        catch (InvalidOperationException ex)
        {
            var detail = $"No se pudo iniciar o completar la verificacion final. {ex.Message}";
            SetStageState(StagePostInstall, InstallerStageStatus.Error, GetPostOperationInitFailTitle(), detail);
            FinalizeFailure("helper_init_fail", 50, detail);
        }
        catch (Exception ex)
        {
            SetStageState(StagePostInstall, InstallerStageStatus.Error, GetPostOperationUnexpectedTitle(), ex.Message);
            FinalizeFailure("helper_unexpected", 50, $"Error inesperado en helper final: {ex.Message}");
        }
    }

    private string GetOperationNoun()
    {
        return currentOperation switch
        {
            "repair" => "reparación",
            "uninstall" => "desinstalación",
            _ => "instalación"
        };
    }

    private string GetOperationTitle()
    {
        return currentOperation switch
        {
            "repair" => "Reparación",
            "uninstall" => "Desinstalación",
            _ => "Instalación"
        };
    }

    private string GetWorkflowHint()
    {
        return currentOperation switch
        {
            "repair" => "La línea de tareas y el resumen reflejan la reparación seleccionada.",
            "uninstall" => "La línea de tareas y el resumen reflejan la desinstalación seleccionada.",
            _ => "La línea de tareas y el resumen reflejan la instalación seleccionada."
        };
    }

    private string GetStageDisplayLabel(string stageId)
    {
        return stageId switch
        {
            StagePlanning => currentOperation switch
            {
                "repair" => "Planificación de reparación",
                "uninstall" => "Planificación de desinstalación",
                _ => "Planificación de instalación"
            },
            StagePostInstall => currentOperation switch
            {
                "repair" => "Verificación final",
                "uninstall" => "Verificación de desinstalación",
                _ => "Configuración final"
            },
            StageFinalize => currentOperation switch
            {
                "repair" => "Finalización de reparación",
                "uninstall" => "Finalización de desinstalación",
                _ => "Finalización de instalación"
            },
            _ => stageId == StageMsi
                ? "Ejecución MSI"
                : stageId == StageRemediation
                    ? "Remediación de prerequisitos"
                    : "Detección"
        };
    }

    private string GetOperationProgressVerb()
    {
        return currentOperation switch
        {
            "repair" => "Reparando",
            "uninstall" => "Desinstalando",
            _ => "Instalando"
        };
    }

    private string GetOperationCompletedTitle()
    {
        return currentOperation switch
        {
            "repair" => "Reparación completada.",
            "uninstall" => "Desinstalación completada.",
            _ => "Instalación completada."
        };
    }

    private string GetOperationCompletedDetail()
    {
        return currentOperation switch
        {
            "repair" => "EvaluaPro quedó reparado y listo para usarse.",
            "uninstall" => "EvaluaPro quedó desinstalado correctamente.",
            _ => "EvaluaPro ya quedó listo para usarse."
        };
    }

    private string GetPostOperationStageTitle()
    {
        return currentOperation switch
        {
            "uninstall" => "Verificando desinstalación.",
            "repair" => "Ejecutando helper de reparación.",
            _ => "Ejecutando helper de post-instalación."
        };
    }

    private string GetPostOperationStageDetail()
    {
        return currentOperation switch
        {
            "uninstall" => "Verificando que el producto haya sido retirado y limpiando huellas residuales.",
            _ => "Aplicando configuración, verificación y endurecimiento final."
        };
    }

    private string GetPostOperationSuccessTitle()
    {
        return currentOperation switch
        {
            "uninstall" => "Desinstalación verificada.",
            "repair" => "Reparación completada.",
            _ => "Post-instalación completada."
        };
    }

    private string GetPostOperationSuccessDetail()
    {
        return currentOperation switch
        {
            "uninstall" => "El producto ya no aparece instalado.",
            "repair" => "EvaluaPro quedó configurado tras la reparación.",
            _ => "EvaluaPro quedó configurado."
        };
    }

    private string GetPostOperationFailureTitle()
    {
        return currentOperation switch
        {
            "uninstall" => "El helper de desinstalación devolvió error.",
            "repair" => "El helper de reparación devolvió error.",
            _ => "El helper post-instalación devolvió error."
        };
    }

    private string GetPostOperationTimeoutTitle()
    {
        return currentOperation switch
        {
            "uninstall" => "Timeout en verificación de desinstalación.",
            "repair" => "Timeout en helper de reparación.",
            _ => "Timeout en helper post-instalación."
        };
    }

    private string GetPostOperationInitFailTitle()
    {
        return currentOperation switch
        {
            "uninstall" => "Fallo al iniciar verificación de desinstalación.",
            "repair" => "Fallo al iniciar helper de reparación.",
            _ => "Fallo al iniciar helper post-instalación."
        };
    }

    private string GetPostOperationUnexpectedTitle()
    {
        return currentOperation switch
        {
            "uninstall" => "Error inesperado en verificación de desinstalación.",
            "repair" => "Error inesperado en reparación.",
            _ => "Error inesperado en post-instalación."
        };
    }

    private async Task<HelperEnvelope<TData>> InvokeHelperAsync<TData>(string mode, Dictionary<string, object?> request, Action<HelperProgressEvent>? onProgress = null)
    {
        Directory.CreateDirectory(requestRoot);
        var correlationId = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}";
        var requestPath = Path.Combine(requestRoot, $"{mode}-{correlationId}.request.json");
        var responsePath = Path.Combine(requestRoot, $"{mode}-{correlationId}.response.json");
        var scriptPath = Path.Combine(payloadRoot, "InstallerBurnHelper.ps1");

        await File.WriteAllTextAsync(requestPath, JsonSerializer.Serialize(request, JsonOptions), Encoding.UTF8).ConfigureAwait(false);
        Log("info", $"[helper:{mode}] correlacion={correlationId}");

        var stdoutLines = new List<string>();
        var stderrLines = new List<string>();
        using var process = StartPowerShellHelperProcess(mode, scriptPath, requestPath, responsePath, onProgress, stdoutLines, stderrLines);

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        try
        {
            using var timeoutCts = new CancellationTokenSource(GetHelperTimeout(mode));
            await process.WaitForExitAsync(timeoutCts.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!process.HasExited)
        {
            Log("error", $"Helper {mode} excedió el timeout; cancelando árbol pid={process.Id} request={requestPath} response={responsePath}.");
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch (Exception killException)
            {
                Log("warn", $"No se pudo cancelar completamente el árbol del helper {mode} pid={process.Id}: {killException.Message}");
            }

            try
            {
                await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5)).ConfigureAwait(false);
            }
            catch (Exception waitException)
            {
                Log("warn", $"El proceso del helper {mode} no confirmó salida tras la cancelación: {waitException.Message}");
            }

            throw new TimeoutException($"Helper {mode} excedió su timeout de {GetHelperTimeout(mode).TotalSeconds:0}s. request={requestPath} response={responsePath}");
        }
        var stdout = string.Join(Environment.NewLine, stdoutLines);
        var stderr = string.Join(Environment.NewLine, stderrLines);

        if (!string.IsNullOrWhiteSpace(stdout))
        {
            Log("info", $"[helper:{mode}:stdout] {TrimForLog(stdout)}");
        }

        if (!string.IsNullOrWhiteSpace(stderr))
        {
            var stderrLevel = process.ExitCode == 0 ? "info" : "warn";
            Log(stderrLevel, $"[helper:{mode}:stderr] {TrimForLog(stderr)}");
        }

        if (process.ExitCode != 0 && !File.Exists(responsePath))
        {
            throw new InvalidOperationException(
                $"Helper {mode} fallo sin generar respuesta JSON (exit={process.ExitCode}). stderr={TrimForLog(stderr)}");
        }

        try
        {
            return await WaitForResponseFileAsync<TData>(responsePath, TimeSpan.FromSeconds(20)).ConfigureAwait(false);
        }
        catch (TimeoutException) when (File.Exists(responsePath))
        {
            Log("warn", $"Helper {mode} genero archivo de respuesta pero no se pudo leer dentro de 20s. Reintentando 10s adicionales.");
            return await WaitForResponseFileAsync<TData>(responsePath, TimeSpan.FromSeconds(10)).ConfigureAwait(false);
        }
        catch (TimeoutException timeoutEx)
        {
            throw new TimeoutException($"Helper {mode} no genero respuesta valida en el tiempo esperado. response={responsePath}", timeoutEx);
        }
    }

    private static TimeSpan GetHelperTimeout(string mode)
    {
        return mode switch
        {
            "detect-prereqs" => TimeSpan.FromMinutes(5),
            "remediate-prereqs" => TimeSpan.FromMinutes(10),
            "uninstall" => TimeSpan.FromMinutes(10),
            "repair" => TimeSpan.FromMinutes(10),
            _ => TimeSpan.FromMinutes(10)
        };
    }

    private Process StartPowerShellHelperProcess(
        string mode,
        string scriptPath,
        string requestPath,
        string responsePath,
        Action<HelperProgressEvent>? onProgress,
        List<string> stdoutLines,
        List<string> stderrLines)
    {
        Exception? lastError = null;
        var candidateFailures = new List<string>();

        foreach (var executable in GetPowerShellExecutableCandidates())
        {
            var psi = CreatePowerShellHelperStartInfo(executable, scriptPath, mode, requestPath, responsePath);
            var process = new Process
            {
                StartInfo = psi,
                EnableRaisingEvents = true
            };

            process.OutputDataReceived += (_, args) =>
            {
                if (string.IsNullOrWhiteSpace(args.Data))
                {
                    return;
                }

                if (TryParseHelperProgress(args.Data, out var progressEvent))
                {
                    onProgress?.Invoke(progressEvent);
                    return;
                }

                lock (stdoutLines)
                {
                    stdoutLines.Add(args.Data);
                }
            };

            process.ErrorDataReceived += (_, args) =>
            {
                if (string.IsNullOrWhiteSpace(args.Data))
                {
                    return;
                }

                lock (stderrLines)
                {
                    stderrLines.Add(args.Data);
                }
            };

            try
            {
                if (process.Start())
                {
                    Log("info", $"Helper {mode} iniciado con host {psi.FileName} (pid={process.Id}).");
                    return process;
                }

                var error = new InvalidOperationException($"No se pudo iniciar el proceso con host {psi.FileName}.");
                lastError = error;
                candidateFailures.Add($"{psi.FileName}: {error.Message}");
            }
            catch (Exception ex)
            {
                lastError = ex;
                candidateFailures.Add($"{psi.FileName}: {DescribePowerShellStartFailure(ex)}");
            }

            process.Dispose();
            Log("warn", $"No se pudo iniciar helper {mode} con host {executable}: {DescribePowerShellStartFailure(lastError)}");
        }

        var diagnostics = candidateFailures.Count == 0
            ? "sin candidatos registrados"
            : string.Join(" | ", candidateFailures);
        throw new InvalidOperationException(
            $"No se pudo iniciar el helper {mode} con ningun host de PowerShell compatible. Diagnostico: {diagnostics}",
            lastError);
    }

    private ProcessStartInfo CreatePowerShellHelperStartInfo(string executablePath, string scriptPath, string mode, string requestPath, string responsePath)
    {
        var psi = new ProcessStartInfo
        {
            FileName = executablePath,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            StandardOutputEncoding = System.Text.Encoding.UTF8,
            StandardErrorEncoding = System.Text.Encoding.UTF8,
            WorkingDirectory = payloadRoot
        };

        psi.ArgumentList.Add("-NoProfile");
        psi.ArgumentList.Add("-ExecutionPolicy");
        psi.ArgumentList.Add("Bypass");
        psi.ArgumentList.Add("-File");
        psi.ArgumentList.Add(scriptPath);
        psi.ArgumentList.Add("-Mode");
        psi.ArgumentList.Add(mode);
        psi.ArgumentList.Add("-RequestPath");
        psi.ArgumentList.Add(requestPath);
        psi.ArgumentList.Add("-ResponsePath");
        psi.ArgumentList.Add(responsePath);

        return psi;
    }

    private static IEnumerable<string> GetPowerShellExecutableCandidates()
    {
        var windowsDirectory = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        if (!string.IsNullOrWhiteSpace(windowsDirectory))
        {
            yield return Path.Combine(windowsDirectory, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
        }

        yield return "pwsh.exe";
        yield return "pwsh";
        yield return "powershell.exe";
    }

    private static async Task<HelperEnvelope<TData>> WaitForResponseFileAsync<TData>(string responsePath, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow.Add(timeout);
        Exception? lastDeserializeError = null;
        while (DateTime.UtcNow < deadline)
        {
            if (File.Exists(responsePath))
            {
                try
                {
                    var raw = await File.ReadAllTextAsync(responsePath, Encoding.UTF8).ConfigureAwait(false);
                    var envelope = JsonSerializer.Deserialize<HelperEnvelope<TData>>(raw, JsonOptions);
                    if (envelope is not null)
                    {
                        return envelope;
                    }

                    lastDeserializeError = new InvalidOperationException("La respuesta JSON del helper no contiene envelope valido.");
                }
                catch (Exception ex) when (ex is JsonException || ex is InvalidOperationException)
                {
                    lastDeserializeError = ex;
                }
            }

            await Task.Delay(350).ConfigureAwait(false);
        }

        if (lastDeserializeError is not null)
        {
            throw new TimeoutException($"El helper genero respuesta pero no fue posible leerla correctamente ({responsePath}). Ultimo error: {lastDeserializeError.Message}", lastDeserializeError);
        }

        throw new TimeoutException($"No se genero archivo de respuesta del helper: {responsePath}");
    }

    private static string DescribePowerShellStartFailure(Exception? error)
    {
        if (error is null)
        {
            return "sin detalle";
        }

        if (error is UnauthorizedAccessException)
        {
            return "acceso denegado al iniciar host PowerShell (verifica permisos administrativos/UAC)";
        }

        if (error is Win32Exception win32)
        {
            return win32.NativeErrorCode switch
            {
                2 => "host no encontrado en el sistema (archivo o comando inexistente)",
                5 => "acceso denegado al iniciar el proceso",
                740 => "se requieren privilegios elevados para ejecutar el host",
                _ => $"Win32 {win32.NativeErrorCode}: {win32.Message}"
            };
        }

        return error.Message;
    }

    private static string TrimForLog(string? value, int max = 1200)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = value.Replace("\r", " ").Replace("\n", " ").Trim();
        if (normalized.Length <= max)
        {
            return normalized;
        }

        return normalized[..max] + "...(truncated)";
    }

    private static bool TryParseHelperProgress(string rawLine, out HelperProgressEvent progressEvent)
    {
        progressEvent = new HelperProgressEvent();
        if (!rawLine.StartsWith(HelperProgressPrefix, StringComparison.Ordinal))
        {
            return false;
        }

        var payload = rawLine[HelperProgressPrefix.Length..].Trim();
        if (string.IsNullOrWhiteSpace(payload))
        {
            return false;
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<HelperProgressEvent>(payload, JsonOptions);
            if (parsed is null)
            {
                return false;
            }

            progressEvent = parsed;
            return true;
        }
        catch
        {
            return false;
        }
    }

    private void UpdateWindowFromDetection(DetectionPayload payload)
    {
        if (payload.Installation is null)
        {
            payload.Installation = new InstallationPayload();
        }
        if (msiInstalled)
        {
            payload.Installation.Installed = true;
        }

        var detectedMode = command?.Action switch
        {
            LaunchAction.Repair => "repair",
            LaunchAction.Uninstall or LaunchAction.UnsafeUninstall => "uninstall",
            _ => msiInstalled ? "repair" : payload.RecommendedMode
        };

        var installDir = payload.Installation?.InstallLocation;
        if (string.IsNullOrWhiteSpace(installDir))
        {
            installDir = Path.Combine(
                string.Equals(payload.Flavor?.FlavorId, "docente-local", StringComparison.OrdinalIgnoreCase)
                    ? Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)
                    : Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                payload.Flavor?.InstallFolderName ?? payload.Flavor?.ProductName ?? "EvaluaPro");
        }

        var model = new WindowDetectionModel
        {
            FlavorId = payload.Flavor?.FlavorId ?? "docente-local",
            FlavorLabel = payload.Flavor?.DisplayName ?? "EvaluaPro",
            InstallDir = installDir,
            Mode = NormalizeMode(detectedMode),
            Summary = payload.Remediation?.RequiresRestart == true
                ? (string.IsNullOrWhiteSpace(payload.Remediation.RestartReason)
                    ? "La remediación automática requiere reinicio de Windows para continuar."
                    : payload.Remediation.RestartReason)
                : payload.System?.Issues?.Count > 0
                    ? string.Join(" | ", payload.System.Issues)
                    : msiInstalled
                        ? "EvaluaPro ya está instalado. El asistente se iniciará en modo de mantenimiento."
                        : (payload.Runtime?.Reason ?? "Equipo listo para continuar."),
            Ready = payload.Ready,
            AssetName = payload.Flavor?.InstallerHubExeName ?? "EvaluaPro-InstallerHub-docente-local.exe",
            Prerequisites = payload.Prerequisites ?? [],
            AvailableFlavors = LoadFlavorItems()
        };

        DispatchToUi(() => window?.ApplyDetectionModel(model));
        DispatchToUi(() => window?.SetRestartActionVisible(payload.Remediation?.RequiresRestart == true, payload.Remediation?.RestartReason));
        SetStageState(
            StageDetection,
            InstallerStageStatus.Ok,
            payload.Ready ? "Prerequisitos verificados." : "Detección completada con observaciones.",
            model.Summary);
        UpdateUiState(statusText: payload.Ready ? "Prerequisitos verificados." : "El equipo requiere atencion antes de instalar.", busy: false);
    }

    private IReadOnlyList<FlavorItem> LoadFlavorItems()
    {
        var path = Path.Combine(payloadRoot, "installer-flavors.json");
        if (!File.Exists(path))
        {
            return [new FlavorItem("docente-local", "EvaluaPro", "EvaluaPro-InstallerHub-docente-local.exe")];
        }

        using var stream = File.OpenRead(path);
        using var doc = JsonDocument.Parse(stream);
        var list = new List<FlavorItem>();
        if (!doc.RootElement.TryGetProperty("flavors", out var flavors))
        {
            return list;
        }

        foreach (var flavor in flavors.EnumerateArray())
        {
            list.Add(new FlavorItem(
                flavor.GetProperty("flavorId").GetString() ?? "docente-local",
                flavor.GetProperty("displayName").GetString() ?? "EvaluaPro",
                flavor.TryGetProperty("installerHubExeName", out var asset) ? asset.GetString() ?? string.Empty : string.Empty));
        }

        return list;
    }

    private IntPtr GetWindowHandle()
    {
        if (window is not null)
        {
            return window.Dispatcher.Invoke(() => new WindowInteropHelper(window).Handle);
        }

        var shellHandle = GetShellWindow();
        if (shellHandle != IntPtr.Zero)
        {
            return shellHandle;
        }

        return GetDesktopWindow();
    }

    private void UpdateUiState(string? statusText = null, int? progress = null, bool? busy = null)
    {
        if (headless)
        {
            if (!string.IsNullOrWhiteSpace(statusText))
            {
                Log("info", statusText);
            }
            return;
        }

        DispatchToUi(() => window?.UpdateState(statusText, progress, busy));
    }

    private void DispatchToUi(Action action)
    {
        if (window is null)
        {
            return;
        }

        if (window.Dispatcher.CheckAccess())
        {
            action();
            return;
        }

        window.Dispatcher.BeginInvoke(action, DispatcherPriority.Background);
    }

    private void ScheduleAutoCloseIfRequested()
    {
        var raw = Environment.GetEnvironmentVariable("EVALUAPRO_BURN_GUI_AUTO_CLOSE_MS");
        if (!int.TryParse(raw, out var ms) || ms <= 0)
        {
            return;
        }

        Task.Delay(ms).ContinueWith(
            _ => RequestQuit(),
            CancellationToken.None,
            TaskContinuationOptions.None,
            TaskScheduler.Default);
    }

    private void RequestQuit()
    {
        if (applyInFlight || helperInFlight)
        {
            DispatchToUi(() => window?.NotifyBusyCloseBlocked());
            return;
        }

        if (!operationFinished.Task.IsCompleted)
        {
            operationFinished.TrySetResult(requestedExitCode);
        }

        DispatchToUi(() =>
        {
            if (window?.IsVisible == true)
            {
                window.Close();
            }
        });
    }

    private bool TryAcquireUiSingleton()
    {
        if (IsAnotherHubProcessRunning())
        {
            Log("warn", "Proceso Hub adicional detectado por nombre de proceso. Se bloquea segunda UI.");
            return false;
        }

        try
        {
            hubSingletonMutex = new Mutex(initiallyOwned: true, name: HubSingletonMutexName, createdNew: out var createdNew);
            ownsHubSingleton = createdNew;
            Log("info", $"Singleton mutex '{HubSingletonMutexName}' createdNew={createdNew} pid={Environment.ProcessId}");
            return createdNew;
        }
        catch (AbandonedMutexException)
        {
            ownsHubSingleton = true;
            Log("warn", "Mutex singleton abandonado detectado; se recupera propiedad para instancia actual.");
            return true;
        }
        catch (UnauthorizedAccessException)
        {
            Log("warn", "Mutex singleton existente sin acceso. Se asume instancia activa y se bloquea segunda UI.");
            return false;
        }
        catch (Exception ex)
        {
            Log("warn", $"No se pudo adquirir mutex singleton; se bloquea UI adicional por seguridad. Motivo: {ex.Message}");
            return false;
        }
    }

    private static bool IsAnotherHubProcessRunning()
    {
        try
        {
            using var current = Process.GetCurrentProcess();
            var peers = Process.GetProcessesByName(current.ProcessName);
            foreach (var peer in peers)
            {
                try
                {
                    if (peer.Id != current.Id)
                    {
                        return true;
                    }
                }
                finally
                {
                    peer.Dispose();
                }
            }
        }
        catch
        {
            // Si no se puede inspeccionar procesos, no bloquea por este criterio.
        }

        return false;
    }

    private void ReleaseUiSingleton()
    {
        try
        {
            if (hubSingletonMutex is not null)
            {
                if (ownsHubSingleton)
                {
                    hubSingletonMutex.ReleaseMutex();
                }

                hubSingletonMutex.Dispose();
            }
        }
        catch
        {
            // Evita que un error de liberacion afecte el cierre del BA.
        }
        finally
        {
            hubSingletonMutex = null;
            ownsHubSingleton = false;
        }
    }

    private void FocusExistingHubWindow()
    {
        try
        {
            var hwnd = IntPtr.Zero;
            try
            {
                using var current = Process.GetCurrentProcess();
                var peers = Process.GetProcessesByName(current.ProcessName);
                foreach (var peer in peers)
                {
                    try
                    {
                        if (peer.Id == current.Id)
                        {
                            continue;
                        }

                        if (peer.MainWindowHandle != IntPtr.Zero)
                        {
                            hwnd = peer.MainWindowHandle;
                            break;
                        }
                    }
                    finally
                    {
                        peer.Dispose();
                    }
                }
            }
            catch
            {
                // Fallback por titulo abajo.
            }

            if (hwnd == IntPtr.Zero)
            {
                hwnd = FindWindow(lpClassName: null, lpWindowName: "EvaluaPro Installer Hub");
            }

            if (hwnd == IntPtr.Zero)
            {
                return;
            }

            const int SW_RESTORE = 9;
            ShowWindow(hwnd, SW_RESTORE);
            SetForegroundWindow(hwnd);
        }
        catch
        {
            // Si no se puede enfocar (ej. restricciones UAC), al menos se bloquea segunda UI.
        }
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr FindWindow(string? lpClassName, string? lpWindowName);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr GetShellWindow();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr GetDesktopWindow();

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    private void RequestSystemRestart()
    {
        if (applyInFlight || helperInFlight)
        {
            DispatchToUi(() => window?.NotifyBusyCloseBlocked());
            return;
        }

        try
        {
            UpdateUiState(statusText: "Reiniciando Windows para continuar la operación...", busy: true);
            var psi = new ProcessStartInfo
            {
                FileName = "shutdown.exe",
                UseShellExecute = false,
                CreateNoWindow = true
            };
            psi.ArgumentList.Add("/r");
            psi.ArgumentList.Add("/t");
            psi.ArgumentList.Add("5");
            psi.ArgumentList.Add("/c");
            psi.ArgumentList.Add("EvaluaPro reanudara automaticamente tras reiniciar.");
            Process.Start(psi);
        }
        catch (Exception ex)
        {
            Log("error", $"No se pudo iniciar reinicio automatico: {ex.Message}");
            UpdateUiState(statusText: "No se pudo iniciar reinicio automático. Reinicia Windows manualmente.", busy: false);
        }
    }

    private void PersistResumeState(string flavorId, string installDir, string mode, string? resumeToken, string? remediationPhase, string restartReason)
    {
        try
        {
            var state = new ResumeState
            {
                CreatedAtUtc = DateTime.UtcNow,
                FlavorId = flavorId,
                InstallDir = installDir,
                Mode = mode,
                AutoStart = true,
                ResumeToken = resumeToken ?? string.Empty,
                RemediationPhase = remediationPhase ?? string.Empty,
                RestartReason = restartReason
            };
            var dir = Path.GetDirectoryName(resumeStatePath);
            if (!string.IsNullOrWhiteSpace(dir))
            {
                Directory.CreateDirectory(dir);
            }
            File.WriteAllText(resumeStatePath, JsonSerializer.Serialize(state, JsonOptions), Encoding.UTF8);
            resumeState = state;
            autoResumeRequested = true;
            Log("info", $"Estado de resume persistido: {resumeStatePath}");
        }
        catch (Exception ex)
        {
            Log("warn", $"No se pudo persistir estado de resume: {ex.Message}");
        }
    }

    private ResumeState? TryLoadResumeState()
    {
        try
        {
            if (string.IsNullOrWhiteSpace(resumeStatePath) || !File.Exists(resumeStatePath))
            {
                return null;
            }

            var raw = File.ReadAllText(resumeStatePath, Encoding.UTF8);
            var state = JsonSerializer.Deserialize<ResumeState>(raw, JsonOptions);
            return state;
        }
        catch (Exception ex)
        {
            Log("warn", $"No se pudo leer estado de resume: {ex.Message}");
            return null;
        }
    }

    private void ClearResumeState()
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(resumeStatePath) && File.Exists(resumeStatePath))
            {
                File.Delete(resumeStatePath);
            }
        }
        catch (Exception ex)
        {
            Log("warn", $"No se pudo limpiar estado de resume: {ex.Message}");
        }
        finally
        {
            resumeState = null;
            autoResumeRequested = false;
        }
    }

    private void RegisterRunOnceForResume()
    {
        try
        {
            var exePath = Environment.ProcessPath;
            if (string.IsNullOrWhiteSpace(exePath))
            {
                using var current = Process.GetCurrentProcess();
                exePath = current.MainModule?.FileName;
            }

            if (string.IsNullOrWhiteSpace(exePath))
            {
                Log("warn", "No se pudo resolver ruta de ejecutable para RunOnce.");
                return;
            }

            using var runOnceKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce", true);
            if (runOnceKey is null)
            {
                Log("warn", "No se pudo abrir HKLM RunOnce para registrar reanudacion.");
                return;
            }

            var command = $"\"{exePath}\"";
            runOnceKey.SetValue("EvaluaProInstallerHubResume", command, RegistryValueKind.String);
            Log("info", $"RunOnce registrado para reanudar operacion: {command}");
        }
        catch (Exception ex)
        {
            Log("warn", $"No se pudo registrar RunOnce: {ex.Message}");
        }
    }

    private void FinalizeFailure(string phase, int exitCode, string message)
    {
        requestedExitCode = exitCode;
        helperInFlight = false;
        applyInFlight = false;
        if (exitCode != 3010)
        {
            ClearResumeState();
        }
        var mappedStage = MapPhaseToStage(phase);
        if (!string.IsNullOrWhiteSpace(mappedStage))
        {
            SetStageState(mappedStage, InstallerStageStatus.Error, $"La etapa '{ResolveStageLabel(mappedStage)}' terminó con error.", message);
        }
        SetStageState(StageFinalize, InstallerStageStatus.Error, "La operación terminó con error.", message);
        Log("error", $"[{phase}] {message}");
        if (!helperDetectionLogsFlushed)
        {
            FlushHelperLogs(helperDetectionResponse?.Logs);
            helperDetectionLogsFlushed = true;
        }
        failureDisplay ??= BuildFailureDisplay("Resumen de error", lastFailedPackageId, lastFailedPackageStatus, ReadEngineVariableString("WixBundleLog_EvaluaProMsi"), sessionLogPath, message);
        RenderWorkflow(message, "La operación se detuvo. Revisa el resumen de error y los logs.");
        DispatchToUi(() => window?.NotifyInitialDetectionCompleted());

        if (headless)
        {
            operationFinished.TrySetResult(exitCode);
            return;
        }

        DispatchToUi(() => window?.MarkCompleted(success: false, $"{phase}: {message}"));
        UpdateUiState(statusText: message, busy: false);
    }

    private void FlushHelperLogs(IReadOnlyList<HelperLogEntry>? entries)
    {
        if (entries is null)
        {
            return;
        }

        foreach (var entry in entries)
        {
            var level = string.IsNullOrWhiteSpace(entry.Level) ? "info" : entry.Level;
            var message = entry.Message ?? string.Empty;
            var helperTimestamp = string.IsNullOrWhiteSpace(entry.Timestamp) ? "" : $" t={entry.Timestamp}";
            Log(level, $"helper{helperTimestamp}: {message}", includeTimestamp: true);
        }
    }

    private void Log(string level, string message, bool includeTimestamp = true)
    {
        lock (sync)
        {
            var line = includeTimestamp
                ? $"[{DateTime.UtcNow:O}] [{level}] {message}"
                : $"[{level}] {message}";

            File.AppendAllText(sessionLogPath, line + Environment.NewLine, Encoding.UTF8);
            if (!headless)
            {
                DispatchToUi(() => window?.AppendLog(line));
            }
        }
    }

    private string ResolveRequestedFlavorId()
    {
        if (!string.IsNullOrWhiteSpace(resumeState?.FlavorId))
        {
            return resumeState.FlavorId;
        }

        var explicitFlavor = Environment.GetEnvironmentVariable("EVALUAPRO_FLAVOR_ID");
        if (!string.IsNullOrWhiteSpace(explicitFlavor))
        {
            return explicitFlavor;
        }

        var flavors = LoadFlavorItems();
        return flavors.FirstOrDefault()?.FlavorId ?? "docente-local";
    }

    private static string NormalizeMode(string? mode)
    {
        var raw = (mode ?? string.Empty).Trim().ToLowerInvariant();
        return raw switch
        {
            "repair" => "repair",
            "uninstall" => "uninstall",
            _ => "install"
        };
    }

    private static string MapPhaseToStage(string? phase)
    {
        return (phase ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "analisis_requisitos" => StageDetection,
            "prerequisitos" => StageRemediation,
            "accion_producto" => StageMsi,
            "configuracion_operativa" => StagePostInstall,
            "helper_post_install" => StagePostInstall,
            "blindaje_licencia_local" => StagePostInstall,
            "helper_timeout" => StagePostInstall,
            "helper_init_fail" => StagePostInstall,
            "helper_unexpected" => StagePostInstall,
            _ => StageFinalize
        };
    }

    private string ResolveStageLabel(string stageId)
    {
        return workflowStages.FirstOrDefault(stage => stage.Id == stageId)?.Label ?? "finalización";
    }

    private static FailureDisplay BuildFailureDisplay(string title, string? packageId, int? statusCode, string? msiLogPath, string? baLogPath, string? reason)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(packageId))
        {
            parts.Add($"Paquete: {packageId}");
        }

        if (statusCode.HasValue)
        {
            parts.Add($"Código: {FormatWindowsStatus(statusCode.Value)}");
        }

        if (!string.IsNullOrWhiteSpace(reason))
        {
            parts.Add($"Motivo: {reason}");
        }

        if (!string.IsNullOrWhiteSpace(msiLogPath))
        {
            parts.Add($"Log MSI: {msiLogPath}");
        }

        if (!string.IsNullOrWhiteSpace(baLogPath))
        {
            parts.Add($"Log BA: {baLogPath}");
        }

        if (statusCode == unchecked((int)0x80070005)
            || (!string.IsNullOrWhiteSpace(reason)
                && (reason.Contains("acceso denegado", StringComparison.OrdinalIgnoreCase)
                    || reason.Contains("access denied", StringComparison.OrdinalIgnoreCase))))
        {
            parts.Add("Accion sugerida: ejecuta la reparacion con permisos de administrador y revisa UAC/politicas del equipo.");
        }
        else if (!string.IsNullOrWhiteSpace(reason)
                 && (reason.Contains("PowerShell", StringComparison.OrdinalIgnoreCase)
                     || reason.Contains("helper", StringComparison.OrdinalIgnoreCase)))
        {
            parts.Add("Accion sugerida: valida disponibilidad de PowerShell (powershell.exe/pwsh) y reintenta en modo Reparar.");
        }
        else
        {
            parts.Add("Accion sugerida: revisa los logs y vuelve a intentar en modo Reparar.");
        }

        return new FailureDisplay
        {
            Title = title,
            Body = string.Join(Environment.NewLine, parts)
        };
    }

    private static string? TryExtractMsiFailureReason(string? logPath)
    {
        if (string.IsNullOrWhiteSpace(logPath) || !File.Exists(logPath))
        {
            return null;
        }

        try
        {
            var text = File.ReadAllText(logPath, Encoding.Unicode);
            if (string.IsNullOrWhiteSpace(text))
            {
                return null;
            }

            var lines = text
                .Replace("\r", string.Empty)
                .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            for (var idx = lines.Length - 1; idx >= 0; idx--)
            {
                var line = lines[idx];
                var productMatch = Regex.Match(line, @"Producto:\s*.+?--\s*(.+)$", RegexOptions.IgnoreCase);
                if (productMatch.Success)
                {
                    return productMatch.Groups[1].Value.Trim();
                }

                var launchConditionMatch = Regex.Match(line, @"No se detecto.+runtime Docker compatible.+", RegexOptions.IgnoreCase);
                if (launchConditionMatch.Success)
                {
                    return launchConditionMatch.Value.Trim();
                }
            }
        }
        catch
        {
            return null;
        }

        return null;
    }

    private static bool IsTruthy(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return value.Trim().Equals("1", StringComparison.OrdinalIgnoreCase)
            || value.Trim().Equals("true", StringComparison.OrdinalIgnoreCase)
            || value.Trim().Equals("yes", StringComparison.OrdinalIgnoreCase)
            || value.Trim().Equals("on", StringComparison.OrdinalIgnoreCase)
            || value.Trim().Equals("si", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsFalsy(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return value.Trim().Equals("0", StringComparison.OrdinalIgnoreCase)
            || value.Trim().Equals("false", StringComparison.OrdinalIgnoreCase)
            || value.Trim().Equals("no", StringComparison.OrdinalIgnoreCase)
            || value.Trim().Equals("off", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsSuccessStatus(int status)
    {
        return status == 0 || status == 3010 || status == 1641;
    }

    private static string FormatWindowsStatus(int status)
    {
        var hex = $"0x{unchecked((uint)status):X8}";
        var description = status switch
        {
            0 => "Operacion completada correctamente.",
            3010 => "Operacion completada; se requiere reinicio.",
            1641 => "Reinicio iniciado por el instalador.",
            unchecked((int)0x80070643) => "Error fatal durante la instalacion MSI.",
            unchecked((int)0x80070652) => "Hay otra instalacion de Windows Installer en progreso.",
            unchecked((int)0x80070666) => "Ya existe una version instalada (upgrade/downgrade no permitido).",
            unchecked((int)0x80070005) => "Acceso denegado; valida permisos administrativos/UAC.",
            unchecked((int)0x80070002) => "No se encontro un archivo requerido por el instalador.",
            _ => "Error de instalacion no clasificado."
        };

        return $"{hex} - {description}";
    }

    private string ReadEngineVariableString(string variableName)
    {
        if (engineHandle is null || string.IsNullOrWhiteSpace(variableName))
        {
            return string.Empty;
        }

        try
        {
            return engineHandle.GetVariableString(variableName) ?? string.Empty;
        }
        catch
        {
            return string.Empty;
        }
    }
}

public sealed class BootstrapperRequest
{
    public string FlavorId { get; set; } = "docente-local";
    public string Mode { get; set; } = "install";
    public string InstallDir { get; set; } = string.Empty;
    public bool InstallDesktopShortcuts { get; set; } = true;
    public bool InstallStartMenuShortcuts { get; set; } = true;
    public bool ExportData { get; set; }
    public string DatabaseUrl { get; set; } = "file:C:/ProgramData/EvaluaPro/data/evaluapro.db";
    public string NodeEnv { get; set; } = "production";
    public string ApiPort { get; set; } = "4000";
    public string PortalPort { get; set; } = "4518";
    public string CorsOrigins { get; set; } = "http://localhost:4173,http://127.0.0.1:4173";
    public string PortalAlumnoUrl { get; set; } = string.Empty;
    public string PortalApiKey { get; set; } = "portal-key-shared";
    public bool PasswordResetEnabled { get; set; }
    public string PasswordResetUrlBase { get; set; } = string.Empty;
    public bool RequireLicenseActivation { get; set; }
    public string LicenseApiBaseUrl { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string ActivationCode { get; set; } = string.Empty;
    public string LicenseAccountEmail { get; set; } = "soporte@tu-institucion.mx";
    public string UpdateChannel { get; set; } = "stable";
    public string UpdateOwner { get; set; } = "Dtcsrni";
    public string UpdateRepo { get; set; } = "EvaluaPro_Sistema_Universitario";
    public string UpdateAssetName { get; set; } = "EvaluaPro-InstallerHub-docente-local.exe";
    public string UpdateShaAssetName { get; set; } = "EvaluaPro-InstallerHub-docente-local.exe.sha256";
}

internal enum InstallerStageStatus
{
    Pending,
    Running,
    Ok,
    Error
}

internal enum InstallerUiSeverity
{
    Active,
    Success,
    Warning,
    Error
}

internal sealed class InstallerStageState
{
    public InstallerStageState(string id, string label, string summary)
    {
        Id = id;
        Label = label;
        Summary = summary;
    }

    public string Id { get; }

    public string Label { get; }

    public InstallerStageStatus State { get; set; } = InstallerStageStatus.Pending;

    public string Summary { get; set; }

    public string Detail { get; set; } = string.Empty;
}

internal sealed class FailureDisplay
{
    public string Title { get; set; } = "Resumen de error";

    public string Body { get; set; } = string.Empty;
}

public sealed class HelperEnvelope<TData>
{
    public bool Ok { get; set; }
    public string? Phase { get; set; }
    public int ExitCode { get; set; }
    public string? Message { get; set; }
    public IReadOnlyList<HelperLogEntry>? Logs { get; set; }
    public IReadOnlyList<string>? Warnings { get; set; }
    public IReadOnlyDictionary<string, string>? Artifacts { get; set; }
    public TData? Data { get; set; }
}

public sealed class HelperProgressEvent
{
    public string Activity { get; set; } = string.Empty;
    public int Percent { get; set; }
    public string Status { get; set; } = string.Empty;
    public IReadOnlyDictionary<string, JsonElement>? Meta { get; set; }
}

public sealed class HelperLogEntry
{
    public string? Timestamp { get; set; }
    public string? Level { get; set; }
    public string? Message { get; set; }
}

public sealed class DetectionPayload
{
    public string RecommendedMode { get; set; } = "install";
    public bool Ready { get; set; }
    public FlavorPayload? Flavor { get; set; }
    public InstallationPayload? Installation { get; set; }
    public SystemPayload? System { get; set; }
    public RuntimePayload? Runtime { get; set; }
    public IReadOnlyList<PrerequisitePayload>? Prerequisites { get; set; }
    public RemediationPayload? Remediation { get; set; }
}

public sealed class FlavorPayload
{
    public string FlavorId { get; set; } = "docente-local";
    public string DisplayName { get; set; } = "EvaluaPro";
    public string ProductName { get; set; } = "EvaluaPro";
    public string InstallFolderName { get; set; } = "EvaluaPro";
    public string InstallerHubExeName { get; set; } = "EvaluaPro-InstallerHub-docente-local.exe";
}

public sealed class InstallationPayload
{
    public bool Installed { get; set; }
    public string InstallLocation { get; set; } = string.Empty;
}

public sealed class SystemPayload
{
    public IReadOnlyList<string> Issues { get; set; } = [];
}

public sealed class RuntimePayload
{
    public string Reason { get; set; } = string.Empty;
}

public sealed class PrerequisitePayload
{
    public string Name { get; set; } = string.Empty;
    public bool Installed { get; set; }
    public string ActualVersion { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}

public sealed class RemediationPayload
{
    public bool Attempted { get; set; }
    public bool Ok { get; set; }
    public bool RequiresRestart { get; set; }
    public string RestartReason { get; set; } = string.Empty;
    public string ResumeToken { get; set; } = string.Empty;
    public string Phase { get; set; } = string.Empty;
}

public sealed class ResumeState
{
    public DateTime CreatedAtUtc { get; set; }
    public string FlavorId { get; set; } = "docente-local";
    public string InstallDir { get; set; } = string.Empty;
    public string Mode { get; set; } = "install";
    public bool AutoStart { get; set; } = true;
    public string ResumeToken { get; set; } = string.Empty;
    public string RemediationPhase { get; set; } = string.Empty;
    public string RestartReason { get; set; } = string.Empty;
}

public sealed record FlavorItem(string FlavorId, string DisplayName, string AssetName);

public sealed class WindowDetectionModel
{
    public string FlavorId { get; set; } = "docente-local";
    public string FlavorLabel { get; set; } = "EvaluaPro";
    public string InstallDir { get; set; } = string.Empty;
    public string Mode { get; set; } = "install";
    public string Summary { get; set; } = string.Empty;
    public bool Ready { get; set; }
    public string AssetName { get; set; } = string.Empty;
    public IReadOnlyList<PrerequisitePayload> Prerequisites { get; set; } = [];
    public IReadOnlyList<FlavorItem> AvailableFlavors { get; set; } = [];
}
