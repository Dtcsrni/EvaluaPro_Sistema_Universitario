#!/usr/bin/env node
/**
 * ai-serena-policy-status
 *
 * Responsabilidad: validar la politica de aprovechamiento de Serena para ahorro
 * de tokens en capa repo-local y capa global de Codex.
 * Limites: solo inspecciona configuracion/archivos; no instala ni corrige estado.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

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

function parseArgs(argv) {
  return {
    json: argv.includes('--json')
  };
}

function includesAll(text, patterns) {
  return patterns.every((pattern) => pattern.test(text));
}

async function inspectRepoLayer(root) {
  const configPath = path.join(root, '.codex', 'config.toml');
  const hooksPath = path.join(root, '.codex', 'hooks.json');
  const [configText, hooksText, hasConfig, hasHooks] = await Promise.all([
    readTextSafe(configPath),
    readTextSafe(hooksPath),
    fileExists(configPath),
    fileExists(hooksPath)
  ]);

  return {
    ...inspectRepoPolicyText({ configText, hooksText, hasConfig, hasHooks }),
    configPath,
    hooksPath
  };
}

function inspectRepoPolicyText({ configText, hooksText, hasConfig, hasHooks }) {
  const checks = {
    hasConfig,
    hasHooks,
    hasSerenaServer: /\[mcp_servers\.serena\]/i.test(configText),
    usesProjectFromCwd: /--project-from-cwd/i.test(configText),
    usesCodexContext: /--context=codex|--context\s*[,=]\s*codex/i.test(configText),
    hasSerenaReminderHook: /SERENA REQUIRED ALWAYS/i.test(hooksText),
    hasSerenaTokenPolicyHook: /SERENA TOKEN POLICY \(MANDATORY\)/i.test(hooksText)
  };

  const ready = Object.values(checks).every(Boolean);
  return { ready, checks };
}

async function inspectGlobalLayer() {
  const codexHome = path.join(os.homedir(), '.codex');
  const configPath = path.join(codexHome, 'config.toml');
  const hooksPath = path.join(codexHome, 'hooks.json');

  const [configText, hooksText, hasConfig, hasHooks] = await Promise.all([
    readTextSafe(configPath),
    readTextSafe(hooksPath),
    fileExists(configPath),
    fileExists(hooksPath)
  ]);

  return {
    ...inspectGlobalPolicyText({ configText, hooksText, hasConfig, hasHooks }),
    codexHome,
    configPath,
    hooksPath
  };
}

function inspectGlobalPolicyText({ configText, hooksText, hasConfig, hasHooks }) {
  const checks = {
    hasConfig,
    hasHooks,
    hasFeaturesBlock: /\[features\]/i.test(configText),
    hasCodexHooksEnabled: /codex_hooks\s*=\s*true/i.test(configText),
    hasSerenaServer: /\[mcp_servers\.serena\]/i.test(configText),
    hasGlobalSerenaCommand:
      /command\s*=\s*"[^"]*serena(?:\.exe)?"/i.test(configText) &&
      /start-mcp-server/i.test(configText) &&
      /--project-from-cwd/i.test(configText) &&
      /--context=codex|--context\s*[,=]\s*codex/i.test(configText),
    hasGlobalSerenaPolicyHook: /SERENA GLOBAL POLICY \(REQUIRED ALWAYS\)/i.test(hooksText),
    hasGlobalSerenaActivationHook: /Activate current repo as Serena project/i.test(hooksText)
  };

  const ready = Object.values(checks).every(Boolean);
  return { ready, checks };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const [repo, global] = await Promise.all([inspectRepoLayer(root), inspectGlobalLayer()]);

  const report = {
    ready: repo.ready && global.ready,
    repo,
    global,
    usage: {
      quickCheck: 'npm run ai:serena:policy:status -- --json',
      activationPrompt: 'Activate the current dir as project using serena',
      mcpCheck: '/mcp'
    }
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`serenaPolicy.ready=${report.ready}`);
  console.log(`serenaPolicy.repo.ready=${report.repo.ready}`);
  console.log(`serenaPolicy.global.ready=${report.global.ready}`);
  console.log(`usage.quickCheck=${report.usage.quickCheck}`);
  console.log(`usage.activationPrompt=${report.usage.activationPrompt}`);
  console.log(`usage.mcpCheck=${report.usage.mcpCheck}`);
}

export { inspectGlobalPolicyText, inspectRepoPolicyText };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[ai-serena-policy-status] error inesperado:', error);
    process.exit(1);
  });
}
