import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function createDefaultUpdateState(currentVersion = '0.0.0') {
  return {
    state: 'idle',
    flavorId: '',
    channel: 'stable',
    currentVersion: String(currentVersion || '0.0.0'),
    availableVersion: '',
    releaseUrl: '',
    notes: '',
    diffSummary: null,
    download: {
      bytesTotal: 0,
      bytesReceived: 0,
      percent: 0,
      filePath: '',
      sha256Ok: null
    },
    preflight: {
      backupOk: false,
      pushOk: false,
      pullOk: false,
      details: []
    },
    lastError: '',
    updatedAt: new Date().toISOString(),
    _assetUrl: '',
    _shaUrl: '',
    _diffSummaryUrl: ''
  };
}

function parseSemver(input) {
  const raw = String(input || '').trim().replace(/^v/i, '').split('+')[0];
  const m = raw.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.') : []
  };
}

function compareIdentifiers(a, b) {
  const na = /^\d+$/.test(a);
  const nb = /^\d+$/.test(b);
  if (na && nb) return Number(a) - Number(b);
  if (na) return -1;
  if (nb) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  const aPre = pa.prerelease;
  const bPre = pb.prerelease;
  if (aPre.length === 0 && bPre.length === 0) return 0;
  if (aPre.length === 0) return 1;
  if (bPre.length === 0) return -1;
  const len = Math.max(aPre.length, bPre.length);
  for (let i = 0; i < len; i += 1) {
    const ai = aPre[i];
    const bi = bPre[i];
    if (typeof ai === 'undefined') return -1;
    if (typeof bi === 'undefined') return 1;
    const cmp = compareIdentifiers(ai, bi);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

function hasBetaTag(version) {
  const parsed = parseSemver(version);
  if (!parsed || !Array.isArray(parsed.prerelease) || parsed.prerelease.length === 0) return false;
  return parsed.prerelease.some((part) => /beta/i.test(String(part || '')));
}

function shouldIncludeReleaseByChannel(channel, entry) {
  const normalized = String(channel || 'stable').trim().toLowerCase();
  const isPrerelease = Boolean(entry?.release?.prerelease);
  if (normalized === 'stable') {
    return !isPrerelease;
  }
  if (normalized === 'beta') {
    return hasBetaTag(entry?.version);
  }
  return true;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readStreamToFile(body, targetPath, onProgress = () => {}) {
  if (!body || typeof body.getReader !== 'function') {
    const buffer = Buffer.from(await new Response(body).arrayBuffer());
    fs.writeFileSync(targetPath, buffer);
    onProgress(buffer.length, buffer.length);
    return;
  }
  const file = fs.createWriteStream(targetPath);
  const reader = body.getReader();
  let received = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      const chunk = Buffer.from(part.value);
      received += chunk.length;
      file.write(chunk);
      onProgress(received, chunk.length);
    }
  } finally {
    await new Promise((resolve, reject) => {
      file.on('error', reject);
      file.end(() => resolve());
    });
  }
}

function sha256OfFile(filePath) {
  const hash = crypto.createHash('sha256');
  const bytes = fs.readFileSync(filePath);
  hash.update(bytes);
  return hash.digest('hex');
}

function parseShaFromText(text) {
  const m = String(text || '').trim().match(/^[a-f0-9]{64}/i);
  return m ? m[0].toLowerCase() : '';
}

async function fetchReleaseManifest(fetchImpl, assetUrl) {
  if (!assetUrl) return null;
  const res = await fetchImpl(assetUrl, {
    headers: { Accept: 'application/json', 'User-Agent': 'EvaluaPro-Updater' }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchReleaseDiffSummary(fetchImpl, assetUrl) {
  if (!assetUrl) return null;
  const res = await fetchImpl(assetUrl, {
    headers: { Accept: 'application/json', 'User-Agent': 'EvaluaPro-Updater' }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload;
}

export function selectLatestRelease(releases, currentVersion, options = {}) {
  const includePrerelease = options.includePrerelease !== false;
  const channel = String(options.channel || '').trim().toLowerCase();
  const flavorId = String(options.flavorId || '').trim();
  const assetName = String(options.assetName || 'EvaluaPro-docente-local-Setup.exe');
  const sha256AssetName = String(options.sha256AssetName || `${assetName}.sha256`);

  const list = Array.isArray(releases) ? releases : [];
  const candidates = list
    .map((release) => {
      const version = String(release?.tag_name || '').trim().replace(/^v/i, '');
      const parsed = parseSemver(version);
      return { release, version, parsed };
    })
    .filter((entry) => entry.parsed)
    .filter((entry) => compareSemver(entry.version, currentVersion) > 0)
    .filter((entry) => includePrerelease || !Boolean(entry.release?.prerelease))
    .filter((entry) => (channel ? shouldIncludeReleaseByChannel(channel, entry) : true))
    .sort((a, b) => compareSemver(b.version, a.version));

  if (candidates.length === 0) {
    return { found: false, error: '', candidate: null };
  }

  const top = candidates[0];
  const assets = Array.isArray(top.release?.assets) ? top.release.assets : [];
  const manifestAsset = assets.find((item) => String(item?.name || '') === 'EvaluaPro-release-manifest.json') || null;
  let manifestFlavor = null;
  if (Array.isArray(top.release?.__manifestFlavors) && flavorId) {
    manifestFlavor = top.release.__manifestFlavors.find((item) => String(item?.flavorId || '') === flavorId) || null;
  }
  const effectiveAssetName = String(manifestFlavor?.assetName || assetName);
  const effectiveShaName = String(manifestFlavor?.sha256AssetName || sha256AssetName);
  const installer = assets.find((item) => String(item?.name || '') === effectiveAssetName) || null;
  if (!installer) {
    return {
      found: false,
      error: `Release ${top.version} no incluye asset requerido ${effectiveAssetName}.`,
      candidate: top
    };
  }

  const shaAsset = assets.find((item) => String(item?.name || '') === effectiveShaName) || null;
  const diffSummaryAsset = assets.find((item) => String(item?.name || '') === 'diff-summary.json') || null;
  return {
    found: true,
    error: '',
    candidate: {
      version: top.version,
      releaseUrl: String(top.release?.html_url || ''),
      notes: String(top.release?.body || ''),
      installerUrl: String(installer?.browser_download_url || ''),
      shaUrl: shaAsset ? String(shaAsset?.browser_download_url || '') : '',
      prerelease: Boolean(top.release?.prerelease),
      flavorId: manifestFlavor ? String(manifestFlavor.flavorId || flavorId) : flavorId,
      manifestUrl: manifestAsset ? String(manifestAsset?.browser_download_url || '') : '',
      diffSummaryUrl: diffSummaryAsset ? String(diffSummaryAsset?.browser_download_url || '') : ''
    }
  };
}

export function createUpdateManager(opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const logger = typeof opts.logger === 'function' ? opts.logger : (() => {});
  const getCurrentVersion = typeof opts.getCurrentVersion === 'function' ? opts.getCurrentVersion : (() => '0.0.0');
  const getNowIso = typeof opts.getNowIso === 'function' ? opts.getNowIso : (() => new Date().toISOString());
  const statePath = String(opts.statePath || '');
  const config = {
    owner: String(opts.owner || ''),
    repo: String(opts.repo || ''),
    flavorId: String(opts.flavorId || ''),
    channel: String(opts.channel || 'stable'),
    assetName: String(opts.assetName || 'EvaluaPro-docente-local-Setup.exe'),
    sha256AssetName: String(opts.sha256AssetName || `${String(opts.assetName || 'EvaluaPro-docente-local-Setup.exe')}.sha256`),
    requireSha256: Boolean(opts.requireSha256),
    feedUrl: String(opts.feedUrl || ''),
    checkRetries: Number(opts.checkRetries || 2),
    downloadRetries: Number(opts.downloadRetries || 2),
    retryDelayMs: Number(opts.retryDelayMs || 300),
    downloadRoot: String(opts.downloadRoot || path.resolve(process.cwd(), 'logs', 'updates'))
  };

  let activeDownloadController = null;
  let state = createDefaultUpdateState(getCurrentVersion());
  state.channel = config.channel;
  state.flavorId = config.flavorId;

  function persistState() {
    if (!statePath) return;
    try {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    } catch {
      // ignore
    }
  }

  function setState(patch) {
    state = {
      ...state,
      ...patch,
      updatedAt: getNowIso()
    };
    persistState();
    if (typeof opts.onStateChange === 'function') {
      try { opts.onStateChange(getStatus()); } catch {}
    }
  }

  function getStatus() {
    return JSON.parse(JSON.stringify(state));
  }

  async function fetchWithRetry(url, init, retries = 1) {
    let attempt = 0;
    let lastError = null;
    while (attempt <= retries) {
      attempt += 1;
      try {
        const res = await fetchImpl(url, init);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res;
      } catch (error) {
        lastError = error;
        if (attempt > retries + 1) break;
        if (attempt <= retries) await delay(config.retryDelayMs);
      }
    }
    throw lastError || new Error('FETCH_FAILED');
  }

  function resolveReleasesUrl() {
    if (config.feedUrl) return config.feedUrl;
    if (!config.owner || !config.repo) {
      throw new Error('No se configuro owner/repo para releases.');
    }
    return `https://api.github.com/repos/${config.owner}/${config.repo}/releases`;
  }

  async function check() {
    const currentVersion = getCurrentVersion();
    setState({
      state: 'checking',
      currentVersion,
      lastError: ''
    });

    try {
      const releasesUrl = resolveReleasesUrl();
      const response = await fetchWithRetry(releasesUrl, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'EvaluaPro-Updater' }
      }, config.checkRetries);
      const payload = await response.json();
      const enriched = [];
      for (const release of Array.isArray(payload) ? payload : []) {
        const assets = Array.isArray(release?.assets) ? release.assets : [];
        const manifestAsset = assets.find((item) => String(item?.name || '') === 'EvaluaPro-release-manifest.json');
        if (manifestAsset) {
          try {
            const manifest = await fetchReleaseManifest(fetchImpl, String(manifestAsset.browser_download_url || ''));
            if (Array.isArray(manifest?.flavors)) {
              release.__manifestFlavors = manifest.flavors;
            }
          } catch {}
        }
        enriched.push(release);
      }
      const pick = selectLatestRelease(enriched, currentVersion, {
        flavorId: config.flavorId,
        channel: config.channel,
        includePrerelease: config.channel !== 'stable',
        assetName: config.assetName,
        sha256AssetName: config.sha256AssetName
      });

      if (!pick.found && pick.error) {
        setState({ state: 'error', lastError: pick.error });
        return getStatus();
      }

      if (!pick.found) {
        setState({
          state: 'idle',
          availableVersion: '',
          releaseUrl: '',
          notes: '',
          diffSummary: null,
          lastError: ''
        });
        return getStatus();
      }

      const candidate = pick.candidate;
      let diffSummary = null;
      if (candidate.diffSummaryUrl) {
        try {
          diffSummary = await fetchReleaseDiffSummary(fetchImpl, candidate.diffSummaryUrl);
        } catch {
          diffSummary = null;
        }
      }
      setState({
        state: 'available',
        flavorId: String(candidate.flavorId || config.flavorId || ''),
        availableVersion: String(candidate.version || ''),
        releaseUrl: String(candidate.releaseUrl || ''),
        notes: String(candidate.notes || ''),
        diffSummary,
        lastError: '',
        download: { ...state.download, percent: 0, bytesReceived: 0, bytesTotal: 0, filePath: '', sha256Ok: null },
        _assetUrl: String(candidate.installerUrl || ''),
        _shaUrl: String(candidate.shaUrl || ''),
        _diffSummaryUrl: String(candidate.diffSummaryUrl || '')
      });
      return getStatus();
    } catch (error) {
      setState({ state: 'error', lastError: String(error?.message || error || 'No se pudo consultar releases.') });
      return getStatus();
    }
  }

  function cancel() {
    if (activeDownloadController) {
      try { activeDownloadController.abort(); } catch {}
      activeDownloadController = null;
      setState({ state: 'idle', lastError: 'Descarga cancelada por usuario.' });
      return true;
    }
    return false;
  }

  async function download() {
    if (!state._assetUrl) {
      await check();
      if (!state._assetUrl) return getStatus();
    }

    const version = String(state.availableVersion || 'unknown');
    const targetDir = path.join(config.downloadRoot, version);
    const targetFile = path.join(targetDir, config.assetName);
    fs.mkdirSync(targetDir, { recursive: true });

    const controller = new AbortController();
    activeDownloadController = controller;

    setState({
      state: 'downloading',
      lastError: '',
      download: { ...state.download, bytesTotal: 0, bytesReceived: 0, percent: 0, filePath: targetFile, sha256Ok: null }
    });

    try {
      const response = await fetchWithRetry(state._assetUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'EvaluaPro-Updater' }
      }, config.downloadRetries);

      const contentLength = Number(response.headers.get('content-length') || 0);
      await readStreamToFile(response.body, targetFile, (received) => {
        const pct = contentLength > 0 ? Math.min(100, Math.round((received / contentLength) * 100)) : 0;
        setState({
          download: {
            ...state.download,
            bytesTotal: contentLength,
            bytesReceived: received,
            percent: pct,
            filePath: targetFile,
            sha256Ok: state.download.sha256Ok
          }
        });
      });

      let shaOk = null;
      if (state._shaUrl) {
        const shaRes = await fetchWithRetry(state._shaUrl, {
          headers: { 'User-Agent': 'EvaluaPro-Updater' }
        }, Math.max(0, config.downloadRetries - 1));
        const text = await shaRes.text();
        const expectedSha = parseShaFromText(text);
        if (!expectedSha) throw new Error('Archivo SHA-256 invalido.');
        const actualSha = sha256OfFile(targetFile);
        shaOk = expectedSha === actualSha;
        if (!shaOk) throw new Error('SHA-256 no coincide con el instalador descargado.');
      } else if (config.requireSha256) {
        throw new Error('No se encontro archivo SHA-256 y es requerido por configuración.');
      }

      activeDownloadController = null;
      setState({
        state: 'ready',
        lastError: '',
        download: {
          ...state.download,
          bytesTotal: contentLength || state.download.bytesReceived,
          percent: 100,
          filePath: targetFile,
          sha256Ok: shaOk
        }
      });
      return getStatus();
    } catch (error) {
      activeDownloadController = null;
      setState({ state: 'error', lastError: String(error?.message || error || 'No se pudo descargar el instalador.') });
      return getStatus();
    }
  }

  async function apply() {
    if (!state.download?.filePath || !fs.existsSync(state.download.filePath)) {
      setState({ state: 'error', lastError: 'No hay instalador descargado para aplicar.' });
      return getStatus();
    }

    setState({ state: 'applying', lastError: '' });
    const runPreflight = typeof opts.preflightSync === 'function' ? opts.preflightSync : async () => ({ ok: true, details: [] });
    const stopTasks = typeof opts.stopTasks === 'function' ? opts.stopTasks : async () => ({ ok: true, runningBefore: [] });
    const runInstaller = typeof opts.runInstaller === 'function' ? opts.runInstaller : async () => ({ ok: false, error: 'runInstaller no configurado.' });
    const startTasks = typeof opts.startTasks === 'function' ? opts.startTasks : async () => ({ ok: true });
    const healthCheck = typeof opts.healthCheck === 'function' ? opts.healthCheck : async () => ({ ok: true });

    try {
      const pre = await runPreflight();
      const preflight = {
        backupOk: Boolean(pre?.backupOk),
        pushOk: Boolean(pre?.pushOk),
        pullOk: Boolean(pre?.pullOk),
        details: Array.isArray(pre?.details) ? pre.details : []
      };
      if (!pre?.ok) {
        setState({ state: 'error', preflight, lastError: String(pre?.error || 'Preflight de sincronización falló.') });
        return getStatus();
      }

      const stop = await stopTasks();
      const runningBefore = Array.isArray(stop?.runningBefore) ? stop.runningBefore : [];
      if (!stop?.ok) throw new Error(String(stop?.error || 'No se pudo detener el stack antes de actualizar.'));

      const install = await runInstaller(state.download.filePath, {
        version: state.availableVersion
      });
      if (!install?.ok) throw new Error(String(install?.error || 'Instalador devolvió error.'));

      const start = await startTasks(runningBefore);
      if (!start?.ok) throw new Error(String(start?.error || 'No se pudo reiniciar el stack después de actualizar.'));

      const health = await healthCheck();
      if (!health?.ok) throw new Error(String(health?.error || 'La validación de salud post-update falló.'));

      const nextVersion = String(state.availableVersion || getCurrentVersion());
      setState({
        state: 'idle',
        currentVersion: nextVersion,
        availableVersion: '',
        releaseUrl: '',
        notes: '',
        diffSummary: null,
        preflight,
        lastError: '',
        _assetUrl: '',
        _shaUrl: '',
        _diffSummaryUrl: '',
        download: {
          bytesTotal: 0,
          bytesReceived: 0,
          percent: 0,
          filePath: '',
          sha256Ok: null
        }
      });
      return getStatus();
    } catch (error) {
      setState({ state: 'error', lastError: String(error?.message || error || 'No se pudo aplicar actualización.') });
      return getStatus();
    }
  }

  function setAvailableForTest(params) {
    setState({
      state: 'available',
      availableVersion: String(params?.version || ''),
      _assetUrl: String(params?.assetUrl || ''),
      _shaUrl: String(params?.shaUrl || ''),
      _diffSummaryUrl: String(params?.diffSummaryUrl || ''),
      diffSummary: params?.diffSummary || null
    });
  }

  logger('UpdateManager inicializado');
  persistState();

  return {
    check,
    download,
    apply,
    cancel,
    getStatus,
    setAvailableForTest
  };
}
