#!/usr/bin/env node
/**
 * ai-caveman-status
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * ai-caveman-status
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * ai-caveman-status
 *
 * Responsabilidad: validar si la integracion repo-local de Caveman para Codex
 * esta presente y lista para usarse.
 * Limites: solo inspecciona archivos locales; no instala plugins ni modifica estado.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

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
  const hooksHasSessionStart = /"SessionStart"/i.test(hooksText);
  const hooksHasCaveman = /caveman/i.test(hooksText);

  const ready = hasConfig && hasHooks && configHasHooksFlag && hooksHasSessionStart && hooksHasCaveman;

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
      hooksHasSessionStart,
      hooksHasCaveman
    },
    usage: {
      activate: '$caveman',
      deactivate: 'stop caveman'
    },
    notes: [
      'La integracion repo-local define pauta de respuesta; no instala el plugin.',
      'Instala Caveman en Codex para tener comando $caveman disponible globalmente.'
    ]
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`caveman.ready=${report.ready}`);
  console.log(`caveman.hasConfig=${report.files.hasConfig}`);
  console.log(`caveman.hasHooks=${report.files.hasHooks}`);
  console.log(`caveman.configHasHooksFlag=${report.checks.configHasHooksFlag}`);
  console.log(`caveman.hooksHasSessionStart=${report.checks.hooksHasSessionStart}`);
  console.log(`caveman.hooksHasCaveman=${report.checks.hooksHasCaveman}`);
  console.log(`usage.activate=${report.usage.activate}`);
  console.log(`usage.deactivate=${report.usage.deactivate}`);
}

main().catch((error) => {
  console.error('[ai-caveman-status] error inesperado:', error);
  process.exit(1);
});