import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const vitestEntry = path.join(rootDir, 'node_modules', 'vitest', 'vitest.mjs');
const targets = {
  frontend: { directory: 'apps/frontend', source: 'apps/frontend/src', configArgs: ['--configLoader', 'runner'], poolArgs: ['--pool=forks'] },
  portal: { directory: 'apps/portal_alumno_cloud', source: 'apps/portal_alumno_cloud/src', configArgs: [], poolArgs: [] }
};
const zeroThresholdArgs = [
  '--coverage.thresholds.lines=0',
  '--coverage.thresholds.functions=0',
  '--coverage.thresholds.branches=0',
  '--coverage.thresholds.statements=0'
];

function isSafeGitRef(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)
    && !value.includes('..')
    && !value.includes('//')
    && !value.endsWith('/');
}

function parseApps(value) {
  const apps = String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  if (!apps.length || apps.some((app) => !Object.hasOwn(targets, app))) {
    throw new Error('Indica --apps frontend,portal o ambos.');
  }
  return [...new Set(apps)];
}

function buildModuleCoveragePlan(app, changedFrom = '', changedFiles = []) {
  const target = targets[app];
  if (!target) throw new Error('Módulo de cobertura no admitido: ' + app);
  if (!changedFrom) {
    const args = ['run', ...target.configArgs, '--coverage', ...target.poolArgs];
    if (app === 'frontend') args.push('--reporter=verbose');
    return { mode: 'full', args };
  }
  if (!isSafeGitRef(changedFrom)) throw new Error('Se requiere una referencia Git válida para coverage diferencial.');
  const files = changedFiles.filter((file) => file === target.source || file.startsWith(target.source + '/'));
  if (!files.length) return { mode: 'skip', args: null };
  return {
    mode: 'changed',
    args: ['run', ...target.configArgs, '--coverage', '--changed=' + changedFrom, ...target.poolArgs, ...zeroThresholdArgs, '--reporter=default']
  };
}

function listChangedSourceFiles(baseRef, source) {
  if (!isSafeGitRef(baseRef)) throw new Error('Se requiere una referencia Git válida para coverage diferencial.');
  const result = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACMR', baseRef + '...HEAD', '--', source], {
    cwd: rootDir,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.error || result.status !== 0) {
    throw new Error('No se pudo calcular el diff de fuentes contra ' + baseRef + ': ' + String(result.stderr || result.error || 'git diff falló').trim());
  }
  return result.stdout.split(/\r?\n/).map((file) => file.trim()).filter(Boolean);
}

function runVitest(app, args) {
  const target = targets[app];
  const result = spawnSync(process.execPath, [vitestEntry, ...args], {
    cwd: path.join(rootDir, target.directory),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function main() {
  const appsArg = process.argv.find((arg) => arg.startsWith('--apps='))?.slice('--apps='.length)
    ?? process.argv[process.argv.indexOf('--apps') + 1];
  const apps = parseApps(appsArg);
  const changedFrom = process.env.MODULE_COVERAGE_CHANGED_FROM?.trim() ?? '';
  for (const app of apps) {
    const target = targets[app];
    const changedFiles = changedFrom ? listChangedSourceFiles(changedFrom, target.source) : [];
    const plan = buildModuleCoveragePlan(app, changedFrom, changedFiles);
    process.stdout.write('[module-coverage] ' + app + ': ' + plan.mode + (changedFrom ? '; base=' + changedFrom + '; fuentes=' + changedFiles.length : '') + '\n');
    if (plan.mode === 'skip') continue;
    const code = runVitest(app, plan.args);
    if (code !== 0) return code;
  }
  return 0;
}

export { buildModuleCoveragePlan, isSafeGitRef, listChangedSourceFiles, parseApps };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write('[module-coverage] ERROR: ' + String(error?.message || error) + '\n');
    process.exitCode = 1;
  }
}
