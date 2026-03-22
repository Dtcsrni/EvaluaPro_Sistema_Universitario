/**
 * ia-traceability
 *
 * Responsabilidad: Normalizar, validar y renderizar la trazabilidad canonica de sesiones IA.
 * Limites: Mantener el contrato agnostico a proveedor/version sin exponer prompts completos ni salidas crudas extensas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRootDir = path.resolve(__dirname, '..');

export const TRACE_SCHEMA_VERSION = '1.0.0';
export const TRACE_STATUSES = new Set(['draft', 'final']);
export const TRACE_ACTION_STATUSES = new Set(['pending', 'ok', 'falla', 'omitido']);
export const TRACE_COMMAND_STATUSES = new Set(['ok', 'falla', 'omitido']);
export const UNKNOWN_VALUE = 'unknown';
export const PENDING_TEXT = 'Pendiente de completar por el agente.';

export function getTraceSchemaPath(rootDir = defaultRootDir) {
  return path.join(rootDir, 'docs', 'handoff', 'trace.schema.json');
}

export function loadTraceSchema(rootDir = defaultRootDir) {
  return JSON.parse(fs.readFileSync(getTraceSchemaPath(rootDir), 'utf8'));
}

export function validateTraceSchemaDefinition(schema) {
  assertPlainObject(schema, 'trace.schema.json');
  assertEqualValue(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', 'trace.schema.json.$schema');
  assertEqualValue(schema.type, 'object', 'trace.schema.json.type');
  assertEqualValue(schema.title, 'EvaluaPro IA Trace Session', 'trace.schema.json.title');
  assertArrayIncludes(schema.required, 'traceSchemaVersion', 'trace.schema.json.required');
  assertArrayIncludes(schema.required, 'sessionId', 'trace.schema.json.required');
  assertArrayIncludes(schema.required, 'agent', 'trace.schema.json.required');
  assertArrayIncludes(schema.required, 'commands', 'trace.schema.json.required');
  assertArrayIncludes(schema.required, 'nextStep', 'trace.schema.json.required');
  return true;
}

export function listTraceabilityContractTargets(rootDir = defaultRootDir) {
  const targets = [
    path.join(rootDir, 'docs', 'handoff', 'trace.schema.json'),
    path.join(rootDir, 'docs', 'handoff', 'CONTRATO_TRAZABILIDAD_IA.md'),
    path.join(rootDir, 'docs', 'handoff', 'PLANTILLA_HANDOFF_IA.md'),
    path.join(rootDir, 'scripts', 'ia-traceability.mjs'),
    path.join(rootDir, 'scripts', 'ia-handoff.mjs')
  ];
  return targets.map((item) => path.resolve(item));
}

export function validateTraceabilityContractFiles(rootDir = defaultRootDir) {
  const targets = listTraceabilityContractTargets(rootDir);
  for (const target of targets) {
    if (!fs.existsSync(target)) {
      throw new Error(`Falta archivo de contrato IA: ${target}`);
    }
  }
  return targets;
}

export function normalizeTraceInput(input, context = {}) {
  const nowIso = normalizeIsoTimestamp(context.nowIso || new Date().toISOString());
  const validationProfile = context.validationProfile === 'full' ? 'full' : 'quick';
  const sessionId = normalizeSessionId(context.sessionId || input?.sessionId || `sesion-${nowIso.replaceAll(':', '-')}`);
  const outputs = normalizeStringArray(context.outputs);
  const repoContext = normalizeRepoContext(input?.repo, context.repo);
  const files = normalizeFiles(input?.files, {
    changed: context.changedFiles,
    artifacts: outputs
  });
  const commands = normalizeCommands(input?.commands, context.commands, nowIso);
  const actions = normalizeActions(input?.actions, commands, nowIso);
  const objective = normalizeTextField(input?.objective, PENDING_TEXT);
  const requestSummary = normalizeTextField(input?.request?.summary, PENDING_TEXT);
  const scope = normalizeStringArray(input?.scope);
  const constraints = normalizeStringArray(input?.constraints);
  const decisions = normalizeStringArray(input?.decisions);
  const assumptions = normalizeStringArray(input?.assumptions);
  const risks = normalizeStringArray(input?.risks);
  const nextStep = normalizeTextField(input?.nextStep, PENDING_TEXT);
  const pendingFields = inferPendingFields({
    requestSummary,
    objective,
    scope,
    commands,
    decisions,
    risks,
    nextStep
  });

  const trace = {
    traceSchemaVersion: TRACE_SCHEMA_VERSION,
    sessionId,
    status: pendingFields.length === 0 ? 'final' : 'draft',
    generatedAt: nowIso,
    validationProfile,
    agent: normalizeAgent(input?.agent),
    request: {
      summary: requestSummary
    },
    objective,
    scope,
    constraints,
    actions,
    files,
    commands,
    decisions,
    assumptions,
    risks,
    nextStep,
    completion: {
      isComplete: pendingFields.length === 0,
      pendingFields
    },
    repo: repoContext
  };

  const parentSessionId = normalizeOptionalText(input?.parentSessionId);
  if (parentSessionId) {
    trace.parentSessionId = parentSessionId;
  }

  return trace;
}

export function validateTraceDocument(trace, options = {}) {
  const allowDraft = options.allowDraft !== false;
  const requireRepo = options.requireRepo === true;
  assertPlainObject(trace, 'trace');
  assertEqualValue(trace.traceSchemaVersion, TRACE_SCHEMA_VERSION, 'trace.traceSchemaVersion');
  assertNonEmptyString(trace.sessionId, 'trace.sessionId');
  assertSetValue(TRACE_STATUSES, trace.status, 'trace.status');
  if (trace.parentSessionId !== undefined) {
    assertNonEmptyString(trace.parentSessionId, 'trace.parentSessionId');
  }
  if (!allowDraft && trace.status !== 'final') {
    throw new Error('trace.status: se esperaba final');
  }
  assertDateTime(trace.generatedAt, 'trace.generatedAt');
  assertSetValue(new Set(['quick', 'full']), trace.validationProfile, 'trace.validationProfile');

  assertPlainObject(trace.agent, 'trace.agent');
  assertNonEmptyString(trace.agent.name, 'trace.agent.name');
  assertNonEmptyString(trace.agent.version, 'trace.agent.version');
  assertNonEmptyString(trace.agent.provider, 'trace.agent.provider');
  assertNonEmptyString(trace.agent.kind, 'trace.agent.kind');
  assertNonEmptyString(trace.agent.channel, 'trace.agent.channel');

  assertPlainObject(trace.request, 'trace.request');
  assertNonEmptyString(trace.request.summary, 'trace.request.summary');
  assertNonEmptyString(trace.objective, 'trace.objective');
  assertStringArray(trace.scope, 'trace.scope');
  assertStringArray(trace.constraints, 'trace.constraints');

  if (!Array.isArray(trace.actions)) {
    throw new Error('trace.actions: debe ser arreglo');
  }
  for (const [index, action] of trace.actions.entries()) {
    assertPlainObject(action, `trace.actions[${index}]`);
    assertNonEmptyString(action.type, `trace.actions[${index}].type`);
    assertNonEmptyString(action.summary, `trace.actions[${index}].summary`);
    assertDateTime(action.timestamp, `trace.actions[${index}].timestamp`);
    assertSetValue(TRACE_ACTION_STATUSES, action.status, `trace.actions[${index}].status`);
  }

  assertPlainObject(trace.files, 'trace.files');
  assertStringArray(trace.files.read, 'trace.files.read');
  assertStringArray(trace.files.changed, 'trace.files.changed');
  assertStringArray(trace.files.artifacts, 'trace.files.artifacts');

  if (!Array.isArray(trace.commands)) {
    throw new Error('trace.commands: debe ser arreglo');
  }
  for (const [index, command] of trace.commands.entries()) {
    assertPlainObject(command, `trace.commands[${index}]`);
    assertNonEmptyString(command.name, `trace.commands[${index}].name`);
    assertNonEmptyString(command.command, `trace.commands[${index}].command`);
    assertSetValue(TRACE_COMMAND_STATUSES, command.status, `trace.commands[${index}].status`);
    if (!(command.exitCode === null || Number.isInteger(command.exitCode))) {
      throw new Error(`trace.commands[${index}].exitCode: debe ser entero o null`);
    }
    if (!Number.isInteger(command.durationMs) || command.durationMs < 0) {
      throw new Error(`trace.commands[${index}].durationMs: debe ser entero >= 0`);
    }
    if (typeof command.resultSummary !== 'string') {
      throw new Error(`trace.commands[${index}].resultSummary: debe ser string`);
    }
  }

  assertStringArray(trace.decisions, 'trace.decisions');
  assertStringArray(trace.assumptions, 'trace.assumptions');
  assertStringArray(trace.risks, 'trace.risks');
  assertNonEmptyString(trace.nextStep, 'trace.nextStep');

  if (trace.completion !== undefined) {
    assertPlainObject(trace.completion, 'trace.completion');
    if (typeof trace.completion.isComplete !== 'boolean') {
      throw new Error('trace.completion.isComplete: debe ser boolean');
    }
    assertStringArray(trace.completion.pendingFields, 'trace.completion.pendingFields');
  }

  if (trace.repo !== undefined) {
    assertPlainObject(trace.repo, 'trace.repo');
    assertNonEmptyString(trace.repo.rootDir, 'trace.repo.rootDir');
    assertNonEmptyString(trace.repo.branch, 'trace.repo.branch');
    assertNonEmptyString(trace.repo.commit, 'trace.repo.commit');
    if (typeof trace.repo.workingTreeStatus !== 'string') {
      throw new Error('trace.repo.workingTreeStatus: debe ser string');
    }
  } else if (requireRepo) {
    throw new Error('trace.repo: requerido');
  }

  if (trace.status === 'final') {
    const pendingFields = inferPendingFields({
      requestSummary: trace.request.summary,
      objective: trace.objective,
      scope: trace.scope,
      commands: trace.commands,
      decisions: trace.decisions,
      risks: trace.risks,
      nextStep: trace.nextStep
    });
    if (pendingFields.length > 0) {
      throw new Error(`trace.status final invalido; faltan campos: ${pendingFields.join(', ')}`);
    }
  }

  return true;
}

export function renderTraceMarkdown(trace) {
  validateTraceDocument(trace);
  const treeStatus = trace.repo?.workingTreeStatus?.trim() ? trace.repo.workingTreeStatus : '_arbol limpio_';
  const actions = trace.actions.length > 0
    ? trace.actions.map((action) => `- [${action.status}] ${action.type}: ${action.summary} (${action.timestamp})`).join('\n')
    : '- Sin acciones registradas.';
  const fileLines = renderStringList(trace.files.read, 'Sin lecturas registradas.');
  const changedLines = renderStringList(trace.files.changed, 'Sin cambios detectados.');
  const artifactLines = renderStringList(trace.files.artifacts, 'Sin artefactos generados.');
  const scopeLines = renderStringList(trace.scope, 'Sin alcance declarado.');
  const constraintLines = renderStringList(trace.constraints, 'Sin restricciones declaradas.');
  const decisionLines = renderStringList(trace.decisions, 'Sin decisiones registradas.');
  const assumptionLines = renderStringList(trace.assumptions, 'Sin supuestos declarados.');
  const riskLines = renderStringList(trace.risks, 'Sin riesgos abiertos.');
  const commandLines = trace.commands.length > 0
    ? trace.commands
        .map(
          (command) =>
            `- ${command.name}: \`${command.command}\` -> ${command.status} (exitCode=${command.exitCode ?? '-'}, duracionMs=${command.durationMs})\n  resultado: ${command.resultSummary || '(sin resumen)'}`
        )
        .join('\n')
    : '- Sin comandos registrados.';
  const pendingLines = trace.completion?.pendingFields?.length
    ? renderStringList(trace.completion.pendingFields)
    : '- Sin pendientes semanticos.';

  return [
    '# Handoff IA - Sesion',
    '',
    `- traceSchemaVersion: ${trace.traceSchemaVersion}`,
    `- sessionId: ${trace.sessionId}`,
    `- parentSessionId: ${trace.parentSessionId || '-'}`,
    `- status: ${trace.status}`,
    `- generatedAt: ${trace.generatedAt}`,
    `- validationProfile: ${trace.validationProfile}`,
    '',
    '## Agente',
    `- name: ${trace.agent.name}`,
    `- version: ${trace.agent.version}`,
    `- provider: ${trace.agent.provider}`,
    `- kind: ${trace.agent.kind}`,
    `- channel: ${trace.agent.channel}`,
    '',
    '## Solicitud',
    `- ${trace.request.summary}`,
    '',
    '## Objetivo',
    `- ${trace.objective}`,
    '',
    '## Alcance',
    scopeLines,
    '',
    '## Restricciones',
    constraintLines,
    '',
    '## Acciones',
    actions,
    '',
    '## Archivos leidos',
    fileLines,
    '',
    '## Archivos cambiados',
    changedLines,
    '',
    '## Validacion ejecutada',
    commandLines,
    '',
    '## Decisiones',
    decisionLines,
    '',
    '## Supuestos',
    assumptionLines,
    '',
    '## Riesgos abiertos',
    riskLines,
    '',
    '## Estado del arbol',
    treeStatus.startsWith('_')
      ? treeStatus
      : ['```txt', treeStatus, '```'].join('\n'),
    '',
    '## Siguiente paso recomendado',
    `- ${trace.nextStep}`,
    '',
    '## Artefactos generados',
    artifactLines,
    '',
    '## Completitud semantica',
    `- isComplete: ${trace.completion?.isComplete === true ? 'true' : 'false'}`,
    pendingLines
  ].join('\n');
}

function normalizeAgent(agent) {
  const data = isPlainObject(agent) ? agent : {};
  return {
    name: normalizeTextField(data.name, UNKNOWN_VALUE),
    version: normalizeTextField(data.version, UNKNOWN_VALUE),
    provider: normalizeTextField(data.provider, UNKNOWN_VALUE),
    kind: normalizeTextField(data.kind, UNKNOWN_VALUE),
    channel: normalizeTextField(data.channel, UNKNOWN_VALUE)
  };
}

function normalizeRepoContext(inputRepo, repoContext) {
  const candidate = isPlainObject(inputRepo) ? inputRepo : {};
  const runtimeRepo = isPlainObject(repoContext) ? repoContext : {};
  return {
    rootDir: normalizeTextField(candidate.rootDir || runtimeRepo.rootDir || defaultRootDir, defaultRootDir),
    branch: normalizeTextField(candidate.branch || runtimeRepo.branch || UNKNOWN_VALUE, UNKNOWN_VALUE),
    commit: normalizeTextField(candidate.commit || runtimeRepo.commit || UNKNOWN_VALUE, UNKNOWN_VALUE),
    workingTreeStatus: normalizeMultilineText(candidate.workingTreeStatus || runtimeRepo.workingTreeStatus || '')
  };
}

function normalizeFiles(inputFiles, runtimeFiles) {
  const files = isPlainObject(inputFiles) ? inputFiles : {};
  const runtime = isPlainObject(runtimeFiles) ? runtimeFiles : {};
  return {
    read: normalizeStringArray(files.read),
    changed: normalizeStringArray(files.changed, normalizeStringArray(runtime.changed)),
    artifacts: normalizeStringArray(files.artifacts, normalizeStringArray(runtime.artifacts))
  };
}

function normalizeCommands(inputCommands, runtimeCommands, fallbackTimestamp) {
  const preferred = Array.isArray(inputCommands) && inputCommands.length > 0 ? inputCommands : runtimeCommands;
  if (!Array.isArray(preferred)) {
    return [];
  }
  return preferred.map((command, index) => {
    const item = isPlainObject(command) ? command : {};
    const status = TRACE_COMMAND_STATUSES.has(item.status) ? item.status : 'omitido';
    return {
      name: normalizeTextField(item.name || `command_${index + 1}`, `command_${index + 1}`),
      command: normalizeTextField(item.command, 'sin comando declarado'),
      status,
      exitCode: Number.isInteger(item.exitCode) ? item.exitCode : item.exitCode === null ? null : status === 'omitido' ? null : Number.isFinite(Number(item.exitCode)) ? Number(item.exitCode) : 0,
      durationMs: Number.isFinite(Number(item.durationMs)) && Number(item.durationMs) >= 0 ? Math.round(Number(item.durationMs)) : 0,
      resultSummary: normalizeFreeText(item.resultSummary || item.salida || ''),
      timestamp: normalizeIsoTimestamp(item.timestamp || fallbackTimestamp)
    };
  });
}

function normalizeActions(inputActions, commands, fallbackTimestamp) {
  const manual = Array.isArray(inputActions) ? inputActions : [];
  const normalizedManual = manual.map((action, index) => {
    const item = isPlainObject(action) ? action : {};
    return {
      type: normalizeTextField(item.type, `accion_${index + 1}`),
      summary: normalizeTextField(item.summary, PENDING_TEXT),
      timestamp: normalizeIsoTimestamp(item.timestamp || fallbackTimestamp),
      status: TRACE_ACTION_STATUSES.has(item.status) ? item.status : 'pending'
    };
  });
  if (normalizedManual.length > 0) {
    return normalizedManual;
  }
  return commands.map((command) => ({
    type: 'validation',
    summary: `Ejecucion de ${command.name}`,
    timestamp: command.timestamp || fallbackTimestamp,
    status: command.status
  }));
}

function inferPendingFields({ requestSummary, objective, scope, commands, decisions, risks, nextStep }) {
  const pending = [];
  if (isPendingText(requestSummary)) pending.push('request.summary');
  if (isPendingText(objective)) pending.push('objective');
  if (!Array.isArray(scope) || scope.length === 0) pending.push('scope');
  if (!Array.isArray(commands) || commands.length === 0) pending.push('commands');
  if (!Array.isArray(decisions) || decisions.length === 0) pending.push('decisions');
  if (!Array.isArray(risks) || risks.length === 0) pending.push('risks');
  if (isPendingText(nextStep)) pending.push('nextStep');
  return pending;
}

function normalizeSessionId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '') || `sesion-${Date.now()}`;
}

function normalizeTextField(value, fallback) {
  const text = normalizeFreeText(value);
  return text || fallback;
}

function normalizeOptionalText(value) {
  const text = normalizeFreeText(value);
  return text || undefined;
}

function normalizeFreeText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function normalizeMultilineText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, array) => line.trim() || index < array.length - 1)
    .join('\n')
    .trim();
}

function normalizeStringArray(value, fallback = []) {
  const source = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [];
  return source
    .map((item) => normalizeFreeText(String(item ?? '')))
    .filter(Boolean);
}

function normalizeIsoTimestamp(value) {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : new Date().toISOString();
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function renderStringList(items, fallback = 'Sin elementos.') {
  if (!Array.isArray(items) || items.length === 0) {
    return `- ${fallback}`;
  }
  return items.map((item) => `- ${item}`).join('\n');
}

function isPendingText(value) {
  return !value || value === PENDING_TEXT;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) {
    throw new Error(`${label}: debe ser objeto`);
  }
}

function assertEqualValue(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: se esperaba ${expected}`);
  }
}

function assertArrayIncludes(value, expected, label) {
  if (!Array.isArray(value) || !value.includes(expected)) {
    throw new Error(`${label}: falta ${expected}`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}: debe ser string no vacio`);
  }
}

function assertStringArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label}: debe ser arreglo`);
  }
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string' || !item.trim()) {
      throw new Error(`${label}[${index}]: debe ser string no vacio`);
    }
  }
}

function assertSetValue(allowed, value, label) {
  if (!allowed.has(value)) {
    throw new Error(`${label}: valor invalido ${String(value)}`);
  }
}

function assertDateTime(value, label) {
  assertNonEmptyString(value, label);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label}: fecha invalida`);
  }
}
