#!/usr/bin/env node
/**
 * check-ci-streak
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * check-ci-streak
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function runGhJson(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`gh fallo (${args.join(' ')}): ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

export function countSuccessfulStreak(runs = []) {
  let streak = 0;
  for (const run of runs) {
    const conclusion = String(run?.conclusion || '').toLowerCase();
    if (conclusion === 'success') {
      streak += 1;
      continue;
    }
    if (['cancelled', 'skipped', 'neutral'].includes(conclusion)) {
      continue;
    }
    break;
  }
  return streak;
}

export function evaluateStreak(runs = [], required = 10) {
  const streak = countSuccessfulStreak(runs);
  return {
    streak,
    required,
    ok: streak >= required
  };
}

function loadRunsFromFixture(fixturePath) {
  const resolved = path.resolve(process.cwd(), fixturePath);
  const raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.workflow_runs)) return raw.workflow_runs;
  throw new Error('Fixture invalido: se esperaba array o { workflow_runs: [...] }');
}

export function fetchRunsFromGitHub(repo, branch, workflowFile, perPage) {
  const response = runGhJson([
    'api',
    `repos/${repo}/actions/workflows/${workflowFile}/runs?branch=${encodeURIComponent(branch)}&status=completed&per_page=${perPage}`
  ]);
  return Array.isArray(response?.workflow_runs) ? response.workflow_runs : [];
}

export async function main() {
  const required = Number(getArg('required', process.env.CI_STREAK_REQUIRED || '10'));
  const branch = getArg('branch', process.env.CI_STREAK_BRANCH || 'main');
  const workflowFile = getArg('workflow', process.env.CI_STREAK_WORKFLOW || 'ci.yml');
  const repo = getArg('repo', process.env.GITHUB_REPOSITORY || '');
  const fixture = getArg('runs-fixture', process.env.CI_STREAK_RUNS_FIXTURE || '');
  const perPage = Math.max(required + 5, 30);

  let runs;
  if (fixture) {
    runs = loadRunsFromFixture(fixture);
  } else {
    if (!repo) throw new Error('Falta --repo=<owner/repo> o GITHUB_REPOSITORY');
    runs = fetchRunsFromGitHub(repo, branch, workflowFile, perPage);
  }

  const verdict = evaluateStreak(runs, required);
  const line = `[release:ci-streak] branch=${branch} workflow=${workflowFile} streak=${verdict.streak}/${required}`;
  if (!verdict.ok) {
    process.stderr.write(`${line} -> FAIL\n`);
    process.exit(1);
  }

  process.stdout.write(`${line} -> OK\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[release:ci-streak] ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
