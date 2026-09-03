#!/usr/bin/env node
/**
 * ai-caveman-status
 *
 * Responsabilidad: validar si la integracion repo-local de Caveman para Codex
 * esta presente y lista para usarse.
 * Limites: solo inspecciona archivos locales; no instala plugins ni modifica estado.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  return {
    json: argv.includes('--json')
  };
}

function parseHooksJson(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function hookHasExpectedCommand(hooks) {
  const sessionStart = hooks?.hooks?.SessionStart;
  if (!Array.isArray(sessionStart)) return false;
  return sessionStart.some((entry) =>
    String(entry?.matcher || '').includes('startup') &&
    String(entry?.matcher || '').includes('resume') &&
    Array.isArray(entry?.hooks) &&
    entry.hooks.some((hook) => hook?.type === 'command' && /scripts[\\/]ai-session-start\.mjs$/.test(String(hook.command || '')))
  );
}

async function hasCavemanPlugin(root) {
  const candidates = [
    process.env.CAVEMAN_PLUGIN_PATH,
    path.join(root, '.codex', 'skills', 'caveman', 'SKILL.md'),
    path.join(os.homedir(), '.codex', 'skills', 'caveman', 'SKILL.md')
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return true;
  }
  return false;
}

export async function checkCavemanIntegration(root = process.cwd()) {
  const codexDir = path.join(root, '.codex');
  const configPath = path.join(codexDir, 'config.toml');
  const hooksPath = path.join(codexDir, 'hooks.json');
  const [hasConfig, hasHooks, configText, hooksText, pluginInstalled] = await Promise.all([
    fileExists(configPath), fileExists(hooksPath), readTextSafe(configPath), readTextSafe(hooksPath), hasCavemanPlugin(root)
  ]);
  const hooks = parseHooksJson(hooksText);
  const configHasHooksFlag = /codex_hooks\s*=\s*true/i.test(configText);
  const hookValid = Boolean(hooks) && hookHasExpectedCommand(hooks);
  const configured = hasConfig && hasHooks && configHasHooksFlag;
  return {
    ready: configured && hookValid && pluginInstalled,
    repoReady: configured && hookValid,
    active: false,
    configured,
    hookValid,
    pluginInstalled,
    files: { configPath, hooksPath, hasConfig, hasHooks },
    checks: { configHasHooksFlag, hooksHasSessionStart: Boolean(hooks?.hooks?.SessionStart), hooksHasExpectedCommand: hookValid },
    usage: { activate: '$caveman', deactivate: 'stop caveman' },
    notes: [
      'repoReady valida la integracion local; ready requiere tambien el plugin instalado.',
      'active no puede demostrarse con inspeccion estatica; no se declara activo automaticamente.'
    ]
  };
}

async function readTextSafe(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const report = await checkCavemanIntegration(root);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`caveman.ready=${report.ready}`);
  console.log(`caveman.repoReady=${report.repoReady}`);
  console.log(`caveman.active=${report.active}`);
  console.log(`caveman.pluginInstalled=${report.pluginInstalled}`);
  console.log(`caveman.hasConfig=${report.files.hasConfig}`);
  console.log(`caveman.hasHooks=${report.files.hasHooks}`);
  console.log(`caveman.configHasHooksFlag=${report.checks.configHasHooksFlag}`);
  console.log(`caveman.hooksHasSessionStart=${report.checks.hooksHasSessionStart}`);
  console.log(`caveman.hooksHasExpectedCommand=${report.checks.hooksHasExpectedCommand}`);
  console.log(`usage.activate=${report.usage.activate}`);
  console.log(`usage.deactivate=${report.usage.deactivate}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[ai-caveman-status] error inesperado:', error);
    process.exit(1);
  });
}
