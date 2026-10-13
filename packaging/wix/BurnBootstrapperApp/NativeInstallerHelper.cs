using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace EvaluaPro.BurnBootstrapperApp;

internal static class NativeInstallerHelper
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };
    private const string ProgressPrefix = "EVALUAPRO_PROGRESS:";
    private const int MaxArchiveEntryCount = 100_000;
    private const long MaxArchiveExpandedBytes = 12L * 1024 * 1024 * 1024;

    internal static int Run(string[] args)
    {
        string mode = string.Empty;
        string requestPath = string.Empty;
        string responsePath = string.Empty;
        string? operationId = null;
        try
        {
            (mode, requestPath, responsePath) = ParseArguments(args);
            var request = ReadRequest(requestPath, mode);
            operationId = request.OperationId;
            var targetDir = GetString(request.Payload, "installDir", "targetDir");

            if (mode == "post-install" && RequiresElevation(targetDir) && !IsAdministrator())
                throw new UnauthorizedAccessException("La operación requiere elevación. El flujo debe reintentarse mediante WiX Burn para que UAC y la transacción sigan bajo control del instalador.");

            object? data = mode switch
            {
                "detect-prereqs" => DetectPrerequisites(request.Payload),
                "post-install" => InstallOrRepair(request, responsePath),
                "uninstall" => PreserveAfterUninstall(request.Payload),
                _ => throw new InvalidOperationException($"Modo nativo de Installer Hub no soportado: {mode}.")
            };

            WriteResponse(responsePath, operationId, ok: true, phase: $"native_{mode}", exitCode: 0,
                message: mode == "detect-prereqs" ? "Detección nativa completada." : "Operación nativa completada.", data);
            return 0;
        }
        catch (Exception ex)
        {
            var responseId = operationId ?? Guid.Empty.ToString("D");
            if (!string.IsNullOrWhiteSpace(responsePath))
            {
                try
                {
                    WriteResponse(responsePath, responseId, ok: false, phase: "native_helper_error", exitCode: 1,
                        message: Sanitize(ex.Message), data: null);
                }
                catch { }
            }
            Console.Error.WriteLine($"Native Installer Hub helper failed ({ex.GetType().Name}): {Sanitize(ex.Message)}");
            return 1;
        }
    }

    private static (string Mode, string RequestPath, string ResponsePath) ParseArguments(string[] args)
    {
        string Read(string name)
        {
            var index = Array.FindIndex(args, value => string.Equals(value, name, StringComparison.Ordinal));
            if (index < 0 || index + 1 >= args.Length || string.IsNullOrWhiteSpace(args[index + 1]))
                throw new ArgumentException($"Falta el argumento requerido {name}.");
            return args[index + 1];
        }

        var mode = Read("--mode");
        if (mode is not ("detect-prereqs" or "post-install" or "uninstall"))
            throw new ArgumentException("El modo del helper no está permitido.");
        var requestPath = Path.GetFullPath(Read("--request"));
        var responsePath = Path.GetFullPath(Read("--response"));
        if (!string.Equals(Path.GetDirectoryName(requestPath), Path.GetDirectoryName(responsePath), StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Los archivos privados de solicitud y respuesta deben compartir directorio.");
        return (mode, requestPath, responsePath);
    }

    private static InstallerRequest ReadRequest(string path, string expectedMode)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("No existe la solicitud privada del Installer Hub.");
        var info = new FileInfo(path);
        if ((info.Attributes & FileAttributes.ReparsePoint) != 0) throw new InvalidOperationException("La solicitud privada es un enlace y se rechaza.");
        using var json = JsonDocument.Parse(File.ReadAllBytes(path));
        var root = json.RootElement;
        if (root.GetProperty("schemaVersion").GetInt32() != 1) throw new InvalidOperationException("Versión de contrato de solicitud no soportada.");
        var operationId = root.GetProperty("operationId").GetString();
        if (!Guid.TryParse(operationId, out var parsedId)) throw new InvalidOperationException("Identificador de operación no válido.");
        if (!string.Equals(root.GetProperty("command").GetString(), expectedMode, StringComparison.Ordinal))
            throw new InvalidOperationException("El comando no corresponde al modo solicitado.");
        var issued = root.GetProperty("issuedAtUtc").GetDateTimeOffset();
        var expires = root.GetProperty("expiresAtUtc").GetDateTimeOffset();
        var now = DateTimeOffset.UtcNow;
        if (issued > now.AddMinutes(2) || expires <= now || expires - issued > TimeSpan.FromMinutes(30))
            throw new InvalidOperationException("La solicitud venció o su ventana temporal no es válida.");
        var payload = root.GetProperty("payload");
        if (payload.ValueKind != JsonValueKind.Object) throw new InvalidOperationException("El payload de solicitud debe ser un objeto.");
        var payloadMap = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(payload.GetRawText(), JsonOptions)
            ?? throw new InvalidOperationException("No se pudo leer el payload de solicitud.");

        if (root.TryGetProperty("protectedSecrets", out var protectedSecrets) && protectedSecrets.ValueKind == JsonValueKind.String)
        {
            var encrypted = Convert.FromBase64String(protectedSecrets.GetString() ?? string.Empty);
            var plain = ProtectedData.Unprotect(encrypted, optionalEntropy: null, DataProtectionScope.LocalMachine);
            try
            {
                using var secretsDocument = JsonDocument.Parse(plain);
                var config = payloadMap.TryGetValue("config", out var configValue) && configValue.ValueKind == JsonValueKind.Object
                    ? JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(configValue.GetRawText(), JsonOptions) ?? new(StringComparer.OrdinalIgnoreCase)
                    : new(StringComparer.OrdinalIgnoreCase);
                foreach (var property in secretsDocument.RootElement.EnumerateObject())
                {
                    if (property.Name is not ("portalAlumnoApiKey" or "portalApiKey" or "codigoActivacion"))
                        throw new InvalidOperationException("La solicitud contiene un secreto no permitido.");
                    config[property.Name] = JsonSerializer.SerializeToElement(property.Value.GetString() ?? string.Empty);
                }
                payloadMap["config"] = JsonSerializer.SerializeToElement(config);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(encrypted);
                CryptographicOperations.ZeroMemory(plain);
            }
        }

        return new InstallerRequest(parsedId.ToString("D"), payloadMap);
    }

    private static object DetectPrerequisites(IReadOnlyDictionary<string, JsonElement> payload)
    {
        var flavorId = GetString(payload, "flavorId");
        if (string.IsNullOrWhiteSpace(flavorId)) flavorId = "docente-local";
        var installDir = ResolveInstallDirectory(payload);
        var edgeVersion = ReadWebView2Version();
        var manifestPath = Path.Combine(installDir, "logs", "installation.manifest.json");
        var appExe = Path.Combine(installDir, "EvaluaPro.exe");
        var packagePath = Path.Combine(installDir, "package.json");
        var payloadPresent = File.Exists(appExe) && File.Exists(packagePath);
        var manifestPresent = File.Exists(manifestPath);
        var installed = payloadPresent || manifestPresent;
        var state = installed ? (payloadPresent && manifestPresent ? "repairable" : "orphaned") : "unknown";
        var instance = new Dictionary<string, object?>
        {
            ["installDir"] = installDir,
            ["dataDir"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "EvaluaPro", "data"),
            ["flavorId"] = flavorId,
            ["version"] = ReadPackageVersion(packagePath),
            ["manifestPresent"] = manifestPresent,
            ["payloadPresent"] = payloadPresent,
            ["dataPresent"] = Directory.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "EvaluaPro", "data")),
            ["state"] = state,
            ["readOnlyInventory"] = true,
            ["preserveDataByDefault"] = true,
            ["cleanupRequiresExplicitConfirmation"] = true
        };
        var lifecycle = new Dictionary<string, object?>
        {
            ["requestedFlavorId"] = flavorId,
            ["instances"] = installed ? new[] { instance } : Array.Empty<object>(),
            ["state"] = state,
            ["recommendedMode"] = installed ? "repair" : "install",
            ["preserveDataByDefault"] = true,
            ["cleanupRequiresExplicitConfirmation"] = true
        };
        var prerequisites = new[]
        {
            new { name = "Microsoft Edge WebView2 Runtime", installed = !string.IsNullOrWhiteSpace(edgeVersion), actualVersion = edgeVersion ?? "No detectado", reason = "Permite la interfaz docente de EvaluaPro." },
            new { name = "Node.js portable (incluido)", installed = true, actualVersion = "Se provisiona con el payload local.", reason = "No requiere Node.js global ni cambios al entorno del usuario." },
            new { name = "Espacio para instalación", installed = true, actualVersion = "Validado por Burn/MSI.", reason = "Burn controla espacio, instalación y recuperación." }
        };
        var ready = !string.IsNullOrWhiteSpace(edgeVersion);
        var autoRemediate = GetBool(payload, "autoRemediate");
        return new Dictionary<string, object?>
        {
            ["ready"] = ready,
            ["recommendedMode"] = installed ? "repair" : "install",
            ["installation"] = new { installed, installLocation = installDir },
            ["lifecycle"] = lifecycle,
            ["prerequisites"] = prerequisites,
            ["system"] = new { issues = ready ? Array.Empty<string>() : new[] { "Instala Microsoft Edge WebView2 Runtime y vuelve a intentar." } },
            ["remediation"] = new { attempted = autoRemediate, ok = false, requiresRestart = false, restartReason = string.Empty, resumeToken = string.Empty, phase = "" }
        };
    }

    private static object InstallOrRepair(InstallerRequest request, string responsePath)
    {
        var payload = request.Payload;
        var mode = GetString(payload, "mode");
        if (mode is not ("install" or "repair")) throw new InvalidOperationException("La operación de instalación no es válida.");
        var flavor = GetString(payload, "flavorId");
        if (!string.Equals(flavor, "docente-local", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("El helper nativo solo admite el perfil docente-local; no se aplicó ningún cambio.");
        var targetDir = ValidateInstallDirectory(ResolveInstallDirectory(payload));
        using var rootLock = AcquireRootLock(targetDir, TimeSpan.FromSeconds(30));
        RecoverTransaction(targetDir);
        ReportProgress(3, "Comprobando procesos de EvaluaPro antes de actualizar.");
        StopOwnedNodeProcesses(targetDir);

        var archivePath = Path.Combine(targetDir, "evaluapro-native-dist.zip");
        if (!File.Exists(archivePath)) throw new FileNotFoundException("El MSI no instaló el archivo de payload nativo requerido.");
        if ((File.GetAttributes(archivePath) & FileAttributes.ReparsePoint) != 0) throw new InvalidOperationException("El archivo de payload es un enlace y se rechaza.");

        var stageDir = Path.Combine(targetDir, ".payload-stage-" + Guid.NewGuid().ToString("N"));
        var transactionDir = Path.Combine(targetDir, ".evaluapro-payload-transaction");
        var transactionStarted = false;
        try
        {
            Directory.CreateDirectory(stageDir);
            ReportProgress(8, "Extrayendo y validando el payload.");
            ExtractArchiveSafely(archivePath, stageDir);
            var payloadVersion = ValidateStagedPayload(stageDir);
            var stagedRoots = Directory.EnumerateFileSystemEntries(stageDir).Select(Path.GetFileName).Where(name => !string.IsNullOrWhiteSpace(name)).Cast<string>().ToList();
            if (stagedRoots.Any(name => name is "data" or ".env" or ".evaluapro-payload-transaction" || name.Contains('/') || name.Contains('\\')))
                throw new InvalidDataException("El payload contiene una raíz protegida o inválida.");

            Directory.CreateDirectory(Path.Combine(transactionDir, "backup"));
            var entries = stagedRoots.Select(name => new TransactionEntry(name, File.Exists(Path.Combine(targetDir, name)) || Directory.Exists(Path.Combine(targetDir, name)), false))
                .Append(new TransactionEntry(".env", File.Exists(Path.Combine(targetDir, ".env")), true))
                .Append(new TransactionEntry(Path.Combine("logs", "installation.manifest.json"), File.Exists(Path.Combine(targetDir, "logs", "installation.manifest.json")), true))
                .ToArray();
            var journal = new TransactionJournal(1, targetDir, "validated", request.OperationId, Guid.NewGuid().ToString("N"), entries);
            WriteJournal(transactionDir, journal);
            foreach (var entry in entries.Where(entry => entry.Snapshot && entry.Existed))
            {
                var source = ResolveTransactionEntry(targetDir, entry.Name);
                var backup = ResolveTransactionEntry(Path.Combine(transactionDir, "backup"), entry.Name);
                if ((File.GetAttributes(source) & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidDataException($"El archivo de configuración previo es un enlace y se rechaza: {entry.Name}.");
                CopyPath(source, backup);
            }
            journal = journal with { State = "promoting" };
            WriteJournal(transactionDir, journal);
            transactionStarted = true;

            for (var index = 0; index < stagedRoots.Count; index++)
            {
                var name = stagedRoots[index];
                var source = Path.Combine(stageDir, name);
                var destination = ResolveTransactionEntry(targetDir, name);
                var backup = ResolveTransactionEntry(Path.Combine(transactionDir, "backup"), name);
                if (File.Exists(destination) || Directory.Exists(destination))
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(backup)!);
                    MovePath(destination, backup);
                }
                if (!File.Exists(source) && !Directory.Exists(source)) throw new IOException($"El payload validado desapareció: {name}.");
                MovePath(source, destination);
                ReportProgress(12 + (int)Math.Round((index + 1d) / Math.Max(1, stagedRoots.Count) * 35), $"Aplicando componente {index + 1} de {stagedRoots.Count}.");
            }

            journal = journal with { State = "configuring" };
            WriteJournal(transactionDir, journal);
            ConfigureRuntime(targetDir, payload);
            EnsureSqlite(targetDir);
            ReportProgress(78, "Validando runtime y manifiesto de instalación.");
            var nodeVersion = ValidateRuntime(targetDir);
            var manifest = CreateInstallationManifest(targetDir, payloadVersion, nodeVersion);
            WriteJsonAtomic(Path.Combine(targetDir, "logs", "installation.manifest.json"), manifest);
            ValidateInstallationManifest(Path.Combine(targetDir, "logs", "installation.manifest.json"), targetDir, nodeVersion);
            journal = journal with { State = "committed" };
            WriteJournal(transactionDir, journal);
            Directory.Delete(transactionDir, recursive: true);
            ReportProgress(100, "Instalación y verificación nativa completadas.");
            return new Dictionary<string, object?>
            {
                ["installed"] = true,
                ["installDir"] = targetDir,
                ["version"] = payloadVersion,
                ["nodeVersion"] = nodeVersion,
                ["transactionPending"] = false,
                ["dataPreserved"] = true,
                ["shortcutsManagedBy"] = "Windows Installer"
            };
        }
        catch (Exception operationError)
        {
            if (transactionStarted)
            {
                try { RecoverTransaction(targetDir); }
                catch (Exception rollbackError)
                {
                    throw new InvalidOperationException($"Falló la operación y el rollback requiere recuperación manual. Se conserva la transacción en '{transactionDir}'. Error operación: {Sanitize(operationError.Message)}. Error rollback: {Sanitize(rollbackError.Message)}", operationError);
                }
            }
            throw;
        }
        finally
        {
            try { if (Directory.Exists(stageDir)) Directory.Delete(stageDir, recursive: true); } catch { }
        }
    }

    private static object PreserveAfterUninstall(IReadOnlyDictionary<string, JsonElement> payload)
    {
        var targetDir = ValidateInstallDirectory(ResolveInstallDirectory(payload));
        var dataDir = GetString(payload, "dataDir");
        if (string.IsNullOrWhiteSpace(dataDir))
            dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "EvaluaPro", "data");
        if (!Directory.Exists(targetDir))
        {
            return new Dictionary<string, object?>
            {
                ["dataPreservedByDefault"] = true,
                ["preservedDataDir"] = Directory.Exists(dataDir) ? Path.GetFullPath(dataDir) : null,
                ["ownedNodeProcesses"] = Array.Empty<int>(),
                ["exportedBackup"] = null
            };
        }

        using var rootLock = AcquireRootLock(targetDir, TimeSpan.FromSeconds(30));
        RecoverTransaction(targetDir);
        StopOwnedNodeProcesses(targetDir);

        var transactionDir = Path.Combine(targetDir, ".evaluapro-payload-transaction");
        Directory.CreateDirectory(Path.Combine(transactionDir, "backup"));
        var entries = Directory.EnumerateFileSystemEntries(targetDir)
            .Select(Path.GetFileName)
            .Where(name => !string.IsNullOrWhiteSpace(name)
                && !string.Equals(name, "data", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(name, ".evaluapro-payload-transaction", StringComparison.OrdinalIgnoreCase))
            .Cast<string>()
            .Select(name => new TransactionEntry(name, Existed: true, Snapshot: false))
            .ToArray();
        var journal = new TransactionJournal(1, targetDir, "promoting", Guid.NewGuid().ToString("D"), Guid.NewGuid().ToString("N"), entries);
        WriteJournal(transactionDir, journal);
        try
        {
            foreach (var entry in entries)
            {
                var source = ResolveTransactionEntry(targetDir, entry.Name);
                if ((File.GetAttributes(source) & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidDataException($"La desinstalación encontró un enlace y se detuvo sin borrarlo: {entry.Name}.");
                MovePath(source, ResolveTransactionEntry(Path.Combine(transactionDir, "backup"), entry.Name));
            }
            WriteJournal(transactionDir, journal with { State = "committed" });
            Directory.Delete(transactionDir, recursive: true);
        }
        catch
        {
            RecoverTransaction(targetDir);
            throw;
        }

        try
        {
            if (Directory.Exists(targetDir) && !Directory.EnumerateFileSystemEntries(targetDir).Any()) Directory.Delete(targetDir);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        return new Dictionary<string, object?>
        {
            ["dataPreservedByDefault"] = true,
            ["preservedDataDir"] = Directory.Exists(dataDir) ? Path.GetFullPath(dataDir) : null,
            ["ownedNodeProcesses"] = Array.Empty<int>(),
            ["exportedBackup"] = null
        };
    }

    private static void ConfigureRuntime(string root, IReadOnlyDictionary<string, JsonElement> payload)
    {
        var config = GetObject(payload, "config");
        var envPath = Path.Combine(root, ".env");
        var values = File.Exists(envPath) ? ReadEnv(envPath) : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var mappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["NODE_ENV"] = GetString(config, "nodeEnv", "NODE_ENV"),
            ["PUERTO_API"] = GetString(config, "puertoApi", "PUERTO_API"),
            ["PUERTO_PORTAL"] = GetString(config, "puertoPortal", "PUERTO_PORTAL"),
            ["CORS_ORIGENES"] = GetString(config, "corsOrigenes", "CORS_ORIGENES"),
            ["PORTAL_ALUMNO_URL"] = GetString(config, "portalAlumnoUrl", "PORTAL_ALUMNO_URL"),
            ["PORTAL_ALUMNO_API_KEY"] = GetString(config, "portalAlumnoApiKey", "PORTAL_ALUMNO_API_KEY"),
            ["PORTAL_API_KEY"] = GetString(config, "portalApiKey", "PORTAL_API_KEY"),
            ["PASSWORD_RESET_ENABLED"] = GetString(config, "passwordResetEnabled", "PASSWORD_RESET_ENABLED"),
            ["PASSWORD_RESET_URL_BASE"] = GetString(config, "passwordResetUrlBase", "PASSWORD_RESET_URL_BASE"),
            ["EVALUAPRO_FLAVOR"] = GetString(config, "flavorId", "flavorId")
        };
        foreach (var pair in mappings)
        {
            if (!string.IsNullOrWhiteSpace(pair.Value)) values[pair.Key] = pair.Value;
        }
        if (string.IsNullOrWhiteSpace(GetString(values, "NODE_ENV"))) values["NODE_ENV"] = "production";
        if (string.IsNullOrWhiteSpace(GetString(values, "EVALUAPRO_FLAVOR"))) values["EVALUAPRO_FLAVOR"] = "docente-local";
        if (string.IsNullOrWhiteSpace(GetString(values, "PUERTO_API"))) values["PUERTO_API"] = "4000";
        if (string.IsNullOrWhiteSpace(GetString(values, "PUERTO_PORTAL"))) values["PUERTO_PORTAL"] = "4518";
        if (string.IsNullOrWhiteSpace(GetString(values, "CORS_ORIGENES"))) values["CORS_ORIGENES"] = "http://localhost:4173,http://127.0.0.1:4173";
        if (string.IsNullOrWhiteSpace(GetString(values, "JWT_SECRETO"))) values["JWT_SECRETO"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));

        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var qaRootPrefix = Path.GetFullPath(Path.Combine(localAppData, "EvaluaPro-QA-Isolated-"));
        var fullRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var isQaInstall = fullRoot.StartsWith(qaRootPrefix, StringComparison.OrdinalIgnoreCase);
        var flavor = GetString(config, "flavorId", "flavorId");
        if (string.IsNullOrWhiteSpace(flavor)) flavor = GetString(values, "EVALUAPRO_FLAVOR");
        if (string.IsNullOrWhiteSpace(flavor)) flavor = "docente-local";
        var dataRoot = flavor.Equals("docente-local", StringComparison.OrdinalIgnoreCase)
            ? isQaInstall
                ? Path.Combine(fullRoot, "data")
                : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "EvaluaPro", "data")
            : Path.Combine(localAppData, "EvaluaPro", "data");
        Directory.CreateDirectory(dataRoot);
        var databaseUrl = GetString(config, "databaseUrl", "DATABASE_URL");
        if (string.IsNullOrWhiteSpace(databaseUrl)) databaseUrl = GetString(values, "DATABASE_URL");
        if (string.IsNullOrWhiteSpace(databaseUrl) || isQaInstall)
            databaseUrl = "file:" + Path.Combine(dataRoot, "evaluapro.db").Replace('\\', '/');
        values["DATABASE_URL"] = databaseUrl;
        values["BACKEND_DATABASE_URL"] = databaseUrl;
        values["BACKEND_DATA_DIR_DEV"] = "./apps/backend/data/examenes_dev";
        values["BACKEND_DATA_DIR_PROD"] = "./apps/backend/data/examenes_prod";

        var updateConfig = new Dictionary<string, object?>
        {
            ["channel"] = "stable",
            ["flavorId"] = "docente-local",
            ["owner"] = "Dtcsrni",
            ["repo"] = "EvaluaPro_Sistema_Universitario",
            ["assetName"] = "EvaluaPro-InstallerHub-docente-local.exe",
            ["sha256AssetName"] = "EvaluaPro-InstallerHub-docente-local.exe.sha256",
            ["requireSha256"] = true,
            ["autoCheckEnabled"] = true,
            ["feedUrl"] = "https://api.github.com/repos/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest"
        };
        WriteAtomicText(envPath, string.Join(Environment.NewLine, values.OrderBy(x => x.Key, StringComparer.OrdinalIgnoreCase).Select(x => $"{x.Key}={EscapeEnv(x.Value)}")) + Environment.NewLine);
        WriteJsonAtomic(Path.Combine(root, "config", "update-config.json"), updateConfig);
    }

    private static void EnsureSqlite(string root)
    {
        var databaseUrl = ReadEnv(Path.Combine(root, ".env")).GetValueOrDefault("DATABASE_URL", string.Empty);
        var databasePath = databaseUrl.StartsWith("file:", StringComparison.OrdinalIgnoreCase) ? databaseUrl[5..].Replace('/', Path.DirectorySeparatorChar) : string.Empty;
        if (string.IsNullOrWhiteSpace(databasePath)) throw new InvalidOperationException("DATABASE_URL no apunta a una base SQLite local file:.");
        var schemaPath = Path.Combine(root, "apps", "backend", "dist", "prisma", "schema.sql");
        var bootstrapPath = Path.Combine(root, "scripts", "prepare-docente-sqlite.mjs");
        if (!File.Exists(schemaPath) || !File.Exists(bootstrapPath)) throw new FileNotFoundException("El payload no contiene el esquema o bootstrap SQLite requeridos.");
        var node = Path.Combine(root, "runtime", "node", "node.exe");
        RunBoundedProcess(node, [bootstrapPath, "--database", databasePath, "--schema-sql", schemaPath], root, TimeSpan.FromMinutes(2));
    }

    private static string ValidateStagedPayload(string stageRoot)
    {
        var required = new[]
        {
            "EvaluaPro.exe",
            Path.Combine("apps", "backend", "dist", "index.js"),
            Path.Combine("apps", "backend", "dist", "prisma", "schema.sql"),
            Path.Combine("apps", "backend", "package.json"),
            Path.Combine("runtime", "node", "node.exe"),
            Path.Combine("scripts", "start-docente-native.mjs"),
            Path.Combine("scripts", "runtime-env.mjs"),
            Path.Combine("scripts", "prepare-docente-sqlite.mjs")
        };
        foreach (var relative in required)
        {
            var path = ResolveTransactionEntry(stageRoot, relative);
            if (!File.Exists(path) || (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidDataException($"Payload nativo incompleto: falta {relative}.");
        }
        var packagePath = Path.Combine(stageRoot, "apps", "backend", "package.json");
        using var package = JsonDocument.Parse(File.ReadAllText(packagePath));
        var version = package.RootElement.GetProperty("version").GetString() ?? string.Empty;
        if (!Version.TryParse(version, out _)) throw new InvalidDataException("La versión del payload no es válida.");
        return version;
    }

    private static string ValidateRuntime(string root)
    {
        var node = Path.Combine(root, "runtime", "node", "node.exe");
        var version = RunBoundedProcess(node, ["--version"], root, TimeSpan.FromSeconds(15)).Trim();
        if (!Regex.IsMatch(version, "^v24\\.\\d+\\.\\d+$", RegexOptions.CultureInvariant))
            throw new InvalidDataException($"Runtime Node.js inválido: se esperaba 24.x y se detectó '{version}'.");
        return version;
    }

    private static object CreateInstallationManifest(string root, string version, string nodeVersion)
    {
        var criticalPaths = new[]
        {
            "EvaluaPro.exe", "apps/backend/dist/index.js", "apps/backend/dist/prisma/schema.sql",
            "runtime/node/node.exe", "scripts/start-docente-native.mjs", "scripts/prepare-docente-sqlite.mjs",
            "config/update-config.json"
        };
        var criticalFiles = criticalPaths.Select(relative =>
        {
            var full = ResolveTransactionEntry(root, relative);
            var exists = File.Exists(full);
            return new { path = relative.Replace('\\', '/'), exists, sha256 = exists ? Convert.ToHexString(SHA256.HashData(File.OpenRead(full))).ToLowerInvariant() : string.Empty };
        }).ToArray();
        return new
        {
            schemaVersion = 1,
            app = new { name = "EvaluaPro", version },
            installation = new { root = root, installed = true, port = 4519, flavor = "docente-local", installedAtUtc = DateTimeOffset.UtcNow.ToString("O") },
            runtime = new { embeddedNode = new { present = true, path = "runtime/node/node.exe", version = nodeVersion } },
            criticalFiles,
            update = new { channel = "stable", owner = "Dtcsrni", repo = "EvaluaPro_Sistema_Universitario" }
        };
    }

    private static void ValidateInstallationManifest(string manifestPath, string expectedRoot, string expectedNodeVersion)
    {
        using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
        var root = manifest.RootElement;
        foreach (var name in new[] { "app", "installation", "runtime", "criticalFiles" })
            if (!root.TryGetProperty(name, out _)) throw new InvalidDataException($"Manifiesto de instalación inválido: falta {name}.");
        if (!Path.GetFullPath(root.GetProperty("installation").GetProperty("root").GetString() ?? string.Empty).Equals(expectedRoot, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("El manifiesto corresponde a otra raíz.");
        if (root.GetProperty("runtime").GetProperty("embeddedNode").GetProperty("version").GetString() != expectedNodeVersion)
            throw new InvalidDataException("El manifiesto no coincide con la versión verificada del runtime Node.");
        if (!Version.TryParse(root.GetProperty("app").GetProperty("version").GetString(), out _))
            throw new InvalidDataException("El manifiesto no declara una versión válida.");
    }

    private static void ExtractArchiveSafely(string archivePath, string stageRoot)
    {
        var stageFull = Path.GetFullPath(stageRoot) + Path.DirectorySeparatorChar;
        using var archive = ZipFile.OpenRead(archivePath);
        if (archive.Entries.Count == 0 || archive.Entries.Count > MaxArchiveEntryCount) throw new InvalidDataException("El archivo de payload tiene un número de entradas no válido.");
        long totalBytes = 0;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in archive.Entries)
        {
            totalBytes = checked(totalBytes + entry.Length);
            if (totalBytes > MaxArchiveExpandedBytes) throw new InvalidDataException("El payload supera el límite de extracción permitido.");
            var normalized = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
            if (Path.IsPathRooted(normalized) || normalized.Split(Path.DirectorySeparatorChar).Any(part => part is ".." or "."))
                throw new InvalidDataException("El payload contiene una ruta de extracción no permitida.");
            var destination = Path.GetFullPath(Path.Combine(stageRoot, normalized));
            if (!destination.StartsWith(stageFull, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("El payload sale del directorio de extracción.");
            if (!seen.Add(destination)) throw new InvalidDataException("El payload contiene rutas duplicadas.");
            var unixMode = (entry.ExternalAttributes >> 16) & 0xF000;
            if (unixMode == 0xA000) throw new InvalidDataException("El payload contiene un enlace simbólico.");
            if (entry.FullName.EndsWith('/') || entry.FullName.EndsWith('\\'))
            {
                Directory.CreateDirectory(destination);
                continue;
            }
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            using var source = entry.Open();
            using var target = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            source.CopyTo(target);
            target.Flush(flushToDisk: true);
        }
    }

    private static void StopOwnedNodeProcesses(string root)
    {
        var nodePath = Path.GetFullPath(Path.Combine(root, "runtime", "node", "node.exe"));
        if (!File.Exists(nodePath)) return;
        var owned = new List<int>();
        foreach (var process in Process.GetProcessesByName("node"))
        {
            using (process)
            {
                string executable;
                try { executable = process.MainModule?.FileName ?? throw new InvalidOperationException($"No se pudo leer la imagen del proceso Node PID={process.Id}."); }
                catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException or NotSupportedException)
                {
                    throw new InvalidOperationException($"No se pudo verificar de forma segura un proceso Node PID={process.Id}; se cancela la actualización.", ex);
                }
                if (Path.GetFullPath(executable).Equals(nodePath, StringComparison.OrdinalIgnoreCase)) owned.Add(process.Id);
            }
        }

        foreach (var processId in owned)
        {
            using var process = Process.GetProcessById(processId);
            var executable = process.MainModule?.FileName;
            if (string.IsNullOrWhiteSpace(executable) || !Path.GetFullPath(executable).Equals(nodePath, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException($"La identidad del proceso cambió antes de detener PID={processId}.");
            process.Kill(entireProcessTree: true);
        }

        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (DateTime.UtcNow < deadline)
        {
            var remaining = owned.Where(IsProcessRunning).ToArray();
            if (remaining.Length == 0) return;
            Thread.Sleep(250);
        }
        throw new TimeoutException("No se detuvieron todos los procesos Node propios dentro de 15 segundos; el payload no se modificó.");
    }

    private static bool IsProcessRunning(int pid)
    {
        try { using var process = Process.GetProcessById(pid); return !process.HasExited; }
        catch (ArgumentException) { return false; }
    }

    private static string RunBoundedProcess(string executable, IReadOnlyList<string> args, string workingDirectory, TimeSpan timeout)
    {
        var start = new ProcessStartInfo { FileName = executable, WorkingDirectory = workingDirectory, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var arg in args) start.ArgumentList.Add(arg);
        using var process = new Process { StartInfo = start };
        if (!process.Start()) throw new InvalidOperationException($"No se pudo iniciar el proceso requerido: {Path.GetFileName(executable)}.");
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        if (!process.WaitForExit((int)timeout.TotalMilliseconds))
        {
            try { process.Kill(entireProcessTree: true); } catch { }
            process.WaitForExit(5_000);
            throw new TimeoutException($"El proceso {Path.GetFileName(executable)} excedió el límite de {timeout.TotalSeconds:0} segundos.");
        }
        var output = stdout.GetAwaiter().GetResult();
        var error = stderr.GetAwaiter().GetResult();
        if (process.ExitCode != 0) throw new InvalidOperationException($"El proceso {Path.GetFileName(executable)} devolvió código {process.ExitCode}: {Sanitize(error)}");
        return string.IsNullOrWhiteSpace(output) ? error : output;
    }

    private static string ValidateInstallDirectory(string directory)
    {
        var root = Path.GetFullPath(directory).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var volumeRoot = Path.GetPathRoot(root);
        if (string.IsNullOrWhiteSpace(volumeRoot) || string.Equals(root, volumeRoot.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("La carpeta de instalación no puede ser la raíz de una unidad.");
        var current = root;
        while (!string.IsNullOrWhiteSpace(current) && current.Length >= volumeRoot.Length)
        {
            if (Directory.Exists(current) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidOperationException($"La ruta de instalación contiene un enlace y se rechaza: {current}");
            current = Path.GetDirectoryName(current) ?? string.Empty;
        }
        return root;
    }

    private static void RecoverTransaction(string root)
    {
        var transactionDir = Path.Combine(root, ".evaluapro-payload-transaction");
        if (!Directory.Exists(transactionDir)) return;
        if ((File.GetAttributes(transactionDir) & FileAttributes.ReparsePoint) != 0) throw new InvalidDataException("La transacción de recuperación es un enlace.");
        var journalPath = Path.Combine(transactionDir, "journal.json");
        if (!File.Exists(journalPath))
        {
            var backup = Path.Combine(transactionDir, "backup");
            if (Directory.Exists(backup) && Directory.EnumerateFileSystemEntries(backup).Any())
                throw new InvalidDataException($"Transacción sin diario con respaldo; se conserva para soporte: {transactionDir}");
            Directory.Delete(transactionDir, recursive: true);
            return;
        }
        var journal = JsonSerializer.Deserialize<TransactionJournal>(File.ReadAllText(journalPath), JsonOptions)
            ?? throw new InvalidDataException("El diario de transacción está vacío.");
        if (journal.SchemaVersion != 1 || !Path.GetFullPath(journal.Root).Equals(root, StringComparison.OrdinalIgnoreCase) || journal.Entries is null)
            throw new InvalidDataException("El diario no corresponde a la carpeta de instalación; se conserva.");
        if (journal.State is "committed" or "recovered") { Directory.Delete(transactionDir, recursive: true); return; }
        WriteJournal(transactionDir, journal with { State = "recovering" });
        foreach (var entry in journal.Entries.Reverse())
        {
            ValidateTransactionName(entry.Name);
            var destination = ResolveTransactionEntry(root, entry.Name);
            var backup = ResolveTransactionEntry(Path.Combine(transactionDir, "backup"), entry.Name);
            if (File.Exists(backup) || Directory.Exists(backup))
            {
                RemovePathSafely(destination);
                Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                if (entry.Snapshot) CopyPath(backup, destination); else MovePath(backup, destination);
            }
            else if (!entry.Existed && (File.Exists(destination) || Directory.Exists(destination)))
            {
                RemovePathSafely(destination);
            }
        }
        WriteJournal(transactionDir, journal with { State = "recovered" });
        Directory.Delete(transactionDir, recursive: true);
    }

    private static void WriteJournal(string transactionDir, TransactionJournal journal) => WriteJsonAtomic(Path.Combine(transactionDir, "journal.json"), journal);

    private static void ValidateTransactionName(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || Path.IsPathRooted(name) || name.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Any(part => part is ".." or ".") ||
            string.Equals(name, "data", StringComparison.OrdinalIgnoreCase) || string.Equals(name, ".evaluapro-payload-transaction", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("El diario contiene una entrada de payload no permitida.");
    }

    private static string ResolveTransactionEntry(string root, string name)
    {
        ValidateTransactionName(name);
        var fullRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var full = Path.GetFullPath(Path.Combine(root, name));
        if (!full.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("La transacción intenta salir de su raíz.");
        return full;
    }

    private static void MovePath(string source, string destination)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
        if (Directory.Exists(source)) Directory.Move(source, destination);
        else if (File.Exists(source)) File.Move(source, destination);
        else throw new FileNotFoundException("La entrada de transacción desapareció.");
    }

    private static void CopyPath(string source, string destination)
    {
        if (Directory.Exists(source)) CopyDirectory(source, destination);
        else
        {
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(source, destination, overwrite: true);
        }
    }

    private static void CopyDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (var item in Directory.EnumerateFileSystemEntries(source))
        {
            if ((File.GetAttributes(item) & FileAttributes.ReparsePoint) != 0) throw new IOException("El respaldo contiene un enlace y se rechaza.");
            var target = Path.Combine(destination, Path.GetFileName(item));
            if (Directory.Exists(item)) CopyDirectory(item, target); else File.Copy(item, target, overwrite: true);
        }
    }

    private static void RemovePathSafely(string path)
    {
        if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
        else if (File.Exists(path)) File.Delete(path);
    }

    private static Mutex AcquireRootLock(string root, TimeSpan timeout)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(root.ToUpperInvariant())))[..20];
        var mutex = new Mutex(false, $"Local\\EvaluaProInstallerRoot-{hash}");
        try
        {
            if (!mutex.WaitOne(timeout)) throw new TimeoutException("Otra operación de instalación mantiene bloqueada esta carpeta.");
            return mutex;
        }
        catch { mutex.Dispose(); throw; }
    }

    private static bool RequiresElevation(string targetDir)
    {
        if (string.IsNullOrWhiteSpace(targetDir)) return false;
        var target = Path.GetFullPath(targetDir).TrimEnd(Path.DirectorySeparatorChar);
        return new[] { Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), Environment.GetFolderPath(Environment.SpecialFolder.Windows) }
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Any(path => target.StartsWith(Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsAdministrator()
    {
        using var identity = WindowsIdentity.GetCurrent();
        return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
    }

    private static string? ReadWebView2Version()
    {
        const string webView2Client = @"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
        foreach (var (hive, view) in new[]
        {
            (Registry.LocalMachine, RegistryView.Registry32),
            (Registry.CurrentUser, RegistryView.Default)
        })
        {
            try
            {
                using var baseKey = RegistryKey.OpenBaseKey(hive.Name == Registry.LocalMachine.Name ? RegistryHive.LocalMachine : RegistryHive.CurrentUser, view);
                using var key = baseKey.OpenSubKey(webView2Client);
                var version = Convert.ToString(key?.GetValue("pv"));
                if (!string.IsNullOrWhiteSpace(version) && Version.TryParse(version, out _)) return version;
            }
            catch (UnauthorizedAccessException) { }
            catch (IOException) { }
        }
        return null;
    }

    private static string ResolveInstallDirectory(IReadOnlyDictionary<string, JsonElement> payload)
    {
        var requested = GetString(payload, "installDir", "targetDir");
        if (!string.IsNullOrWhiteSpace(requested)) return Path.GetFullPath(requested);
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "EvaluaPro");
    }

    private static string ReadPackageVersion(string path)
    {
        try
        {
            using var package = JsonDocument.Parse(File.ReadAllText(path));
            return package.RootElement.GetProperty("version").GetString() ?? string.Empty;
        }
        catch { return string.Empty; }
    }

    private static Dictionary<string, string> ReadEnv(string path)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (!File.Exists(path)) return values;
        foreach (var raw in File.ReadLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;
            var split = line.IndexOf('=');
            if (split <= 0) continue;
            values[line[..split].Trim()] = line[(split + 1)..].Trim().Trim('"', '\'');
        }
        return values;
    }

    private static void WriteAtomicText(string path, string content)
    {
        var full = Path.GetFullPath(path);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        var temporary = full + "." + Guid.NewGuid().ToString("N") + ".tmp";
        File.WriteAllText(temporary, content, new UTF8Encoding(false));
        using (var stream = new FileStream(temporary, FileMode.Open, FileAccess.ReadWrite, FileShare.None)) stream.Flush(flushToDisk: true);
        if (File.Exists(full)) File.Replace(temporary, full, null, ignoreMetadataErrors: true); else File.Move(temporary, full);
    }

    private static void WriteJsonAtomic(string path, object value) => WriteAtomicText(path, JsonSerializer.Serialize(value, JsonOptions));
    private static string EscapeEnv(string value) => value.Replace("\r", string.Empty, StringComparison.Ordinal).Replace("\n", string.Empty, StringComparison.Ordinal);

    private static IReadOnlyDictionary<string, JsonElement> GetObject(IReadOnlyDictionary<string, JsonElement> payload, string name)
    {
        if (!payload.TryGetValue(name, out var value) || value.ValueKind != JsonValueKind.Object) return new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(value.GetRawText(), JsonOptions) ?? new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
    }

    private static string GetString(IReadOnlyDictionary<string, JsonElement> values, params string[] names)
    {
        foreach (var name in names)
            if (values.TryGetValue(name, out var value))
            {
                if (value.ValueKind == JsonValueKind.String) return value.GetString() ?? string.Empty;
                if (value.ValueKind is JsonValueKind.True or JsonValueKind.False) return value.GetBoolean() ? "1" : "0";
                if (value.ValueKind == JsonValueKind.Number) return value.ToString();
            }
        return string.Empty;
    }

    private static string GetString(Dictionary<string, string> values, string name) => values.TryGetValue(name, out var value) ? value : string.Empty;
    private static bool GetBool(IReadOnlyDictionary<string, JsonElement> values, string name) => values.TryGetValue(name, out var value) && (value.ValueKind == JsonValueKind.True || value.ValueKind == JsonValueKind.String && value.GetString() is "1" or "true");

    private static void ReportProgress(int percent, string status)
    {
        Console.Out.WriteLine(ProgressPrefix + JsonSerializer.Serialize(new { percent = Math.Clamp(percent, 0, 100), status }));
        Console.Out.Flush();
    }

    private static void WriteResponse(string path, string operationId, bool ok, string phase, int exitCode, string message, object? data)
    {
        WriteJsonAtomic(path, new { schemaVersion = 1, operationId, ok, phase, exitCode, message, data, logs = Array.Empty<object>(), warnings = Array.Empty<string>() });
    }

    private static string Sanitize(string value) => Regex.Replace(value ?? string.Empty, "(?i)(access_token|token|signature|code)=([^&\\s]+)", "$1=[REDACTED]");

    private sealed record InstallerRequest(string OperationId, Dictionary<string, JsonElement> Payload);
    private sealed record TransactionEntry(string Name, bool Existed, bool Snapshot);
    private sealed record TransactionJournal(int SchemaVersion, string Root, string State, string OperationId, string TransactionId, TransactionEntry[] Entries);
}
