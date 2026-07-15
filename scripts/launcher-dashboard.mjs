/**
 * launcher-dashboard
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/*
  Local web dashboard to control the dev stack.
  - Serves a small HTML UI and JSON endpoints on localhost.
  - Starts/stops tasks via cmd.exe and streams logs to the UI.
  - Filters noisy lines by default for readability.
  - Enforces a single running instance using a lock file.
*/
import http from 'http';
import https from 'node:https';
import fs from 'fs';
import path from 'path';
import net from 'net';
import process from 'node:process';
import { X509Certificate } from 'node:crypto';
import { spawn, spawnSync, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createUpdateManager } from './update-manager.mjs';

// Resolve paths relative to this script.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const nativeNodePath = fs.existsSync(path.join(root, 'runtime', 'node', process.platform === 'win32' ? 'node.exe' : 'node'))
  ? path.join(root, 'runtime', 'node', process.platform === 'win32' ? 'node.exe' : 'node')
  : process.execPath;
const nativeDocenteCommand = `"${nativeNodePath}" "${path.join(root, 'scripts', 'start-docente-native.mjs')}"`;

// CLI options: --mode dev|prod|none, --port <n>, --no-open, --verbose, --full-logs.
const args = process.argv.slice(2);
const mode = getArgValue('--mode', 'none');
const portArg = getArgValue('--port', '');
const noOpen = args.includes('--no-open');
const verbose = args.includes('--verbose');
const fullLogs = args.includes('--full-logs');

const dashboardStartedAt = Date.now();
let listeningPort = 0;

// Docker/stack bootstrap state (for shortcuts/tray).
const composeFile = path.join(root, 'docker-compose.yml');
const dockerAutostart = {
  state: 'idle', // idle|checking|starting|ready|error
  ready: false,
  version: '',
  attemptedDesktopStart: false,
  stack: {
    state: 'unknown', // unknown|checking|running|starting|skipped|error
    running: false,
    lastError: ''
  },
  lastError: '',
  lastChangedAt: Date.now()
};

let dockerAutostartPromise = null;
let composeSnapshot = {
  checkedAt: 0,
  dev: {},
  prod: {},
  error: ''
};

// Persist recent logs to disk to aid troubleshooting.
const logDir = path.join(root, 'logs');
const logFile = path.join(logDir, 'dashboard.log');
const lockPath = path.join(logDir, 'dashboard.lock.json');
const singletonPath = path.join(logDir, 'dashboard.singleton.json');
const dashboardConfigPath = path.join(logDir, 'dashboard.config.json');
const lifecycleConfigPath = path.join(logDir, 'lifecycle.config.json');
const continuityConfigPath = path.join(logDir, 'continuity.config.json');
const installationManifestPath = path.join(logDir, 'installation.manifest.json');
const updateStatePath = path.join(logDir, 'update-state.json');
const updateConfigPath = path.join(root, 'config', 'update-config.json');
const portableLicensePath = path.join(process.env.ProgramData || 'C:\\ProgramData', 'EvaluaPro', 'security', 'portable-license.epl');
const stepUpConfigPath = path.join(process.env.ProgramData || 'C:\\ProgramData', 'EvaluaPro', 'security', 'stepup.config.json');
const stepUpSessionPath = path.join(process.env.ProgramData || 'C:\\ProgramData', 'EvaluaPro', 'security', 'stepup.session.json');
const privilegedSupportActions = Object.freeze([
  'hub-install',
  'hub-repair',
  'hub-update-apply',
  'hub-uninstall'
]);
ensureDir(logDir);

// Logging persistence mode:
// - off: no disk writes
// - important: only system/warn/error (+ any entry explicitly marked)
// - all: persist everything
const persistArg = getArgValue('--persist', 'important');
const persistMode = ['off', 'important', 'all'].includes(String(persistArg)) ? String(persistArg) : 'important';

const diskWriter = createDiskWriter(logFile, {
  enabled: persistMode !== 'off',
  flushMs: Number(process.env.DASHBOARD_LOG_FLUSH_MS || 1400),
  maxBytes: Number(process.env.DASHBOARD_LOG_MAX_BYTES || 2_000_000),
  keepFiles: Number(process.env.DASHBOARD_LOG_KEEP || 3)
});

// In-memory log buffers for the UI.
const maxFiltered = 600;
const maxRaw = 2000;
const logLines = [];
const rawLines = [];

// In-memory event buffer for structured activity (small + diagnostic).
const maxEvents = 450;
const events = [];

// Singleton lock to avoid multiple dashboard instances.
let singletonOwned = false;
let singletonPayload = null;

// Track suppressed noisy lines per task.
const noiseStats = new Map();

// Track spawned processes by task name.
const processes = new Map();

// Dev convenience: auto-restart tasks when source files change.
const dashboardConfigDefaults = Object.freeze({
  autoRestart: mode === 'dev',
  showFullLogs: Boolean(fullLogs),
  autoScroll: true,
  pauseUpdates: false,
  refreshForegroundMs: 3000,
  refreshBackgroundMs: 20000
});
let dashboardConfig = loadDashboardConfig();
let autoRestart = dashboardConfig.autoRestart;
let restartTimer = null;

// HTML template and assets.
// En DEV se leen desde disco por request para que cambios UI/UX se vean al refrescar.
// En PROD se cachean en memoria (comportamiento estable/reproducible).
const dashboardPath = path.join(__dirname, 'dashboard.html');
const manifestPath = path.join(__dirname, 'dashboard.webmanifest');
const iconPath = path.join(__dirname, 'dashboard-icon.svg');
const icon192Path = path.join(__dirname, 'dashboard-icon-192.png');
const icon512Path = path.join(__dirname, 'dashboard-icon-512.png');
const iconMaskablePath = path.join(__dirname, 'dashboard-icon-maskable-512.png');
const swPath = path.join(__dirname, 'dashboard-sw.js');
const portalDistEntry = path.join(root, 'apps', 'portal_alumno_cloud', 'dist', 'index.js');

const cachedDashboardHtml = fs.readFileSync(dashboardPath, 'utf8');
const cachedManifestJson = fs.readFileSync(manifestPath, 'utf8');
const cachedIconSvg = fs.readFileSync(iconPath, 'utf8');
const cachedIcon192 = fs.existsSync(icon192Path) ? fs.readFileSync(icon192Path) : Buffer.alloc(0);
const cachedIcon512 = fs.existsSync(icon512Path) ? fs.readFileSync(icon512Path) : Buffer.alloc(0);
const cachedIconMaskable = fs.existsSync(iconMaskablePath) ? fs.readFileSync(iconMaskablePath) : Buffer.alloc(0);
const cachedSwJs = fs.existsSync(swPath) ? fs.readFileSync(swPath, 'utf8') : '';

const repairState = {
  runId: '',
  state: 'idle', // idle|running|ok|error
  currentStep: '',
  percent: 0,
  steps: [],
  manualActions: [],
  issues: [],
  lastRun: null
};

const lifecyclePolicyDefaults = Object.freeze({
  desiredMode: mode === 'dev' ? 'dev' : 'prod',
  supervisorEnabled: mode === 'dev' || mode === 'prod',
  autoRepairEnabled: true,
  supervisorIntervalMs: 15000,
  failureThreshold: 3,
  repairCooldownMs: 180000
});

const lifecycleState = {
  desiredMode: lifecyclePolicyDefaults.desiredMode,
  supervisorEnabled: lifecyclePolicyDefaults.supervisorEnabled,
  autoRepairEnabled: lifecyclePolicyDefaults.autoRepairEnabled,
  supervisorIntervalMs: lifecyclePolicyDefaults.supervisorIntervalMs,
  failureThreshold: lifecyclePolicyDefaults.failureThreshold,
  repairCooldownMs: lifecyclePolicyDefaults.repairCooldownMs,
  reconcile: {
    running: false,
    lastRunAt: 0,
    nextRunAt: 0,
    lastReason: '',
    lastAction: '',
    lastResult: '',
    failureCount: 0,
    lastRepairTriggeredAt: 0,
    lastError: ''
  },
  operation: {
    running: false,
    kind: '',
    startedAt: 0,
    finishedAt: 0,
    lastExitCode: 0,
    lastError: ''
  },
  installation: {
    installed: false,
    installDir: '',
    checkedAt: 0
  },
  lastChangedAt: Date.now()
};

let lifecycleSupervisorTimer = null;
let lifecycleReconcilePromise = null;
let lifecycleOperationPromise = null;

const continuityPolicyDefaults = Object.freeze({
  enabled: false,
  intervalMs: 10 * 60_000,
  exportBeforePush: true,
  doPush: true,
  doPull: true,
  maxConsecutiveFailures: 6
});

const continuityState = {
  enabled: continuityPolicyDefaults.enabled,
  intervalMs: continuityPolicyDefaults.intervalMs,
  exportBeforePush: continuityPolicyDefaults.exportBeforePush,
  doPush: continuityPolicyDefaults.doPush,
  doPull: continuityPolicyDefaults.doPull,
  maxConsecutiveFailures: continuityPolicyDefaults.maxConsecutiveFailures,
  running: false,
  lastRunAt: 0,
  nextRunAt: 0,
  lastResult: 'idle',
  lastError: '',
  lastDetails: [],
  consecutiveFailures: 0,
  history: [],
  updatedAt: Date.now()
};

let continuityTimer = null;
let continuityRunPromise = null;
let updateAutoCheckTimer = null;

loadLifecyclePolicy();
loadContinuityPolicy();

function shouldLiveReloadUi() {
  // En prod: UI estable (cache en memoria).
  // En dev/none: leer desde disco por request para que cambios de UI se vean al refrescar.
  return mode !== 'prod';
}

function readTextDevOrCache(filePath, cached) {
  if (!shouldLiveReloadUi()) return cached;
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return cached;
  }
}

function readRootPackageInfo() {
  try {
    const raw = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const authorName = typeof parsed.author === 'string'
      ? parsed.author
      : (parsed.author && typeof parsed.author === 'object' ? String(parsed.author.name || '') : '');
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      version: typeof parsed.version === 'string' ? parsed.version : '',
      authorName: String(authorName || '').trim(),
      repositoryUrl: String(parsed?.repository?.url || '').trim()
    };
  } catch {
    return { name: '', version: '', authorName: '', repositoryUrl: '' };
  }
}

function readAppVersionMetadata() {
  const pkg = readRootPackageInfo();
  try {
    const raw = fs.readFileSync(path.join(root, 'config', 'app-version.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      name: pkg.name || 'evaluapro',
      version: String(parsed?.version || pkg.version || '0.0.0'),
      displayVersion: String(parsed?.displayVersion || parsed?.version || pkg.version || '0.0.0'),
      authorName: pkg.authorName || '',
      repositoryUrl: pkg.repositoryUrl || ''
    };
  } catch {
    return {
      name: pkg.name || 'evaluapro',
      version: pkg.version || '0.0.0',
      displayVersion: pkg.version || '0.0.0',
      authorName: pkg.authorName || '',
      repositoryUrl: pkg.repositoryUrl || ''
    };
  }
}

function readChangelogSnippet(maxChars = 24_000) {
  try {
    const changelogPath = path.join(root, 'CHANGELOG.md');
    const raw = fs.readFileSync(changelogPath, 'utf8');
    if (!raw) return '';
    return raw.slice(0, Math.max(2_000, maxChars));
  } catch {
    return '';
  }
}

function readVersionCatalog() {
  try {
    const filePath = path.join(root, 'config', 'version-catalog.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const repositoryUrl = String(parsed?.repositoryUrl || '').trim();
    const technologies = Array.isArray(parsed?.technologies)
      ? parsed.technologies
        .map((item) => ({
          id: String(item?.id || '').trim(),
          label: String(item?.label || '').trim(),
          logoUrl: String(item?.logoUrl || '').trim(),
          website: String(item?.website || '').trim()
        }))
        .filter((item) => item.id && item.label && item.logoUrl)
      : [];
    return { repositoryUrl, technologies };
  } catch {
    return { repositoryUrl: '', technologies: [] };
  }
}

function buildVersionInfoPayload(source = 'dashboard') {
  const pkg = readAppVersionMetadata();
  const catalog = readVersionCatalog();
  const developerName = String(process.env.EVALUAPRO_DEVELOPER_NAME || pkg.authorName || 'Equipo EvaluaPro').trim();
  const developerRole = String(process.env.EVALUAPRO_DEVELOPER_ROLE || 'Desarrollo').trim();
  const changelog = readChangelogSnippet();
  return {
    source,
    app: {
      name: pkg.name || 'evaluapro',
      version: pkg.version || '0.0.0',
      displayVersion: pkg.displayVersion || pkg.version || '0.0.0',
      dashboardMode: mode
    },
    repositoryUrl: catalog.repositoryUrl || String(pkg.repositoryUrl || '').trim() || 'https://github.com/Dtcsrni',
    technologies: catalog.technologies,
    developer: {
      nombre: developerName || 'Equipo EvaluaPro',
      rol: developerRole || 'Desarrollo'
    },
    system: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      hostname: safeExec('hostname', 'desconocido'),
      uptimeSec: Math.floor(process.uptime()),
      dashboardPort: listeningPort || Number(portArg || 0) || 0,
      generatedAt: new Date().toISOString()
    },
    changelog
  };
}

function readUpdateConfig() {
  const defaults = {
    owner: 'Dtcsrni',
    repo: 'EvaluaPro_Sistema_Universitario',
    flavorId: 'docente-local',
    channel: 'stable',
    assetName: 'EvaluaPro-InstallerHub-docente-local.exe',
    sha256AssetName: 'EvaluaPro-InstallerHub-docente-local.exe.sha256',
    requireSha256: true,
    autoCheckEnabled: true,
    checkIntervalMs: 900_000,
    syncPreflight: {
      enabled: true,
      baseUrl: 'http://127.0.0.1:4000/api/sincronizaciones',
      tokenEnv: 'EVALUAPRO_SYNC_BEARER',
      exportPayload: {},
      pushPayload: {},
      pullPayload: {}
    }
  };

  let parsed = {};
  try {
    const raw = fs.readFileSync(updateConfigPath, 'utf8');
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const cfg = {
    ...defaults,
    ...parsed,
    syncPreflight: {
      ...defaults.syncPreflight,
      ...(parsed.syncPreflight && typeof parsed.syncPreflight === 'object' ? parsed.syncPreflight : {})
    }
  };

  if (process.env.EVALUAPRO_UPDATE_OWNER) cfg.owner = String(process.env.EVALUAPRO_UPDATE_OWNER);
  if (process.env.EVALUAPRO_UPDATE_REPO) cfg.repo = String(process.env.EVALUAPRO_UPDATE_REPO);
  if (process.env.EVALUAPRO_UPDATE_FLAVOR) cfg.flavorId = String(process.env.EVALUAPRO_UPDATE_FLAVOR);
  if (process.env.EVALUAPRO_UPDATE_CHANNEL) cfg.channel = String(process.env.EVALUAPRO_UPDATE_CHANNEL);
  if (process.env.EVALUAPRO_UPDATE_ASSET) cfg.assetName = String(process.env.EVALUAPRO_UPDATE_ASSET);
  if (process.env.EVALUAPRO_UPDATE_SHA_ASSET) cfg.sha256AssetName = String(process.env.EVALUAPRO_UPDATE_SHA_ASSET);
  if (process.env.EVALUAPRO_UPDATE_FEED_URL) cfg.feedUrl = String(process.env.EVALUAPRO_UPDATE_FEED_URL);
  if (process.env.EVALUAPRO_UPDATE_REQUIRE_SHA256) cfg.requireSha256 = /^(1|true|yes|si)$/i.test(String(process.env.EVALUAPRO_UPDATE_REQUIRE_SHA256));
  if (process.env.EVALUAPRO_UPDATE_AUTOCHECK) cfg.autoCheckEnabled = /^(1|true|yes|si)$/i.test(String(process.env.EVALUAPRO_UPDATE_AUTOCHECK));
  if (process.env.EVALUAPRO_UPDATE_CHECK_INTERVAL_MS) cfg.checkIntervalMs = Number(process.env.EVALUAPRO_UPDATE_CHECK_INTERVAL_MS);

  cfg.channel = String(cfg.channel || 'stable').trim().toLowerCase();
  if (!cfg.channel) cfg.channel = 'stable';
  cfg.flavorId = String(cfg.flavorId || 'docente-local').trim().toLowerCase();

  const interval = Number(cfg.checkIntervalMs || 0);
  cfg.checkIntervalMs = Number.isFinite(interval) && interval >= 60_000 ? Math.round(interval) : defaults.checkIntervalMs;

  return cfg;
}

const updateConfig = readUpdateConfig();

function resolveFlavorPolicy(manifest = null) {
  const installation = manifest?.installation && typeof manifest.installation === 'object'
    ? manifest.installation
    : {};
  const rawFlavorId = String(installation.flavor || updateConfig.flavorId || 'docente-local').trim().toLowerCase();
  const flavorId = rawFlavorId || 'docente-local';
  const requireLocalPortal = installation.requireLocalPortal === true || flavorId !== 'docente-local';
  const requireDockerRuntime = installation.requireDockerRuntime === true && flavorId !== 'docente-local';
  return {
    flavorId,
    requireLocalPortal,
    requireDockerRuntime,
    runtimeTarget: String(installation.runtimeTarget || (flavorId === 'docente-local' ? 'native-node-sqlite' : 'docker-compatible'))
  };
}

function requiresDockerRuntime(manifest = null) {
  return resolveFlavorPolicy(manifest).requireDockerRuntime === true;
}

function renderVersionInfoPage() {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>EvaluaPro · Version Info</title>
  <style>
    :root {
      --bg-0:#05070f;
      --bg-1:#0a1022;
      --bg-2:#0f1a33;
      --ink:#d8e7ff;
      --muted:#95a8cc;
      --cyan:#1de9ff;
      --mag:#ff4dd8;
      --lime:#7dffb3;
      --card:rgba(8,14,30,0.78);
      --bd:rgba(29,233,255,0.35);
    }
    * { box-sizing:border-box; }
    body {
      margin:0;
      min-height:100vh;
      color:var(--ink);
      font-family: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
      background:
        radial-gradient(circle at 8% 12%, rgba(29,233,255,0.22), transparent 35%),
        radial-gradient(circle at 88% 5%, rgba(255,77,216,0.2), transparent 36%),
        linear-gradient(145deg, var(--bg-0), var(--bg-1) 52%, var(--bg-2));
      overflow-x:hidden;
    }
    body::after {
      content:"";
      position:fixed; inset:0;
      pointer-events:none;
      background: repeating-linear-gradient(
        0deg,
        rgba(255,255,255,0.04) 0px,
        rgba(255,255,255,0.0) 2px,
        rgba(255,255,255,0.0) 6px
      );
      mix-blend-mode:overlay;
    }
    .wrap {
      width:min(1120px, 94vw);
      margin:26px auto 44px;
      display:grid;
      gap:16px;
      animation: rise .48s cubic-bezier(.2,.9,.2,1);
    }
    @keyframes rise { from { opacity:0; transform:translateY(16px);} to {opacity:1; transform:translateY(0);} }
    .hero {
      border:1px solid var(--bd);
      border-radius:20px;
      background:linear-gradient(130deg, rgba(29,233,255,0.12), rgba(255,77,216,0.08) 62%, rgba(125,255,179,0.08));
      box-shadow:0 22px 60px rgba(0,0,0,0.45);
      padding:20px 22px;
    }
    .title { margin:0; font-size:clamp(1.25rem, 2vw, 2rem); letter-spacing:.02em; }
    .sub { margin:8px 0 0; color:var(--muted); }
    .grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); }
    .card {
      border:1px solid rgba(149,168,204,0.28);
      background:var(--card);
      border-radius:16px;
      padding:14px;
      backdrop-filter: blur(7px);
      box-shadow:0 10px 34px rgba(0,0,0,0.34);
    }
    .k { color:var(--muted); font-size:.82rem; text-transform:uppercase; letter-spacing:.07em; }
    .v { font-weight:700; margin-top:4px; }
    .badge {
      display:inline-flex; align-items:center; gap:8px;
      border-radius:999px; padding:6px 12px;
      border:1px solid var(--bd);
      background:rgba(29,233,255,0.12);
      color:#d7fdff; font-weight:700;
      margin-top:8px;
    }
    .changelog {
      margin:0;
      border:1px solid rgba(149,168,204,0.28);
      background:rgba(5,8,18,0.9);
      color:#b7c8e8;
      border-radius:16px;
      padding:18px;
      min-height:320px;
      white-space:pre-wrap;
      overflow:auto;
      line-height:1.45;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      box-shadow: inset 0 0 0 1px rgba(29,233,255,0.1);
    }
    .pulse {
      width:10px; height:10px; border-radius:50%;
      background:var(--lime);
      box-shadow:0 0 0 0 rgba(125,255,179,.8);
      animation:pulse 1.8s infinite;
    }
    .actions {
      margin-top:12px;
      display:flex;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
    }
    .repo-link {
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 12px;
      border-radius:999px;
      border:1px solid rgba(29,233,255,0.45);
      background:rgba(29,233,255,0.1);
      color:#d8f6ff;
      text-decoration:none;
      font-weight:700;
      transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease;
    }
    .repo-link:hover {
      transform:translateY(-2px);
      box-shadow:0 14px 30px rgba(29,233,255,0.22);
      border-color:rgba(29,233,255,0.72);
    }
    .tech-grid {
      display:grid;
      gap:12px;
      grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
    }
    .tech-item {
      border:1px solid rgba(149,168,204,0.28);
      background:rgba(8,14,30,0.86);
      border-radius:14px;
      padding:10px 12px;
      display:flex;
      align-items:center;
      gap:10px;
      text-decoration:none;
      color:inherit;
      position:relative;
      overflow:hidden;
      animation:techFloat 4.2s ease-in-out infinite;
      animation-delay:var(--delay, 0s);
      transition:transform .2s ease, border-color .2s ease, box-shadow .2s ease;
    }
    .tech-item::after {
      content:"";
      position:absolute;
      inset:-150% auto auto -40%;
      width:50%;
      height:300%;
      transform:rotate(20deg);
      background:linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.16), rgba(255,255,255,0));
      pointer-events:none;
      animation:scan 2.8s linear infinite;
    }
    .tech-item:hover {
      transform:translateY(-2px);
      border-color:rgba(29,233,255,0.68);
      box-shadow:0 18px 34px rgba(29,233,255,0.14);
    }
    .tech-logo {
      width:28px;
      height:28px;
      object-fit:contain;
      filter:drop-shadow(0 0 6px rgba(29,233,255,0.26));
      flex-shrink:0;
    }
    .tech-name {
      font-weight:700;
      color:#d6e8ff;
    }
    @keyframes techFloat {
      0%,100% { transform:translateY(0); }
      50% { transform:translateY(-3px); }
    }
    @keyframes scan {
      0% { left:-65%; }
      100% { left:130%; }
    }
    @keyframes pulse {
      0% { box-shadow:0 0 0 0 rgba(125,255,179,.65);}
      70% { box-shadow:0 0 0 13px rgba(125,255,179,0);}
      100% { box-shadow:0 0 0 0 rgba(125,255,179,0);}
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <h1 class="title">EvaluaPro · Version Center</h1>
      <p class="sub">Detalles de versión, sistema, desarrollador y changelog en tiempo real.</p>
      <span class="badge"><span class="pulse"></span><span id="badge-version">Cargando versión...</span></span>
      <div class="actions">
        <a id="repo-link" class="repo-link" href="https://github.com/Dtcsrni" target="_blank" rel="noreferrer noopener">Repositorio del desarrollador</a>
      </div>
    </section>
    <section class="grid" id="info-grid"></section>
    <section class="card">
      <div class="k">Tecnologías utilizadas</div>
      <div class="tech-grid" id="tech-grid"></div>
    </section>
    <pre class="changelog" id="changelog">Cargando changelog...</pre>
  </main>
  <script>
    function esc(value) {
      return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    }

    async function loadInfo() {
      try {
        const res = await fetch('/api/version-info', { cache: 'no-store' });
        const data = await res.json();
        const grid = document.getElementById('info-grid');
        const badge = document.getElementById('badge-version');
        const changelog = document.getElementById('changelog');
        const techGrid = document.getElementById('tech-grid');
        const repoLink = document.getElementById('repo-link');
        badge.textContent = String((data && data.app && data.app.name) || 'evaluapro') + ' v' + String((data && data.app && data.app.version) || '0.0.0');
        if (repoLink && data?.repositoryUrl) repoLink.href = String(data.repositoryUrl);
        const cards = [
          ['Sistema', 'Node', String(data?.system?.node || '-')],
          ['Sistema', 'Plataforma', String(data?.system?.platform || '-') + ' / ' + String(data?.system?.arch || '-')],
          ['Sistema', 'Host', String(data?.system?.hostname || '-')],
          ['Sistema', 'Modo dashboard', String(data?.app?.dashboardMode || '-')],
          ['Desarrollador', 'Nombre', String(data?.developer?.nombre || '-')],
          ['Desarrollador', 'Rol', String(data?.developer?.rol || '-')],
          ['Versionado', 'Generado', String(data?.system?.generatedAt || '-')],
          ['Versionado', 'Source', String(data?.source || '-')]
        ];
        grid.innerHTML = cards.map(([sec,key,val]) => (
          '<article class="card"><div class="k">' + esc(sec) + ' · ' + esc(key) + '</div><div class="v">' + esc(val) + '</div></article>'
        )).join('');
        const techs = Array.isArray(data?.technologies) ? data.technologies : [];
        if (techGrid) {
          techGrid.innerHTML = techs.map((tech, idx) => {
            const delay = ((idx % 5) * 0.22).toFixed(2);
            const href = esc(tech?.website || '#');
            const logo = esc(tech?.logoUrl || '');
            const label = esc(tech?.label || tech?.id || 'Tecnología');
            return '<a class="tech-item" style="--delay:' + delay + 's" href="' + href + '" target="_blank" rel="noreferrer noopener"><img class="tech-logo" src="' + logo + '" alt="' + label + ' logo" loading="lazy"/><span class="tech-name">' + label + '</span></a>';
          }).join('') || '<div class="v">Sin tecnologías registradas.</div>';
        }
        changelog.textContent = String(data?.changelog || 'Sin changelog disponible.');
      } catch (error) {
        const msg = 'No se pudo cargar version-info: ' + (error && error.message ? error.message : 'error');
        const cl = document.getElementById('changelog');
        if (cl) cl.textContent = msg;
      }
    }
    loadInfo();
  </script>
</body>
</html>`;
}

function parseEnvContent(content) {
  const result = {};
  const lines = String(content || '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function readEnvFile() {
  try {
    const raw = fs.readFileSync(path.join(root, '.env'), 'utf8');
    return parseEnvContent(raw);
  } catch {
    return {};
  }
}

function parseBool(value) {
  return /^(1|true|si|yes)$/i.test(String(value || '').trim());
}

function parseSubject(subject) {
  const result = {};
  String(subject || '').split(',').forEach((segment) => {
    const parts = segment.split('=');
    if (parts.length < 2) return;
    const key = parts.shift().trim();
    const value = parts.join('=').trim();
    if (key) result[key] = value;
  });
  return { cn: result.CN || '', o: result.O || '' };
}

function readCertSubject(certPath) {
  try {
    const pem = fs.readFileSync(certPath);
    const cert = new X509Certificate(pem);
    return parseSubject(cert.subject);
  } catch {
    return { cn: '', o: '' };
  }
}

function resolveHttpsState() {
  const env = readEnvFile();
  const enabled = parseBool(env.VITE_HTTPS);
  const certPath = String(env.VITE_HTTPS_CERT_PATH || '').trim();
  const keyPath = String(env.VITE_HTTPS_KEY_PATH || '').trim();
  const certReady = Boolean(certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath));
  const ready = enabled && certReady;
  const fallback = enabled && !certReady;
  const mode = enabled ? (certReady ? 'https' : 'http-fallback') : 'http';

  const hintedName = String(env.VITE_HTTPS_CERT_NAME || '').trim();
  const hintedOrg = String(env.VITE_HTTPS_CERT_COMPANY || '').trim();
  const subject = certReady ? readCertSubject(certPath) : { cn: '', o: '' };
  const certName = subject.cn || hintedName;
  const certOrg = subject.o || hintedOrg;

  let display = enabled ? 'HTTP (fallback)' : 'HTTP';
  if (enabled && certReady) {
    const detail = [certName, certOrg].filter(Boolean).join(' - ');
    display = detail ? `HTTPS (${detail})` : 'HTTPS';
  }

  return {
    enabled,
    ready,
    fallback,
    mode,
    certPath: certPath || '',
    keyPath: keyPath || '',
    certName,
    certOrg,
    display
  };
}

function writeConsole(line) {
  if (!verbose) return;
  process.stdout.write(line + '\n');
}

function timestamp() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function makeEntry(source, level, text) {
  return { ts: Date.now(), time: timestamp(), source, level, text };
}

function formatEntry(entry) {
  const base = `[${entry.time}] [${entry.source}] [${entry.level}] ${entry.text}`;
  if (entry && entry.meta && typeof entry.meta === 'object') {
    try {
      return `${base} | ${JSON.stringify(entry.meta)}`;
    } catch {
      return base;
    }
  }
  return base;
}

function persistEntry(entry) {
  if (!diskWriter.enabled) return;
  if (persistMode === 'important') {
    const important = entry.level === 'error' || entry.level === 'warn' || entry.level === 'system';
    const forced = Boolean(entry && entry.meta && entry.meta.persist === true);
    if (!important && !forced) return;
  }
  diskWriter.append(formatEntry(entry) + '\n');
}

function pushEntry(buffer, entry, max) {
  buffer.push(entry);
  if (buffer.length > max) buffer.shift();
}

function pushEvent(type, source, level, text, meta = undefined) {
  const evt = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ts: Date.now(),
    time: timestamp(),
    type,
    source,
    level,
    text,
    meta
  };
  events.unshift(evt);
  if (events.length > maxEvents) events.splice(maxEvents);
}

function shouldConsole(entry, options) {
  if (entry.level === 'error') return true;
  if (options && options.console === true) return true;
  if (!verbose) return false;
  if (options && options.console === false) return false;
  return true;
}

// Central logger for system-level messages.
function logSystem(text, level = 'system', options = {}) {
  const entry = makeEntry('dashboard', level, text);
  if (options && typeof options.meta === 'object') entry.meta = options.meta;
  pushEntry(rawLines, entry, maxRaw);
  pushEntry(logLines, entry, maxFiltered);
  if (shouldConsole(entry, options)) writeConsole(formatEntry(entry));
  persistEntry(entry);

  // Emit an event for key system-level messages.
  if (level === 'error' || level === 'warn' || level === 'system') {
    pushEvent('system', 'dashboard', level, text);
  }
}

function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sanitizeDashboardConfig(raw = null) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const normalizeMs = (value, fallback, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    const rounded = Math.round(numeric);
    return Math.min(max, Math.max(min, rounded));
  };
  const refreshForegroundMs = normalizeMs(source.refreshForegroundMs, dashboardConfigDefaults.refreshForegroundMs, 1000, 15000);
  const refreshBackgroundMsRaw = normalizeMs(source.refreshBackgroundMs, dashboardConfigDefaults.refreshBackgroundMs, 3000, 120000);
  const refreshBackgroundMs = Math.max(refreshBackgroundMsRaw, refreshForegroundMs);
  const next = {
    autoRestart: Boolean(source.autoRestart),
    showFullLogs: Boolean(source.showFullLogs),
    autoScroll: source.autoScroll === undefined ? true : Boolean(source.autoScroll),
    pauseUpdates: Boolean(source.pauseUpdates),
    refreshForegroundMs,
    refreshBackgroundMs
  };
  if (mode !== 'dev') next.autoRestart = false;
  return next;
}

function saveDashboardConfig(config) {
  const safeConfig = sanitizeDashboardConfig(config);
  dashboardConfig = safeConfig;
  autoRestart = safeConfig.autoRestart;
  try {
    fs.writeFileSync(dashboardConfigPath, JSON.stringify(safeConfig, null, 2));
  } catch (error) {
    logSystem(`No se pudo guardar dashboard.config.json: ${error.message}`, 'warn');
  }
  return safeConfig;
}

function loadDashboardConfig() {
  const fromDisk = readJsonFile(dashboardConfigPath);
  if (!fromDisk) return sanitizeDashboardConfig(dashboardConfigDefaults);
  return sanitizeDashboardConfig(Object.assign({}, dashboardConfigDefaults, fromDisk));
}

function isPidAlive(pid) {
  const id = Number(pid);
  if (!Number.isFinite(id) || id <= 0) return false;
  try {
    process.kill(id, 0);
    return true;
  } catch (err) {
    if (err && err.code === 'ESRCH') return false;
    return true;
  }
}

function lockAgeMs(startedAt) {
  if (!startedAt) return Number.POSITIVE_INFINITY;
  const ts = Date.parse(String(startedAt));
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return Date.now() - ts;
}

function writeSingletonLock(payload, exclusive = false) {
  try {
    const data = JSON.stringify(payload, null, 2);
    fs.writeFileSync(singletonPath, data, { flag: exclusive ? 'wx' : 'w' });
    return true;
  } catch {
    return false;
  }
}

function updateSingletonLock(patch) {
  if (!singletonOwned) return;
  const next = Object.assign({}, singletonPayload || {}, patch);
  if (!writeSingletonLock(next, false)) return;
  singletonPayload = next;
}

function clearSingletonLock() {
  if (!singletonOwned) return;
  singletonOwned = false;
  singletonPayload = null;
  try {
    if (fs.existsSync(singletonPath)) fs.unlinkSync(singletonPath);
  } catch {
    // ignore
  }
}

async function ensureSingletonLock() {
  const payload = {
    pid: process.pid,
    port: 0,
    mode,
    state: 'starting',
    startedAt: new Date().toISOString()
  };

  if (writeSingletonLock(payload, true)) {
    singletonOwned = true;
    singletonPayload = payload;
    return { ok: true };
  }

  const existing = readJsonFile(singletonPath);
  if (existing && isPidAlive(existing.pid)) {
    const port = Number(existing.port);
    if (port > 0) {
      const ok = await pingDashboard(port);
      if (ok) {
        const url = `http://127.0.0.1:${port}`;
        logSystem(`Dashboard ya esta activo: ${url}`, 'ok', { console: true });
        if (!noOpen) openBrowser(url);
      } else {
        const ageMs = lockAgeMs(existing.startedAt);
        if (ageMs > 5 * 60 * 1000) {
          try { if (fs.existsSync(singletonPath)) fs.unlinkSync(singletonPath); } catch {}
          logSystem('Lock singleton obsoleto detectado. Se recupera automaticamente.', 'warn', { console: true });
          if (writeSingletonLock(payload, true)) {
            singletonOwned = true;
            singletonPayload = payload;
            return { ok: true, recovered: true };
          }
          logSystem('No se pudo reescribir lock singleton recuperado.', 'error', { console: true });
          return { ok: false };
        }
        logSystem('Otra instancia del dashboard ya esta iniciando.', 'warn', { console: true });
      }
    } else {
      logSystem('Otra instancia del dashboard ya esta iniciando.', 'warn', { console: true });
    }
    return { ok: false, existing };
  }

  try {
    if (fs.existsSync(singletonPath)) fs.unlinkSync(singletonPath);
  } catch {
    logSystem('No se pudo eliminar lock singleton obsoleto.', 'warn');
    return { ok: true, degraded: true };
  }

  if (writeSingletonLock(payload, true)) {
    singletonOwned = true;
    singletonPayload = payload;
    return { ok: true, recovered: true };
  }

  logSystem('No se pudo adquirir lock singleton.', 'error', { console: true });
  return { ok: false };
}

function createDiskWriter(filePath, options) {
  const enabled = Boolean(options && options.enabled);
  const flushMs = Math.max(300, Number(options && options.flushMs) || 1400);
  const maxBytes = Math.max(200_000, Number(options && options.maxBytes) || 2_000_000);
  const keepFiles = Math.max(1, Math.min(10, Number(options && options.keepFiles) || 3));

  let buffer = '';
  let stream = null;
  let timer = null;
  let approxSize = 0;

  function openStream() {
    if (!enabled) return;
    if (stream) return;
    try {
      if (fs.existsSync(filePath)) {
        try {
          approxSize = fs.statSync(filePath).size || 0;
        } catch {
          approxSize = 0;
        }
      }
      stream = fs.createWriteStream(filePath, { flags: 'a' });
      stream.on('error', () => {
        try { stream?.destroy(); } catch {}
        stream = null;
      });
    } catch {
      stream = null;
    }
  }

  function closeStream() {
    try { stream?.end(); } catch {}
    stream = null;
  }

  function rotateIfNeeded() {
    if (!enabled) return;
    if (approxSize < maxBytes) return;

    closeStream();
    try {
      for (let i = keepFiles - 1; i >= 1; i -= 1) {
        const from = `${filePath}.${i}`;
        const to = `${filePath}.${i + 1}`;
        if (fs.existsSync(from)) {
          try { fs.renameSync(from, to); } catch {}
        }
      }
      if (fs.existsSync(filePath)) {
        try { fs.renameSync(filePath, `${filePath}.1`); } catch {}
      }
    } catch {
      // ignore
    }
    approxSize = 0;
    openStream();
  }

  function flush() {
    if (!enabled) return;
    if (!buffer) return;

    openStream();
    if (!stream) {
      buffer = '';
      return;
    }

    rotateIfNeeded();

    const chunk = buffer;
    buffer = '';
    approxSize += Buffer.byteLength(chunk, 'utf8');
    try {
      stream.write(chunk);
    } catch {
      // ignore
    }
  }

  function append(text) {
    if (!enabled) return;
    buffer += text;
    if (buffer.length >= 64_000) flush();
  }

  if (enabled) {
    openStream();
    timer = setInterval(flush, flushMs);
    timer.unref?.();
  }

  process.on('exit', () => {
    try { flush(); } catch {}
    try { closeStream(); } catch {}
  });

  return { enabled, append, flush };
}

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {
    // ignore
  }
}

// Simple argv parser for single-value flags.
function getArgValue(flag, fallback) {
  const idx = args.indexOf(flag);
  if (idx === -1) return fallback;
  const value = args[idx + 1];
  return value || fallback;
}

// Runs a command and returns its first line, or a fallback.
function safeExec(command, fallback) {
  try {
    const out = execSync(command, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    }).trim();
    return out.split(/\r?\n/)[0] || fallback;
  } catch {
    return fallback;
  }
}

function safeExecFast(command, fallback, timeoutMs = 1400) {
  try {
    const out = execSync(command, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: Math.max(200, Number(timeoutMs) || 1400)
    }).trim();
    return out.split(/\r?\n/)[0] || fallback;
  } catch {
    return fallback;
  }
}

function toWslPath(windowsPath) {
  const resolved = path.resolve(windowsPath);
  const match = /^([a-zA-Z]):[\\/](.*)$/.exec(resolved);
  if (!match) return resolved.replaceAll('\\', '/');
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll('\\', '/')}`;
}

function quoteSh(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function quoteCmd(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

function dockerCliArgs(args = [], options = {}) {
  const effectiveRuntime = dockerRuntimePreference() === 'wsl2-engine' ? 'wsl2-engine' : 'desktop';
  if (effectiveRuntime !== 'wsl2-engine') return ['docker', ...args];

  const cwd = options.cwd || root;
  const command = `cd ${quoteSh(toWslPath(cwd))} && docker ${args.map(quoteSh).join(' ')}`;
  return ['wsl', '-d', 'Ubuntu', '-u', 'root', '--', 'sh', '-lc', command];
}

function dockerCommandForShell(args = [], options = {}) {
  return dockerCliArgs(args, options).map(quoteCmd).join(' ');
}

function execDocker(args = [], options = {}) {
  const cliArgs = dockerCliArgs(args, options);
  return execSync(cliArgs.map(quoteCmd).join(' '), {
    cwd: options.cwd || root,
    stdio: ['ignore', 'pipe', options.stderr || 'ignore'],
    encoding: 'utf8',
    timeout: options.timeoutMs || 1600
  }).trim();
}

function setDockerAutostart(patch) {
  Object.assign(dockerAutostart, patch);
  dockerAutostart.lastChangedAt = Date.now();
}

function dockerDisplayString() {
  if (!requiresDockerRuntime(readInstallationManifest())) return 'No requerido para docente-local';
  if (dockerAutostart.state === 'starting') return 'Iniciando runtime Docker...';
  if (dockerAutostart.state === 'checking') return 'Comprobando runtime Docker...';
  if (dockerAutostart.state === 'error') return dockerAutostart.lastError || 'El runtime Docker no responde.';
  if (dockerAutostart.ready && dockerAutostart.version) return dockerAutostart.version;
  const v = tryGetDockerVersion();
  return v || 'No disponible';
}

function tryGetDockerVersion() {
  try {
    return execDocker(['version', '--format', '{{.Server.Version}}'], { timeoutMs: 1800 }) || '';
  } catch {
    return '';
  }
}

function tryGetDockerContext() {
  try {
    return execDocker(['context', 'show'], { timeoutMs: 1800 }) || '';
  } catch {
    return '';
  }
}

function dockerRuntimePreference() {
  const raw = String(process.env.EVALUAPRO_DOCKER_RUNTIME || 'auto').trim().toLowerCase();
  return ['auto', 'wsl2-engine', 'desktop'].includes(raw) ? raw : 'auto';
}

function resolveEffectiveDockerRuntime(flavorPolicy = resolveFlavorPolicy(readInstallationManifest())) {
  if (!flavorPolicy.requireDockerRuntime) {
    return {
      mode: 'not-required',
      label: 'No requerido',
      context: '',
      preference: dockerRuntimePreference(),
      warning: ''
    };
  }
  const preference = dockerRuntimePreference();
  const context = tryGetDockerContext();
  const docenteWslTarget = flavorPolicy.flavorId === 'docente-local' && flavorPolicy.runtimeTarget === 'wsl2-docker-minimal';
  const effectivePreference = preference === 'auto' && docenteWslTarget ? 'wsl2-engine' : preference;
  const mode = effectivePreference === 'desktop' && context === 'desktop-linux'
    ? 'desktop-manual'
    : context === 'desktop-linux'
      ? 'desktop-unapproved'
      : 'wsl2-engine';
  const warning = mode === 'desktop-unapproved' && docenteWslTarget
    ? 'Este flavor requiere WSL2 + Docker Engine; Docker Desktop solo se acepta con EVALUAPRO_DOCKER_RUNTIME=desktop.'
    : '';
  return {
    preference: effectivePreference,
    mode,
    context,
    warning
  };
}

function dockerRuntimeGuidance() {
  return dockerRuntimePreference() === 'desktop' ? 'Docker Desktop' : 'WSL2 + Docker Engine';
}

function findDockerDesktopExe() {
  if (process.platform !== 'win32') return '';

  const roots = [
    process.env.ProgramW6432,
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)']
  ].filter(Boolean);

  const candidates = [];
  for (const r of roots) {
    candidates.push(path.join(r, 'Docker', 'Docker', 'Docker Desktop.exe'));
  }

  return candidates.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  }) || '';
}

function tryStartDockerDesktopWindows() {
  const exe = findDockerDesktopExe();
  if (!exe) return false;

  try {
    const child = spawn(exe, [], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function waitForDockerReady(timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const v = tryGetDockerVersion();
    if (v) return v;
    await sleep(1200);
  }
  return '';
}

function shouldAttemptDesktopCompatStart() {
  return process.platform === 'win32' && dockerRuntimePreference() !== 'wsl2-engine' && Boolean(findDockerDesktopExe());
}

function composeBaseArgsForMode(desiredMode) {
  const args = ['compose', '-f', path.basename(composeFile)];
  if (desiredMode === 'prod') args.push('--profile', 'prod');
  return args;
}

function isComposeServiceRunning(desiredMode, service) {
  if (!composeFile || !fs.existsSync(composeFile)) return false;
  const base = composeBaseArgsForMode(desiredMode);
  try {
    const out = execDocker([...base, 'ps', '-q', service], { timeoutMs: 2200 });
    return Boolean(out);
  } catch {
    return false;
  }
}

function isStackRunning(desiredMode) {
  if (desiredMode === 'prod') {
    return (
      isComposeServiceRunning('prod', 'mongo_local') &&
      isComposeServiceRunning('prod', 'api_docente_prod') &&
      isComposeServiceRunning('prod', 'web_docente_prod')
    );
  }
  // dev
  return (
    isComposeServiceRunning('dev', 'mongo_local') &&
    isComposeServiceRunning('dev', 'api_docente_local')
  );
}

function readComposeSnapshot() {
  const now = Date.now();
  if (now - composeSnapshot.checkedAt < 2500) return composeSnapshot;

  const next = {
    checkedAt: now,
    dev: {
      mongo_local: isComposeServiceRunning('dev', 'mongo_local'),
      api_docente_local: isComposeServiceRunning('dev', 'api_docente_local')
    },
    prod: {
      mongo_local: isComposeServiceRunning('prod', 'mongo_local'),
      api_docente_prod: isComposeServiceRunning('prod', 'api_docente_prod'),
      web_docente_prod: isComposeServiceRunning('prod', 'web_docente_prod')
    },
    error: ''
  };

  composeSnapshot = next;
  return composeSnapshot;
}

function requestDockerAutostart(reason = 'startup') {
  if (mode !== 'dev' && mode !== 'prod') return;
  if (!requiresDockerRuntime(readInstallationManifest())) return;
  if (dockerAutostartPromise) return;

  dockerAutostartPromise = (async () => {
    pushEvent('docker', 'dashboard', 'info', 'Autostart solicitado', { reason, mode });

    setDockerAutostart({ state: 'checking', lastError: '' });
    dockerAutostart.stack.state = 'checking';
    dockerAutostart.stack.lastError = '';

    let version = tryGetDockerVersion();
    if (!version) {
      setDockerAutostart({ state: 'starting', ready: false, version: '' });
      if (!dockerAutostart.attemptedDesktopStart) {
        dockerAutostart.attemptedDesktopStart = true;
        const started = shouldAttemptDesktopCompatStart() ? tryStartDockerDesktopWindows() : false;
        if (started) {
          logSystem('Modo compatibilidad Docker Desktop iniciado (si estaba instalado).', 'warn');
        } else {
          logSystem(`Docker no esta listo. Inicia ${dockerRuntimeGuidance()} y verifica \`docker version\`.`, 'warn');
        }
      }
      version = await waitForDockerReady(Number(process.env.DASHBOARD_DOCKER_TIMEOUT_MS || 120_000));
    }

    if (!version) {
      setDockerAutostart({ state: 'error', ready: false, version: '', lastError: 'El runtime Docker no responde.' });
      dockerAutostart.stack.state = 'error';
      dockerAutostart.stack.lastError = 'El runtime Docker no responde.';
      logSystem('El runtime Docker no responde. No se pudo iniciar el stack automaticamente.', 'error', { console: true });
      return;
    }

    setDockerAutostart({ state: 'ready', ready: true, version, lastError: '' });

    // Evita recrear el stack si ya esta levantado.
    const alreadyRunning = isStackRunning(mode);
    dockerAutostart.stack.running = alreadyRunning;
    if (alreadyRunning) {
      dockerAutostart.stack.state = 'skipped';
      logSystem('Stack Docker ya esta activo. No se reinicia.', 'ok');
      ensurePortalAutostartForProd('stack_activo');
      return;
    }

    dockerAutostart.stack.state = 'starting';
    logSystem(`Iniciando stack Docker (${mode})...`, 'system');
    if (!isRunning(mode)) {
      const command = getCommand(mode);
      if (command) startTask(mode, command);
    }
    ensurePortalAutostartForProd('stack_inicio');
  })()
    .catch((err) => {
      setDockerAutostart({ state: 'error', ready: false, version: '', lastError: err?.message || 'Error iniciando Docker' });
      dockerAutostart.stack.state = 'error';
      dockerAutostart.stack.lastError = err?.message || 'Error iniciando Docker';
      logSystem(`Fallo autostart Docker: ${err?.message || 'error'}`, 'error', { console: true });
    })
    .finally(() => {
      dockerAutostartPromise = null;
    });
}

// Check a local endpoint with a small timeout for health reporting.
async function checkHealth(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const started = Date.now();
    try {
      const u = new URL(url);
      const isHttps = u.protocol === 'https:';
      const client = isHttps ? https : http;
      const req = client.request({
        hostname: u.hostname,
        port: u.port ? Number(u.port) : (isHttps ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: 'GET',
        family: 4,
        timeout: timeoutMs,
        rejectUnauthorized: false
      }, (res) => {
        res.resume();
        const ok = res.statusCode >= 200 && res.statusCode < 400;
        resolve({ ok, status: res.statusCode || 0, ms: Date.now() - started });
      });
      req.on('error', (error) => resolve({ ok: false, error: error?.name || 'error', ms: Date.now() - started }));
      req.on('timeout', () => {
        try { req.destroy(); } catch {}
        resolve({ ok: false, error: 'timeout', ms: Date.now() - started });
      });
      req.end();
    } catch (error) {
      resolve({ ok: false, error: error?.name || 'error', ms: Date.now() - started });
    }
  });
}

function checkTcpPort(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ ok: true, ms: Date.now() - started }));
    socket.once('timeout', () => finish({ ok: false, error: 'timeout', ms: Date.now() - started }));
    socket.once('error', (error) => finish({ ok: false, error: error?.code || error?.name || 'error', ms: Date.now() - started }));

    try {
      socket.connect(Number(port), host);
    } catch (error) {
      finish({ ok: false, error: error?.code || error?.name || 'error', ms: Date.now() - started });
    }
  });
}

// Aggregate health checks for the main services used by the dashboard.
async function collectHealth() {
  const httpsState = resolveHttpsState();
  const devScheme = httpsState.mode === 'https' ? 'https' : 'http';
  const apiPort = Number(process.env.PUERTO_API || process.env.PORT || 4000) || 4000;
  const portalPort = Number(process.env.PUERTO_PORTAL || 8080) || 8080;
  const entries = await Promise.all([
    Promise.resolve(['mongoLocal', await checkTcpPort('127.0.0.1', 27017, 2200)]),
    Promise.resolve(['apiDocente', await checkHealth(`http://127.0.0.1:${apiPort}/api/salud`)]),
    Promise.resolve(['apiPortal', await checkHealth(`http://127.0.0.1:${portalPort}/api/portal/salud`)]),
    Promise.resolve(['webDocenteDev', await checkHealth(`${devScheme}://127.0.0.1:5173`)]),
    Promise.resolve(['webDocenteProd', await checkHealth('http://127.0.0.1:4173')])
  ]);
  const services = Object.fromEntries(entries);

  const warmupMs = Math.max(5000, Number(process.env.DASHBOARD_HEALTH_WARMUP_MS || 45000));
  const getTaskAgeMs = (taskName) => {
    const task = processes.get(taskName);
    if (!task || !task.startedAt) return Number.POSITIVE_INFINITY;
    return Date.now() - Number(task.startedAt || 0);
  };
  const withinWarmup = (taskName) => isRunning(taskName) && getTaskAgeMs(taskName) <= warmupMs;
  const getWarmupRemainingMs = (taskName) => {
    const ageMs = getTaskAgeMs(taskName);
    if (!Number.isFinite(ageMs)) return 0;
    return Math.max(0, warmupMs - ageMs);
  };

  const warmingDev = withinWarmup('dev');
  const warmingProd = withinWarmup('prod');
  const warmingPortal = withinWarmup('portal');

  if (!services.apiDocente?.ok && (warmingDev || warmingProd)) {
    const warmupRemainingMs = warmingProd ? getWarmupRemainingMs('prod') : getWarmupRemainingMs('dev');
    services.apiDocente = { ...services.apiDocente, warming: true, warmupMs, warmupRemainingMs };
  }
  if (!services.webDocenteDev?.ok && warmingDev) {
    services.webDocenteDev = { ...services.webDocenteDev, warming: true, warmupMs, warmupRemainingMs: getWarmupRemainingMs('dev') };
  }
  if (!services.webDocenteProd?.ok && warmingProd) {
    services.webDocenteProd = { ...services.webDocenteProd, warming: true, warmupMs, warmupRemainingMs: getWarmupRemainingMs('prod') };
  }
  if (!services.apiPortal?.ok && warmingPortal) {
    services.apiPortal = { ...services.apiPortal, warming: true, warmupMs, warmupRemainingMs: getWarmupRemainingMs('portal') };
  }

  return services;
}

function runCommandCapture(command, timeoutMs = 20_000) {
  const result = spawn('cmd.exe', ['/c', command], {
    cwd: root,
    windowsHide: true
  });
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let done = false;
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      try { result.kill(); } catch {}
      resolve({ ok: false, code: 124, stdout, stderr: `${stderr}\nTimeout` });
    }, Math.max(1000, Number(timeoutMs) || 20_000));

    result.stdout.on('data', (chunk) => { stdout += String(chunk || ''); });
    result.stderr.on('data', (chunk) => { stderr += String(chunk || ''); });
    result.on('error', (error) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      resolve({ ok: false, code: 1, stdout, stderr: `${stderr}\n${error?.message || 'error'}` });
    });
    result.on('exit', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      resolve({ ok: Number(code || 0) === 0, code: Number(code || 0), stdout, stderr });
    });
  });
}

async function postJsonWithAuth(url, token, payload, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1_000, timeoutMs));
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload || {}),
      signal: controller.signal
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return {
      ok: response.ok,
      status: Number(response.status || 0),
      data
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runSyncPreflightForUpdate() {
  const syncCfg = updateConfig?.syncPreflight && typeof updateConfig.syncPreflight === 'object'
    ? updateConfig.syncPreflight
    : {};
  if (!syncCfg.enabled) {
    return {
      ok: true,
      backupOk: true,
      pushOk: true,
      pullOk: true,
      details: ['Preflight sync desactivado por configuración.']
    };
  }

  const tokenEnv = String(syncCfg.tokenEnv || 'EVALUAPRO_SYNC_BEARER');
  const token = String(process.env[tokenEnv] || '').trim();
  const baseUrl = String(syncCfg.baseUrl || 'http://127.0.0.1:4000/api/sincronizaciones').replace(/\/$/, '');
  if (!token) {
    return {
      ok: false,
      backupOk: false,
      pushOk: false,
      pullOk: false,
      error: `Falta token de sincronización en variable ${tokenEnv}.`,
      details: [`Configura ${tokenEnv} con JWT docente válido para ejecutar preflight.`]
    };
  }

  const details = [];
  const exportRes = await postJsonWithAuth(`${baseUrl}/paquete/exportar`, token, syncCfg.exportPayload || {});
  details.push(`exportar:${exportRes.status}`);
  if (!exportRes.ok) {
    return {
      ok: false,
      backupOk: false,
      pushOk: false,
      pullOk: false,
      error: 'Falló backup pre-update (exportar).',
      details
    };
  }

  const pushRes = await postJsonWithAuth(`${baseUrl}/push`, token, syncCfg.pushPayload || {});
  details.push(`push:${pushRes.status}`);
  if (!pushRes.ok) {
    return {
      ok: false,
      backupOk: true,
      pushOk: false,
      pullOk: false,
      error: 'Falló sincronización pre-update (push).',
      details
    };
  }

  const pullRes = await postJsonWithAuth(`${baseUrl}/pull`, token, syncCfg.pullPayload || {});
  details.push(`pull:${pullRes.status}`);
  if (!pullRes.ok) {
    return {
      ok: false,
      backupOk: true,
      pushOk: true,
      pullOk: false,
      error: 'Falló sincronización pre-update (pull).',
      details
    };
  }

  return {
    ok: true,
    backupOk: true,
    pushOk: true,
    pullOk: true,
    details
  };
}

async function stopTasksForUpdate() {
  const runningBefore = runningTasks();
  for (const task of runningBefore) {
    try { stopTask(task); } catch {}
  }
  await sleep(1200);
  return { ok: true, runningBefore };
}

async function startTasksAfterUpdate(runningBefore = []) {
  const toStart = Array.from(new Set(Array.isArray(runningBefore) ? runningBefore : []));
  if (toStart.length === 0) {
    const preferred = mode === 'prod' ? 'prod' : (mode === 'dev' ? 'dev' : '');
    if (preferred) toStart.push(preferred);
  }

  for (const task of toStart) {
    const command = getCommand(task);
    if (!command) continue;
    try { startTask(task, command); } catch {}
  }
  await sleep(1500);
  return { ok: true, restarted: toStart };
}

async function runInstallerForUpdate(filePath) {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'Actualización automática soportada solo en Windows.' };
  }
  const quoted = `"${String(filePath || '').replace(/"/g, '\\"')}"`;
  const command = `${quoted} /quiet /norestart`;
  const result = await runCommandCapture(command, 10 * 60_000);
  if (!result.ok) {
    return { ok: false, error: `Instalador falló (code=${result.code})` };
  }
  return { ok: true };
}

async function healthCheckAfterUpdate() {
  const manifest = readInstallationManifest();
  const requirePortal = requiresLocalPortal(manifest);
  const services = await collectHealth();
  const running = runningTasks();
  const expectsApi = running.includes('dev') || running.includes('prod') || mode === 'dev' || mode === 'prod';
  const expectsPortal = requirePortal && running.includes('portal');
  if (expectsApi && !services?.apiDocente?.ok) {
    return { ok: false, error: 'API docente no saludable tras actualización.' };
  }
  if (expectsPortal && !services?.apiPortal?.ok) {
    return { ok: false, error: 'Portal no saludable tras actualización.' };
  }
  return { ok: true };
}

const updateManager = createUpdateManager({
  owner: updateConfig.owner,
  repo: updateConfig.repo,
  channel: updateConfig.channel,
  assetName: updateConfig.assetName,
  flavorId: updateConfig.flavorId,
  sha256AssetName: updateConfig.sha256AssetName,
  requireSha256: updateConfig.requireSha256,
  feedUrl: updateConfig.feedUrl,
  statePath: updateStatePath,
  downloadRoot: path.join(logDir, 'updates'),
  logger: (message) => logSystem(`[update] ${message}`, 'system'),
  getCurrentVersion: () => String(readRootPackageInfo().version || '0.0.0'),
  preflightSync: runSyncPreflightForUpdate,
  stopTasks: stopTasksForUpdate,
  startTasks: startTasksAfterUpdate,
  runInstaller: runInstallerForUpdate,
  healthCheck: healthCheckAfterUpdate
});

function configureUpdateAutoCheck() {
  if (updateAutoCheckTimer) {
    clearInterval(updateAutoCheckTimer);
    updateAutoCheckTimer = null;
  }

  if (!updateConfig.autoCheckEnabled) {
    logSystem('Auto-check de actualizaciones desactivado por configuración.', 'system');
    return;
  }

  const intervalMs = Number(updateConfig.checkIntervalMs || 0);
  if (!Number.isFinite(intervalMs) || intervalMs < 60_000) {
    logSystem(`Intervalo inválido para auto-check (${updateConfig.checkIntervalMs}).`, 'warn');
    return;
  }

  const runCheck = async (reason) => {
    const status = updateManager.getStatus();
    const currentState = String(status?.state || 'idle');
    if (['checking', 'downloading', 'applying', 'ready', 'available'].includes(currentState)) return;
    try {
      const next = await updateManager.check();
      if (String(next?.state || '') === 'available') {
        logSystem(`Actualización disponible detectada (${next.availableVersion || '?'}) [${reason}]`, 'warn');
      }
    } catch (error) {
      const msg = String(error?.message || error || 'update_check_error');
      logSystem(`Auto-check de actualización falló [${reason}]: ${msg}`, 'warn');
    }
  };

  const startupDelayMs = Math.min(Math.max(Math.floor(intervalMs / 3), 10_000), 60_000);
  setTimeout(() => {
    runCheck('startup').catch(() => undefined);
  }, startupDelayMs);

  updateAutoCheckTimer = setInterval(() => {
    runCheck('interval').catch(() => undefined);
  }, intervalMs);
  logSystem(`Auto-check de actualizaciones activo cada ${Math.round(intervalMs / 1000)}s.`, 'system');
}

function isShortcutsMissing() {
  if (!process.env.USERPROFILE) return false;
  const desktop = path.join(process.env.USERPROFILE, 'Desktop');
  const startMenu = path.join(
    process.env.APPDATA || '',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs'
  );
  const desktopProd = path.join(desktop, 'EvaluaPro - Prod.lnk');
  const desktopDev = path.join(desktop, 'EvaluaPro - Dev.lnk');
  const startProd = path.join(startMenu, 'EvaluaPro - Prod.lnk');
  const startDev = path.join(startMenu, 'EvaluaPro - Dev.lnk');
  const hasDesktop = fs.existsSync(desktopProd) && fs.existsSync(desktopDev);
  const hasStartMenu = fs.existsSync(startProd) && fs.existsSync(startDev);
  return !(hasDesktop || hasStartMenu);
}

function detectNodeMajor(manifest = readInstallationManifest()) {
  const embeddedVersion = String(manifest?.runtime?.embeddedNode?.version || '').replace(/^v/i, '').trim();
  const runtimeVersion = embeddedVersion || String(process.versions.node || '').replace(/^v/i, '').trim();
  const v = runtimeVersion;
  const major = Number(String(v).split('.')[0] || 0);
  if (!Number.isFinite(major) || major <= 0) return 0;
  return major;
}

async function diagnoseRepairStatus() {
  const issues = [];
  const running = runningTasks();
  const expectedMode = mode === 'prod' ? 'prod' : (mode === 'dev' ? 'dev' : 'none');
  const manifest = readInstallationManifest();
  const requirePortal = requiresLocalPortal(manifest);
  const requireDocker = requiresDockerRuntime(manifest);
  const embeddedNodePresent = Boolean(manifest?.runtime?.embeddedNode?.present);
  const nodeMajor = detectNodeMajor(manifest);
  const dockerVersion = requireDocker ? tryGetDockerVersion() : '';
  const health = await collectHealth();
  const stackRunning = expectedMode === 'none' ? false : (isStackRunning(expectedMode) || running.includes(expectedMode));
  const portalRunning = running.includes('portal') || Boolean(health?.apiPortal?.ok);

  if (!embeddedNodePresent || nodeMajor < 24) {
    issues.push({
      code: 'runtime.embedded_node.missing_or_old',
      severity: 'error',
      message: 'Runtime Node embebido local no disponible o desactualizado.',
      autoFixable: false
    });
  }
  if (requireDocker && !dockerVersion) {
    issues.push({
      code: 'prereq.docker.unavailable',
      severity: 'error',
      message: `No se detecta un runtime Docker compatible o el daemon no responde (${dockerRuntimeGuidance()}).`,
      autoFixable: false
    });
  }
  if (requirePortal && !fs.existsSync(portalDistEntry)) {
    issues.push({
      code: 'portal.dist.missing',
      severity: 'error',
      message: 'Falta build del portal (dist/index.js).',
      autoFixable: true
    });
  }
  if (expectedMode !== 'none' && !stackRunning) {
    issues.push({
      code: 'services.stack.down',
      severity: 'error',
      message: `Plataforma ${expectedMode} no esta activa.`,
      autoFixable: true
    });
  }
  if (requirePortal && expectedMode !== 'none' && !portalRunning) {
    issues.push({
      code: 'services.portal.down',
      severity: 'error',
      message: 'Servicio portal no esta saludable.',
      autoFixable: true
    });
  }
  if (isShortcutsMissing()) {
    issues.push({
      code: 'shortcuts.missing',
      severity: 'warn',
      message: 'No se detectaron accesos directos esperados.',
      autoFixable: false
    });
  }

  const needsRepair = issues.some((issue) => issue.severity === 'error');
  repairState.issues = issues;
  return { needsRepair, issues, lastRun: repairState.lastRun };
}

function createRepairSteps() {
  return [
    { id: 'precheck', label: 'Diagnostico inicial', state: 'pending', detail: '' },
    { id: 'ensure_prereq_visibility', label: 'Verificacion de prerequisitos', state: 'pending', detail: '' },
    { id: 'repair_portal_dist', label: 'Reparar build portal', state: 'pending', detail: '' },
    { id: 'repair_shortcuts', label: 'Accesos directos (solo Installer Hub)', state: 'pending', detail: '' },
    { id: 'repair_stack', label: 'Recuperar stack', state: 'pending', detail: '' },
    { id: 'repair_portal_service', label: 'Recuperar portal', state: 'pending', detail: '' },
    { id: 'postcheck_health', label: 'Validacion final de salud', state: 'pending', detail: '' },
    { id: 'finalize', label: 'Finalizacion', state: 'pending', detail: '' }
  ];
}

function updateRepairPercent() {
  const total = repairState.steps.length || 1;
  const done = repairState.steps.filter((step) => step.state === 'ok' || step.state === 'skipped').length;
  repairState.percent = Math.round((done / total) * 100);
}

async function runRepairStep(stepId, work) {
  const step = repairState.steps.find((item) => item.id === stepId);
  if (!step) return;
  repairState.currentStep = stepId;
  step.state = 'running';
  updateRepairPercent();
  try {
    const detail = await work();
    step.state = 'ok';
    step.detail = String(detail || 'OK');
  } catch (error) {
    step.state = 'error';
    step.detail = String(error?.message || 'Error');
    throw error;
  } finally {
    updateRepairPercent();
  }
}

function markStepSkipped(stepId, detail = 'No aplica') {
  const step = repairState.steps.find((item) => item.id === stepId);
  if (!step) return;
  step.state = 'skipped';
  step.detail = detail;
  updateRepairPercent();
}

async function startRepairRun() {
  if (repairState.state === 'running') {
    return { ok: false, error: 'already_running', runId: repairState.runId };
  }

  repairState.runId = `repair-${Date.now()}`;
  repairState.state = 'running';
  repairState.currentStep = '';
  repairState.percent = 0;
  repairState.steps = createRepairSteps();
  repairState.manualActions = [];
  const startedAt = Date.now();
  let success = true;
  const running = runningTasks();
  const expectedMode = mode === 'prod' ? 'prod' : (mode === 'dev' ? 'dev' : (running.includes('prod') ? 'prod' : 'dev'));
  const diagnostics = await diagnoseRepairStatus();
  const manifest = readInstallationManifest();
  const requirePortal = requiresLocalPortal(manifest);
  repairState.issues = diagnostics.issues;

  (async () => {
    try {
      await runRepairStep('precheck', async () => `${diagnostics.issues.length} hallazgos.`);
      await runRepairStep('ensure_prereq_visibility', async () => {
        const blockers = diagnostics.issues.filter((issue) =>
          issue.code === 'runtime.embedded_node.missing_or_old' || issue.code === 'prereq.docker.unavailable'
        );
        if (blockers.length === 0) return 'Prerequisitos minimos disponibles.';
        if (blockers.some((i) => i.code === 'runtime.embedded_node.missing_or_old')) {
          repairState.manualActions.push('El runtime Node embebido local no esta disponible. Reejecuta Installer Hub o una reparacion del producto.');
        }
        if (blockers.some((i) => i.code === 'prereq.docker.unavailable')) {
          repairState.manualActions.push(`Inicia ${dockerRuntimeGuidance()} y verifica que responda \`docker version\`.`);
          repairState.manualActions.push('Si usaras WSL2 por defecto, valida la distro soportada, Docker Engine y Node 24 dentro de la distro activa.');
        }
        if (diagnostics.issues.some((issue) => issue.code === 'shortcuts.missing')) {
          repairState.manualActions.push('Los accesos directos solo se instalan o restauran desde Installer Hub. Ejecuta una reparacion del producto desde el Hub si necesitas recrearlos.');
        }
        return `${blockers.length} prerequisitos pendientes reportados.`;
      });

      if (requirePortal && !fs.existsSync(portalDistEntry)) {
        await runRepairStep('repair_portal_dist', async () => {
          const result = await runCommandCapture('npm -C apps/portal_alumno_cloud run build', 180_000);
          if (!result.ok) throw new Error('Fallo build portal.');
          return 'Build portal completado.';
        });
      } else {
        markStepSkipped('repair_portal_dist', requirePortal ? 'Build portal ya disponible.' : 'Portal local no requerido por el flavor actual.');
      }

      markStepSkipped('repair_shortcuts', 'Los accesos directos se gestionan exclusivamente desde Installer Hub.');

      await runRepairStep('repair_stack', async () => {
        const task = expectedMode === 'prod' ? 'prod' : 'dev';
        const command = getCommand(task);
        if (!command) throw new Error('No hay comando de plataforma configurado.');
        if (isRunning(task)) restartTask(task);
        else startTask(task, command);
        await sleep(1500);
        return `Plataforma ${task} solicitada.`;
      });

      if (requirePortal) {
        await runRepairStep('repair_portal_service', async () => {
          const command = getCommand('portal');
          if (!command) throw new Error('No hay comando de portal configurado.');
          if (isRunning('portal')) restartTask('portal');
          else startTask('portal', command);
          await sleep(1000);
          return 'Portal solicitado.';
        });
      } else {
        markStepSkipped('repair_portal_service', 'Portal local no requerido por el flavor actual.');
      }

      await runRepairStep('postcheck_health', async () => {
        let finalHealth = await collectHealth();
        for (let i = 0; i < 2; i += 1) {
          if (finalHealth?.apiDocente?.ok && (!requirePortal || finalHealth?.apiPortal?.ok)) break;
          await sleep(1500);
          finalHealth = await collectHealth();
        }
        const okApi = Boolean(finalHealth?.apiDocente?.ok);
        const okPortal = !requirePortal || Boolean(finalHealth?.apiPortal?.ok);
        if (!okApi || !okPortal) {
          if (!okApi) repairState.manualActions.push('API docente sigue sin salud. Revisa logs del backend.');
          if (requirePortal && !okPortal) repairState.manualActions.push('Portal sigue sin salud. Revisa logs del portal.');
          throw new Error('Salud final incompleta.');
        }
        return 'Servicios saludables despues de reparacion.';
      });
    } catch (error) {
      success = false;
      logSystem(`Reparacion fallida: ${error?.message || 'error'}`, 'error');
    } finally {
      const finalizeStep = repairState.steps.find((step) => step.id === 'finalize');
      if (finalizeStep) {
        finalizeStep.state = success ? 'ok' : 'error';
        finalizeStep.detail = success ? 'Reparacion completada.' : 'Reparacion incompleta.';
      }
      updateRepairPercent();
      repairState.state = success ? 'ok' : 'error';
      repairState.currentStep = '';
      repairState.lastRun = {
        startedAt,
        finishedAt: Date.now(),
        ok: success,
        steps: repairState.steps.map((step) => ({
          id: step.id,
          state: step.state,
          detail: step.detail
        }))
      };
      await diagnoseRepairStatus();
    }
  })();

  return { ok: true, runId: repairState.runId };
}

function setLifecycleState(patch = {}) {
  Object.assign(lifecycleState, patch || {});
  lifecycleState.lastChangedAt = Date.now();
}

function getDesiredLifecycleMode() {
  return lifecycleState.desiredMode === 'dev' ? 'dev' : 'prod';
}

function normalizeLifecycleIntervalMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return lifecycleState.supervisorIntervalMs;
  return Math.min(120000, Math.max(5000, Math.round(n)));
}

function normalizeLifecycleFailureThreshold(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return lifecycleState.failureThreshold;
  return Math.min(8, Math.max(1, Math.round(n)));
}

function normalizeLifecycleRepairCooldownMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return lifecycleState.repairCooldownMs;
  return Math.min(30 * 60_000, Math.max(30_000, Math.round(n)));
}

function sanitizeLifecyclePolicy(raw = null) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const candidateMode = String(source.desiredMode || lifecyclePolicyDefaults.desiredMode).trim().toLowerCase();
  const desiredMode = candidateMode === 'dev' ? 'dev' : 'prod';

  const intervalRaw = Number(source.supervisorIntervalMs);
  const failureRaw = Number(source.failureThreshold);
  const cooldownRaw = Number(source.repairCooldownMs);

  const supervisorIntervalMs = Number.isFinite(intervalRaw)
    ? Math.min(120000, Math.max(5000, Math.round(intervalRaw)))
    : lifecyclePolicyDefaults.supervisorIntervalMs;
  const failureThreshold = Number.isFinite(failureRaw)
    ? Math.min(8, Math.max(1, Math.round(failureRaw)))
    : lifecyclePolicyDefaults.failureThreshold;
  const repairCooldownMs = Number.isFinite(cooldownRaw)
    ? Math.min(30 * 60_000, Math.max(30_000, Math.round(cooldownRaw)))
    : lifecyclePolicyDefaults.repairCooldownMs;

  return {
    desiredMode,
    supervisorEnabled: source.supervisorEnabled === undefined
      ? lifecyclePolicyDefaults.supervisorEnabled
      : Boolean(source.supervisorEnabled),
    autoRepairEnabled: source.autoRepairEnabled === undefined
      ? lifecyclePolicyDefaults.autoRepairEnabled
      : Boolean(source.autoRepairEnabled),
    supervisorIntervalMs,
    failureThreshold,
    repairCooldownMs
  };
}

function saveLifecyclePolicy(partial = null) {
  const merged = sanitizeLifecyclePolicy({
    desiredMode: lifecycleState.desiredMode,
    supervisorEnabled: lifecycleState.supervisorEnabled,
    autoRepairEnabled: lifecycleState.autoRepairEnabled,
    supervisorIntervalMs: lifecycleState.supervisorIntervalMs,
    failureThreshold: lifecycleState.failureThreshold,
    repairCooldownMs: lifecycleState.repairCooldownMs,
    ...(partial && typeof partial === 'object' ? partial : {})
  });

  lifecycleState.desiredMode = merged.desiredMode;
  lifecycleState.supervisorEnabled = merged.supervisorEnabled;
  lifecycleState.autoRepairEnabled = merged.autoRepairEnabled;
  lifecycleState.supervisorIntervalMs = merged.supervisorIntervalMs;
  lifecycleState.failureThreshold = merged.failureThreshold;
  lifecycleState.repairCooldownMs = merged.repairCooldownMs;
  lifecycleState.lastChangedAt = Date.now();

  try {
    fs.writeFileSync(lifecycleConfigPath, JSON.stringify(merged, null, 2), 'utf8');
  } catch (error) {
    logSystem(`No se pudo guardar lifecycle config: ${error?.message || 'error'}`, 'warn');
  }

  return merged;
}

function loadLifecyclePolicy() {
  try {
    if (!fs.existsSync(lifecycleConfigPath)) {
      return saveLifecyclePolicy(lifecyclePolicyDefaults);
    }
    const raw = fs.readFileSync(lifecycleConfigPath, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    return saveLifecyclePolicy(parsed);
  } catch (error) {
    logSystem(`Lifecycle config inválida, usando defaults: ${error?.message || 'error'}`, 'warn');
    return saveLifecyclePolicy(lifecyclePolicyDefaults);
  }
}

function normalizeContinuityIntervalMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return continuityState.intervalMs;
  return Math.min(2 * 60 * 60_000, Math.max(60_000, Math.round(n)));
}

function normalizeContinuityFailureLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return continuityState.maxConsecutiveFailures;
  return Math.min(20, Math.max(1, Math.round(n)));
}

function sanitizeContinuityPolicy(raw = null) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: source.enabled === undefined ? continuityPolicyDefaults.enabled : Boolean(source.enabled),
    intervalMs: normalizeContinuityIntervalMs(
      source.intervalMs === undefined ? continuityPolicyDefaults.intervalMs : source.intervalMs
    ),
    exportBeforePush: source.exportBeforePush === undefined
      ? continuityPolicyDefaults.exportBeforePush
      : Boolean(source.exportBeforePush),
    doPush: source.doPush === undefined ? continuityPolicyDefaults.doPush : Boolean(source.doPush),
    doPull: source.doPull === undefined ? continuityPolicyDefaults.doPull : Boolean(source.doPull),
    maxConsecutiveFailures: normalizeContinuityFailureLimit(
      source.maxConsecutiveFailures === undefined
        ? continuityPolicyDefaults.maxConsecutiveFailures
        : source.maxConsecutiveFailures
    )
  };
}

function saveContinuityPolicy(partial = null) {
  const merged = sanitizeContinuityPolicy({
    enabled: continuityState.enabled,
    intervalMs: continuityState.intervalMs,
    exportBeforePush: continuityState.exportBeforePush,
    doPush: continuityState.doPush,
    doPull: continuityState.doPull,
    maxConsecutiveFailures: continuityState.maxConsecutiveFailures,
    ...(partial && typeof partial === 'object' ? partial : {})
  });

  continuityState.enabled = merged.enabled;
  continuityState.intervalMs = merged.intervalMs;
  continuityState.exportBeforePush = merged.exportBeforePush;
  continuityState.doPush = merged.doPush;
  continuityState.doPull = merged.doPull;
  continuityState.maxConsecutiveFailures = merged.maxConsecutiveFailures;
  continuityState.updatedAt = Date.now();

  try {
    fs.writeFileSync(continuityConfigPath, JSON.stringify(merged, null, 2), 'utf8');
  } catch (error) {
    logSystem(`No se pudo guardar continuity config: ${error?.message || 'error'}`, 'warn');
  }

  return merged;
}

function loadContinuityPolicy() {
  try {
    if (!fs.existsSync(continuityConfigPath)) {
      return saveContinuityPolicy(continuityPolicyDefaults);
    }
    const raw = fs.readFileSync(continuityConfigPath, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    return saveContinuityPolicy(parsed);
  } catch (error) {
    logSystem(`Continuity config inválida, usando defaults: ${error?.message || 'error'}`, 'warn');
    return saveContinuityPolicy(continuityPolicyDefaults);
  }
}

function continuitySnapshot() {
  return {
    enabled: continuityState.enabled,
    intervalMs: continuityState.intervalMs,
    exportBeforePush: continuityState.exportBeforePush,
    doPush: continuityState.doPush,
    doPull: continuityState.doPull,
    maxConsecutiveFailures: continuityState.maxConsecutiveFailures,
    running: continuityState.running,
    lastRunAt: continuityState.lastRunAt,
    nextRunAt: continuityState.nextRunAt,
    lastResult: continuityState.lastResult,
    lastError: continuityState.lastError,
    lastDetails: Array.isArray(continuityState.lastDetails) ? continuityState.lastDetails.slice(0, 12) : [],
    consecutiveFailures: continuityState.consecutiveFailures,
    history: Array.isArray(continuityState.history) ? continuityState.history.slice(0, 20) : [],
    updatedAt: continuityState.updatedAt
  };
}

async function runContinuitySync(reason = 'manual') {
  if (continuityRunPromise) return continuityRunPromise;

  continuityRunPromise = (async () => {
    continuityState.running = true;
    continuityState.lastError = '';
    continuityState.lastRunAt = Date.now();
    continuityState.lastResult = 'running';
    continuityState.updatedAt = Date.now();

    const syncCfg = updateConfig?.syncPreflight && typeof updateConfig.syncPreflight === 'object'
      ? updateConfig.syncPreflight
      : {};
    const tokenEnv = String(syncCfg.tokenEnv || 'EVALUAPRO_SYNC_BEARER');
    const token = String(process.env[tokenEnv] || '').trim();
    const baseUrl = String(syncCfg.baseUrl || 'http://127.0.0.1:4000/api/sincronizaciones').replace(/\/$/, '');
    const details = [];
    let ok = true;
    let errorText = '';

    try {
      if (!continuityState.enabled) {
        continuityState.lastResult = 'disabled';
        continuityState.nextRunAt = 0;
        continuityState.lastDetails = ['Continuidad desactivada por política.'];
        return { ok: true, skipped: true, reason: 'disabled' };
      }

      if (!token) {
        ok = false;
        errorText = `Falta token en ${tokenEnv}`;
      } else {
        if (continuityState.exportBeforePush) {
          const exportRes = await postJsonWithAuth(`${baseUrl}/paquete/exportar`, token, syncCfg.exportPayload || {}, 35_000);
          details.push(`exportar:${exportRes.status}`);
          if (!exportRes.ok) {
            ok = false;
            errorText = 'Falló exportar paquete de sincronización.';
          }
        }

        if (ok && continuityState.doPush) {
          const pushRes = await postJsonWithAuth(`${baseUrl}/push`, token, syncCfg.pushPayload || {}, 35_000);
          details.push(`push:${pushRes.status}`);
          if (!pushRes.ok) {
            ok = false;
            errorText = 'Falló push de sincronización.';
          }
        }

        if (ok && continuityState.doPull) {
          const pullRes = await postJsonWithAuth(`${baseUrl}/pull`, token, syncCfg.pullPayload || {}, 35_000);
          details.push(`pull:${pullRes.status}`);
          if (!pullRes.ok) {
            ok = false;
            errorText = 'Falló pull de sincronización.';
          }
        }
      }

      continuityState.lastDetails = details;
      continuityState.lastError = ok ? '' : errorText;
      continuityState.lastResult = ok ? 'ok' : 'error';
      continuityState.consecutiveFailures = ok ? 0 : (continuityState.consecutiveFailures + 1);
      continuityState.nextRunAt = continuityState.enabled ? Date.now() + continuityState.intervalMs : 0;
      continuityState.updatedAt = Date.now();

      const eventEntry = {
        ts: Date.now(),
        reason,
        ok,
        details: details.slice(0, 8),
        error: ok ? '' : errorText
      };
      continuityState.history.unshift(eventEntry);
      if (continuityState.history.length > 40) continuityState.history.length = 40;

      pushEvent('continuity', 'dashboard', ok ? 'ok' : 'error', ok ? 'Sync continuidad OK' : 'Sync continuidad con error', {
        reason,
        details,
        error: errorText
      });

      if (!ok && continuityState.consecutiveFailures >= continuityState.maxConsecutiveFailures) {
        continuityState.enabled = false;
        continuityState.nextRunAt = 0;
        continuityState.lastResult = 'paused';
        continuityState.lastError = `Pausado por ${continuityState.consecutiveFailures} fallos consecutivos.`;
        saveContinuityPolicy();
        configureContinuityScheduler();
      }

      return {
        ok,
        reason,
        details,
        error: errorText
      };
    } catch (error) {
      const msg = String(error?.message || 'continuity_error');
      continuityState.lastResult = 'error';
      continuityState.lastError = msg;
      continuityState.consecutiveFailures += 1;
      continuityState.nextRunAt = continuityState.enabled ? Date.now() + continuityState.intervalMs : 0;
      continuityState.updatedAt = Date.now();
      logSystem(`Continuity sync falló: ${msg}`, 'error');
      return { ok: false, reason, error: msg };
    } finally {
      continuityState.running = false;
      continuityState.updatedAt = Date.now();
    }
  })().finally(() => {
    continuityRunPromise = null;
  });

  return continuityRunPromise;
}

function configureContinuityScheduler() {
  if (continuityTimer) {
    clearInterval(continuityTimer);
    continuityTimer = null;
  }

  if (!continuityState.enabled) {
    continuityState.nextRunAt = 0;
    continuityState.updatedAt = Date.now();
    return;
  }

  const intervalMs = normalizeContinuityIntervalMs(continuityState.intervalMs);
  continuityState.intervalMs = intervalMs;
  continuityState.nextRunAt = Date.now() + intervalMs;
  continuityState.updatedAt = Date.now();

  continuityTimer = setInterval(() => {
    runContinuitySync('scheduler').catch(() => undefined);
  }, intervalMs);
}

function detectInstalledProduct() {
  const checkedAt = Date.now();
  if (process.platform !== 'win32') {
    lifecycleState.installation = {
      installed: false,
      installDir: '',
      checkedAt
    };
    return lifecycleState.installation;
  }

  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'EvaluaPro'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'EvaluaPro')
  ];

  const installDir = candidates.find((dir) => {
    try {
      if (!fs.existsSync(dir)) return false;
      const hasEnv = fs.existsSync(path.join(dir, '.env'));
      const hasConfig = fs.existsSync(path.join(dir, 'config', 'update-config.json'));
      const hasLauncher = fs.existsSync(path.join(dir, 'scripts', 'launcher-dashboard-hidden.vbs'));
      return hasEnv || hasConfig || hasLauncher;
    } catch {
      return false;
    }
  }) || '';

  lifecycleState.installation = {
    installed: Boolean(installDir),
    installDir,
    checkedAt
  };
  return lifecycleState.installation;
}

function readInstallationManifest() {
  const manifest = readJsonFile(installationManifestPath);
  if (!manifest || typeof manifest !== 'object') {
    return {
      generatedAt: '',
      installation: {
        flavor: updateConfig.flavorId || 'docente-local',
        requireLocalPortal: false,
        requireDockerRuntime: false,
        runtimeTarget: 'native-node-sqlite',
        installed: false,
        root: root,
        port: Number(portArg || 0) || 0
      },
      runtime: {
        embeddedNode: {
          present: false,
          path: path.join(root, 'runtime', 'node', 'node.exe'),
          version: ''
        },
        wsl: {
          distro: 'Ubuntu',
          nodeVersion: '',
          dockerReady: false
        }
      },
      shortcuts: {},
      license: {
        portableExists: fs.existsSync(portableLicensePath),
        portablePath: portableLicensePath
      },
      criticalFiles: []
    };
  }
  return manifest;
}

function requiresLocalPortal(manifest = null) {
  return resolveFlavorPolicy(manifest).requireLocalPortal;
}

function normalizeShortcutValue(value) {
  return String(value || '').trim().replace(/\\/g, '/').toLowerCase();
}

function normalizeIconLocation(value) {
  const raw = String(value || '').trim();
  const [iconPath] = raw.split(',');
  return normalizeShortcutValue(iconPath);
}

function resolveShortcutState(manifest) {
  const entries = Object.values((manifest && manifest.shortcuts) || {});
  const expected = entries.filter((entry) => entry && typeof entry === 'object');
  const present = expected.filter((entry) => Boolean(entry.exists));
  const missing = expected.filter((entry) => !entry.exists).map((entry) => String(entry.path || '')).filter(Boolean);
  const mismatched = expected.filter((entry) => {
    if (!entry.exists) {
      return false;
    }

    const targetMismatch = entry.expectedTargetPath && normalizeShortcutValue(entry.targetPath) !== normalizeShortcutValue(entry.expectedTargetPath);
    const argumentsMismatch = entry.expectedArguments && normalizeShortcutValue(entry.arguments) !== normalizeShortcutValue(entry.expectedArguments);
    const iconMismatch = entry.expectedIconLocation && normalizeIconLocation(entry.iconLocation) !== normalizeIconLocation(entry.expectedIconLocation);
    return targetMismatch || argumentsMismatch || iconMismatch;
  }).map((entry) => ({
    path: String(entry.path || ''),
    expectedTargetPath: String(entry.expectedTargetPath || ''),
    targetPath: String(entry.targetPath || ''),
    expectedArguments: String(entry.expectedArguments || ''),
    arguments: String(entry.arguments || ''),
    expectedIconLocation: String(entry.expectedIconLocation || ''),
    iconLocation: String(entry.iconLocation || '')
  }));
  return {
    state: expected.length > 0 && missing.length === 0 && mismatched.length === 0 ? 'ok' : (present.length > 0 ? 'degradada' : 'faltantes'),
    expected: expected.length,
    present: present.length,
    missing,
    mismatched
  };
}

function resolveLicenseState(manifest) {
  const portableExists = Boolean(manifest?.license?.portableExists) || fs.existsSync(portableLicensePath);
  const stepUpConfigExists = Boolean(manifest?.license?.stepUpConfigExists) || fs.existsSync(stepUpConfigPath);
  const stepUpSessionExists = Boolean(manifest?.license?.stepUpSessionExists) || fs.existsSync(stepUpSessionPath);
  let holderName = '';
  let tier = '';
  let stepUpMethods = [];
  let recoveryCodesRemaining = 0;
  let lastStepUpAt = '';
  let stepUpRequired = false;
  if (portableExists) {
    try {
      const envelope = readJsonFile(portableLicensePath);
      holderName = String(envelope?.payload?.holderName || '');
      tier = String(envelope?.payload?.tier || '');
    } catch {}
  }
  if (stepUpConfigExists) {
    try {
      const envelope = readJsonFile(stepUpConfigPath);
      stepUpMethods = Array.isArray(envelope?.payload?.methods) ? envelope.payload.methods.map((item) => String(item || '')) : [];
      recoveryCodesRemaining = Array.isArray(envelope?.payload?.recovery?.codes)
        ? envelope.payload.recovery.codes.filter((item) => !String(item?.usedAt || '').trim()).length
        : 0;
    } catch {}
  }
  if (stepUpSessionExists) {
    try {
      const envelope = readJsonFile(stepUpSessionPath);
      lastStepUpAt = String(envelope?.payload?.lastStepUpAt || '');
      const expiresAt = String(envelope?.payload?.expiresAt || '');
      stepUpRequired = !(expiresAt && Date.parse(expiresAt) > Date.now());
    } catch {
      stepUpRequired = true;
    }
  } else if (portableExists) {
    stepUpRequired = true;
  }
  return {
    state: portableExists ? 'portable_present' : 'missing',
    portablePath: String(manifest?.license?.portablePath || portableLicensePath),
    portableExists,
    stepUpConfigExists,
    holderName,
    tier,
    stepUpRequired,
    stepUpMethods,
    recoveryCodesRemaining,
    lastStepUpAt
  };
}

function resolveSupportAuthorization() {
  const verified = readVerifiedStepUpStatus();
  return {
    active: Boolean(verified.active),
    configured: Boolean(verified.configured),
    expiresAt: String(verified.expiresAt || ''),
    methods: Array.isArray(verified.stepUpMethods) ? verified.stepUpMethods.map((item) => String(item || '')) : [],
    verified: Boolean(verified.ok),
    allowlist: [...privilegedSupportActions]
  };
}

function readVerifiedStepUpStatus() {
  if (process.platform !== 'win32') {
    return { ok: false, configured: false, active: false, error: 'step_up_windows_only' };
  }

  const securityModule = path.join(root, 'scripts', 'installer-burn', 'modules', 'LicenseClientSecurity.psm1');
  if (!fs.existsSync(securityModule)) {
    return { ok: false, configured: false, active: false, error: 'step_up_module_missing' };
  }

  const psScript = [
    `$ErrorActionPreference='Stop'`,
    `Import-Module -Force -WarningAction SilentlyContinue '${securityModule.replace(/'/g, "''")}'`,
    `Get-EvaluaProStepUpStatus | ConvertTo-Json -Depth 8 -Compress`
  ].join('; ');
  const result = spawnSync(getPowerShellPath(), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 8_000
  });
  if (result.status !== 0) {
    return {
      ok: false,
      configured: false,
      active: false,
      error: String(result.stderr || 'step_up_status_failed').trim().slice(0, 300)
    };
  }
  try {
    return JSON.parse(String(result.stdout || '').trim());
  } catch {
    return { ok: false, configured: false, active: false, error: 'step_up_status_invalid_json' };
  }
}

function assertSupportAuthorization(action) {
  const authorization = resolveSupportAuthorization();
  if (!authorization.active) {
    return {
      ok: false,
      status: 403,
      error: 'step_up_required',
      detail: 'Operacion de soporte requiere sesion step-up local activa.',
      authorization
    };
  }

  if (!privilegedSupportActions.includes(action)) {
    return {
      ok: false,
      status: 400,
      error: 'support_action_not_allowed',
      detail: 'Accion de soporte fuera de allowlist.',
      authorization
    };
  }

  return { ok: true, status: 200, authorization };
}

async function runPrivilegedSupportAction(action, options = {}) {
  const normalized = String(action || '').trim().toLowerCase();
  const authorized = assertSupportAuthorization(normalized);
  if (!authorized.ok) {
    pushEvent('support', 'dashboard', 'warn', 'Operacion privilegiada denegada', {
      action: normalized || 'missing',
      error: authorized.error
    });
    return authorized;
  }

  pushEvent('support', 'dashboard', 'system', 'Operacion privilegiada autorizada', { action: normalized });
  logSystem(`Soporte privilegiado ejecuta ${normalized}.`, 'system', { meta: { persist: true } });

  if (normalized === 'hub-install') {
    const result = await runLifecycleOperation('install');
    return { ok: Boolean(result?.ok), status: result?.ok ? 200 : 500, action: normalized, result };
  }
  if (normalized === 'hub-repair') {
    const result = await runLifecycleOperation('repair');
    return { ok: Boolean(result?.ok), status: result?.ok ? 200 : 500, action: normalized, result };
  }
  if (normalized === 'hub-update-apply') {
    const result = await updateManager.apply();
    return { ok: result?.state !== 'error', status: result?.state === 'error' ? 502 : 200, action: normalized, result };
  }
  if (normalized === 'hub-uninstall') {
    if (options?.confirm !== true) {
      return {
        ok: false,
        status: 428,
        error: 'support_confirmation_required',
        detail: 'Desinstalacion requiere confirmacion explicita.',
        action: normalized
      };
    }
    const result = await runLifecycleOperation('uninstall');
    return { ok: Boolean(result?.ok), status: result?.ok ? 200 : 500, action: normalized, result };
  }

  return {
    ok: false,
    status: 400,
    error: 'support_action_not_allowed',
    detail: 'Accion de soporte fuera de allowlist.',
    authorization: authorized.authorization
  };
}

function resolveBootstrapState() {
  try {
    const candidates = fs.readdirSync(logDir)
      .filter((name) => name.startsWith('bootstrap-state-') && name.endsWith('.json'))
      .map((name) => path.join(logDir, name))
      .map((filePath) => ({
        filePath,
        stat: fs.statSync(filePath)
      }))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    if (candidates.length === 0) {
      return {
        runId: '',
        state: 'idle',
        message: '',
        desiredMode: getDesiredLifecycleMode(),
        updatedAt: 0
      };
    }
    const latest = readJsonFile(candidates[0].filePath) || {};
    return {
      runId: String(latest.runId || ''),
      state: String(latest.state || 'idle'),
      message: String(latest.message || ''),
      desiredMode: String(latest.desiredMode || getDesiredLifecycleMode()),
      updatedAt: candidates[0].stat.mtimeMs
    };
  } catch {
    return {
      runId: '',
      state: 'idle',
      message: '',
      desiredMode: getDesiredLifecycleMode(),
      updatedAt: 0
    };
  }
}

function resolveInstallationState(manifest, installInfo) {
  const issues = [];
  const criticalFiles = Array.isArray(manifest?.criticalFiles) ? manifest.criticalFiles : [];
  for (const item of criticalFiles) {
    if (!item?.exists) {
      issues.push(`Falta archivo critico: ${String(item.path || '')}`);
    }
  }
  const shortcutState = resolveShortcutState(manifest);
  if (shortcutState.missing.length > 0) {
    issues.push(`Faltan accesos directos: ${shortcutState.missing.length}`);
  }
  if (shortcutState.mismatched.length > 0) {
    issues.push(`Accesos directos con metadata incorrecta: ${shortcutState.mismatched.length}`);
  }
  const manifestInstalled = Boolean(manifest?.installation?.installed);
  const effectiveInstalled = Boolean(installInfo.installed || manifestInstalled);
  const state = !effectiveInstalled
    ? 'ausente'
    : (issues.length === 0 ? 'ok' : (issues.length <= 2 ? 'degradada' : 'dañada'));
  return {
    state,
    installDir: String(installInfo.installDir || manifest?.installation?.root || ''),
    generatedAt: String(manifest?.generatedAt || ''),
    registeredInstalled: Boolean(installInfo.installed),
    manifestInstalled,
    issues
  };
}

function isStackHealthyFromServices(services, desiredMode = getDesiredLifecycleMode(), requirePortal = requiresLocalPortal()) {
  const mongoOk = Boolean(services?.mongoLocal?.ok);
  const apiOk = Boolean(services?.apiDocente?.ok);
  const webOk = desiredMode === 'prod'
    ? Boolean(services?.webDocenteProd?.ok)
    : Boolean(services?.webDocenteDev?.ok);
  const portalOk = !requirePortal || Boolean(services?.apiPortal?.ok);
  return mongoOk && apiOk && webOk && portalOk;
}

async function buildLifecycleStatus(includeHealth = true) {
  const running = runningTasks();
  const desiredMode = getDesiredLifecycleMode();
  const installInfo = detectInstalledProduct();
  const manifest = readInstallationManifest();
  const flavorPolicy = resolveFlavorPolicy(manifest);
  const services = includeHealth ? await collectHealth() : {};
  const healthy = includeHealth ? isStackHealthyFromServices(services, desiredMode, flavorPolicy.requireLocalPortal) : false;
  const stackManagedRunning = running.includes('dev') || running.includes('prod');
  const desiredRunning = running.includes(desiredMode);
  const portalRunning = running.includes('portal');
  const installationState = resolveInstallationState(manifest, installInfo);
  const shortcutState = resolveShortcutState(manifest);
  const licenseState = resolveLicenseState(manifest);
  const bootstrapState = resolveBootstrapState();

  return {
    desiredMode,
    installed: installInfo.installed,
    installDir: installInfo.installDir,
    pwaPolicy: {
      installable: true,
      launcherPreferred: true,
      offlineCapable: false,
      manifestId: '/pwa/evaluapro/dashboard-local',
      startUrl: '/#tab=main&source=pwa'
    },
    installationState,
    shortcutState,
    licenseState,
    bootstrapState,
    flavorPolicy,
    running,
    stackManagedRunning,
    desiredRunning,
    portalRunning: flavorPolicy.requireLocalPortal ? portalRunning : false,
    healthy,
    services,
    supervisor: {
      enabled: lifecycleState.supervisorEnabled,
      autoRepairEnabled: lifecycleState.autoRepairEnabled,
      intervalMs: lifecycleState.supervisorIntervalMs,
      nextRunAt: lifecycleState.reconcile.nextRunAt,
      failureThreshold: lifecycleState.failureThreshold,
      repairCooldownMs: lifecycleState.repairCooldownMs
    },
    reconcile: { ...lifecycleState.reconcile },
    operation: { ...lifecycleState.operation },
    lastChangedAt: lifecycleState.lastChangedAt
  };
}

function ensureTaskRunning(taskName) {
  const command = getCommand(taskName);
  if (!command) return false;
  if (isRunning(taskName)) return false;
  startTask(taskName, command);
  return true;
}

async function reconcileLifecycle(reason = 'manual') {
  if (lifecycleReconcilePromise) return lifecycleReconcilePromise;

  lifecycleReconcilePromise = (async () => {
    const startedAt = Date.now();
    lifecycleState.reconcile.running = true;
    lifecycleState.reconcile.lastReason = reason;
    lifecycleState.reconcile.lastError = '';
    lifecycleState.reconcile.lastAction = 'none';
    lifecycleState.reconcile.lastResult = 'running';
    lifecycleState.reconcile.lastRunAt = startedAt;
    lifecycleState.reconcile.nextRunAt = startedAt + lifecycleState.supervisorIntervalMs;
    lifecycleState.lastChangedAt = Date.now();

    let action = 'none';
    try {
      if (lifecycleState.operation.running) {
        action = 'operation_running';
        lifecycleState.reconcile.lastAction = action;
        lifecycleState.reconcile.lastResult = 'busy';
        lifecycleState.reconcile.nextRunAt = Date.now() + lifecycleState.supervisorIntervalMs;
        lifecycleState.lastChangedAt = Date.now();
        return {
          ok: true,
          action,
          result: 'busy',
          durationMs: Date.now() - startedAt
        };
      }

      const desiredMode = getDesiredLifecycleMode();
      const servicesBefore = await collectHealth();
      const manifest = readInstallationManifest();
      const flavorPolicy = resolveFlavorPolicy(manifest);
      const healthyBefore = isStackHealthyFromServices(servicesBefore, desiredMode, flavorPolicy.requireLocalPortal);

      if (!healthyBefore) {
        if (process.platform === 'win32' && flavorPolicy.requireDockerRuntime) {
          requestDockerAutostart('lifecycle_reconcile');
        }

        const startedDesired = ensureTaskRunning(desiredMode);
        const startedPortal = flavorPolicy.requireLocalPortal ? ensureTaskRunning('portal') : false;
        if (startedDesired && startedPortal) action = `start:${desiredMode}+portal`;
        else if (startedDesired) action = `start:${desiredMode}`;
        else if (startedPortal) action = 'start:portal';
        else action = 'verify';

        if (startedDesired || startedPortal) {
          await sleep(1800);
        }

        const servicesAfter = await collectHealth();
        const healthyAfter = isStackHealthyFromServices(servicesAfter, desiredMode, flavorPolicy.requireLocalPortal);
        if (!healthyAfter) {
          lifecycleState.reconcile.failureCount += 1;
          const now = Date.now();
          const threshold = normalizeLifecycleFailureThreshold(lifecycleState.failureThreshold);
          const cooldownMs = normalizeLifecycleRepairCooldownMs(lifecycleState.repairCooldownMs);
          const elapsedFromLastRepair = now - Number(lifecycleState.reconcile.lastRepairTriggeredAt || 0);
          const canTriggerRepair = elapsedFromLastRepair >= cooldownMs;
          if (
            lifecycleState.autoRepairEnabled &&
            lifecycleState.reconcile.failureCount >= threshold &&
            canTriggerRepair &&
            repairState.state !== 'running'
          ) {
            const startedRepair = await startRepairRun();
            if (startedRepair?.ok) {
              action = action === 'none' ? 'repair:run' : `${action}+repair`;
              lifecycleState.reconcile.lastRepairTriggeredAt = now;
            }
            lifecycleState.reconcile.failureCount = 0;
          } else if (
            lifecycleState.autoRepairEnabled &&
            lifecycleState.reconcile.failureCount >= threshold &&
            !canTriggerRepair
          ) {
            action = action === 'none' ? 'repair:cooldown' : `${action}+repair_cooldown`;
          }
          lifecycleState.reconcile.lastResult = 'degraded';
        } else {
          lifecycleState.reconcile.failureCount = 0;
          lifecycleState.reconcile.lastResult = 'healthy';
        }
      } else {
        lifecycleState.reconcile.failureCount = 0;
        lifecycleState.reconcile.lastResult = 'healthy';
      }

      lifecycleState.reconcile.lastAction = action;
      lifecycleState.reconcile.nextRunAt = Date.now() + lifecycleState.supervisorIntervalMs;
      lifecycleState.lastChangedAt = Date.now();

      pushEvent('lifecycle', 'dashboard', 'info', 'Lifecycle reconcile', {
        reason,
        action,
        result: lifecycleState.reconcile.lastResult
      });

      return {
        ok: true,
        action,
        result: lifecycleState.reconcile.lastResult,
        durationMs: Date.now() - startedAt
      };
    } catch (error) {
      const message = String(error?.message || 'reconcile_error');
      lifecycleState.reconcile.lastError = message;
      lifecycleState.reconcile.lastResult = 'error';
      lifecycleState.reconcile.failureCount += 1;
      lifecycleState.reconcile.lastAction = action;
      lifecycleState.reconcile.nextRunAt = Date.now() + lifecycleState.supervisorIntervalMs;
      lifecycleState.lastChangedAt = Date.now();
      logSystem(`Lifecycle reconcile falló: ${message}`, 'error');
      return {
        ok: false,
        action,
        result: 'error',
        error: message,
        durationMs: Date.now() - startedAt
      };
    } finally {
      lifecycleState.reconcile.running = false;
      lifecycleState.lastChangedAt = Date.now();
    }
  })().finally(() => {
    lifecycleReconcilePromise = null;
  });

  return lifecycleReconcilePromise;
}

function configureLifecycleSupervisor() {
  if (lifecycleSupervisorTimer) {
    clearInterval(lifecycleSupervisorTimer);
    lifecycleSupervisorTimer = null;
  }

  if (!lifecycleState.supervisorEnabled) {
    lifecycleState.reconcile.nextRunAt = 0;
    lifecycleState.lastChangedAt = Date.now();
    return;
  }

  const intervalMs = normalizeLifecycleIntervalMs(lifecycleState.supervisorIntervalMs);
  lifecycleState.supervisorIntervalMs = intervalMs;
  lifecycleState.reconcile.nextRunAt = Date.now() + intervalMs;
  lifecycleState.lastChangedAt = Date.now();

  lifecycleSupervisorTimer = setInterval(() => {
    reconcileLifecycle('supervisor_tick').catch(() => undefined);
  }, intervalMs);
}

function getPowerShellPath() {
  const systemPs = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (fs.existsSync(systemPs)) return systemPs;
  return 'powershell.exe';
}

function quoteCmdArg(text) {
  return `"${String(text || '').replace(/"/g, '\\"')}"`;
}

async function runInstallerHubMode(modeName) {
  if (process.platform !== 'win32') {
    return { ok: false, code: 1, stdout: '', stderr: 'Installer Hub soportado solo en Windows.' };
  }
  const resolved = resolveInstallerHubExecutablePath();
  if (!resolved.ok) {
    return { ok: false, code: 1, stdout: '', stderr: resolved.error || 'No se encontró el bundle Burn público.' };
  }

  const action = String(modeName || '').trim().toLowerCase();
  const args = [];
  if (action === 'repair') args.push('/repair');
  else if (action === 'uninstall') args.push('/uninstall');

  const command = `${quoteCmdArg(resolved.path)} ${args.join(' ')}`.trim();
  return runCommandCapture(command, 30_000);
}

function readInstallerLocalPathsManifest() {
  const candidates = [
    path.join(root, 'dist', 'installer', 'installer-local-paths.json'),
    path.join(root, 'dist', 'installer', '_internal', 'installer-local-paths.json')
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {}
  }

  return null;
}

function resolveInstallerHubExecutablePath() {
  const manifest = readInstallerLocalPathsManifest();
  if (!manifest) {
    return { ok: false, error: 'No se encontró dist/installer/installer-local-paths.json ni su variante interna.' };
  }

  const recommended = manifest?.recommended;
  const publicPath = typeof recommended?.bundlePublicPath === 'string' ? recommended.bundlePublicPath.trim() : '';
  if (publicPath && fs.existsSync(publicPath)) {
    return { ok: true, path: publicPath };
  }

  const fallback = Array.isArray(manifest?.artifacts)
    ? manifest.artifacts.find((item) => item?.bundlePublicPath && fs.existsSync(item.bundlePublicPath))
    : null;
  if (fallback?.bundlePublicPath) {
    return { ok: true, path: String(fallback.bundlePublicPath) };
  }

  return { ok: false, error: 'El manifiesto de instaladores no contiene un bundle Burn público accesible.' };
}

async function runLifecycleOperation(kind) {
  if (lifecycleOperationPromise) {
    return { ok: false, error: 'operation_running' };
  }

  lifecycleOperationPromise = (async () => {
    lifecycleState.operation.running = true;
    lifecycleState.operation.kind = String(kind || '');
    lifecycleState.operation.startedAt = Date.now();
    lifecycleState.operation.finishedAt = 0;
    lifecycleState.operation.lastExitCode = 0;
    lifecycleState.operation.lastError = '';
    lifecycleState.lastChangedAt = Date.now();

    const result = await runInstallerHubMode(kind);
    lifecycleState.operation.running = false;
    lifecycleState.operation.finishedAt = Date.now();
    lifecycleState.operation.lastExitCode = Number(result?.code || 0);
    lifecycleState.operation.lastError = result?.ok ? '' : String(result?.stderr || 'installer_hub_failed').trim();
    lifecycleState.lastChangedAt = Date.now();

    if (result?.ok && (kind === 'install' || kind === 'repair')) {
      await reconcileLifecycle(`operation_${kind}`);
    }

    if (result?.ok && kind === 'uninstall') {
      const active = runningTasks();
      active.forEach((task) => {
        try { stopTask(task); } catch {}
      });
    }

    const out = String(result?.stdout || '').trim();
    const err = String(result?.stderr || '').trim();
    const detail = out || err;
    return {
      ok: Boolean(result?.ok),
      code: Number(result?.code || 0),
      detail: detail.slice(0, 1200)
    };
  })().finally(() => {
    lifecycleOperationPromise = null;
  });

  return lifecycleOperationPromise;
}

async function runLifecycleComponentAction(action, component) {
  const target = String(component || '').trim().toLowerCase();
  if (!target) return { ok: false, error: 'component_required' };

  if (action === 'install') {
    if (target === 'stack') {
      const modeName = getDesiredLifecycleMode();
      const started = ensureTaskRunning(modeName);
      await reconcileLifecycle('component_stack_install');
      return { ok: true, started, component: target, mode: modeName };
    }
    if (target === 'portal') {
      const started = ensureTaskRunning('portal');
      await reconcileLifecycle('component_portal_install');
      return { ok: true, started, component: target };
    }
    if (target === 'shortcuts') {
      return {
        ok: false,
        component: target,
        error: 'shortcuts_only_via_installer_hub',
        detail: 'Los accesos directos solo se instalan o reparan mediante Installer Hub.'
      };
    }
    return { ok: false, error: 'component_unknown' };
  }

  if (action === 'uninstall') {
    if (target === 'portal') {
      try { stopTask('portal'); } catch {}
      return { ok: true, component: target, stopped: true };
    }
    if (target === 'stack') {
      ['dev', 'prod', 'dev-backend', 'dev-frontend', 'portal'].forEach((task) => {
        try { stopTask(task); } catch {}
      });
      const dockerDown = getCommand('docker-down');
      if (dockerDown) {
        try { startTask('docker-down', dockerDown); } catch {}
      }
      return { ok: true, component: target, stopped: true };
    }
    return { ok: false, error: 'component_uninstall_not_supported' };
  }

  return { ok: false, error: 'action_unknown' };
}

function truncateLine(text) {
  const limit = 900;
  if (text.length <= limit) return text;
  return text.slice(0, limit) + '...';
}

function normalizeLine(text) {
  const trimmed = text.trim();
  const pipeIndex = trimmed.indexOf('|');
  if (pipeIndex !== -1) {
    const after = trimmed.slice(pipeIndex + 1).trim();
    if (after.startsWith('{') || after.includes('"msg"')) return after;
  }
  return trimmed;
}

function classifyLine(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const normalized = normalizeLine(trimmed);
  const lower = normalized.toLowerCase();
  const isJson = normalized.startsWith('{') && normalized.includes('"msg"');
  let mongoSeverity = null;
  if (isJson) {
    const match = normalized.match(/"s"\s*:\s*"([A-Z])"/);
    if (match) {
      const sev = match[1];
      if (sev === 'I') mongoSeverity = 'info';
      else if (sev === 'W') mongoSeverity = 'warn';
      else if (sev === 'E' || sev === 'F') mongoSeverity = 'error';
    }
  }

  const isMongoNoise = isJson && (
    normalized.includes('"c":"NETWORK"') ||
    normalized.includes('"c":"ACCESS"') ||
    normalized.includes('"c":"WTCHKPT"') ||
    normalized.includes('"msg":"Connection ended"') ||
    normalized.includes('"msg":"Connection accepted"') ||
    normalized.includes('"msg":"Received first command"') ||
    normalized.includes('"msg":"client metadata"') ||
    normalized.includes('"msg":"Connection not authenticating"') ||
    normalized.includes('"msg":"WiredTiger message"') ||
    normalized.includes('WT_VERB_CHECKPOINT_PROGRESS')
  );

  const isMongoVerbose = (lower.includes('mongo') || lower.includes('mongo_local')) && (
    lower.includes('connection ended') ||
    lower.includes('connection accepted') ||
    lower.includes('received first command') ||
    lower.includes('client metadata') ||
    lower.includes('not authenticating') ||
    lower.includes('wiredtiger') ||
    lower.includes('wtchkpt') ||
    lower.includes('checkpoint')
  );

  let level = mongoSeverity || 'info';
  if (!mongoSeverity) {
    if (lower.includes('error') || lower.includes('err!') || lower.includes('failed')) {
      level = 'error';
    } else if (lower.includes('warn')) {
      level = 'warn';
    } else if (lower.includes('ready') || lower.includes('listening') || lower.includes('compiled') || lower.includes('healthy')) {
      level = 'ok';
    }
  }

  const noisy = (isMongoNoise || isMongoVerbose) && level !== 'error';
  return { text: truncateLine(trimmed), level, noisy };
}

function recordNoise(source) {
  const stat = noiseStats.get(source) || { count: 0 };
  stat.count += 1;
  noiseStats.set(source, stat);
}

function logTaskOutput(source, data) {
  const lines = String(data).split(/\r?\n/);
  for (const line of lines) {
    const info = classifyLine(line);
    if (!info) continue;
    const entry = makeEntry(source, info.level, info.text);
    if (info.level === 'error') entry.meta = { task: source };
    pushEntry(rawLines, entry, maxRaw);
    if (info.noisy && !fullLogs) {
      recordNoise(source);
      continue;
    }
    pushEntry(logLines, entry, maxFiltered);
    persistEntry(entry);

    if (info.level === 'error' || info.level === 'warn') {
      pushEvent('task_log', source, info.level, info.text);
    }
  }
}

// Start a task in the repo root and attach its output to the log.
function startTask(name, command) {
  const existing = processes.get(name);
  if (existing && existing.proc && existing.proc.exitCode === null) {
    logSystem(`[${name}] ya esta en ejecucion`, 'warn');
    return;
  }

  logSystem(`[${name}] iniciar: ${command}`, 'system');
  pushEvent('task_start', name, 'system', 'Inicio solicitado', { command });
  const proc = spawn('cmd.exe', ['/c', command], {
    cwd: root,
    windowsHide: true
  });

  processes.set(name, { name, command, proc, startedAt: Date.now() });
  logSystem(`[${name}] PID ${proc.pid}`, 'system');
  pushEvent('task_pid', name, 'system', 'Proceso creado', { pid: proc.pid });

  proc.stdout.on('data', (data) => logTaskOutput(name, data));
  proc.stderr.on('data', (data) => logTaskOutput(name, data));
  proc.on('exit', (code) => {
    logSystem(`[${name}] finalizo con codigo ${code}`, 'system');
    pushEvent('task_exit', name, code === 0 ? 'ok' : 'warn', 'Proceso finalizado', { code });
    processes.delete(name);
  });
  proc.on('error', (err) => {
    logSystem(`[${name}] error: ${err.message}`, 'error', { console: true });
    pushEvent('task_error', name, 'error', 'Error del proceso', { message: err.message });
    processes.delete(name);
  });
}

// Stop a running task via taskkill.
function stopTask(name) {
  const entry = processes.get(name);
  if (!entry || !entry.proc || entry.proc.exitCode !== null) {
    logSystem(`[${name}] no esta en ejecucion`, 'warn');
    return;
  }
  logSystem(`[${name}] deteniendo`, 'system');
  pushEvent('task_stop', name, 'warn', 'Detencion solicitada');
  spawn('taskkill', ['/T', '/F', '/PID', String(entry.proc.pid)], { windowsHide: true });
}

// Open the dashboard URL in the default browser.
function findBrowserExecutable() {
  const candidates = [
    [process.env.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
    [process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
    [process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
    [process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'],
    [process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'],
    [process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe']
  ];

  for (const parts of candidates) {
    if (!parts[0]) continue;
    const exe = path.join(...parts);
    try {
      if (fs.existsSync(exe)) return exe;
    } catch {
      // ignore
    }
  }
  return '';
}

function openBrowser(url) {
  const targetUrl = decorateDashboardUrl(url);
  const browserExe = findBrowserExecutable();
  if (browserExe) {
    const lower = browserExe.toLowerCase();
    const supportsNewWindow = lower.endsWith('msedge.exe') || lower.endsWith('chrome.exe');
    const browserArgs = supportsNewWindow ? ['--new-window', targetUrl] : [targetUrl];
    const child = spawn(browserExe, browserArgs, { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    return;
  }
  spawn('cmd.exe', ['/c', 'start', '', targetUrl], { windowsHide: true });
}

function decorateDashboardUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    const localHost = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
    if (localHost && (parsed.pathname === '/' || parsed.pathname === '')) {
      if (!parsed.searchParams.has('resume')) parsed.searchParams.set('resume', '1');
      if (!parsed.hash) parsed.hash = 'tab=main';
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function shouldAutostartTray() {
  return !/^(0|false|no)$/i.test(String(process.env.DASHBOARD_TRAY_AUTOSTART || '').trim());
}

function startTrayIfNeeded(activeMode, port) {
  if (process.platform !== 'win32') return;
  if (!shouldAutostartTray()) return;
  if (activeMode !== 'dev' && activeMode !== 'prod') return;

  const psPath = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const trayScript = path.join(root, 'scripts', 'launcher-tray.ps1');
  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-STA',
    '-WindowStyle',
    'Hidden',
    '-File',
    trayScript,
    '-Mode',
    activeMode,
    '-Port',
    String(port),
    '-NoOpen',
    '-Attach'
  ];

  try {
    const child = spawn(psPath, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
  } catch (err) {
    logSystem(`No se pudo iniciar tray: ${err.message}`, 'warn');
  }
}

// List running task names for the status panel.
function runningTasks() {
  const names = [];
  for (const [name, entry] of processes.entries()) {
    if (entry.proc && entry.proc.exitCode === null) names.push(name);
  }
  return names;
}

function noiseSnapshot() {
  const result = {};
  for (const [name, stat] of noiseStats.entries()) {
    result[name] = stat.count;
  }
  return result;
}

// Known commands exposed via the dashboard.
const baseCommands = {
  dev: 'npm run dev',
  'dev-frontend': 'npm run dev:frontend',
  'dev-backend': 'npm run dev:backend',
  // En dashboard, PROD debe levantar la plataforma rapidamente (sin correr verify/tests).
  prod: 'npm run stack:prod',
  'docente-native': nativeDocenteCommand,
  'portal-dev': 'npm run dev:portal',
  'portal-prod': 'npm run portal:prod',
  status: 'npm run status',
  'docker-ps': 'docker ps',
  'docker-down': 'docker compose down'
};

function getCommand(taskName) {
  const task = String(taskName || '').trim();
  if (!task) return null;
  if (task === 'portal') {
    return mode === 'prod' ? baseCommands['portal-prod'] : baseCommands['portal-dev'];
  }
  if (task === 'prod' && !requiresDockerRuntime(readInstallationManifest())) {
    return baseCommands['docente-native'];
  }
  if (task === 'prod' && dockerRuntimePreference() === 'wsl2-engine') {
    return dockerCommandForShell(['compose', '-f', path.basename(composeFile), '--profile', 'prod', 'up', '--no-build', '-d', 'mongo_local', 'api_docente_prod', 'web_docente_prod']);
  }
  if (task === 'docker-ps' && dockerRuntimePreference() === 'wsl2-engine') {
    return dockerCommandForShell(['ps']);
  }
  if (task === 'docker-down' && dockerRuntimePreference() === 'wsl2-engine') {
    return dockerCommandForShell(['compose', '-f', path.basename(composeFile), 'down', '--remove-orphans']);
  }
  return baseCommands[task] ?? null;
}

function ensurePortalAutostartForProd(reason = 'prod') {
  if (mode !== 'prod') return;
  if (!requiresLocalPortal(readInstallationManifest())) return;
  const portalCommand = getCommand('portal');
  if (!portalCommand) return;
  if (isRunning('portal')) return;
  logSystem(`Portal autoarranque (${reason}).`, 'system');
  startTask('portal', portalCommand);
}

function isRunning(name) {
  const entry = processes.get(name);
  return Boolean(entry && entry.proc && entry.proc.exitCode === null);
}

function stackDisplayString(runningList = [], compose = null) {
  const requireDocker = requiresDockerRuntime(readInstallationManifest());
  const stack = dockerAutostart.stack || {};
  const state = stack.state || 'unknown';
  const lastError = stack.lastError || '';
  const running = Array.isArray(runningList) ? runningList : [];
  const hasStackTask = running.includes('dev') || running.includes('prod') || running.includes('dev-backend');
  const dockerDetected = compose && (
    compose.dev?.mongo_local ||
    compose.dev?.api_docente_local ||
    compose.prod?.mongo_local ||
    compose.prod?.api_docente_prod ||
    compose.prod?.web_docente_prod
  );
  const stackRunning = Boolean(stack.running) || hasStackTask || dockerDetected;

  if (state === 'error') return lastError || 'Error iniciando plataforma.';
  if (state === 'checking') return requireDocker ? 'Comprobando stack Docker...' : 'Comprobando plataforma local...';
  if (state === 'skipped') return requireDocker ? 'Stack Docker ya esta activo.' : 'Plataforma local ya esta activa.';
  if (stackRunning) {
    if (dockerDetected && !hasStackTask) return requireDocker ? 'Stack activo (Docker detectado).' : 'Plataforma activa.';
    return 'Plataforma activa (procesos en ejecucion).';
  }
  if (state === 'starting') return requireDocker ? 'Iniciando stack Docker...' : 'Iniciando plataforma local...';
  return 'Plataforma detenida.';
}

function restartTask(name, delayMs = 700) {
  const command = getCommand(name);
  if (!command) {
    logSystem(`[${name}] reinicio solicitado pero no existe comando`, 'warn');
    return;
  }

  const wasRunning = isRunning(name);
  if (wasRunning) stopTask(name);
  pushEvent('task_restart', name, 'warn', 'Reinicio solicitado', { delayMs });
  setTimeout(() => startTask(name, command), wasRunning ? delayMs : 0);
}

function restartAll(runningNames) {
  const unique = Array.from(new Set(runningNames)).filter(Boolean);
  if (unique.length === 0) return;
  logSystem(`Reiniciando: ${unique.join(', ')}`, 'system');
  unique.forEach((name) => restartTask(name));
}

function requestAutoRestart(reason) {
  if (mode !== 'dev' || !autoRestart) return;
  const lowerReason = String(reason || '').toLowerCase();
  if (lowerReason.startsWith('frontend:')) return;
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    const running = runningTasks();
    if (running.length === 0) return;

    // In dev we prefer restarting the whole dev stack if it's running.
    if (running.includes('dev')) {
      logSystem(`Auto-reinicio (dev): cambio detectado (${reason}).`, 'warn');
      restartTask('dev');
      return;
    }

    // Otherwise restart granular tasks if they are running.
    const toRestart = [];
    if (running.includes('dev-backend')) toRestart.push('dev-backend');
    if (running.includes('dev-frontend')) toRestart.push('dev-frontend');
    restartAll(toRestart);
  }, 650);
}

function setupDevWatchers() {
  if (mode !== 'dev') return;

  const targets = [
    { label: 'frontend', dir: path.join(root, 'apps', 'frontend', 'src') },
    { label: 'backend', dir: path.join(root, 'apps', 'backend', 'src') }
  ];

  targets.forEach(({ label, dir }) => {
    try {
      if (!fs.existsSync(dir)) return;
      fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const lower = String(filename).toLowerCase();
        if (lower.includes('node_modules')) return;
        if (lower.endsWith('.map') || lower.endsWith('.tsbuildinfo')) return;
        requestAutoRestart(`${label}:${eventType}:${filename}`);
      });
      logSystem(`Watcher dev activo: ${label} (${dir})`, 'ok');
    } catch (error) {
      logSystem(`No se pudo activar watcher para ${label}: ${error?.message || 'error'}`, 'warn');
    }
  });
}

// Read a JSON body safely with a size cap.
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

// Write JSON responses with no-store caching.
function sendJson(res, status, payload) {
  const data = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(data);
}

async function probeHttp(url, timeoutMs = 900) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = http.get({
        hostname: u.hostname,
        port: u.port ? Number(u.port) : 80,
        path: u.pathname + (u.search || ''),
        timeout: timeoutMs
      }, (res) => {
        res.resume();
        resolve({ ok: true, status: res.statusCode || 0 });
      });
      req.on('error', () => resolve({ ok: false, status: 0 }));
      req.on('timeout', () => {
        try { req.destroy(); } catch {}
        resolve({ ok: false, status: 0 });
      });
    } catch {
      resolve({ ok: false, status: 0 });
    }
  });
}

async function pingDashboard(port) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: '127.0.0.1',
      port,
      path: '/api/status',
      timeout: 800
    }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function fetchDashboardStatus(port) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: '127.0.0.1',
      port,
      path: '/api/status',
      timeout: 900
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
        if (body.length > 250_000) {
          try { req.destroy(); } catch {}
        }
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      try { req.destroy(); } catch {}
      resolve(null);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function terminateProcess(pid) {
  if (!pid || !Number.isFinite(Number(pid))) return;
  const id = String(pid);
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/T', '/F', '/PID', id], { windowsHide: true });
      return;
    }
    process.kill(Number(pid), 'SIGTERM');
  } catch {
    // ignore
  }
}

async function findExistingInstance() {
  if (!fs.existsSync(lockPath)) return null;
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (!lock || !lock.port) return null;
    const ok = await pingDashboard(lock.port);
    if (ok) {
      const status = await fetchDashboardStatus(lock.port);
      const hasModeConfig = Boolean(status && typeof status === 'object' && 'modeConfig' in status);
      const running = status && Array.isArray(status.running) ? status.running : [];
      const inconsistent = status && status.mode === 'none' && (running.includes('dev') || running.includes('prod'));

      // If instance is old (no modeConfig) or inconsistent, restart it so UI updates apply.
      if (!hasModeConfig || inconsistent) {
        logSystem('Instancia previa desactualizada detectada. Reiniciando...', 'warn', { console: true });
        terminateProcess(Number(lock.pid || 0));
        try { fs.unlinkSync(lockPath); } catch {}
        for (let i = 0; i < 7; i++) {
          await sleep(250);
          const stillUp = await pingDashboard(lock.port);
          if (!stillUp) break;
        }
        return null;
      }

      return { port: lock.port };
    }
  } catch {
    // ignore
  }
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // ignore
  }
  return null;
}

function writeLock(port) {
  const payload = {
    pid: process.pid,
    port,
    mode,
    startedAt: new Date().toISOString()
  };
  try {
    fs.writeFileSync(lockPath, JSON.stringify(payload, null, 2));
  } catch {
    // ignore
  }
  updateSingletonLock({ port, state: 'ready', lastSeenAt: new Date().toISOString() });
}

function clearLock() {
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch {
    // ignore
  }
}

function handleExit(signal) {
  if (signal) logSystem(`Cierre solicitado: ${signal}`, 'system');
  if (lifecycleSupervisorTimer) {
    clearInterval(lifecycleSupervisorTimer);
    lifecycleSupervisorTimer = null;
  }
  if (continuityTimer) {
    clearInterval(continuityTimer);
    continuityTimer = null;
  }
  clearLock();
  clearSingletonLock();
  process.exit(0);
}

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));
process.on('exit', () => {
  if (lifecycleSupervisorTimer) {
    clearInterval(lifecycleSupervisorTimer);
    lifecycleSupervisorTimer = null;
  }
  if (continuityTimer) {
    clearInterval(continuityTimer);
    continuityTimer = null;
  }
  clearLock();
  clearSingletonLock();
});

// Main HTTP server for UI and API.
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const pathName = reqUrl.pathname;

  if (req.method === 'GET' && pathName === '/') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(readTextDevOrCache(dashboardPath, cachedDashboardHtml));
    return;
  }

  if (req.method === 'GET' && pathName === '/version-info') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(renderVersionInfoPage());
    return;
  }

  if (req.method === 'GET' && pathName === '/manifest.webmanifest') {
    res.writeHead(200, {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(readTextDevOrCache(manifestPath, cachedManifestJson));
    return;
  }

  if (req.method === 'GET' && pathName === '/assets/dashboard-icon.svg') {
    res.writeHead(200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(readTextDevOrCache(iconPath, cachedIconSvg));
    return;
  }

  if (req.method === 'GET' && pathName === '/assets/dashboard-icon-192.png') {
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(fs.existsSync(icon192Path) ? fs.readFileSync(icon192Path) : cachedIcon192);
    return;
  }

  if (req.method === 'GET' && pathName === '/assets/dashboard-icon-512.png') {
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(fs.existsSync(icon512Path) ? fs.readFileSync(icon512Path) : cachedIcon512);
    return;
  }

  if (req.method === 'GET' && pathName === '/assets/dashboard-icon-maskable-512.png') {
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(fs.existsSync(iconMaskablePath) ? fs.readFileSync(iconMaskablePath) : cachedIconMaskable);
    return;
  }

  if (req.method === 'GET' && pathName === '/sw.js') {
    // Service Worker: debe poder actualizarse rápido.
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'Service-Worker-Allowed': '/',
      'X-Content-Type-Options': 'nosniff'
    });
    let swJs = cachedSwJs;
    try {
      swJs = fs.readFileSync(swPath, 'utf8');
    } catch {}
    res.end(swJs);
    return;
  }

  if (req.method === 'GET' && pathName === '/api/status') {
    // Autostart en background: el endpoint debe responder rapido.
    if ((mode === 'dev' || mode === 'prod') && dockerAutostart.state === 'idle' && requiresDockerRuntime(readInstallationManifest())) {
      requestDockerAutostart('api_status');
    }

    const noise = noiseSnapshot();
    const noiseTotal = Object.values(noise).reduce((acc, val) => acc + val, 0);
    const managedTasks = runningTasks();
    const dockerDisplay = dockerDisplayString();
    const compose = readComposeSnapshot();
    const stackDisplay = stackDisplayString(managedTasks, compose);
    const httpsState = resolveHttpsState();
    const manifest = readInstallationManifest();
    const flavorPolicy = resolveFlavorPolicy(manifest);
    const dockerRuntime = resolveEffectiveDockerRuntime(flavorPolicy);
    const shortcutState = resolveShortcutState(manifest);
    const licenseState = resolveLicenseState(manifest);
    const bootstrapState = resolveBootstrapState();
    const installationState = resolveInstallationState(manifest, detectInstalledProduct());

    const hasDev = managedTasks.includes('dev');
    const hasProd = managedTasks.includes('prod');
    let uiMode = mode;
    if (mode !== 'dev' && mode !== 'prod') {
      if (hasDev && !hasProd) uiMode = 'dev';
      else if (hasProd && !hasDev) uiMode = 'prod';
      else if (hasDev && hasProd) uiMode = 'dev';
      else uiMode = 'none';
    }

    const pkg = readAppVersionMetadata();
    const payload = {
      app: {
        name: pkg.name || 'evaluapro',
        version: pkg.version || '0.0.0',
        displayVersion: pkg.displayVersion || pkg.version || '0.0.0'
      },
      root,
      mode: uiMode,
      modeConfig: mode,
      port: listeningPort,
      node: `v${process.versions.node || '0.0.0'}`,
      npm: safeExec('npm -v', 'No detectado'),
      docker: dockerDisplay,
      dockerDisplay,
      stackDisplay,
      compose,
      https: httpsState,
      runtime: manifest?.runtime || {},
      dockerState: {
        state: dockerAutostart.state,
        ready: dockerAutostart.ready,
        version: dockerAutostart.version,
        lastError: dockerAutostart.lastError,
        runtime: dockerRuntime,
        stack: dockerAutostart.stack,
        lastChangedAt: dockerAutostart.lastChangedAt
      },
      managedTasks,
      running: managedTasks,
      logSize: logLines.length,
      rawSize: rawLines.length,
      noise,
      noiseTotal,
      autoRestart,
      config: dashboardConfig,
      lifecycle: {
        desiredMode: getDesiredLifecycleMode(),
        supervisorEnabled: lifecycleState.supervisorEnabled,
        autoRepairEnabled: lifecycleState.autoRepairEnabled,
        supervisorIntervalMs: lifecycleState.supervisorIntervalMs,
        reconcile: lifecycleState.reconcile,
        operation: lifecycleState.operation,
        installation: lifecycleState.installation,
        lastChangedAt: lifecycleState.lastChangedAt
      },
      flavorPolicy,
      installationState,
      bootstrapState,
      shortcutState,
      licenseState,
      installationManifest: manifest,
      continuity: continuitySnapshot(),
      update: updateManager.getStatus()
    };
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === 'GET' && pathName === '/api/version-info') {
    sendJson(res, 200, buildVersionInfoPayload('dashboard'));
    return;
  }

  if (req.method === 'GET' && pathName === '/api/install') {
    const pkg = readAppVersionMetadata();
    const running = runningTasks();
    const hasDev = running.includes('dev');
    const hasProd = running.includes('prod');
    let uiMode = mode;
    if (mode !== 'dev' && mode !== 'prod') {
      if (hasDev && !hasProd) uiMode = 'dev';
      else if (hasProd && !hasDev) uiMode = 'prod';
      else if (hasDev && hasProd) uiMode = 'dev';
      else uiMode = 'none';
    }
    const payload = {
      app: {
        name: pkg.name || 'evaluapro',
        version: pkg.version || '',
        displayVersion: pkg.displayVersion || pkg.version || ''
      },
      dashboard: {
        mode: uiMode,
        modeConfig: mode,
        port: listeningPort,
        pid: process.pid,
        startedAt: dashboardStartedAt,
        noOpen,
        verbose,
        fullLogs
      },
      paths: {
        root,
        logDir,
        logFile,
        lockPath,
        dashboardHtml: dashboardPath,
        manifestPath,
        iconPath
      },
      logs: {
        persistMode,
        enabled: diskWriter.enabled,
        flushMs: diskWriter.flushMs,
        maxBytes: diskWriter.maxBytes,
        keepFiles: diskWriter.keepFiles
      },
      runtime: {
        nodeVersion: process.version,
        execPath: process.execPath,
        platform: process.platform,
        arch: process.arch
      }
    };
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === 'GET' && pathName === '/api/mongo-express') {
    const url = 'http://127.0.0.1:8081/';
    const probe = await probeHttp(url);
    // 401/403 suele indicar que el servicio esta arriba con basic auth.
    const reachable = probe.ok && probe.status >= 100;
    sendJson(res, 200, {
      url,
      reachable,
      status: probe.status || 0
    });
    return;
  }

  if (req.method === 'GET' && pathName === '/api/update/status') {
    return sendJson(res, 200, updateManager.getStatus());
  }

  if (req.method === 'POST' && pathName === '/api/update/check') {
    const status = await updateManager.check();
    const code = status.state === 'error' ? 502 : 200;
    return sendJson(res, code, status);
  }

  if (req.method === 'POST' && pathName === '/api/update/download') {
    const status = await updateManager.download();
    const code = status.state === 'error' ? 502 : 200;
    return sendJson(res, code, status);
  }

  if (req.method === 'POST' && pathName === '/api/update/apply') {
    const result = await runPrivilegedSupportAction('hub-update-apply');
    return sendJson(res, result.status, result);
  }

  if (req.method === 'POST' && pathName === '/api/update/cancel') {
    const canceled = updateManager.cancel();
    return sendJson(res, 200, { ok: true, canceled, status: updateManager.getStatus() });
  }

  if (req.method === 'GET' && pathName === '/api/config') {
    sendJson(res, 200, dashboardConfig);
    return;
  }

  if (req.method === 'POST' && pathName === '/api/config') {
    const body = await readBody(req);
    const previous = dashboardConfig;
    const next = saveDashboardConfig(Object.assign({}, dashboardConfig, body || {}));
    const changed = [];
    if (next.autoRestart !== previous.autoRestart) changed.push('autoRestart');
    if (next.showFullLogs !== previous.showFullLogs) changed.push('showFullLogs');
    if (next.autoScroll !== previous.autoScroll) changed.push('autoScroll');
    if (next.pauseUpdates !== previous.pauseUpdates) changed.push('pauseUpdates');
    if (next.refreshForegroundMs !== previous.refreshForegroundMs) changed.push('refreshForegroundMs');
    if (next.refreshBackgroundMs !== previous.refreshBackgroundMs) changed.push('refreshBackgroundMs');
    logSystem(`Auto-reinicio: ${autoRestart ? 'ACTIVO' : 'DESACTIVADO'}`, autoRestart ? 'ok' : 'warn');
    if (changed.length > 0) {
      logSystem(`Configuracion dashboard actualizada: ${changed.join(', ')}`, 'system');
    }
    sendJson(res, 200, { ok: true, config: dashboardConfig });
    return;
  }

  if (req.method === 'POST' && pathName === '/api/config/reset') {
    const previous = dashboardConfig;
    const next = saveDashboardConfig(dashboardConfigDefaults);
    const changed = [];
    if (previous.autoRestart !== next.autoRestart) changed.push('autoRestart');
    if (previous.showFullLogs !== next.showFullLogs) changed.push('showFullLogs');
    if (previous.autoScroll !== next.autoScroll) changed.push('autoScroll');
    if (previous.pauseUpdates !== next.pauseUpdates) changed.push('pauseUpdates');
    if (previous.refreshForegroundMs !== next.refreshForegroundMs) changed.push('refreshForegroundMs');
    if (previous.refreshBackgroundMs !== next.refreshBackgroundMs) changed.push('refreshBackgroundMs');
    logSystem(`Configuracion dashboard reiniciada a valores por defecto (${changed.length ? changed.join(', ') : 'sin cambios'})`, 'warn');
    sendJson(res, 200, { ok: true, config: dashboardConfig, defaults: dashboardConfigDefaults });
    return;
  }

  if (req.method === 'GET' && pathName === '/api/repair/status') {
    const status = await diagnoseRepairStatus();
    sendJson(res, 200, status);
    return;
  }

  if (req.method === 'POST' && pathName === '/api/repair/run') {
    const result = await startRepairRun();
    if (!result.ok && result.error === 'already_running') {
      sendJson(res, 409, result);
      return;
    }
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'GET' && pathName === '/api/repair/progress') {
    sendJson(res, 200, {
      runId: repairState.runId || '',
      state: repairState.state,
      currentStep: repairState.currentStep,
      percent: repairState.percent,
      steps: repairState.steps,
      manualActions: repairState.manualActions,
      issues: repairState.issues,
      lastRun: repairState.lastRun
    });
    return;
  }

  if (req.method === 'GET' && pathName === '/api/lifecycle/status') {
    const status = await buildLifecycleStatus(true);
    return sendJson(res, 200, status);
  }

  if (req.method === 'GET' && pathName === '/api/support/privileged/status') {
    return sendJson(res, 200, {
      ok: true,
      authorization: resolveSupportAuthorization()
    });
  }

  if (req.method === 'POST' && pathName === '/api/support/privileged/run') {
    const body = await readBody(req);
    const result = await runPrivilegedSupportAction(body?.action, { confirm: body?.confirm === true });
    return sendJson(res, result.status, result);
  }

  if (req.method === 'POST' && pathName === '/api/lifecycle/reconcile') {
    const result = await reconcileLifecycle('api_reconcile');
    return sendJson(res, 200, result);
  }

  if (req.method === 'POST' && pathName === '/api/lifecycle/supervisor') {
    const body = await readBody(req);
    if (Object.prototype.hasOwnProperty.call(body || {}, 'enabled')) {
      lifecycleState.supervisorEnabled = Boolean(body.enabled);
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'autoRepairEnabled')) {
      lifecycleState.autoRepairEnabled = Boolean(body.autoRepairEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'intervalMs')) {
      lifecycleState.supervisorIntervalMs = normalizeLifecycleIntervalMs(body.intervalMs);
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'failureThreshold')) {
      lifecycleState.failureThreshold = normalizeLifecycleFailureThreshold(body.failureThreshold);
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'repairCooldownMs')) {
      lifecycleState.repairCooldownMs = normalizeLifecycleRepairCooldownMs(body.repairCooldownMs);
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'desiredMode')) {
      const candidate = String(body.desiredMode || '').trim().toLowerCase();
      if (candidate === 'dev' || candidate === 'prod') {
        lifecycleState.desiredMode = candidate;
      }
    }
    saveLifecyclePolicy();
    setLifecycleState({});
    configureLifecycleSupervisor();
    return sendJson(res, 200, {
      ok: true,
      supervisor: {
        enabled: lifecycleState.supervisorEnabled,
        autoRepairEnabled: lifecycleState.autoRepairEnabled,
        intervalMs: lifecycleState.supervisorIntervalMs,
        desiredMode: lifecycleState.desiredMode,
        failureThreshold: lifecycleState.failureThreshold,
        repairCooldownMs: lifecycleState.repairCooldownMs
      }
    });
  }

  if (req.method === 'POST' && pathName === '/api/lifecycle/supervisor/reset') {
    const policy = saveLifecyclePolicy(lifecyclePolicyDefaults);
    setLifecycleState({});
    configureLifecycleSupervisor();
    return sendJson(res, 200, {
      ok: true,
      supervisor: {
        enabled: policy.supervisorEnabled,
        autoRepairEnabled: policy.autoRepairEnabled,
        intervalMs: policy.supervisorIntervalMs,
        desiredMode: policy.desiredMode,
        failureThreshold: policy.failureThreshold,
        repairCooldownMs: policy.repairCooldownMs
      }
    });
  }

  if (req.method === 'POST' && pathName === '/api/lifecycle/install') {
    const result = await runPrivilegedSupportAction('hub-install');
    return sendJson(res, result.status, result);
  }

  if (req.method === 'POST' && pathName === '/api/lifecycle/repair') {
    const result = await runPrivilegedSupportAction('hub-repair');
    return sendJson(res, result.status, result);
  }

  if (req.method === 'POST' && pathName === '/api/lifecycle/uninstall') {
    const body = await readBody(req);
    const result = await runPrivilegedSupportAction('hub-uninstall', { confirm: body?.confirm === true });
    return sendJson(res, result.status, result);
  }

  if (req.method === 'POST' && pathName === '/api/lifecycle/component/install') {
    const body = await readBody(req);
    const result = await runLifecycleComponentAction('install', body?.component);
    const status = result?.ok ? 200 : 400;
    return sendJson(res, status, result);
  }

  if (req.method === 'POST' && pathName === '/api/lifecycle/component/uninstall') {
    const body = await readBody(req);
    const result = await runLifecycleComponentAction('uninstall', body?.component);
    const status = result?.ok ? 200 : 400;
    return sendJson(res, status, result);
  }

  if (req.method === 'GET' && pathName === '/api/continuity/status') {
    return sendJson(res, 200, continuitySnapshot());
  }

  if (req.method === 'POST' && pathName === '/api/continuity/run') {
    const result = await runContinuitySync('api_manual');
    const status = result?.ok ? 200 : 502;
    return sendJson(res, status, result);
  }

  if (req.method === 'POST' && pathName === '/api/continuity/config') {
    const body = await readBody(req);
    const next = saveContinuityPolicy(body && typeof body === 'object' ? body : {});
    configureContinuityScheduler();
    return sendJson(res, 200, {
      ok: true,
      config: next,
      state: continuitySnapshot()
    });
  }

  if (req.method === 'POST' && pathName === '/api/continuity/config/reset') {
    const next = saveContinuityPolicy(continuityPolicyDefaults);
    continuityState.consecutiveFailures = 0;
    continuityState.lastError = '';
    continuityState.lastDetails = [];
    continuityState.lastResult = 'idle';
    continuityState.nextRunAt = 0;
    continuityState.history = [];
    configureContinuityScheduler();
    return sendJson(res, 200, {
      ok: true,
      config: next,
      state: continuitySnapshot()
    });
  }

  if (req.method === 'POST' && pathName === '/api/shortcuts/regenerate') {
    return sendJson(res, 409, {
      ok: false,
      error: 'Los accesos directos solo se instalan o reparan mediante Installer Hub.'
    });
  }

  if (req.method === 'GET' && pathName === '/api/health') {
    const services = await collectHealth();
    sendJson(res, 200, { checkedAt: Date.now(), services, flavorPolicy: resolveFlavorPolicy(readInstallationManifest()) });
    return;
  }

  if (req.method === 'GET' && pathName === '/api/logs') {
    const wantFull = reqUrl.searchParams.get('full') === '1';
    const entries = wantFull ? rawLines : logLines;
    sendJson(res, 200, { entries });
    return;
  }

  if (req.method === 'GET' && pathName === '/api/events') {
    sendJson(res, 200, { entries: events });
    return;
  }

  if (req.method === 'GET' && pathName === '/api/logfile') {
    let content = '';
    try {
      content = fs.readFileSync(logFile, 'utf8');
    } catch {
      content = '';
    }
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline; filename="dashboard.log"',
      'Cache-Control': 'no-store'
    });
    res.end(content);
    return;
  }

  if (req.method === 'POST' && pathName === '/api/logs/clear') {
    logLines.length = 0;
    rawLines.length = 0;
    noiseStats.clear();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && pathName === '/api/start') {
    const body = await readBody(req);
    const task = String(body.task || '').trim();
    const command = getCommand(task);
    if (!command) return sendJson(res, 400, { error: 'Tarea desconocida' });
    pushEvent('api', 'dashboard', 'info', 'POST /api/start', { task });
    if (task === 'portal' && mode === 'prod') {
      logSystem('Portal prod build en curso/inicio solicitado.', 'system');
    }
    startTask(task, command);
    if (task === 'prod') {
      ensurePortalAutostartForProd('api_start_prod');
    }
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathName === '/api/stop') {
    const body = await readBody(req);
    const task = String(body.task || '').trim();
    if (!task) return sendJson(res, 400, { error: 'Tarea requerida' });
    pushEvent('api', 'dashboard', 'info', 'POST /api/stop', { task });
    stopTask(task);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathName === '/api/restart') {
    const body = await readBody(req);
    const task = String(body.task || '').trim();

    if (!task) return sendJson(res, 400, { error: 'Tarea requerida' });

    pushEvent('api', 'dashboard', 'info', 'POST /api/restart', { task });

    if (task === 'all') {
      const running = runningTasks();
      restartAll(running);
      return sendJson(res, 200, { ok: true, restarted: running });
    }

    if (task === 'stack') {
      if (mode === 'prod') {
        const fastRestartCommand = requiresDockerRuntime(readInstallationManifest()) ? 'npm run stack:restart' : getCommand('prod');
        if (!fastRestartCommand) return sendJson(res, 400, { error: 'Tarea desconocida' });
        if (isRunning('prod')) {
          stopTask('prod');
        }
        startTask('prod', fastRestartCommand);
        ensurePortalAutostartForProd('api_restart_stack_fast');
        return sendJson(res, 200, { ok: true, restarted: ['prod'], mode: 'fast' });
      }

      const running = runningTasks();
      const candidates = ['dev', 'prod', 'portal', 'dev-frontend', 'dev-backend'];
      const toRestart = candidates.filter((name) => running.includes(name));
      if (toRestart.length === 0) {
        const preferido = mode === 'prod' ? 'prod' : 'dev';
        const comando = getCommand(preferido);
        if (comando) {
          startTask(preferido, comando);
          if (preferido === 'prod') {
            ensurePortalAutostartForProd('api_restart_stack');
          }
          return sendJson(res, 200, { ok: true, restarted: [], started: [preferido] });
        }
      }
      restartAll(toRestart);
      return sendJson(res, 200, { ok: true, restarted: toRestart });
    }

    if (!getCommand(task)) return sendJson(res, 400, { error: 'Tarea desconocida' });
    restartTask(task);
    return sendJson(res, 200, { ok: true, restarted: [task] });
  }

  if (req.method === 'POST' && pathName === '/api/run') {
    const body = await readBody(req);
    const task = String(body.task || '').trim();
    const command = getCommand(task);
    if (!command) return sendJson(res, 400, { error: 'Comando desconocido' });
    pushEvent('api', 'dashboard', 'info', 'POST /api/run', { task });
    if (task === 'portal' && mode === 'prod') {
      logSystem('Portal prod build en curso/inicio solicitado.', 'system');
    }
    startTask(task, command);
    return sendJson(res, 200, { ok: true });
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// Start server on a free port and auto-start tasks for the chosen mode.
(async () => {
  const singleton = await ensureSingletonLock();
  if (!singleton.ok) return;

  const existing = await findExistingInstance();
  if (existing) {
    const url = `http://127.0.0.1:${existing.port}`;
    logSystem(`Dashboard ya esta activo: ${url}`, 'ok', { console: true });
    if (!noOpen) openBrowser(url);
    clearSingletonLock();
    return;
  }

  const requestedPort = portArg ? Number(portArg) : null;
  const hasRequestedPort = Number.isFinite(requestedPort);
  let port = hasRequestedPort ? requestedPort : await findPort(4519);

  if (!await isPortFree(port)) {
    const url = `http://127.0.0.1:${port}`;
    const ok = await pingDashboard(port);
    if (ok) {
      logSystem(`Dashboard ya esta activo: ${url}`, 'ok', { console: true });
      if (!noOpen) openBrowser(url);
      return;
    }

    if (hasRequestedPort) {
      const fallback = await findPort(port + 1);
      const fallbackOk = fallback !== port && await isPortFree(fallback);
      if (fallbackOk) {
        logSystem(`Puerto ocupado: ${port}. Usando ${fallback}.`, 'warn', { console: true });
        port = fallback;
      } else {
        logSystem(`Puerto ocupado: ${port}. Cierra la instancia previa o cambia --port.`, 'error', { console: true });
        clearSingletonLock();
        return;
      }
    } else {
      const fallback = await findPort(port + 1);
      const fallbackOk = fallback !== port && await isPortFree(fallback);
      if (fallbackOk) {
        port = fallback;
      } else {
        logSystem('No se encontro puerto libre para dashboard.', 'error', { console: true });
        clearSingletonLock();
        return;
      }
    }
  }

  server.on('error', (err) => {
    logSystem(`Error del servidor: ${err.message}`, 'error', { console: true });
  });
  server.listen(port, '127.0.0.1', () => {
    listeningPort = port;
    const url = `http://127.0.0.1:${port}`;
    writeLock(port);
    logSystem(`Dashboard listo: ${url}`, 'ok', { console: true });
    if (!noOpen) openBrowser(url);
    // En accesos directos/tray: solo confirma Docker cuando el flavor lo requiere.
    if ((mode === 'dev' || mode === 'prod') && requiresDockerRuntime(readInstallationManifest())) requestDockerAutostart('startup');
    configureLifecycleSupervisor();
    configureContinuityScheduler();
    if (lifecycleState.supervisorEnabled) {
      reconcileLifecycle('startup').catch(() => undefined);
    }
    if (continuityState.enabled) {
      runContinuitySync('startup').catch(() => undefined);
    }
    configureUpdateAutoCheck();
    startTrayIfNeeded(mode, port);

    setupDevWatchers();
  });
})();

// Scan a small range to find a free localhost port.
async function findPort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    const ok = await isPortFree(port);
    if (ok) return port;
  }
  return startPort;
}

// Check if a port is free by attempting to bind.
function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });
}
