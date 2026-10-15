#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const JOBS_BY_MODE = {
  core: [
    ['core_contract_docs_gov', 'job_core_contract_docs_gov'],
    ['core_backend_portal', 'job_core_backend_portal'],
    ['core_frontend', 'job_core_frontend'],
    ['core_security_compliance', 'job_core_security_compliance']
  ],
  extended: [
    ['ext_funcionales', 'job_ext_funcionales'],
    ['ext_perf_arquitectura', 'job_ext_perf_arquitectura'],
    ['ext_compliance_evidencia', 'job_ext_compliance_evidencia']
  ]
};
const AFFECTED_GROUPS = new Set(['shared_core', 'backend', 'frontend', 'portal', 'installer', 'release', 'docs', 'compliance']);
const VALID_ESCALATIONS = new Set(['affected', 'full-core', 'full-extended']);

function parseJsonEnv(name) {
  const raw = process.env[name];
  if (!raw) throw new Error(`Falta la variable ${name}.`);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} no contiene JSON válido: ${String(error?.message || error)}`);
  }
}

export function buildGateSummary({ mode, eventName, forceFull = false, sha, needs }) {
  const jobs = JOBS_BY_MODE[mode];
  if (!jobs) throw new Error(`Modo de gate desconocido: ${mode}`);
  if (!needs || typeof needs !== 'object') throw new TypeError('needs debe ser un objeto.');

  const detector = needs.detectar_cambios;
  const outputs = detector?.outputs ?? {};
  const fullRun = eventName === 'schedule' || (eventName === 'workflow_dispatch' && forceFull === true);
  const requiredJobs = {};
  const jobResults = {};
  const failures = [];

  if (detector?.result !== 'success') {
    failures.push(`El detector de cambios terminó con ${detector?.result ?? 'estado ausente'}.`);
  }
  if (!VALID_ESCALATIONS.has(outputs.escalation)) failures.push('El plan no contiene una escalación válida.');

  const escalationRequiresAllJobs = mode === 'core'
    ? outputs.escalation === 'full-core' || outputs.escalation === 'full-extended'
    : outputs.escalation === 'full-extended';

  if (mode === 'extended') {
    const coreResult = needs.verificaciones_core?.result ?? 'missing';
    if (coreResult !== 'success') failures.push(`El gate Core terminó con ${coreResult}.`);
  }

  for (const [jobId, outputName] of jobs) {
    const selected = outputs[outputName];
    if (selected !== 'true' && selected !== 'false') {
      failures.push(`El plan no contiene un booleano válido para ${outputName}.`);
    }

    const required = fullRun || escalationRequiresAllJobs || selected === 'true';
    const result = needs[jobId]?.result ?? 'missing';
    requiredJobs[jobId] = required;
    jobResults[jobId] = result;

    if (required && result !== 'success') {
      failures.push(`El job requerido ${jobId} terminó con ${result}.`);
    } else if (!required && result !== 'success' && result !== 'skipped') {
      failures.push(`El job no requerido ${jobId} terminó con ${result}.`);
    }
  }

  return {
    schemaVersion: 1,
    mode,
    event: eventName || 'unknown',
    sha: sha || 'unknown',
    fullRun,
    escalation: outputs.escalation || 'unknown',
    matchedGroups: Object.fromEntries(Object.entries(outputs).filter(([key]) => AFFECTED_GROUPS.has(key) || key.startsWith('group_'))),
    matchedGates: Object.fromEntries(Object.entries(outputs).filter(([key]) => key.startsWith('gate_'))),
    detector: detector?.result ?? 'missing',
    ...(mode === 'extended' ? { coreGate: needs.verificaciones_core?.result ?? 'missing' } : {}),
    requiredJobs,
    jobResults,
    decision: failures.length === 0 ? 'success' : 'failure',
    failures
  };
}

function getArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((argument) => argument.startsWith(prefix));
  return found?.slice(prefix.length);
}

function main() {
  const mode = getArg('mode');
  const reportPath = getArg('report');
  if (!reportPath) throw new Error('Falta --report=<ruta>.');

  const summary = buildGateSummary({
    mode,
    eventName: process.env.CI_GATE_EVENT,
    forceFull: process.env.CI_GATE_FORCE_FULL === 'true',
    sha: process.env.CI_GATE_SHA,
    needs: parseJsonEnv('CI_GATE_NEEDS_JSON')
  });
  const absoluteReportPath = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(absoluteReportPath), { recursive: true });
  fs.writeFileSync(absoluteReportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.decision !== 'success') process.exitCode = 1;
}

export { JOBS_BY_MODE };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[ci-gate-summary] ${String(error?.message || error)}\n`);
    process.exitCode = 1;
  }
}
