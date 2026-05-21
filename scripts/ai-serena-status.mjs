#!/usr/bin/env node
/**
 * ai-serena-status
 *
 * Responsabilidad: validar si la integracion repo-local de Serena para Codex
 * esta presente y lista para usarse.
 * Limites: solo inspecciona archivos locales y disponibilidad del comando;
 * no instala plugins ni modifica estado.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

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

async function readTextSafe(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function checkCommandAvailable(command) {
  try {
    const candidates = [['--version'], ['--help']];
    for (const args of candidates) {
      const result = spawnSync(command, args, {
        stdio: 'pipe',
        timeout: 4000,
        encoding: 'utf8',
        shell: false
      });
      if (result && result.status === 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function checkAnyCommandAvailable(commands) {
  return commands.some((command) => checkCommandAvailable(command));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const codexDir = path.join(root, '.codex');
  const configPath = path.join(codexDir, 'config.toml');
  const hooksPath = path.join(codexDir, 'hooks.json');

  const [hasConfig, hasHooks, configText, hooksText] = await Promise.all([
    fileExists(configPath),
    fileExists(hooksPath),
    readTextSafe(configPath),
    readTextSafe(hooksPath)
  ]);

  const configHasHooksFlag = /codex_hooks\s*=\s*true/i.test(configText);
  const configHasSerenaBlock = /\[mcp_servers\.serena\]/i.test(configText);
  const configHasStartMcpServer = /start-mcp-server/i.test(configText);
  const configHasProjectFromCwd = /--project-from-cwd/i.test(configText);
  const configHasCodexContext = /--context=codex|--context\s*[,=]\s*codex/i.test(configText);
  const configUsesSerenaCommand =
    /command\s*=\s*"serena"/i.test(configText) ||
    /serena-mcp\.(sh|ps1)/i.test(configText);
  const hooksHasSerenaReminder = /serena/i.test(hooksText);
  const home = process.env.HOME ?? '';
  const commandAvailable = checkAnyCommandAvailable([
    'serena',
    'serena.exe',
    path.join(home, '.local', 'bin', 'serena'),
    path.join(home, '.local', 'bin', 'serena.exe')
  ]);

  const ready =
    hasConfig &&
    configHasHooksFlag &&
    configHasSerenaBlock &&
    configHasStartMcpServer &&
    configHasProjectFromCwd &&
    configHasCodexContext &&
    configUsesSerenaCommand;

  const report = {
    ready,
    files: {
      configPath,
      hooksPath,
      hasConfig,
      hasHooks
    },
    checks: {
      configHasHooksFlag,
      configHasSerenaBlock,
      configHasStartMcpServer,
      configHasProjectFromCwd,
      configHasCodexContext,
      configUsesSerenaCommand,
      hooksHasSerenaReminder,
      commandAvailable
    },
    usage: {
      status: 'npm run ai:serena:status -- --json',
      activationPrompt: 'Activate the current dir as project using serena',
      checkMcp: '/mcp'
    },
    notes: [
    'La configuracion repo-local no instala Serena automaticamente.',
    'En Windows, scripts/serena-mcp.ps1 resuelve el binario uv tool desde ~/.local/bin si PATH aun no fue recargado.',
    'Si commandAvailable=false fuera de Windows, instala Serena en tu PATH antes de usar /mcp.'
    ]
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`serena.ready=${report.ready}`);
  console.log(`serena.hasConfig=${report.files.hasConfig}`);
  console.log(`serena.hasHooks=${report.files.hasHooks}`);
  console.log(`serena.configHasHooksFlag=${report.checks.configHasHooksFlag}`);
  console.log(`serena.configHasSerenaBlock=${report.checks.configHasSerenaBlock}`);
  console.log(`serena.configHasStartMcpServer=${report.checks.configHasStartMcpServer}`);
  console.log(`serena.configHasProjectFromCwd=${report.checks.configHasProjectFromCwd}`);
  console.log(`serena.configHasCodexContext=${report.checks.configHasCodexContext}`);
  console.log(`serena.configUsesSerenaCommand=${report.checks.configUsesSerenaCommand}`);
  console.log(`serena.hooksHasSerenaReminder=${report.checks.hooksHasSerenaReminder}`);
  console.log(`serena.commandAvailable=${report.checks.commandAvailable}`);
  console.log(`usage.status=${report.usage.status}`);
  console.log(`usage.activationPrompt=${report.usage.activationPrompt}`);
  console.log(`usage.checkMcp=${report.usage.checkMcp}`);
}

main().catch((error) => {
  console.error('[ai-serena-status] error inesperado:', error);
  process.exit(1);
});
