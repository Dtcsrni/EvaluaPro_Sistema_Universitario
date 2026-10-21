import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseResponse(raw, label) {
  const match = raw.match(/^HTTP\/\S+\s+(\d{3})(?:\s|$)/m);
  if (!match) throw new Error(`${label}: respuesta HTTP ausente o inválida.`);

  const status = Number(match[1]);
  const separator = raw.search(/\r?\n\r?\n/);
  const body = separator < 0 ? '' : raw.slice(separator).replace(/^\r?\n\r?\n/, '').trim();
  if (status !== 404 && (status < 200 || status >= 300)) {
    throw new Error(`${label}: GitHub API respondió HTTP ${status}.`);
  }

  if (status === 404) return { status, payload: null };
  try {
    return { status, payload: JSON.parse(body) };
  } catch {
    throw new Error(`${label}: la respuesta de GitHub no contiene JSON válido.`);
  }
}

export function validateExistingStableDraft({ releaseResponse, tagResponse, expectedTag, sourceSha }) {
  if (!/^v\d+\.\d+\.\d+$/.test(expectedTag)) throw new Error('La tag esperada debe tener formato vX.Y.Z.');
  if (!/^[0-9a-f]{40}$/i.test(sourceSha)) throw new Error('SOURCE_SHA debe ser un SHA completo de 40 caracteres.');

  const releaseResult = parseResponse(releaseResponse, 'Release');
  const tagResult = parseResponse(tagResponse, 'Tag');
  const candidateSha = sourceSha.toLowerCase();
  const tagSha = tagResult.status === 404 ? null : String(tagResult.payload?.sha || '').toLowerCase();

  if (tagResult.status !== 404 && !/^[0-9a-f]{40}$/.test(tagSha)) {
    throw new Error('La referencia de tag no resolvió a un SHA completo.');
  }

  if (releaseResult.status === 404) {
    if (tagSha && tagSha !== candidateSha) throw new Error(`La tag ${expectedTag} ya apunta a otro SHA y no se reemplaza.`);
    return { action: 'create-or-continue', tagSha };
  }

  const release = releaseResult.payload;
  if (release?.tag_name !== expectedTag) throw new Error(`El release existente no corresponde a ${expectedTag}.`);
  if (release?.draft !== true) throw new Error(`El release ${expectedTag} ya está publicado.`);

  if (tagSha) {
    if (tagSha !== candidateSha) throw new Error(`La tag ${expectedTag} apunta a un SHA distinto del candidato.`);
    return { action: 'reuse-draft', sha: tagSha };
  }

  const targetSha = String(release.target_commitish || '').toLowerCase();
  if (targetSha !== candidateSha) {
    throw new Error(`El borrador ${expectedTag} no está fijado al SHA candidato.`);
  }
  return { action: 'reuse-draft', sha: targetSha };
}

function argumentValue(args, name) {
  const prefix = `--${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (!value) throw new Error(`Falta --${name}.`);
  return value;
}

function main() {
  const args = process.argv.slice(2);
  const releaseResponse = fs.readFileSync(path.resolve(argumentValue(args, 'release-response')), 'utf8');
  const tagResponse = fs.readFileSync(path.resolve(argumentValue(args, 'tag-response')), 'utf8');
  const decision = validateExistingStableDraft({
    releaseResponse,
    tagResponse,
    expectedTag: argumentValue(args, 'tag'),
    sourceSha: argumentValue(args, 'source-sha')
  });
  console.log(`Release guard: ${decision.action}; tag=${argumentValue(args, 'tag')}; sha=${decision.sha || decision.tagSha || 'no-existing-tag'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
