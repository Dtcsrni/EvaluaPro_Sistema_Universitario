import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareApiSnapshots, readCurrentPublicApis } from './module-contract-check.mjs';

export function updateSnapshots(root = process.cwd()) {
  const manifestPath = path.join(root, 'docs/contracts/module-contracts.v2.json');
  const legacyPath = path.join(root, 'docs/contracts/module-contracts.v1.json');
  const sourcePath = fs.existsSync(manifestPath) ? manifestPath : legacyPath;
  const manifest = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const apis = readCurrentPublicApis({ root });
  const next = structuredClone(manifest);
  next.schemaVersion = 2;

  for (const descriptor of next.modules) {
    const exports = apis[descriptor.id];
    const history = descriptor.publicApiHistory ?? [];
    const latest = history.at(-1);
    if (!latest) {
      descriptor.publicApiHistory = [{ version: descriptor.contractVersion, exports }];
      continue;
    }
    if (latest.version === descriptor.contractVersion) {
      if (JSON.stringify(latest.exports) !== JSON.stringify(exports)) {
        throw new Error(`${descriptor.id}: la API cambió sin incrementar contractVersion; no se modifica el historial`);
      }
      continue;
    }
    const errors = compareApiSnapshots(latest, { exports }, descriptor.contractVersion);
    if (errors.length) throw new Error(`${descriptor.id}: ${errors.join('; ')}`);
    descriptor.publicApiHistory.push({ version: descriptor.contractVersion, exports });
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return manifestPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(`[module-contracts] snapshots actualizados: ${path.relative(process.cwd(), updateSnapshots())}`);
  } catch (error) {
    console.error(`[module-contracts] ${error.message}`);
    process.exitCode = 1;
  }
}
