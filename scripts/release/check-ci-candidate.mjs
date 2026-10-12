#!/usr/bin/env node
/**
 * check-ci-candidate
 *
 * Valida las ejecuciones CI asociadas a un SHA candidato concreto.
 */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function runGhJson(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`gh fallo (${args.join(' ')}): ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

export function selectLatestCandidateRun(runs, { candidateSha, branch = 'main', workflowName }) {
  const expectedSha = String(candidateSha || '').trim().toLowerCase();
  const expectedBranch = String(branch || '').trim();
  const expectedWorkflow = String(workflowName || '').trim();
  if (!/^[a-f0-9]{40}$/.test(expectedSha)) {
    return { ok: false, run: null, detail: 'SHA candidato ausente o inválido.' };
  }
  if (!expectedWorkflow) {
    return { ok: false, run: null, detail: 'Nombre de workflow esperado ausente.' };
  }

  const matching = (Array.isArray(runs) ? runs : [])
    .filter((run) =>
      String(run?.head_sha || '').trim().toLowerCase() === expectedSha &&
      String(run?.head_branch || '').trim() === expectedBranch &&
      String(run?.name || '').trim() === expectedWorkflow
    )
    .sort((left, right) => {
      const attemptDelta = Number(right?.run_attempt || 0) - Number(left?.run_attempt || 0);
      if (attemptDelta !== 0) return attemptDelta;
      return Date.parse(right?.updated_at || right?.created_at || 0) - Date.parse(left?.updated_at || left?.created_at || 0);
    });
  const run = matching[0] || null;
  if (!run) {
    return {
      ok: false,
      run: null,
      detail: `No existe ejecución de ${expectedWorkflow} para ${expectedBranch} en el SHA candidato ${expectedSha}.`
    };
  }

  const ok = String(run.status || '').toLowerCase() === 'completed' && String(run.conclusion || '').toLowerCase() === 'success';
  return {
    ok,
    run: {
      id: run.id,
      workflow: expectedWorkflow,
      branch: expectedBranch,
      sha: expectedSha,
      status: String(run.status || '').toLowerCase(),
      conclusion: String(run.conclusion || '').toLowerCase(),
      runAttempt: Number(run.run_attempt || 1),
      completedAt: String(run.updated_at || run.completed_at || '')
    },
    detail: ok
      ? `${expectedWorkflow} run=${run.id} success en ${expectedSha}.`
      : `${expectedWorkflow} run=${run.id} status=${run.status || 'unknown'} conclusion=${run.conclusion || 'pending'} para ${expectedSha}.`
  };
}

export function fetchCandidateWorkflowRuns(repo, branch, workflowFile, candidateSha) {
  const query = new URLSearchParams({ branch, head_sha: candidateSha, per_page: '30' });
  const response = runGhJson([
    'api',
    `repos/${repo}/actions/workflows/${workflowFile}/runs?${query.toString()}`
  ]);
  return Array.isArray(response?.workflow_runs) ? response.workflow_runs : [];
}

export function fetchWorkflowRun(repo, runId) {
  if (!/^\d+$/.test(String(runId || ''))) throw new Error('El identificador de CI Installer Windows es inválido.');
  return runGhJson(['api', `repos/${repo}/actions/runs/${runId}`]);
}

export function validateCiCandidate({ ciRuns, installerRun, candidateSha, branch = 'main' }) {
  const ci = selectLatestCandidateRun(ciRuns, { candidateSha, branch, workflowName: 'CI Checks' });
  const installer = selectLatestCandidateRun(installerRun ? [installerRun] : [], {
    candidateSha,
    branch,
    workflowName: 'CI Installer Windows'
  });
  return {
    ok: ci.ok && installer.ok,
    ci,
    installer
  };
}

export function main() {
  const args = new Map(process.argv.slice(2).map((arg) => {
    const separator = arg.indexOf('=');
    return separator < 0 ? [arg, ''] : [arg.slice(0, separator), arg.slice(separator + 1)];
  }));
  const get = (name, fallback = '') => args.get(`--${name}`) || fallback;
  const repo = get('repo', process.env.GITHUB_REPOSITORY || '');
  const candidateSha = get('candidate-sha', process.env.RELEASE_CANDIDATE_SHA || '').toLowerCase();
  const branch = get('branch', 'main');
  const workflow = get('workflow', 'ci.yml');
  const installerRunId = get('installer-run-id', process.env.RELEASE_INSTALLER_RUN_ID || '');
  if (!repo) throw new Error('Falta --repo=<owner/repo> o GITHUB_REPOSITORY.');
  if (!/^[a-f0-9]{40}$/.test(candidateSha)) throw new Error('Falta --candidate-sha con un SHA completo.');
  if (!/^\d+$/.test(installerRunId)) throw new Error('Falta --installer-run-id válido.');

  const ciRuns = fetchCandidateWorkflowRuns(repo, branch, workflow, candidateSha);
  const installerRun = fetchWorkflowRun(repo, installerRunId);
  const result = validateCiCandidate({ ciRuns, installerRun, candidateSha, branch });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[release:check-ci-candidate] ${String(error?.message || error)}\n`);
    process.exit(1);
  }
}
