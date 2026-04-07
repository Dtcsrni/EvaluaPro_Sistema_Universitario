using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
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

    private readonly object sync = new();
    private readonly TaskCompletionSource<bool> uiReady = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource<int> operationFinished = new(TaskCreationOptions.RunContinuationsAsynchronously);

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
    private int requestedExitCode;
    private string currentOperation = "install";
    private DetectionPayload? detectionPayload;
    private HelperEnvelope<DetectionPayload>? helperDetectionResponse;
    private string? pendingHelperResponsePath;
    private BootstrapperRequest? currentRequest;

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
            FinalizeFailure("accion_producto", 30, $"La planificacion del bundle fallo con status={args.Status}.");
            return;
        }

        applyInFlight = true;
        UpdateUiState(statusText: "Aplicando MSI de EvaluaPro...", progress: 0, busy: true);
        engineHandle?.Apply(GetWindowHandle());
    }

    protected override void OnProgress(ProgressEventArgs args)
    {
        base.OnProgress(args);
        UpdateUiState(progress: args.OverallPercentage);
    }

    protected override void OnExecutePackageComplete(ExecutePackageCompleteEventArgs args)
    {
        base.OnExecutePackageComplete(args);
        Log(args.Status == 0 || args.Status == 3010 ? "info" : "warn", $"ExecutePackageComplete package={args.PackageId} status={args.Status}");
    }

    protected override void OnApplyComplete(ApplyCompleteEventArgs args)
    {
        base.OnApplyComplete(args);
        applyInFlight = false;

        if (args.Status != 0)
        {
            FinalizeFailure("accion_producto", 30, $"La ejecucion del bundle fallo con status={args.Status}.");
            return;
        }

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
                        UpdateUiState(statusText: statusText, progress: progressValue, busy: true);
                    }).ConfigureAwait(false);
                FlushHelperLogs(remediationResponse.Logs);
                helperDetectionLogsFlushed = true;
                helperDetectionResponse = remediationResponse;
                detectionPayload = remediationResponse.Data;

                if (detectionPayload is not null)
                {
                    UpdateWindowFromDetection(detectionPayload);
                }
            }
            catch (Exception ex)
            {
                FinalizeFailure("prerequisitos", 10, $"No se pudo ejecutar la remediacion automatica de prerequisitos: {ex.Message}");
                return;
            }

            if (detectionPayload is { Ready: false })
            {
                FinalizeFailure("prerequisitos", 10, "El equipo no cumple los prerequisitos detectados por el bootstrapper.");
                return;
            }
        }

        startRequested = true;
        currentRequest = request;
        currentOperation = normalizedOperation;

        UpdateUiState(statusText: "Planificando instalacion...", progress: 0, busy: true);
        engineHandle.SetVariableString("InstallFolder", request.InstallDir, false);
        engineHandle.SetVariableString("SelectedFlavorId", request.FlavorId, false);
        engineHandle.SetVariableNumeric("InstallDesktopShortcuts", request.InstallDesktopShortcuts ? 1 : 0);
        engineHandle.SetVariableNumeric("InstallStartMenuShortcuts", request.InstallStartMenuShortcuts ? 1 : 0);

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
                FinalizeFailure(envelope.Phase ?? "helper_post_install", envelope.ExitCode == 0 ? 50 : envelope.ExitCode, envelope.Message ?? "El helper post-install devolvio error.");
                return;
            }

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
            Log("warn", $"[helper:{mode}:stderr] {TrimForLog(stderr)}");
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
        Log("error", $"[{phase}] {message}");
        if (!helperDetectionLogsFlushed)
        {
            FlushHelperLogs(helperDetectionResponse?.Logs);
            helperDetectionLogsFlushed = true;
        }

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
