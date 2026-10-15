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
const AFFECTED_GATES = new Set([
  'flujo_docente_check', 'dataset_prodlike_check', 'omr_tv_extended_gate',
  'docente_alumno_e2e_check', 'global_grade_check', 'pdf_print_check',
  'classroom_audit_check', 'ux_visual_check', 'perf_check', 'perf_business_check',
  'clean_architecture_check', 'qa_manifest', 'dsr_flow_test', 'compliance_evidence'
]);
const JOB_FOR_GATE = {
  flujo_docente_check: 'ext_funcionales',
  dataset_prodlike_check: 'ext_funcionales',
  omr_tv_extended_gate: 'ext_funcionales',
  docente_alumno_e2e_check: 'ext_funcionales',
  global_grade_check: 'ext_funcionales',
  pdf_print_check: 'ext_funcionales',
  classroom_audit_check: 'ext_funcionales',
  ux_visual_check: 'ext_funcionales',
  perf_check: 'ext_perf_arquitectura',
  perf_business_check: 'ext_perf_arquitectura',
  clean_architecture_check: 'ext_perf_arquitectura',
  qa_manifest: 'ext_compliance_evidencia',
  dsr_flow_test: 'ext_compliance_evidencia',
  compliance_evidence: 'ext_compliance_evidencia'
};
const AFFECTED_GROUP_OUTPUTS = new Set(AFFECTED_GROUPS);
const CORE_JOBS_FOR_GROUP = {
  shared_core: ['core_contract_docs_gov', 'core_backend_portal', 'core_frontend', 'core_security_compliance'],
  backend: ['core_backend_portal', 'core_security_compliance'],
  frontend: ['core_frontend'],
  portal: ['core_backend_portal', 'core_security_compliance'],
  installer: ['core_contract_docs_gov'],
  release: ['core_contract_docs_gov'],
  docs: ['core_contract_docs_gov', 'core_security_compliance'],
  compliance: ['core_security_compliance']
};
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

  for (const group of AFFECTED_GROUP_OUTPUTS) {
    if (outputs[group] !== 'true' && outputs[group] !== 'false') {
      failures.push(`El plan no contiene un booleano válido para el grupo ${group}.`);
      continue;
    }
    if (outputs[group] === 'true') {
      for (const job of CORE_JOBS_FOR_GROUP[group] || []) {
        if (outputs[`job_${job}`] === 'false') {
          failures.push(`El plan selecciona el grupo ${group}, pero job_${job} está marcado como no requerido.`);
        }
      }
    }
  }
  for (const gate of AFFECTED_GATES) {
    const selected = outputs[`gate_${gate}`];
    if (selected !== 'true' && selected !== 'false') {
      failures.push(`El plan no contiene un booleano válido para gate_${gate}.`);
      continue;
    }
    const job = JOB_FOR_GATE[gate];
    if (selected === 'true' && outputs[`job_${job}`] === 'false' && outputs.escalation !== 'full-extended') {
      failures.push(`El plan marca gate_${gate} como requerido, pero job_${job} como no requerido.`);
    }
  }

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
    matchedGroups: Object.fromEntries([...AFFECTED_GROUP_OUTPUTS]
      .filter((key) => outputs[key] === 'true' || outputs[key] === 'false')
      .map((key) => [key, outputs[key]])),
    matchedGates: Object.fromEntries([...AFFECTED_GATES]
      .filter((key) => outputs[`gate_${key}`] === 'true' || outputs[`gate_${key}`] === 'false')
      .map((key) => [key, outputs[`gate_${key}`]])),
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
