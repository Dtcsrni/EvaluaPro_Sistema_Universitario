#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ESCALATION_WEIGHT = {
  affected: 0,
  'full-core': 1,
  'full-extended': 2
};

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function globToRegex(glob) {
  const escaped = String(glob)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function sanitizeOutputKey(prefix, key) {
  return `${prefix}_${String(key).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
}

function readConfig(root = process.cwd()) {
  const mapPath = path.resolve(root, 'ci', 'affected-test-map.json');
  return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
}

function runGit(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
}

function getChangedFiles(baseRef, headRef) {
  try {
    const output = runGit(['diff', '--name-only', `${baseRef}...${headRef}`]);
    return output.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  } catch {
    const output = runGit(['diff', '--name-only', `${baseRef}..${headRef}`]);
    return output.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }
}

function maxEscalation(left, right) {
  const leftValue = ESCALATION_WEIGHT[left] ?? ESCALATION_WEIGHT.affected;
  const rightValue = ESCALATION_WEIGHT[right] ?? ESCALATION_WEIGHT.affected;
  return leftValue >= rightValue ? left : right;
}

function matchPaths(paths, changedFiles) {
  const patterns = Array.isArray(paths) ? paths.map(globToRegex) : [];
  return changedFiles.some((file) => patterns.some((rx) => rx.test(file)));
}

export function evaluateAffectedChangeSet(config, changedFiles) {
  const matchedGroups = {};
  const selectedGroups = [];
  let escalation = 'affected';
  const commands = new Set();

  for (const [groupName, group] of Object.entries(config.groups || {})) {
    const matched = matchPaths(group.paths, changedFiles);
    matchedGroups[groupName] = matched;
    if (!matched) continue;
    selectedGroups.push(groupName);
    for (const command of group.commands || []) {
      commands.add(command);
    }
    escalation = maxEscalation(escalation, String(group.escalate || 'affected'));
  }

  const matchedGates = {};
  const selectedGates = [];
  for (const [gateName, gate] of Object.entries(config.gates || {})) {
    const groups = Array.isArray(gate.groups) ? gate.groups : [];
    const matched = groups.some((groupName) => matchedGroups[groupName] === true);
    matchedGates[gateName] = matched;
    if (matched) {
      selectedGates.push(gateName);
    }
  }

  const matchedJobs = {};
  const selectedJobs = [];
  for (const [jobName, job] of Object.entries(config.jobs || {})) {
    const groups = Array.isArray(job.groups) ? job.groups : [];
    const gates = Array.isArray(job.gates) ? job.gates : [];
    const matched =
      groups.some((groupName) => matchedGroups[groupName] === true) ||
      gates.some((gateName) => matchedGates[gateName] === true);
    matchedJobs[jobName] = matched;
    if (matched) {
      selectedJobs.push(jobName);
    }
  }

  return {
    changedFiles,
    selectedGroups,
    selectedGates,
    selectedJobs,
    matchedGroups,
    matchedGates,
    matchedJobs,
    escalation,
    commands: Array.from(commands)
  };
}

function appendGitHubOutputs(filePath, result) {
  if (!filePath) return;
  const lines = [
    `escalation=${result.escalation}`,
    `selected_groups_csv=${result.selectedGroups.join(',')}`,
    `selected_gates_csv=${result.selectedGates.join(',')}`,
    `selected_jobs_csv=${result.selectedJobs.join(',')}`,
    `changed_files_count=${result.changedFiles.length}`
  ];

  for (const [name, matched] of Object.entries(result.matchedGroups || {})) {
    lines.push(`${sanitizeOutputKey('group', name)}=${matched}`);
  }
  for (const [name, matched] of Object.entries(result.matchedGates || {})) {
    lines.push(`${sanitizeOutputKey('gate', name)}=${matched}`);
  }
  for (const [name, matched] of Object.entries(result.matchedJobs || {})) {
    lines.push(`${sanitizeOutputKey('job', name)}=${matched}`);
  }

  fs.appendFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

export function resolveAffectedFromGit(options = {}) {
  const root = options.root || process.cwd();
  const config = options.config || readConfig(root);
  const baseRef = options.baseRef || getArg('base', process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'HEAD~1');
  const headRef = options.headRef || getArg('head', process.env.GITHUB_SHA || 'HEAD');
  const changedFiles = options.changedFiles || getChangedFiles(baseRef, headRef);
  const result = evaluateAffectedChangeSet(config, changedFiles);
  return {
    baseRef,
    headRef,
    ...result
  };
}

function main() {
  const githubOutput = getArg('github-output', process.env.GITHUB_OUTPUT || '');
  const result = resolveAffectedFromGit();
  appendGitHubOutputs(githubOutput, result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[affected-ci] ${String(error?.message || error)}\n`);
    process.exit(1);
  }
}
