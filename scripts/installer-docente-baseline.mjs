/**
 * Baseline no destructivo para footprint y confiabilidad del flavor docente-local.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const enforce = args.includes('--enforce');
// El MSI/payload se limita separadamente; el Bundle incluye además el Hub WPF
// autocontenido y su runtime .NET para conservar instalación autónoma.
const maxPayloadBytes = 130 * 1024 * 1024;
const maxBundleBytes = 200 * 1024 * 1024;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function runProbe(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 12_000
  });
  return {
    ok: result.status === 0,
    code: Number(result.status ?? -1),
    stdout: String(result.stdout || '').trim().slice(0, 3000),
    stderr: String(result.stderr || '').trim().slice(0, 1200)
  };
}

function statIfPresent(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return { path: filePath, exists: true, bytes: stat.size };
  } catch {
    return { path: filePath, exists: false, bytes: 0 };
  }
}

function resolveBundleStats() {
  const publicDir = path.join(root, 'dist', 'installer', 'docente-local');
  let files = [];
  try {
    files = fs.readdirSync(publicDir)
      .filter((name) => /^EvaluaPro-InstallerHub-docente-local-v.+\.exe$/i.test(name))
      .sort();
  } catch {}
  return files.map((name) => statIfPresent(path.join(publicDir, name)));
}

function resolvePayloadStats() {
  const payloadPath = path.join(root, 'dist', 'installer', '_internal', 'docente-local', 'EvaluaPro-docente-local.msi');
  return [statIfPresent(payloadPath)];
}

const flavors = readJson(path.join(root, 'config', 'installer-flavors.json'));
const docente = Array.isArray(flavors?.flavors)
  ? flavors.flavors.find((flavor) => flavor.flavorId === 'docente-local')
  : null;
const requiresDockerRuntime = docente?.requireDockerRuntime === true;
const skippedDockerProbe = (reason) => ({ ok: true, skipped: true, reason, code: 0, stdout: '', stderr: '' });
const compose = requiresDockerRuntime
  ? runProbe('docker', ['compose', '-f', 'docker-compose.yml', '--profile', 'prod', 'ps', '--format', 'json'])
  : skippedDockerProbe('runtime nativo docente-local');
const dockerDf = requiresDockerRuntime
  ? runProbe('docker', ['system', 'df', '--format', 'json'])
  : skippedDockerProbe('runtime nativo docente-local');
const dockerContext = requiresDockerRuntime
  ? runProbe('docker', ['context', 'show'])
  : skippedDockerProbe('runtime nativo docente-local');
const composeServices = requiresDockerRuntime
  ? runProbe('docker', ['compose', '-f', 'docker-compose.yml', '--profile', 'prod', 'config', '--services'])
  : skippedDockerProbe('runtime nativo docente-local');

const report = {
  generatedAt: new Date().toISOString(),
  flavorId: 'docente-local',
  contract: {
    runtimeTarget: requiresDockerRuntime ? 'docker-compatible' : 'native-node-sqlite',
    requireLocalPortal: Boolean(docente?.requireLocalPortal),
    requiredServices: requiresDockerRuntime ? ['mongo_local', 'api_docente_prod', 'web_docente_prod'] : [],
    requiredImages: requiresDockerRuntime ? {
      apiDocente: process.env.EVALUAPRO_API_DOCENTE_IMAGE || 'ghcr.io/dtcsrni/evaluapro_sistema_universitario/evaluapro-api-docente:1.1.1',
      webDocente: process.env.EVALUAPRO_WEB_DOCENTE_IMAGE || 'ghcr.io/dtcsrni/evaluapro_sistema_universitario/evaluapro-web-docente:1.1.1',
      mongo: 'mongo:8.0.23'
    } : {},
    deferredConfig: ['portal/sync', 'OAuth/Classroom', 'correo', 'licencia si no es obligatoria']
  },
  artifacts: {
    bundles: resolveBundleStats(),
    payloads: resolvePayloadStats(),
    updateConfig: statIfPresent(path.join(root, 'config', 'update-config.json'))
  },
  quality: {
    maxBundleBytes,
    maxPayloadBytes,
    bundlePresent: false,
    bundleWithinLimit: false,
    payloadPresent: false,
    payloadWithinLimit: false,
    ok: false
  },
  probes: {
    dockerComposeProd: compose,
    dockerSystemDf: dockerDf,
    dockerContext,
    composeServices
  },
  acceptance: {
    compareBeforeAfter: [
      'bundle_bytes',
      'download_bytes',
      'install_to_ui_ready_ms',
      'uac_prompts',
      'disk_after_install_bytes',
      'ram_idle_bytes',
      'install_repair_update_uninstall_e2e'
    ]
  }
};

report.quality.bundlePresent = report.artifacts.bundles.length > 0;
report.quality.payloadPresent = report.artifacts.payloads.some((payload) => payload.exists && payload.bytes > 0);
report.quality.bundleWithinLimit = report.artifacts.bundles.every((bundle) => bundle.bytes > 0 && bundle.bytes <= maxBundleBytes);
report.quality.payloadWithinLimit = report.artifacts.payloads.every((payload) => payload.bytes > 0 && payload.bytes <= maxPayloadBytes);
report.quality.ok = report.quality.bundlePresent && report.quality.bundleWithinLimit && report.quality.payloadPresent && report.quality.payloadWithinLimit;

if (enforce && !report.quality.ok) {
  process.stderr.write(`[baseline] FAIL: payload o bundle docente fuera de limite (payload=${maxPayloadBytes}, bundle=${maxBundleBytes} bytes).\n`);
  process.exitCode = 1;
}

if (jsonOnly) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write('Baseline docente-local\n');
  process.stdout.write(`- Bundle(s): ${report.artifacts.bundles.length}\n`);
  process.stdout.write(`- Portal local requerido: ${report.contract.requireLocalPortal ? 'si' : 'no'}\n`);
  process.stdout.write(`- Docker compose probe: ${compose.ok ? 'ok' : 'no disponible'}\n`);
  process.stdout.write(`- Bundle dentro de limite: ${report.quality.bundleWithinLimit ? 'si' : 'no'} (${maxBundleBytes} bytes)\n`);
  process.stdout.write(`- Payload MSI dentro de limite: ${report.quality.payloadWithinLimit ? 'si' : 'no'} (${maxPayloadBytes} bytes)\n`);
  process.stdout.write('\nUsa `--json` para evidencia machine-readable; agrega `--enforce` para bloquear release.\n');
}
