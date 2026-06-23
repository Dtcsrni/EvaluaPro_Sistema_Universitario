#!/usr/bin/env node
/**
 * check-ruleset-main
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_RULESET_NAME,
  FORBIDDEN_REQUIRED_STATUS_CHECKS_MAIN,
  REQUIRED_RULE_TYPES_MAIN,
  REQUIRED_STATUS_CHECKS_MAIN,
  extractRuleTypes,
  extractStatusCheckContexts,
  missingRequiredRuleTypes,
  missingRequiredContexts,
  unexpectedRequiredContexts
} from './ruleset-main-contract.mjs';

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function runGhJson(args, env = process.env) {
  const result = spawnSync('gh', args, { encoding: 'utf8', env });
  if (result.status !== 0) {
    throw new Error(`gh fallo (${args.join(' ')}): ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function fetchRulesetDetails(repo, rulesetId) {
  if (!repo) throw new Error('Falta repo para consultar detalle de ruleset.');
  if (!rulesetId) throw new Error('Falta id de ruleset para consulta de detalle.');
  return runGhJson(['api', `repos/${repo}/rulesets/${rulesetId}`]);
}

function loadRulesetsFromFixture(fixturePath) {
  const resolved = path.resolve(process.cwd(), fixturePath);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

export function selectRuleset(rulesets, desiredName = DEFAULT_RULESET_NAME) {
  if (!Array.isArray(rulesets)) return null;
  const byName = rulesets.find((item) => String(item?.name || '') === desiredName);
  if (byName) return byName;

  return (
    rulesets.find((item) => {
      if (item?.target !== 'branch') return false;
      if (item?.enforcement !== 'active') return false;
      const includeRefs = item?.conditions?.ref_name?.include;
      return (
        Array.isArray(includeRefs) &&
        (includeRefs.includes('~DEFAULT_BRANCH') || includeRefs.includes('refs/heads/main'))
      );
    }) || null
  );
}

export function evaluateRulesetCompliance(ruleset) {
  const ruleTypes = extractRuleTypes(ruleset);
  const missingRuleTypes = missingRequiredRuleTypes(ruleTypes, REQUIRED_RULE_TYPES_MAIN);
  const current = extractStatusCheckContexts(ruleset);
  const missing = missingRequiredContexts(current, REQUIRED_STATUS_CHECKS_MAIN);
  const unexpected = unexpectedRequiredContexts(current, FORBIDDEN_REQUIRED_STATUS_CHECKS_MAIN);
  return {
    ok: missingRuleTypes.length === 0 && missing.length === 0 && unexpected.length === 0,
    ruleTypes,
    missingRuleTypes,
    current,
    missing,
    unexpected
  };
}

export async function main() {
  const repo = getArg('repo', process.env.GITHUB_REPOSITORY || '');
  const rulesetName = getArg('ruleset-name', process.env.RULESET_NAME || DEFAULT_RULESET_NAME);
  const fixturePath = getArg('fixture', process.env.RULESET_FIXTURE_PATH || '');

  let rulesets;
  if (fixturePath) {
    rulesets = loadRulesetsFromFixture(fixturePath);
  } else {
    if (!repo) throw new Error('Falta --repo=<owner/repo> o GITHUB_REPOSITORY');
    rulesets = runGhJson(['api', `repos/${repo}/rulesets?per_page=100`]);
  }

  const ruleset = selectRuleset(rulesets, rulesetName);
  if (!ruleset) {
    throw new Error(`No se encontro ruleset activo para main. nombre=${rulesetName}`);
  }

  const rulesetResolved = fixturePath
    ? ruleset
    : fetchRulesetDetails(repo, ruleset.id);

  const compliance = evaluateRulesetCompliance(rulesetResolved);
  if (!compliance.ok) {
    const details = [];
    if (compliance.missingRuleTypes.length > 0) {
      details.push(`missing required rule types: ${compliance.missingRuleTypes.join(', ')}`);
    }
    if (compliance.missing.length > 0) {
      details.push(`missing required checks: ${compliance.missing.join(', ')}`);
    }
    if (compliance.unexpected.length > 0) {
      details.push(`forbidden required checks present: ${compliance.unexpected.join(', ')}`);
    }
    process.stderr.write(
      `[ruleset:check] FAIL ${details.join(' | ')}\n`
    );
    process.exit(1);
  }

  process.stdout.write(
    `[ruleset:check] OK (${rulesetResolved.name}) checks requeridos presentes: ${REQUIRED_STATUS_CHECKS_MAIN.join(', ')}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[ruleset:check] ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
