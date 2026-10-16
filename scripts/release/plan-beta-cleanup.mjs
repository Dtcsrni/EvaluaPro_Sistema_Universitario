#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[a-f0-9]{40}$/i;

export function planBetaCleanup({ version, candidateSha, stableRelease, stableTagSha, betaReleases = [], tagCommits = {} }) {
  const normalizedVersion = String(version || '').trim();
  const sha = String(candidateSha || '').trim().toLowerCase();
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(normalizedVersion)) {
    throw new Error('La versión estable debe ser SemVer X.Y.Z.');
  }
  if (!SHA_PATTERN.test(sha)) throw new Error('El candidato debe ser un SHA completo.');

  const stableTag = `v${normalizedVersion}`;
  if (!stableRelease || stableRelease.tag_name !== stableTag || stableRelease.draft || stableRelease.prerelease) {
    throw new Error('No existe una release estable pública verificada para la versión candidata.');
  }
  if (!SHA_PATTERN.test(String(stableTagSha || '')) || String(stableTagSha).toLowerCase() !== sha) {
    throw new Error('El tag estable no apunta al SHA candidato; no se elimina ninguna beta.');
  }

  const betaPattern = new RegExp(`^v${normalizedVersion.replaceAll('.', '\\.')}-beta\\.(0|[1-9]\\d*)$`);
  const remove = [];
  const preserve = [];
  for (const release of betaReleases) {
    const tag = String(release?.tag_name || '');
    if (!betaPattern.test(tag) || release.draft || !release.prerelease) continue;
    const betaSha = String(tagCommits[tag] || '').trim().toLowerCase();
    if (!SHA_PATTERN.test(betaSha)) throw new Error(`No se pudo verificar el SHA del tag beta ${tag}; no se elimina ninguna beta.`);
    if (betaSha === sha) remove.push(tag);
    else preserve.push({ tag, sha: betaSha });
  }

  return {
    version: normalizedVersion,
    candidateSha: sha,
    stableTag,
    stableReleaseUrl: String(stableRelease.html_url || ''),
    stablePublishedAt: String(stableRelease.published_at || ''),
    remove: remove.sort(),
    preserve: preserve.sort((left, right) => left.tag.localeCompare(right.tag))
  };
}

async function main() {
  const inputPath = process.argv.find((arg) => arg.startsWith('--input='))?.slice('--input='.length);
  if (!inputPath) throw new Error('Falta --input=<json>.');
  const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
  process.stdout.write(`${JSON.stringify(planBetaCleanup(input), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[release:beta-cleanup] ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
