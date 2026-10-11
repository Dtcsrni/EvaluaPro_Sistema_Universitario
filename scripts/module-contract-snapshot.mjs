import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareApiSnapshots, readCurrentCompositionApis, readCurrentPublicApis } from './module-contract-check.mjs';

function updateHistory(descriptor, field, exports) {
  const history = descriptor[field] ?? [];
  const latest = history.at(-1);
  if (!latest) {
    descriptor[field] = [{ version: descriptor.contractVersion, exports }];
    return;
  }
  if (latest.version === descriptor.contractVersion) {
    if (JSON.stringify(latest.exports) !== JSON.stringify(exports)) {
      throw new Error(`${descriptor.id}: ${field} cambió sin incrementar contractVersion; no se modifica el historial`);
    }
    return;
  }
  const errors = compareApiSnapshots(latest, { exports }, descriptor.contractVersion);
  if (errors.length) throw new Error(`${descriptor.id}: ${errors.map((error) => error.replace('publicApiHistory', field)).join('; ')}`);
  history.push({ version: descriptor.contractVersion, exports });
  descriptor[field] = history;
}

export function updateSnapshots(root = process.cwd()) {
  const manifestPath = path.join(root, 'docs/contracts/module-contracts.v2.json');
  const legacyPath = path.join(root, 'docs/contracts/module-contracts.v1.json');
  const sourcePath = fs.existsSync(manifestPath) ? manifestPath : legacyPath;
  const manifest = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const apis = readCurrentPublicApis({ root });
  const compositionApis = readCurrentCompositionApis({ root });
  const next = structuredClone(manifest);
  next.schemaVersion = 2;

  for (const descriptor of next.modules) {
    updateHistory(descriptor, 'publicApiHistory', apis[descriptor.id]);
    updateHistory(descriptor, 'compositionApiHistory', compositionApis[descriptor.id]);
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
