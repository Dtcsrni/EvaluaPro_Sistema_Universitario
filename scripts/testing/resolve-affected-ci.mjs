import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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

const root = process.cwd();
const mapPath = path.resolve(root, 'ci', 'affected-test-map.json');
const config = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const baseRef = getArg('base', process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'HEAD~1');
const headRef = getArg('head', process.env.GITHUB_SHA || 'HEAD');
const changedFiles = getChangedFiles(baseRef, headRef);

const selectedGroups = [];
let escalation = 'affected';
const commands = new Set();

for (const [groupName, group] of Object.entries(config.groups || {})) {
  const patterns = Array.isArray(group.paths) ? group.paths.map(globToRegex) : [];
  const matched = changedFiles.some((file) => patterns.some((rx) => rx.test(file)));
  if (!matched) continue;
  selectedGroups.push(groupName);
  for (const command of group.commands || []) {
    commands.add(command);
  }
  if (group.escalate) {
    escalation = String(group.escalate);
  }
}

const result = {
  baseRef,
  headRef,
  changedFiles,
  selectedGroups,
  escalation,
  commands: Array.from(commands)
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
