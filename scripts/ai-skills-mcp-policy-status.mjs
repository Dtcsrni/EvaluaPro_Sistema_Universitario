#!/usr/bin/env node
/**
 * ai-skills-mcp-policy-status
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * ai-skills-mcp-policy-status
 *
 * Responsabilidad: validar la politica repo-local/global de skills y MCP para EvaluaPro.
 * Limites: solo inspecciona configuracion/archivos; no instala ni corrige estado.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  return { json: argv.includes('--json') };
}

async function readTextSafe(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function pluginEnabled(configText, pluginId) {
  const escaped = pluginId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    String.raw`\[plugins\."${escaped}"\]\s*(?:\r?\n[^\[]*)?enabled\s*=\s*true`,
    'i'
  );
  return pattern.test(configText);
}

function pluginDisabled(configText, pluginId) {
  const escaped = pluginId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    String.raw`\[plugins\."${escaped}"\]\s*(?:\r?\n[^\[]*)?enabled\s*=\s*false`,
    'i'
  );
  return pattern.test(configText);
}

function inspectRepo({ configText, hooksText, policyExists, scriptExists }) {
  const checks = {
    hasPolicyDoc: policyExists,
    hasVerifierScript: scriptExists,
    hasSerenaMcp: /\[mcp_servers\.serena\]/i.test(configText),
    hasCodexHooks: /codex_hooks\s*=\s*true/i.test(configText),
    hasCavemanHook: /caveman/i.test(hooksText),
    hasSerenaHook: /SERENA REQUIRED ALWAYS/i.test(hooksText)
  };
  return {
    ready: Object.values(checks).every(Boolean),
    checks
  };
}

function inspectGlobal({ configText, hooksText }) {
  const requiredPlugins = {
    github: 'github@openai-curated',
    browser: 'browser@openai-bundled',
    codexSecurity: 'codex-security@openai-curated',
    superpowers: 'superpowers@openai-curated',
    googleDrive: 'google-drive@openai-curated',
    cloudflare: 'cloudflare@openai-curated',
    documents: 'documents@openai-primary-runtime',
    spreadsheets: 'spreadsheets@openai-primary-runtime',
    presentations: 'presentations@openai-primary-runtime'
  };

  const checks = {
    hasSerenaMcp: /\[mcp_servers\.serena\]/i.test(configText),
    hasGlobalSerenaHook: /SERENA GLOBAL POLICY \(REQUIRED ALWAYS\)/i.test(hooksText),
    requiredPlugins: Object.fromEntries(
      Object.entries(requiredPlugins).map(([name, pluginId]) => [name, pluginEnabled(configText, pluginId)])
    ),
    discouragedPlugins: {
      figmaEnabled: pluginEnabled(configText, 'figma@openai-curated'),
      figmaDisabled: pluginDisabled(configText, 'figma@openai-curated'),
      canvaEnabled: pluginEnabled(configText, 'canva@openai-curated'),
      canvaDisabled: pluginDisabled(configText, 'canva@openai-curated')
    }
  };

  const requiredReady =
    checks.hasSerenaMcp &&
    checks.hasGlobalSerenaHook &&
    Object.values(checks.requiredPlugins).every(Boolean);
  const discouragedEnabled =
    checks.discouragedPlugins.figmaEnabled || checks.discouragedPlugins.canvaEnabled;

  return {
    ready: requiredReady && !discouragedEnabled,
    requiredReady,
    discouragedEnabled,
    checks
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const repoConfigPath = path.join(root, '.codex', 'config.toml');
  const repoHooksPath = path.join(root, '.codex', 'hooks.json');
  const policyPath = path.join(root, 'docs', 'IA_SKILLS_MCP_POLICY.md');
  const scriptPath = path.join(root, 'scripts', 'ai-skills-mcp-policy-status.mjs');
  const codexHome = path.join(os.homedir(), '.codex');
  const globalConfigPath = path.join(codexHome, 'config.toml');
  const globalHooksPath = path.join(codexHome, 'hooks.json');

  const [
    repoConfigText,
    repoHooksText,
    globalConfigText,
    globalHooksText,
    policyExists,
    scriptExists
  ] = await Promise.all([
    readTextSafe(repoConfigPath),
    readTextSafe(repoHooksPath),
    readTextSafe(globalConfigPath),
    readTextSafe(globalHooksPath),
    fileExists(policyPath),
    fileExists(scriptPath)
  ]);

  const repo = inspectRepo({
    configText: repoConfigText,
    hooksText: repoHooksText,
    policyExists,
    scriptExists
  });
  const global = inspectGlobal({ configText: globalConfigText, hooksText: globalHooksText });
  const report = {
    ready: repo.ready && global.ready,
    repo: {
      ...repo,
      files: { repoConfigPath, repoHooksPath, policyPath, scriptPath }
    },
    global: {
      ...global,
      files: { globalConfigPath, globalHooksPath }
    },
    usage: {
      quickCheck: 'npm run ai:skills-mcp:status -- --json',
      policyDoc: 'docs/IA_SKILLS_MCP_POLICY.md',
      designAlternative: 'Excalidraw para bocetos; componentes reales + Playwright para aceptacion'
    }
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`skillsMcp.ready=${report.ready}`);
  console.log(`skillsMcp.repo.ready=${report.repo.ready}`);
  console.log(`skillsMcp.global.ready=${report.global.ready}`);
  console.log(`skillsMcp.global.discouragedEnabled=${report.global.discouragedEnabled}`);
  console.log(`usage.quickCheck=${report.usage.quickCheck}`);
}

export { inspectGlobal, inspectRepo, pluginDisabled, pluginEnabled };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[ai-skills-mcp-policy-status] error inesperado:', error);
    process.exit(1);
  });
}
