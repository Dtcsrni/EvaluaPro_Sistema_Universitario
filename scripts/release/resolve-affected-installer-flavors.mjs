import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();

function getArg(name, fallback = '') {
  const hit = process.argv.find((item) => item.startsWith(`${name}=`));
  if (hit) return hit.slice(name.length + 1);
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function runGit(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function readCatalog() {
  const file = path.join(root, 'config', 'installer-flavors.json');
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw);
  const flavors = Array.isArray(parsed.flavors) ? parsed.flavors.map((f) => String(f.flavorId || '').trim()).filter(Boolean) : [];
  const defaultFlavorId = String(parsed.defaultFlavorId || '').trim() || flavors[0] || 'docente-local';
  return { flavors, defaultFlavorId };
}

function listChangedFiles(baseRef, headRef) {
  if (!baseRef || !headRef) return [];
  const out = runGit(['diff', '--name-only', `${baseRef}...${headRef}`]).trim();
  if (!out) return [];
  return out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function shouldAffectAll(file) {
  const p = file.replace(/\\/g, '/');
  return (
    p.startsWith('apps/') ||
    p.startsWith('packaging/wix/') ||
    p.startsWith('scripts/installer-burn/') ||
    p.startsWith('scripts/installer-hub/') ||
    p === 'scripts/build-msi.ps1' ||
    p === 'scripts/generate-installer-hashes.ps1' ||
    p === 'scripts/generate-installer-release-manifest.ps1' ||
    p === 'config/installer-flavors.json' ||
    p === 'config/installer-prereqs.manifest.json' ||
    p === 'package.json' ||
    p === 'package-lock.json' ||
    p === '.github/workflows/release-beta.yml' ||
    p === '.github/workflows/ci-installer-windows.yml' ||
    p === 'docker-compose.yml'
  );
}

function resolveAffectedFlavors({ changedFiles, flavors, defaultFlavorId }) {
  if (!changedFiles.length) {
    return new Set([defaultFlavorId]);
  }

  if (changedFiles.some((file) => shouldAffectAll(file))) {
    return new Set(flavors);
  }

  const byName = new Set();
  for (const file of changedFiles) {
    const normalized = file.replace(/\\/g, '/').toLowerCase();
    for (const flavorId of flavors) {
      if (normalized.includes(flavorId.toLowerCase())) {
        byName.add(flavorId);
      }
    }
  }

  if (byName.size === 0) {
    byName.add(defaultFlavorId);
  }
  return byName;
}

function appendGithubOutput(outputs) {
  const target = process.env.GITHUB_OUTPUT;
  if (!target) return;
  const lines = [];
  for (const [key, value] of Object.entries(outputs)) {
    lines.push(`${key}=${value}`);
  }
  fs.appendFileSync(target, `${lines.join('\n')}\n`);
}

function main() {
  const baseRef = getArg('--base-ref', '');
  const headRef = getArg('--head-ref', '');
  const { flavors, defaultFlavorId } = readCatalog();
  const canDiff = Boolean(baseRef && headRef);
  const changedFiles = canDiff ? listChangedFiles(baseRef, headRef) : [];
  const affected = canDiff
    ? Array.from(resolveAffectedFlavors({ changedFiles, flavors, defaultFlavorId }))
    : Array.from(new Set(flavors));

  const buildFlavorArg = affected.length === flavors.length ? 'all' : affected.join(',');
  const outputs = {
    flavors_csv: affected.join(','),
    build_flavor_arg: buildFlavorArg,
    default_flavor: defaultFlavorId,
    changed_files_count: String(changedFiles.length)
  };

  appendGithubOutput(outputs);
  process.stdout.write(`${JSON.stringify({ ...outputs, changed_files: changedFiles }, null, 2)}\n`);
}

main();
