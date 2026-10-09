/**
 * Baseline no destructivo para footprint y confiabilidad del flavor docente-local.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const enforce = args.includes('--enforce');
// El MSI/payload se limita separadamente; el Bundle incluye además el Hub WPF
// autocontenido y su runtime .NET para conservar instalación autónoma. Estos
// presupuestos incluyen margen para el runtime nativo de Windows, Prisma,
// Sharp y canvas; no autorizan retirar dependencias funcionales.
// Calibrado con el build v1.2.6 anclado al lock raíz: payload MSI 194 MiB y
// Bundle 256.3 MiB. El margen de 6 MiB/13.7 MiB absorbe variación normal sin
// permitir que una regresión grande pase inadvertida.
const maxPayloadBytes = 200 * 1024 * 1024;
const maxBundleBytes = 270 * 1024 * 1024;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
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
const report = {
  generatedAt: new Date().toISOString(),
  flavorId: 'docente-local',
  contract: {
    runtimeTarget: 'native-node-sqlite',
    requireLocalPortal: Boolean(docente?.requireLocalPortal),
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
  process.stdout.write(`- Bundle dentro de limite: ${report.quality.bundleWithinLimit ? 'si' : 'no'} (${maxBundleBytes} bytes)\n`);
  process.stdout.write(`- Payload MSI dentro de limite: ${report.quality.payloadWithinLimit ? 'si' : 'no'} (${maxPayloadBytes} bytes)\n`);
  process.stdout.write('\nUsa `--json` para evidencia machine-readable; agrega `--enforce` para bloquear release.\n');
}
