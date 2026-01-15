/*
  Local web dashboard to control the dev stack.
  - Serves a small HTML UI and JSON endpoints on localhost.
  - Starts/stops tasks via cmd.exe and streams logs to the UI.
  - Filters noisy lines by default for readability.
  - Enforces a single running instance using a lock file.
*/
import http from 'http';
import fs from 'fs';
import path from 'path';
import net from 'net';
import process from 'node:process';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Resolve paths relative to this script.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// CLI options: --mode dev|prod|none, --port <n>, --no-open, --verbose, --full-logs.
const args = process.argv.slice(2);
const mode = getArgValue('--mode', 'none');
const portArg = getArgValue('--port', '');
const noOpen = args.includes('--no-open');
const verbose = args.includes('--verbose');
const fullLogs = args.includes('--full-logs');

// Persist recent logs to disk to aid troubleshooting.
const logDir = path.join(root, 'logs');
const logFile = path.join(logDir, 'dashboard.log');
const lockPath = path.join(logDir, 'dashboard.lock.json');
ensureDir(logDir);

// Reset the log file at startup for a clean session.
try {
  fs.writeFileSync(logFile, '');
} catch {
  // ignore
}

// In-memory log buffers for the UI.
const maxFiltered = 600;
const maxRaw = 2000;
const logLines = [];
const rawLines = [];

// Track suppressed noisy lines per task.
const noiseStats = new Map();

// Track spawned processes by task name.
const processes = new Map();

// Dev convenience: auto-restart tasks when source files change.
let autoRestart = mode === 'dev';
let restartTimer = null;

// HTML template loaded once at startup.
const dashboardPath = path.join(__dirname, 'dashboard.html');
const dashboardHtml = fs.readFileSync(dashboardPath, 'utf8');

// PWA assets (manifest + icon) for "instalar como app" (Edge/Chrome).
const manifestPath = path.join(__dirname, 'dashboard.webmanifest');
const manifestJson = fs.readFileSync(manifestPath, 'utf8');
const iconPath = path.join(__dirname, 'dashboard-icon.svg');
const iconSvg = fs.readFileSync(iconPath, 'utf8');

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
  return { time: timestamp(), source, level, text };
}

function formatEntry(entry) {
  return `[${entry.time}] [${entry.source}] ${entry.text}`;
}

function persistEntry(entry) {
  try {
    fs.appendFileSync(logFile, formatEntry(entry) + '\n');
  } catch {
    // ignore file write errors
  }
}

function pushEntry(buffer, entry, max) {
  buffer.push(entry);
  if (buffer.length > max) buffer.shift();
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
  pushEntry(rawLines, entry, maxRaw);
  pushEntry(logLines, entry, maxFiltered);
  if (shouldConsole(entry, options)) writeConsole(formatEntry(entry));
  persistEntry(entry);
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

// Check a local endpoint with a small timeout for health reporting.
async function checkHealth(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const started = Date.now();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, error: error?.name || 'error', ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

// Aggregate health checks for the main services used by the dashboard.
async function collectHealth() {
  const targets = {
    apiDocente: 'http://localhost:4000/api/salud',
    apiPortal: 'http://localhost:8080/api/portal/salud',
    webDocenteDev: 'http://localhost:5173',
    webDocenteProd: 'http://localhost:4173'
  };

  const entries = await Promise.all(
    Object.entries(targets).map(async ([name, url]) => [name, await checkHealth(url)])
  );
  return Object.fromEntries(entries);
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

  let level = 'info';
  if (lower.includes('error') || lower.includes('err!') || lower.includes('failed')) {
    level = 'error';
  } else if (lower.includes('warn')) {
    level = 'warn';
  } else if (lower.includes('ready') || lower.includes('listening') || lower.includes('compiled') || lower.includes('healthy')) {
    level = 'ok';
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
    pushEntry(rawLines, entry, maxRaw);
    if (info.noisy && !fullLogs) {
      recordNoise(source);
      continue;
    }
    pushEntry(logLines, entry, maxFiltered);
    persistEntry(entry);
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
  const proc = spawn('cmd.exe', ['/c', command], {
    cwd: root,
    windowsHide: true
  });

  processes.set(name, { name, command, proc, startedAt: Date.now() });
  logSystem(`[${name}] PID ${proc.pid}`, 'system');

  proc.stdout.on('data', (data) => logTaskOutput(name, data));
  proc.stderr.on('data', (data) => logTaskOutput(name, data));
  proc.on('exit', (code) => {
    logSystem(`[${name}] finalizo con codigo ${code}`, 'system');
    processes.delete(name);
  });
  proc.on('error', (err) => {
    logSystem(`[${name}] error: ${err.message}`, 'error', { console: true });
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
  spawn('taskkill', ['/T', '/F', '/PID', String(entry.proc.pid)], { windowsHide: true });
}

// Open the dashboard URL in the default browser.
function openBrowser(url) {
  spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true });
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
const commands = {
  dev: 'npm run dev',
  'dev-frontend': 'npm run dev:frontend',
  'dev-backend': 'npm run dev:backend',
  prod: 'npm start',
  portal: 'npm run dev:portal',
  status: 'npm run status',
  'docker-ps': 'docker ps',
  'docker-down': 'docker compose down'
};

function isRunning(name) {
  const entry = processes.get(name);
  return Boolean(entry && entry.proc && entry.proc.exitCode === null);
}

function restartTask(name, delayMs = 700) {
  const command = commands[name];
  if (!command) {
    logSystem(`[${name}] reinicio solicitado pero no existe comando`, 'warn');
    return;
  }

  const wasRunning = isRunning(name);
  if (wasRunning) stopTask(name);
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
    'Cache-Control': 'no-store'
  });
  res.end(data);
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

async function findExistingInstance() {
  if (!fs.existsSync(lockPath)) return null;
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (!lock || !lock.port) return null;
    const ok = await pingDashboard(lock.port);
    if (ok) return { port: lock.port };
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
    startedAt: new Date().toISOString()
  };
  try {
    fs.writeFileSync(lockPath, JSON.stringify(payload, null, 2));
  } catch {
    // ignore
  }
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
  clearLock();
  process.exit(0);
}

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));
process.on('exit', () => clearLock());

// Main HTTP server for UI and API.
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const pathName = reqUrl.pathname;

  if (req.method === 'GET' && pathName === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(dashboardHtml);
    return;
  }

  if (req.method === 'GET' && pathName === '/manifest.webmanifest') {
    res.writeHead(200, {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(manifestJson);
    return;
  }

  if (req.method === 'GET' && pathName === '/assets/dashboard-icon.svg') {
    res.writeHead(200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(iconSvg);
    return;
  }

  if (req.method === 'GET' && pathName === '/api/status') {
    const noise = noiseSnapshot();
    const noiseTotal = Object.values(noise).reduce((acc, val) => acc + val, 0);
    const payload = {
      root,
      mode,
      node: safeExec('node -v', 'No detectado'),
      npm: safeExec('npm -v', 'No detectado'),
      docker: safeExec('docker version --format "{{.Server.Version}}"', 'No disponible'),
      running: runningTasks(),
      logSize: logLines.length,
      rawSize: rawLines.length,
      noise,
      noiseTotal,
      autoRestart
    };
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === 'GET' && pathName === '/api/config') {
    sendJson(res, 200, { autoRestart });
    return;
  }

  if (req.method === 'POST' && pathName === '/api/config') {
    const body = await readBody(req);
    const next = Boolean(body.autoRestart);
    autoRestart = mode === 'dev' ? next : false;
    logSystem(`Auto-reinicio: ${autoRestart ? 'ACTIVO' : 'DESACTIVADO'}`, autoRestart ? 'ok' : 'warn');
    sendJson(res, 200, { ok: true, autoRestart });
    return;
  }

  if (req.method === 'GET' && pathName === '/api/health') {
    const services = await collectHealth();
    sendJson(res, 200, { checkedAt: Date.now(), services });
    return;
  }

  if (req.method === 'GET' && pathName === '/api/logs') {
    const wantFull = reqUrl.searchParams.get('full') === '1';
    const entries = wantFull ? rawLines : logLines;
    sendJson(res, 200, { entries });
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
    const command = commands[task];
    if (!command) return sendJson(res, 400, { error: 'Tarea desconocida' });
    startTask(task, command);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathName === '/api/stop') {
    const body = await readBody(req);
    const task = String(body.task || '').trim();
    if (!task) return sendJson(res, 400, { error: 'Tarea requerida' });
    stopTask(task);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathName === '/api/restart') {
    const body = await readBody(req);
    const task = String(body.task || '').trim();

    if (!task) return sendJson(res, 400, { error: 'Tarea requerida' });

    if (task === 'all') {
      const running = runningTasks();
      restartAll(running);
      return sendJson(res, 200, { ok: true, restarted: running });
    }

    if (task === 'stack') {
      const running = runningTasks();
      const candidates = ['dev', 'prod', 'portal', 'dev-frontend', 'dev-backend'];
      const toRestart = candidates.filter((name) => running.includes(name));
      restartAll(toRestart);
      return sendJson(res, 200, { ok: true, restarted: toRestart });
    }

    if (!commands[task]) return sendJson(res, 400, { error: 'Tarea desconocida' });
    restartTask(task);
    return sendJson(res, 200, { ok: true, restarted: [task] });
  }

  if (req.method === 'POST' && pathName === '/api/run') {
    const body = await readBody(req);
    const task = String(body.task || '').trim();
    const command = commands[task];
    if (!command) return sendJson(res, 400, { error: 'Comando desconocido' });
    startTask(task, command);
    return sendJson(res, 200, { ok: true });
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// Start server on a free port and auto-start tasks for the chosen mode.
(async () => {
  const existing = await findExistingInstance();
  if (existing) {
    const url = `http://127.0.0.1:${existing.port}`;
    logSystem(`Dashboard ya esta activo: ${url}`, 'ok', { console: true });
    if (!noOpen) openBrowser(url);
    return;
  }

  const requestedPort = portArg ? Number(portArg) : null;
  const port = Number.isFinite(requestedPort) ? requestedPort : await findPort(4519);
  server.on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
      const url = `http://127.0.0.1:${port}`;
      const ok = await pingDashboard(port);
      if (ok) {
        logSystem(`Dashboard ya esta activo: ${url}`, 'ok', { console: true });
        if (!noOpen) openBrowser(url);
        process.exit(0);
      }

      if (Number.isFinite(requestedPort)) {
        logSystem(`Puerto ocupado: ${port}. Cierra la instancia previa o cambia --port.`, 'error', { console: true });
        process.exit(1);
      }
    }
    logSystem(`Error del servidor: ${err.message}`, 'error', { console: true });
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    writeLock(port);
    logSystem(`Dashboard listo: ${url}`, 'ok', { console: true });
    if (!noOpen) openBrowser(url);
    if (mode === 'dev') startTask('dev', commands.dev);
    if (mode === 'prod') startTask('prod', commands.prod);

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


