using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
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

    private readonly object sync = new();
    private readonly TaskCompletionSource<bool> uiReady = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource<int> operationFinished = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly List<InstallerStageState> workflowStages = CreateDefaultWorkflowStages();

    private IEngine? engineHandle;
    private IBootstrapperCommand? command;
    private MainWindow? window;
    private Thread? uiThread;
    private string payloadRoot = string.Empty;
    private string sessionRoot = string.Empty;
    private string sessionLogPath = string.Empty;
    private string requestRoot = string.Empty;
    private bool headless;
    private bool burnDetectionComplete;
    private bool helperDetectionComplete;
    private bool startRequested;
    private bool applyInFlight;
    private bool helperInFlight;
    private bool helperDetectionLogsFlushed;
    private bool applySawPackageFailure;
    private int requestedExitCode;
    private int? lastFailedPackageStatus;
    private string currentOperation = "install";
    private string? lastFailedPackageId;
    private DetectionPayload? detectionPayload;
    private HelperEnvelope<DetectionPayload>? helperDetectionResponse;
    private string? pendingHelperResponsePath;
    private BootstrapperRequest? currentRequest;
    private FailureDisplay? failureDisplay;

    protected override void Run()
    {
        var exitCode = operationFinished.Task.GetAwaiter().GetResult();
        engineHandle?.Quit(exitCode);

        if (uiThread is { IsAlive: true })
        {
            uiThread.Join(TimeSpan.FromSeconds(2));
        }
    }

    protected override void OnCreate(CreateEventArgs args)
    {
        base.OnCreate(args);

        engineHandle = args.Engine;
        command = args.Command;
        payloadRoot = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        InitializeSessionPaths();
        Log("info", $"Burn bootstrapper iniciado. Action={command?.Action} Display={command?.Display}");

        headless = command?.Display == Display.None || IsTruthy(Environment.GetEnvironmentVariable("EVALUAPRO_BURN_HEADLESS"));

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
        SetStageState(StageMsi, InstallerStageStatus.Running, "Ejecutando MSI principal.", "La instalación base de EvaluaPro está en progreso.");
        UpdateUiState(statusText: "Instalando componentes de EvaluaPro. Esto puede tardar algunos minutos...", progress: 0, busy: true);
        engineHandle?.Apply(GetWindowHandle());
    }

    protected override void OnProgress(ProgressEventArgs args)
    {
        base.OnProgress(args);
        SetStageState(StageMsi, InstallerStageStatus.Running, $"Ejecutando MSI principal ({Math.Max(0, Math.Min(100, args.OverallPercentage))}%).", "La instalación base de EvaluaPro sigue en progreso.");
        UpdateUiState(statusText: $"Instalando componentes... {Math.Max(0, Math.Min(100, args.OverallPercentage))}%", progress: args.OverallPercentage, busy: true);
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
            SetStageState(StageFinalize, InstallerStageStatus.Error, "La instalación terminó con error.", "La transacción MSI no pudo completarse.");
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

        SetStageState(StageMsi, InstallerStageStatus.Ok, "MSI completado.", "La instalación base terminó y continúa la post-instalación.");
        SetStageState(StagePostInstall, InstallerStageStatus.Running, "Ejecutando helper post-instalación.", "Aplicando configuración, verificación y endurecimiento final.");
        UpdateUiState(statusText: "MSI aplicado. Ejecutando helper post-install...", progress: 100, busy: true);
        _ = RunPostInstallHelperAsync();
    }

    protected override void OnLaunchApprovedExeComplete(LaunchApprovedExeCompleteEventArgs args)
    {
        base.OnLaunchApprovedExeComplete(args);

        if (!helperInFlight)
        {
            return;
        }

        if (args.Status != 0 || args.ProcessId <= 0)
        {
            FinalizeFailure("helper_post_install", 50, $"No se pudo lanzar helper elevado. status={args.Status}, pid={args.ProcessId}");
            return;
        }

        var responsePath = pendingHelperResponsePath;
        if (string.IsNullOrWhiteSpace(responsePath))
        {
            FinalizeFailure("helper_post_install", 50, "No se genero ruta de respuesta para el helper post-install.");
            return;
        }

        _ = WaitForHelperExitAsync(args.ProcessId, responsePath);
    }

    private void InitializeSessionPaths()
    {
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "EvaluaPro", "installer-hub", "logs");
        Directory.CreateDirectory(root);
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
                    eventArgs.Handled = true;
                    requestedExitCode = 50;
                    UpdateUiState(statusText: "El instalador detectó un error de UI. Revisa los logs.", busy: false);
                };

                AppDomain.CurrentDomain.UnhandledException += (_, eventArgs) =>
                {
                    Log("error", $"UI UnhandledException: {eventArgs.ExceptionObject}");
                    requestedExitCode = 50;
                };

                var createdWindow = new MainWindow();
                var availableFlavors = LoadFlavorItems();
                createdWindow.ConfigureInitialFlavorLayout(availableFlavors, ResolveRequestedFlavorId());
                createdWindow.DetectRequested += (_, _) => _ = RunHelperDetectionAsync(force: true);
                createdWindow.StartRequested += (_, request) => _ = StartBundleOperationAsync(request);
                createdWindow.CloseRequested += (_, _) => RequestQuit();
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

                createdWindow.Show();
                RenderWorkflow("Inicializando Installer Hub...", "Preparando la detección inicial de prerequisitos.");
                application.Run(createdWindow);
            }
            catch (Exception ex)
            {
                Log("error", $"StartUiThread fatal exception: {ex}");
                requestedExitCode = 50;
                operationFinished.TrySetResult(requestedExitCode);
            }
        });

        uiThread.SetApartmentState(ApartmentState.STA);
        uiThread.IsBackground = true;
        uiThread.Start();
    }

    private static List<InstallerStageState> CreateDefaultWorkflowStages()
    {
        return
        [
            new InstallerStageState(StageDetection, "Detección", "Pendiente de iniciar."),
            new InstallerStageState(StageRemediation, "Remediación de prerequisitos", "Solo se ejecuta si hace falta."),
            new InstallerStageState(StagePlanning, "Planificación", "Aún no se solicitó la operación."),
            new InstallerStageState(StageMsi, "Ejecución MSI", "Esperando la transacción del MSI."),
            new InstallerStageState(StagePostInstall, "Post-instalación", "Esperando configuración final."),
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
                                ? "Esperando configuración final."
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

        var severity = failedStage is not null
            ? InstallerUiSeverity.Error
            : runningStage is not null
                ? InstallerUiSeverity.Active
                : workflowStages.FirstOrDefault(stage => stage.Id == StageFinalize)?.State == InstallerStageStatus.Ok
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
                InstallerUiSeverity.Error => "#D34B5A",
                InstallerUiSeverity.Success => "#198754",
                InstallerUiSeverity.Warning => "#E5B85C",
                _ => "#0C7489"
            },
            HeaderForeground = severity == InstallerUiSeverity.Warning ? "#2E2413" : "#FFFFFF",
            SummaryBackground = severity switch
            {
                InstallerUiSeverity.Error => "#FFF1F3",
                InstallerUiSeverity.Success => "#EBF8F0",
                InstallerUiSeverity.Warning => "#FFF7E2",
                _ => "#E6F4F8"
            },
            SummaryBorder = severity switch
            {
                InstallerUiSeverity.Error => "#F0B6BE",
                InstallerUiSeverity.Success => "#A7D8B9",
                InstallerUiSeverity.Warning => "#F4D28E",
                _ => "#9BD2DF"
            },
            SummaryForeground = severity switch
            {
                InstallerUiSeverity.Error => "#8A1733",
                InstallerUiSeverity.Success => "#14532D",
                InstallerUiSeverity.Warning => "#8A6116",
                _ => "#0B4A5A"
            },
            StageBodyForeground = severity switch
            {
                InstallerUiSeverity.Error => "#8A1733",
                InstallerUiSeverity.Success => "#14532D",
                InstallerUiSeverity.Warning => "#8A6116",
                _ => "#37576A"
            },
            SummaryBadge = runningStage is not null
                ? "En curso"
                : failedStage is not null
                    ? "Fallo detectado"
                    : workflowStages.FirstOrDefault(stage => stage.Id == StageFinalize)?.State == InstallerStageStatus.Ok
                        ? "Completado"
                        : "Pendiente",
            CurrentStageTitle = $"Etapa destacada: {currentStage.Label}",
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

    private static InstallerStageView MapStageToView(InstallerStageState stage)
    {
        return stage.State switch
        {
            InstallerStageStatus.Running => new InstallerStageView
            {
                Label = stage.Label,
                Badge = "ACTIVA",
                Summary = stage.Summary,
                Detail = stage.Detail,
                Background = "#E6F4F8",
                Border = "#9BD2DF",
                Foreground = "#0B4A5A"
            },
            InstallerStageStatus.Ok => new InstallerStageView
            {
                Label = stage.Label,
                Badge = "OK",
                Summary = stage.Summary,
                Detail = stage.Detail,
                Background = "#EBF8F0",
                Border = "#A7D8B9",
                Foreground = "#14532D"
            },
            InstallerStageStatus.Error => new InstallerStageView
            {
                Label = stage.Label,
                Badge = "ERROR",
                Summary = stage.Summary,
                Detail = stage.Detail,
                Background = "#FFF1F3",
                Border = "#F0B6BE",
                Foreground = "#8A1733"
            },
            _ => new InstallerStageView
            {
                Label = stage.Label,
                Badge = "PENDIENTE",
                Summary = stage.Summary,
                Detail = stage.Detail,
                Background = "#F8FAFC",
                Border = "#D7DEE5",
                Foreground = "#334155"
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

        if (headless && !startRequested)
        {
            _ = StartBundleOperationAsync(BuildHeadlessRequest(detectionPayload));
        }
    }

    private BootstrapperRequest BuildHeadlessRequest(DetectionPayload payload)
    {
        var productName = payload.Flavor?.ProductName ?? "EvaluaPro";
        var installDir = Environment.GetEnvironmentVariable("EVALUAPRO_BURN_INSTALLDIR");
        if (string.IsNullOrWhiteSpace(installDir))
        {
            installDir = payload.Installation?.InstallLocation;
        }

        if (string.IsNullOrWhiteSpace(installDir))
        {
            installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), productName);
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
            Mode = NormalizeMode(command?.Action switch
            {
                LaunchAction.Repair => "repair",
                LaunchAction.Uninstall or LaunchAction.UnsafeUninstall => "uninstall",
                _ => payload.RecommendedMode
            }),
            InstallDir = installDir,
            InstallDesktopShortcuts = !IsFalsy(Environment.GetEnvironmentVariable("EVALUAPRO_INSTALL_DESKTOP_SHORTCUTS")),
            InstallStartMenuShortcuts = !IsFalsy(Environment.GetEnvironmentVariable("EVALUAPRO_INSTALL_STARTMENU_SHORTCUTS")),
            MongoUri = Environment.GetEnvironmentVariable("EVALUAPRO_MONGODB_URI") ?? "mongodb://mongo_local:27017/evaluapro",
            NodeEnv = Environment.GetEnvironmentVariable("EVALUAPRO_NODE_ENV") ?? "production",
            ApiPort = Environment.GetEnvironmentVariable("EVALUAPRO_API_PORT") ?? "4000",
            PortalPort = Environment.GetEnvironmentVariable("EVALUAPRO_PORTAL_PORT") ?? "4518",
            CorsOrigins = Environment.GetEnvironmentVariable("EVALUAPRO_CORS_ORIGINS") ?? "http://localhost:4173,http://127.0.0.1:4173",
            PortalAlumnoUrl = Environment.GetEnvironmentVariable("EVALUAPRO_PORTAL_ALUMNO_URL") ?? "https://portal-alumno.example.edu",
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
            try
            {
                ResetWorkflow(keepDetectionStage: true);
                SetStageState(StageRemediation, InstallerStageStatus.Running, "Resolviendo prerequisitos automáticamente.", "Preparando bootstrap guiado o semiautomático.");
                UpdateUiState(statusText: "Resolviendo prerequisitos automaticamente...", progress: 0, busy: true);
                Log("info", "Iniciando remediacion automatica de prerequisitos.");
                var remediationRequest = new Dictionary<string, object?>
                {
                    ["flavorId"] = request.FlavorId,
                    ["installDir"] = request.InstallDir,
                    ["autoRemediate"] = true
                };
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
                return;
            }

            if (detectionPayload is { Ready: false })
            {
                SetStageState(StageRemediation, InstallerStageStatus.Error, "La remediación terminó, pero el equipo sigue incompleto.", "Todavía falta una acción manual o un runtime válido.");
                FinalizeFailure("prerequisitos", 10, "El equipo no cumple los prerequisitos detectados por el bootstrapper.");
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
        UpdateUiState(statusText: "Planificando instalacion...", progress: 0, busy: true);
        engineHandle.SetVariableString("InstallFolder", request.InstallDir, false);
        engineHandle.SetVariableString("SelectedFlavorId", request.FlavorId, false);
        engineHandle.SetVariableNumeric("InstallDesktopShortcuts", request.InstallDesktopShortcuts ? 1 : 0);
        engineHandle.SetVariableNumeric("InstallStartMenuShortcuts", request.InstallStartMenuShortcuts ? 1 : 0);
        Log(
            "info",
            $"Snapshot MSI vars: InstallFolder='{request.InstallDir}', SelectedFlavorId='{request.FlavorId}', " +
            $"InstallDesktopShortcuts={(request.InstallDesktopShortcuts ? 1 : 0)}, InstallStartMenuShortcuts={(request.InstallStartMenuShortcuts ? 1 : 0)}, " +
            "REQUIRE_INSTALLER_HUB=1 (Bundle->MsiProperty)");

        var action = currentOperation switch
        {
            "repair" => LaunchAction.Repair,
            "uninstall" => LaunchAction.Uninstall,
            _ => LaunchAction.Install
        };

        engineHandle.Plan(action);
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
            SetStageState(StagePostInstall, InstallerStageStatus.Running, "Ejecutando helper post-instalación.", "Preparando la solicitud elevada.");
            var requestObject = new Dictionary<string, object?>
            {
                ["mode"] = currentOperation,
                ["flavorId"] = currentRequest.FlavorId,
                ["installDir"] = currentRequest.InstallDir,
                ["config"] = new Dictionary<string, object?>
                {
                    ["mongoUri"] = currentRequest.MongoUri,
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

            var requestPath = Path.Combine(requestRoot, $"post-install-{DateTime.UtcNow:yyyyMMddHHmmss}.request.json");
            pendingHelperResponsePath = Path.Combine(requestRoot, $"post-install-{DateTime.UtcNow:yyyyMMddHHmmss}.response.json");
            await File.WriteAllTextAsync(requestPath, JsonSerializer.Serialize(requestObject, JsonOptions), Encoding.UTF8).ConfigureAwait(false);

            var scriptPath = Path.Combine(payloadRoot, "InstallerBurnHelper.ps1");
            var args = BuildPowerShellArguments(scriptPath, requestPath, pendingHelperResponsePath);
            engineHandle?.LaunchApprovedExe(GetWindowHandle(), "PowerShellHost", args, 1500);
        }
        catch (Exception ex)
        {
            SetStageState(StagePostInstall, InstallerStageStatus.Error, "No se pudo iniciar el helper post-instalación.", ex.Message);
            FinalizeFailure("blindaje_licencia_local", 50, $"No se pudo iniciar helper post-install: {ex.Message}");
        }
    }

    private async Task WaitForHelperExitAsync(int processId, string responsePath)
    {
        try
        {
            using var process = Process.GetProcessById(processId);
            await process.WaitForExitAsync().ConfigureAwait(false);

            var envelope = await WaitForResponseFileAsync<Dictionary<string, object?>>(responsePath, TimeSpan.FromMinutes(3)).ConfigureAwait(false);
            helperInFlight = false;
            FlushHelperLogs(envelope.Logs);

            if (!envelope.Ok)
            {
                SetStageState(StagePostInstall, InstallerStageStatus.Error, "El helper post-instalación devolvió error.", envelope.Message ?? "No se completó la configuración final.");
                FinalizeFailure(envelope.Phase ?? "helper_post_install", envelope.ExitCode == 0 ? 50 : envelope.ExitCode, envelope.Message ?? "El helper post-install devolvio error.");
                return;
            }

            SetStageState(StagePostInstall, InstallerStageStatus.Ok, "Post-instalación completada.", envelope.Message ?? "EvaluaPro quedó configurado.");
            SetStageState(StageFinalize, InstallerStageStatus.Ok, "Instalación completada.", "EvaluaPro ya quedó listo para usarse.");
            UpdateUiState(statusText: "Instalacion completada.", progress: 100, busy: false);
            requestedExitCode = 0;

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
        catch (Exception ex)
        {
            FinalizeFailure("helper_post_install", 50, $"No se pudo esperar la salida del helper post-install: {ex.Message}");
        }
    }

    private async Task<HelperEnvelope<TData>> InvokeHelperAsync<TData>(string mode, Dictionary<string, object?> request, Action<HelperProgressEvent>? onProgress = null)
    {
        var requestPath = Path.Combine(requestRoot, $"{mode}-{DateTime.UtcNow:yyyyMMddHHmmss}.request.json");
        var responsePath = Path.Combine(requestRoot, $"{mode}-{DateTime.UtcNow:yyyyMMddHHmmss}.response.json");
        var scriptPath = Path.Combine(payloadRoot, "InstallerBurnHelper.ps1");

        await File.WriteAllTextAsync(requestPath, JsonSerializer.Serialize(request, JsonOptions), Encoding.UTF8).ConfigureAwait(false);

        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
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

        using var process = new Process
        {
            StartInfo = psi,
            EnableRaisingEvents = true
        };
        var stdoutLines = new List<string>();
        var stderrLines = new List<string>();
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

        if (!process.Start())
        {
            throw new InvalidOperationException("No se pudo iniciar PowerShell para el helper.");
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        await process.WaitForExitAsync().ConfigureAwait(false);
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

        return await WaitForResponseFileAsync<TData>(responsePath, TimeSpan.FromSeconds(20)).ConfigureAwait(false);
    }

    private static async Task<HelperEnvelope<TData>> WaitForResponseFileAsync<TData>(string responsePath, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow.Add(timeout);
        while (DateTime.UtcNow < deadline)
        {
            if (File.Exists(responsePath))
            {
                var raw = await File.ReadAllTextAsync(responsePath, Encoding.UTF8).ConfigureAwait(false);
                var envelope = JsonSerializer.Deserialize<HelperEnvelope<TData>>(raw, JsonOptions);
                if (envelope is not null)
                {
                    return envelope;
                }
            }

            await Task.Delay(350).ConfigureAwait(false);
        }

        throw new TimeoutException($"No se genero archivo de respuesta del helper: {responsePath}");
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
        var detectedMode = command?.Action switch
        {
            LaunchAction.Repair => "repair",
            LaunchAction.Uninstall or LaunchAction.UnsafeUninstall => "uninstall",
            _ => payload.RecommendedMode
        };

        var installDir = payload.Installation?.InstallLocation;
        if (string.IsNullOrWhiteSpace(installDir))
        {
            installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), payload.Flavor?.ProductName ?? "EvaluaPro");
        }

        var model = new WindowDetectionModel
        {
            FlavorId = payload.Flavor?.FlavorId ?? "docente-local",
            FlavorLabel = payload.Flavor?.DisplayName ?? "EvaluaPro",
            InstallDir = installDir,
            Mode = NormalizeMode(detectedMode),
            Summary = payload.System?.Issues?.Count > 0
                ? string.Join(" | ", payload.System.Issues)
                : payload.Runtime?.Reason ?? "Equipo listo para continuar.",
            Ready = payload.Ready,
            AssetName = payload.Flavor?.InstallerHubExeName ?? "EvaluaPro-InstallerHub-docente-local.exe",
            Prerequisites = payload.Prerequisites ?? [],
            AvailableFlavors = LoadFlavorItems()
        };

        DispatchToUi(() => window?.ApplyDetectionModel(model));
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

    private static string BuildPowerShellArguments(string scriptPath, string requestPath, string responsePath)
    {
        return string.Join(" ", new[]
        {
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", QuoteForCommandLine(scriptPath),
            "-Mode", "post-install",
            "-RequestPath", QuoteForCommandLine(requestPath),
            "-ResponsePath", QuoteForCommandLine(responsePath)
        });
    }

    private static string QuoteForCommandLine(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }

    private IntPtr GetWindowHandle()
    {
        if (window is null)
        {
            return IntPtr.Zero;
        }

        return window.Dispatcher.Invoke(() => new WindowInteropHelper(window).Handle);
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

    private void FinalizeFailure(string phase, int exitCode, string message)
    {
        requestedExitCode = exitCode;
        helperInFlight = false;
        applyInFlight = false;
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
            Log(string.IsNullOrWhiteSpace(entry.Level) ? "info" : entry.Level, entry.Message ?? string.Empty, includeTimestamp: false);
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
    public string MongoUri { get; set; } = "mongodb://mongo_local:27017/evaluapro";
    public string NodeEnv { get; set; } = "production";
    public string ApiPort { get; set; } = "4000";
    public string PortalPort { get; set; } = "4518";
    public string CorsOrigins { get; set; } = "http://localhost:4173,http://127.0.0.1:4173";
    public string PortalAlumnoUrl { get; set; } = "https://portal-alumno.example.edu";
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
}

public sealed class FlavorPayload
{
    public string FlavorId { get; set; } = "docente-local";
    public string DisplayName { get; set; } = "EvaluaPro";
    public string ProductName { get; set; } = "EvaluaPro";
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
