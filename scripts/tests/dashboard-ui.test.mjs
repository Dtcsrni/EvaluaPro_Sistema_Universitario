import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(process.cwd());
const dashboardHtml = fs.readFileSync(path.join(root, 'scripts', 'dashboard.html'), 'utf8');

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  };
}

function createFetchMock(routes) {
  return async (input) => {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    const parsed = new URL(url, 'http://127.0.0.1:4519/');
    const handler = routes[parsed.pathname];
    if (!handler) {
      return createJsonResponse({}, 200);
    }
    const payload = typeof handler === 'function' ? await handler(parsed) : handler;
    return createJsonResponse(payload, 200);
  };
}

async function renderDashboard(routes) {
  const virtualConsole = new VirtualConsole();
  const jsdomErrors = [];
  virtualConsole.on('jsdomError', (error) => {
    jsdomErrors.push(error);
  });

  const dom = new JSDOM(dashboardHtml, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://127.0.0.1:4519/',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.fetch = createFetchMock(routes);
      window.navigator.serviceWorker = { register: () => Promise.resolve() };
      window.matchMedia = window.matchMedia || (() => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {}
      }));
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 120));
  if (jsdomErrors.length > 0) {
    throw jsdomErrors[0];
  }
  return dom;
}

async function renderDashboardWithSetup(routes, setup) {
  const virtualConsole = new VirtualConsole();
  const jsdomErrors = [];
  virtualConsole.on('jsdomError', (error) => {
    jsdomErrors.push(error);
  });

  const dom = new JSDOM(dashboardHtml, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://127.0.0.1:4519/',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.fetch = createFetchMock(routes);
      window.navigator.serviceWorker = { register: () => Promise.resolve() };
      window.matchMedia = window.matchMedia || (() => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {}
      }));
      if (typeof setup === 'function') setup(window);
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 160));
  if (jsdomErrors.length > 0) {
    throw jsdomErrors[0];
  }
  return dom;
}

function text(dom, id) {
  return dom.window.document.getElementById(id)?.textContent?.trim() || '';
}

function envState(dom, env) {
  return dom.window.document.querySelector(`[data-env="${env}"] [data-state]`)?.textContent?.trim() || '';
}

function createRoutes({ status, health }) {
  return {
    '/api/status': status,
    '/api/health': health,
    '/api/install': {
      app: { name: 'evaluapro', version: '1.0.0', displayVersion: '1.0.0b' },
      dashboard: {
        mode: 'prod',
        modeConfig: 'prod',
        port: 4519,
        pid: 1234,
        startedAt: Date.now(),
        noOpen: true,
        verbose: false,
        fullLogs: false
      },
      paths: {
        root: 'V:\\Software\\Generador_Examenes_Universitarios_MERN\\sistema-evaluacion-universitaria',
        logFile: 'V:\\Software\\Generador_Examenes_Universitarios_MERN\\sistema-evaluacion-universitaria\\logs\\dashboard.log'
      },
      logs: {
        persistMode: 'important',
        enabled: true,
        flushMs: 1400,
        maxBytes: 2000000,
        keepFiles: 3
      },
      runtime: {
        nodeVersion: 'v24.12.0',
        platform: 'win32',
        arch: 'x64'
      }
    },
    '/api/update/status': {
      state: 'idle',
      channel: 'stable',
      currentVersion: '1.0.0',
      availableVersion: '',
      download: { bytesTotal: 0, bytesReceived: 0, percent: 0 }
    },
    '/api/logs': { entries: [] },
    '/api/events': { entries: [] },
    '/api/config': {
      autoRestart: false,
      showFullLogs: false,
      autoScroll: true,
      pauseUpdates: false,
      refreshForegroundMs: 3000,
      refreshBackgroundMs: 20000
    },
    '/api/repair/status': { needsRepair: false, issues: [], lastRun: null },
    '/api/repair/progress': {
      runId: '',
      state: 'idle',
      currentStep: '',
      percent: 0,
      steps: [],
      manualActions: [],
      issues: [],
      lastRun: null
    },
    '/api/mongo-express': { url: 'http://127.0.0.1:8081/', reachable: false, status: 0 }
  };
}

test('dashboard UI muestra PROD detectado con salud real y tareas separadas', async () => {
  const dom = await renderDashboard(createRoutes({
    status: {
      app: { name: 'evaluapro', version: '1.0.0', displayVersion: '1.0.0b' },
      root: 'V:\\Software\\Generador_Examenes_Universitarios_MERN\\sistema-evaluacion-universitaria',
      mode: 'prod',
      modeConfig: 'prod',
      port: 4519,
      node: 'v24.12.0',
      npm: '11.4.1',
      docker: '29.2.1',
      dockerDisplay: '29.2.1',
      stackDisplay: 'Stack Docker ya esta activo.',
      compose: {
        checkedAt: Date.now(),
        dev: { mongo_local: false, api_docente_local: false },
        prod: { mongo_local: true, api_docente_prod: true, web_docente_prod: true },
        error: ''
      },
      https: { mode: 'http-fallback', display: 'HTTP (fallback)' },
      dockerState: {
        state: 'ready',
        ready: true,
        version: '29.2.1',
        lastError: '',
        stack: { state: 'skipped', running: true, lastError: '' }
      },
      managedTasks: [],
      running: [],
      logSize: 0,
      rawSize: 0,
      config: {
        autoRestart: false,
        showFullLogs: false,
        autoScroll: true,
        pauseUpdates: false,
        refreshForegroundMs: 3000,
        refreshBackgroundMs: 20000
      }
    },
    health: {
      checkedAt: Date.now(),
      services: {
        mongoLocal: { ok: true, ms: 1 },
        apiDocente: { ok: true, status: 200, ms: 2 },
        apiPortal: { ok: false, error: 'Error', ms: 1 },
        webDocenteDev: { ok: false, error: 'Error', ms: 1 },
        webDocenteProd: { ok: true, status: 200, ms: 3 }
      }
    }
  }));

  assert.equal(text(dom, 'mode'), 'PROD');
  assert.equal(text(dom, 'running-count'), '1');
  assert.equal(text(dom, 'running'), '-');
  assert.equal(text(dom, 'running-chip'), 'Tareas: 0');
  assert.equal(text(dom, 'stack-real'), 'Arriba (3/3 OK)');
  assert.equal(text(dom, 'health-ok'), '3');
  assert.equal(text(dom, 'health-down'), '0');
  assert.equal(envState(dom, 'prod'), 'Detectado');
  assert.equal(text(dom, 'alert-title'), 'Sin alertas activas');
  assert.ok(text(dom, 'alert-message').includes('Servicios monitoreados'));
  assert.equal(dom.window.document.querySelectorAll('#version-chip').length, 1);
  assert.equal(text(dom, 'version-chip'), 'v1.0.0b');

  dom.window.close();
});

test('dashboard UI eleva alerta principal cuando falla la salud real', async () => {
  const dom = await renderDashboard(createRoutes({
    status: {
      app: { name: 'evaluapro', version: '1.0.0', displayVersion: '1.0.0b' },
      root: 'V:\\Software\\Generador_Examenes_Universitarios_MERN\\sistema-evaluacion-universitaria',
      mode: 'prod',
      modeConfig: 'prod',
      port: 4519,
      node: 'v24.12.0',
      npm: '11.4.1',
      docker: '29.2.1',
      dockerDisplay: '29.2.1',
      stackDisplay: 'Stack Docker ya esta activo.',
      compose: {
        checkedAt: Date.now(),
        dev: { mongo_local: false, api_docente_local: false },
        prod: { mongo_local: true, api_docente_prod: true, web_docente_prod: true },
        error: ''
      },
      https: { mode: 'http-fallback', display: 'HTTP (fallback)' },
      dockerState: {
        state: 'ready',
        ready: true,
        version: '29.2.1',
        lastError: '',
        stack: { state: 'skipped', running: true, lastError: '' }
      },
      managedTasks: [],
      running: [],
      logSize: 0,
      rawSize: 0,
      config: {
        autoRestart: false,
        showFullLogs: false,
        autoScroll: true,
        pauseUpdates: false,
        refreshForegroundMs: 3000,
        refreshBackgroundMs: 20000
      }
    },
    health: {
      checkedAt: Date.now(),
      services: {
        mongoLocal: { ok: true, ms: 1 },
        apiDocente: { ok: false, error: 'timeout', ms: 1200 },
        apiPortal: { ok: false, error: 'Error', ms: 1 },
        webDocenteDev: { ok: false, error: 'Error', ms: 1 },
        webDocenteProd: { ok: true, status: 200, ms: 3 }
      }
    }
  }));

  assert.equal(text(dom, 'stack-real'), 'Parcial (2/3 OK)');
  assert.equal(text(dom, 'health-ok'), '2');
  assert.equal(text(dom, 'health-down'), '1');
  assert.equal(text(dom, 'alert-title'), 'Error detectado');
  assert.ok(text(dom, 'alert-message').includes('API docente'));

  dom.window.close();
});

test('dashboard UI sincroniza tema con preferencia auto/light/dark compartida', async () => {
  const dom = await renderDashboardWithSetup(createRoutes({
    status: {
      app: { name: 'evaluapro', version: '1.0.0', displayVersion: '1.0.0b' },
      root: 'C:\\EvaluaPro',
      mode: 'prod',
      modeConfig: 'prod',
      port: 4519,
      node: 'v24.12.0',
      npm: '11.4.1',
      docker: '29.2.1',
      dockerDisplay: '29.2.1',
      stackDisplay: 'Stack Docker listo.',
      compose: { checkedAt: Date.now(), dev: {}, prod: {}, error: '' },
      https: { mode: 'http-fallback', display: 'HTTP' },
      dockerState: { state: 'ready', ready: true, version: '29.2.1', lastError: '', stack: { state: 'skipped', running: true, lastError: '' } },
      managedTasks: [],
      running: [],
      logSize: 0,
      rawSize: 0,
      config: {
        autoRestart: false,
        showFullLogs: false,
        autoScroll: true,
        pauseUpdates: false,
        refreshForegroundMs: 3000,
        refreshBackgroundMs: 20000
      }
    },
    health: {
      checkedAt: Date.now(),
      services: {
        mongoLocal: { ok: true, ms: 1 },
        apiDocente: { ok: true, status: 200, ms: 2 },
        apiPortal: { ok: true, status: 200, ms: 2 },
        webDocenteDev: { ok: false, error: 'Error', ms: 1 },
        webDocenteProd: { ok: true, status: 200, ms: 3 }
      }
    }
  }), (window) => {
    window.localStorage.setItem('ep.theme.preference', 'auto');
    window.matchMedia = () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {}
    });
  });

  const btn = dom.window.document.getElementById('theme-toggle');
  assert.ok(btn?.textContent?.includes('Auto'));
  btn?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(dom.window.localStorage.getItem('ep.theme.preference'), 'light');
  btn?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(dom.window.localStorage.getItem('ep.theme.preference'), 'dark');
  dom.window.close();
});

test('dashboard UI recupera el foco en la pestana activa tras recarga', async () => {
  const routes = createRoutes({
    status: {
      app: { name: 'evaluapro', version: '1.0.0', displayVersion: '1.0.0b' },
      root: 'V:\\Software\\Generador_Examenes_Universitarios_MERN\\sistema-evaluacion-universitaria',
      mode: 'prod',
      modeConfig: 'prod',
      port: 4519,
      node: 'v24.12.0',
      npm: '11.4.1',
      docker: '29.2.1',
      dockerDisplay: '29.2.1',
      stackDisplay: 'Stack Docker ya esta activo.',
      compose: {
        checkedAt: Date.now(),
        dev: { mongo_local: false, api_docente_local: false },
        prod: { mongo_local: true, api_docente_prod: true, web_docente_prod: true },
        error: ''
      },
      https: { mode: 'http-fallback', display: 'HTTP (fallback)' },
      dockerState: {
        state: 'ready',
        ready: true,
        version: '29.2.1',
        lastError: '',
        stack: { state: 'skipped', running: true, lastError: '' }
      },
      managedTasks: [],
      running: [],
      logSize: 0,
      rawSize: 0,
      config: {
        autoRestart: false,
        showFullLogs: false,
        autoScroll: true,
        pauseUpdates: false,
        refreshForegroundMs: 3000,
        refreshBackgroundMs: 20000
      }
    },
    health: {
      checkedAt: Date.now(),
      services: {
        mongoLocal: { ok: true, ms: 1 },
        apiDocente: { ok: true, status: 200, ms: 2 },
        apiPortal: { ok: false, error: 'Error', ms: 1 },
        webDocenteDev: { ok: false, error: 'Error', ms: 1 },
        webDocenteProd: { ok: true, status: 200, ms: 3 }
      }
    }
  });

  const dom = await renderDashboardWithSetup(routes, (window) => {
    window.sessionStorage.setItem('seuDashboardReloadFocusGuard', String(Date.now()));
  });

  try {
    assert.equal(dom.window.document.activeElement?.id, 'tab-main');
  } finally {
    dom.window.close();
  }
});
