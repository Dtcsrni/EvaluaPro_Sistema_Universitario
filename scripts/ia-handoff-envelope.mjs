#!/usr/bin/env node
/**
 * Envelope interoperable para transferir trabajo entre agentes IA.
 * No ejecuta comandos ni comparte prompts completos; produce JSON compacto.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const HANDOFF_PROTOCOL = 'evaluapro.handoff';
export const HANDOFF_VERSION = '1.0';
export const HANDOFF_STATES = new Set(['submitted', 'working', 'input_required', 'completed', 'failed', 'cancelled', 'rejected']);
export const HANDOFF_TRUST = new Set(['untrusted', 'trusted_local']);
const SECRET_PATTERNS = [
  /bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(?:api[_-]?key|password|secret|token)\s*[=:]\s*[^\s,;]+/gi,
  /\bsk-[A-Za-z0-9_-]{10,}/g,
  /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
];
const KNOWN_INPUT_KEYS = new Set([
  'protocol', 'protocolVersion', 'messageId', 'task', 'taskId', 'contextId', 'state', 'objective', 'acceptanceCriteria',
  'request', 'summary', 'scope', 'constraints', 'decisions', 'decisiones', 'restricciones', 'assumptions', 'supuestos', 'risks', 'riesgos', 'nextStep', 'siguientePaso', 'acceptanceCriteria', 'criteriosAceptacion',
  'agent', 'sender', 'recipient', 'artifacts', 'files', 'provenance', 'traceSessionId', 'parentSessionId',
  'budget', 'security', 'warnings', 'generatedAt'
]);

function text(value, fallback = '') {
  return typeof value === 'string' ? value.replace(/\r/g, '').replace(/\s+/g, ' ').trim() || fallback : fallback;
}

function list(value) {
  return Array.isArray(value) ? value.map((item) => text(String(item))).filter(Boolean) : [];
}

function first(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function redact(value) {
  let result = text(value);
  let count = 0;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, () => {
      count += 1;
      return '[REDACTED]';
    });
  }
  return { value: result, count };
}

function safeRelativePath(value) {
  const candidate = text(value);
  if (!candidate || path.isAbsolute(candidate) || /^[A-Za-z]:[\\/]/.test(candidate)) {
    throw new Error(`artifact.path invalida: ${candidate || '(vacia)'}`);
  }
  const normalized = candidate.replaceAll('\\', '/');
  if (normalized.split('/').includes('..') || normalized.startsWith('/')) {
    throw new Error(`artifact.path insegura: ${candidate}`);
  }
  return normalized;
}

function normalizeParty(value, fallback = {}) {
  const item = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    provider: text(item.provider, text(fallback.provider, 'unknown')),
    agent: text(item.agent || item.name, text(fallback.agent, 'unknown')),
    model: text(item.model || item.version, text(fallback.model, 'unknown')),
    runtime: text(item.runtime || item.channel, text(fallback.runtime, 'unknown'))
  };
}

function normalizeArtifacts(input, rootDir, warnings) {
  const source = Array.isArray(input) ? input : [];
  return source.map((raw, index) => {
    const item = typeof raw === 'string' ? { path: raw } : raw && typeof raw === 'object' ? raw : {};
    const artifactPath = safeRelativePath(item.path || item.relativePath);
    const result = {
      id: text(item.id, `artifact-${index + 1}`),
      path: artifactPath,
      mediaType: text(item.mediaType, 'application/octet-stream'),
      bytes: Number.isInteger(item.bytes) && item.bytes >= 0 ? item.bytes : 0,
      trust: HANDOFF_TRUST.has(item.trust) ? item.trust : 'untrusted'
    };
    if (typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256)) result.sha256 = item.sha256;
    if (rootDir && result.bytes === 0) warnings.push(`artifact ${result.id}: bytes no verificados`);
    return result;
  });
}

export async function describeArtifact(relativePath, rootDir, options = {}) {
  const safePath = safeRelativePath(relativePath);
  const fullPath = path.resolve(rootDir, safePath);
  const relativeCheck = path.relative(path.resolve(rootDir), fullPath);
  if (!relativeCheck || relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) throw new Error(`artifact.path fuera del workspace: ${safePath}`);
  const data = await fs.readFile(fullPath);
  return {
    id: text(options.id, safePath),
    path: safePath,
    mediaType: text(options.mediaType, 'application/octet-stream'),
    bytes: data.byteLength,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
    trust: 'trusted_local'
  };
}

export async function prepareHandoffInput(input = {}, options = {}) {
  const envelope = normalizeHandoffInput(input, options);
  if (!options.rootDir) return envelope;
  const prepared = [];
  for (const artifact of envelope.artifacts) {
    if (artifact.sha256 || artifact.bytes > 0) {
      prepared.push(artifact);
      continue;
    }
    try {
      prepared.push(await describeArtifact(artifact.path, options.rootDir, artifact));
      envelope.warnings = (envelope.warnings || []).filter((warning) => warning !== `artifact ${artifact.id}: bytes no verificados`);
    } catch (error) {
      envelope.warnings = [...new Set([...(envelope.warnings || []), `artifact ${artifact.id}: no disponible localmente`])];
      prepared.push(artifact);
    }
  }
  envelope.artifacts = prepared;
  if (envelope.warnings?.length === 0) delete envelope.warnings;
  return envelope;
}

export function normalizeHandoffInput(input = {}, options = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const warnings = [];
  for (const key of Object.keys(source)) if (!KNOWN_INPUT_KEYS.has(key)) warnings.push(`campo desconocido ignorado: ${key}`);
  const task = source.task && typeof source.task === 'object' ? source.task : {};
  const request = source.request && typeof source.request === 'object' ? source.request : {};
  const sender = normalizeParty(source.sender || source.agent, options.sender);
  const recipientSource = source.recipient && typeof source.recipient === 'object' ? source.recipient : null;
  const redactions = [];
  const redactField = (value, field) => {
    const result = redact(value);
    if (result.count) redactions.push(field);
    return result.value;
  };
  const objective = redactField(first(task.objective, source.objective), 'task.objective');
  const summary = redactField(first(request.summary, source.summary, source.objective), 'context.summary');
  const decisions = list(source.decisions || source.decisiones).map((v, i) => redactField(v, `context.decisions[${i}]`));
  const risks = list(source.risks || source.riesgos).map((v, i) => redactField(v, `context.risks[${i}]`));
  const constraints = list(source.constraints || source.restricciones).map((v, i) => redactField(v, `context.constraints[${i}]`));
  const assumptions = list(source.assumptions || source.supuestos).map((v, i) => redactField(v, `context.assumptions[${i}]`));
  const nextStep = redactField(first(source.nextStep, source.siguientePaso), 'context.nextStep');
  const criteria = list(task.acceptanceCriteria || source.acceptanceCriteria || source.criteriosAceptacion).map((v, i) => redactField(v, `task.acceptanceCriteria[${i}]`));
  const state = text(task.state || source.state, 'submitted');
  if (!HANDOFF_STATES.has(state)) throw new Error(`task.state invalido: ${state}`);
  const generatedAt = new Date(options.generatedAt || source.generatedAt || Date.now()).toISOString();
  const messageId = text(source.messageId, `msg-${crypto.randomUUID()}`);
  const taskId = text(task.taskId || source.taskId, `task-${messageId}`);
  const contextId = text(task.contextId || source.contextId, taskId);
  const artifacts = normalizeArtifacts(source.artifacts || source.files?.artifacts, options.rootDir, warnings);
  const traceSessionId = text(source.traceSessionId || source.provenance?.traceSessionId);
  const parentSessionId = text(source.parentSessionId || source.provenance?.parentSessionId);
  const envelope = {
    protocol: HANDOFF_PROTOCOL,
    protocolVersion: HANDOFF_VERSION,
    messageId,
    task: { taskId, contextId, state, objective, acceptanceCriteria: criteria },
    sender,
    context: { summary, decisions, constraints, assumptions, risks, nextStep },
    artifacts,
    provenance: { generatedAt },
    security: { trust: 'untrusted', executionPolicy: 'no-auto-exec', redactionsApplied: redactions }
  };
  if (recipientSource) envelope.recipient = {
    provider: text(recipientSource.provider, 'unknown'),
    agent: text(recipientSource.agent || recipientSource.name, 'unknown'),
    capabilitiesRequired: list(recipientSource.capabilitiesRequired)
  };
  if (traceSessionId) envelope.provenance.traceSessionId = traceSessionId;
  if (parentSessionId) envelope.provenance.parentSessionId = parentSessionId;
  if (source.budget && typeof source.budget === 'object') envelope.budget = {
    ...(Number.isInteger(source.budget.maxBytes) ? { maxBytes: source.budget.maxBytes } : {}),
    ...(Number.isInteger(source.budget.maxInputTokens) ? { maxInputTokens: source.budget.maxInputTokens } : {}),
    ...(Number.isInteger(source.budget.maxOutputTokens) ? { maxOutputTokens: source.budget.maxOutputTokens } : {})
  };
  if (warnings.length) envelope.warnings = [...new Set(warnings)];
  return envelope;
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}

export function serializeHandoff(envelope) {
  validateHandoffEnvelope(envelope);
  return JSON.stringify(sorted(envelope));
}

export function validateHandoffEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('handoff: debe ser objeto');
  assertKeys(envelope, ['protocol', 'protocolVersion', 'messageId', 'task', 'sender', 'recipient', 'context', 'artifacts', 'provenance', 'budget', 'security', 'warnings'], 'handoff');
  if (envelope.protocol !== HANDOFF_PROTOCOL || envelope.protocolVersion !== HANDOFF_VERSION) throw new Error('handoff: protocolo/version no soportados');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(envelope.messageId || '')) throw new Error('handoff.messageId invalido');
  const task = envelope.task;
  assertKeys(task, ['taskId', 'contextId', 'state', 'objective', 'acceptanceCriteria'], 'handoff.task');
  if (!task || !text(task.taskId) || !text(task.contextId) || !HANDOFF_STATES.has(task.state) || !text(task.objective) || !Array.isArray(task.acceptanceCriteria)) throw new Error('handoff.task invalido');
  if (task.acceptanceCriteria.some((item) => !text(item))) throw new Error('handoff.task.acceptanceCriteria invalido');
  assertKeys(envelope.sender, ['provider', 'agent', 'model', 'runtime'], 'handoff.sender');
  for (const field of ['summary', 'nextStep']) if (!text(envelope.context?.[field])) throw new Error(`handoff.context.${field} requerido`);
  for (const field of ['decisions', 'constraints', 'assumptions', 'risks']) if (!Array.isArray(envelope.context?.[field])) throw new Error(`handoff.context.${field} debe ser arreglo`);
  assertKeys(envelope.context, ['summary', 'decisions', 'constraints', 'assumptions', 'risks', 'nextStep'], 'handoff.context');
  for (const field of ['decisions', 'constraints', 'assumptions', 'risks']) if (envelope.context[field].some((item) => !text(item))) throw new Error(`handoff.context.${field} invalido`);
  if (envelope.recipient !== undefined) {
    assertKeys(envelope.recipient, ['provider', 'agent', 'capabilitiesRequired'], 'handoff.recipient');
    if (!text(envelope.recipient.provider) || !text(envelope.recipient.agent) || !Array.isArray(envelope.recipient.capabilitiesRequired) || envelope.recipient.capabilitiesRequired.some((item) => !text(item))) throw new Error('handoff.recipient invalido');
  }
  if (!envelope.sender || !text(envelope.sender.provider) || !text(envelope.sender.agent) || !text(envelope.sender.model) || !text(envelope.sender.runtime)) throw new Error('handoff.sender invalido');
  if (!Array.isArray(envelope.artifacts)) throw new Error('handoff.artifacts debe ser arreglo');
  for (const artifact of envelope.artifacts) {
    safeRelativePath(artifact.path);
    if (!text(artifact.id) || !text(artifact.mediaType) || !Number.isInteger(artifact.bytes) || artifact.bytes < 0 || !HANDOFF_TRUST.has(artifact.trust)) throw new Error('handoff.artifact invalido');
    if (artifact.sha256 !== undefined && !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error(`hash invalido: ${artifact.id}`);
  }
  assertKeys(envelope.provenance, ['generatedAt', 'traceSessionId', 'parentSessionId'], 'handoff.provenance');
  if (!envelope.provenance || Number.isNaN(new Date(envelope.provenance.generatedAt).getTime())) throw new Error('handoff.provenance.generatedAt invalido');
  if (envelope.budget !== undefined) {
    assertKeys(envelope.budget, ['maxBytes', 'maxInputTokens', 'maxOutputTokens'], 'handoff.budget');
    for (const key of Object.keys(envelope.budget)) if (!Number.isInteger(envelope.budget[key]) || envelope.budget[key] < 1) throw new Error(`handoff.budget.${key} invalido`);
  }
  assertKeys(envelope.security, ['trust', 'executionPolicy', 'redactionsApplied'], 'handoff.security');
  if (envelope.security?.trust !== 'untrusted' || envelope.security?.executionPolicy !== 'no-auto-exec' || !Array.isArray(envelope.security?.redactionsApplied)) throw new Error('handoff.security invalido');
  if (envelope.warnings !== undefined && (!Array.isArray(envelope.warnings) || envelope.warnings.some((item) => !text(item)))) throw new Error('handoff.warnings invalido');
  return true;
}

function assertKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: debe ser objeto`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label}: propiedad no permitida ${key}`);
}

export function assessHandoff(envelope) {
  try { validateHandoffEnvelope(envelope); return { ready: Boolean(envelope.task.objective && envelope.context.nextStep), errors: [] }; }
  catch (error) { return { ready: false, errors: [String(error?.message || error)] }; }
}

export function acceptHandoff(envelope, seenMessageIds = new Set()) {
  validateHandoffEnvelope(envelope);
  if (seenMessageIds.has(envelope.messageId)) return { status: 'duplicate', messageId: envelope.messageId, sideEffects: false };
  seenMessageIds.add(envelope.messageId);
  return { status: 'accepted', messageId: envelope.messageId, sideEffects: false };
}

export function createAcknowledgement(envelope, status = 'accepted', reason = '') {
  validateHandoffEnvelope(envelope);
  if (!['accepted', 'duplicate', 'rejected'].includes(status)) throw new Error(`ack status invalido: ${status}`);
  return { protocol: HANDOFF_PROTOCOL, protocolVersion: HANDOFF_VERSION, messageId: `ack-${envelope.messageId}`, ackFor: envelope.messageId, status, reason: text(reason) };
}

async function main() {
  const args = process.argv.slice(2);
  const valueFor = (flag) => {
    const inline = args.find((arg) => arg.startsWith(`${flag}=`));
    if (inline) return inline.slice(flag.length + 1);
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : null;
  };
  const validatePath = valueFor('--validate');
  const inputPath = valueFor('--input');
  const outputPath = valueFor('--output');
  if (validatePath) {
    const envelope = JSON.parse(await fs.readFile(path.resolve(validatePath), 'utf8'));
    validateHandoffEnvelope(envelope);
    console.log(JSON.stringify({ valid: true, bytes: Buffer.byteLength(serializeHandoff(envelope)) }));
    return;
  }
  const input = inputPath ? JSON.parse(await fs.readFile(path.resolve(inputPath), 'utf8')) : {};
  const envelope = await prepareHandoffInput(input, { rootDir: process.cwd() });
  validateHandoffEnvelope(envelope);
  const serialized = `${serializeHandoff(envelope)}\n`;
  if (outputPath) await fs.writeFile(path.resolve(outputPath), serialized, 'utf8');
  console.log(JSON.stringify({ valid: true, messageId: envelope.messageId, bytes: Buffer.byteLength(serialized), output: outputPath || null }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(`[ia-handoff-envelope] ${String(error?.message || error)}`); process.exit(1); });
