#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_RULESET_NAME,
  FORBIDDEN_REQUIRED_STATUS_CHECKS_MAIN,
  REQUIRED_STATUS_CHECKS_MAIN,
  extractStatusCheckContexts,
  missingRequiredContexts,
  normalizeRequiredChecks,
  unexpectedRequiredContexts
} from './ruleset-main-contract.mjs';
import { evaluateRulesetCompliance, selectRuleset } from './check-ruleset-main.mjs';

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function runGhJson(args, env = process.env, input = '') {
  const result = spawnSync('gh', args, { encoding: 'utf8', env, input });
  if (result.status !== 0) {
    throw new Error(`gh fallo (${args.join(' ')}): ${result.stderr || result.stdout}`);
  }
  return result.stdout ? JSON.parse(result.stdout) : {};
}

function fetchRulesetDetails(repo, rulesetId) {
  if (!repo) throw new Error('Falta repo para consultar detalle de ruleset.');
  if (!rulesetId) throw new Error('Falta id de ruleset para consulta de detalle.');
  return runGhJson(['api', `repos/${repo}/rulesets/${rulesetId}`]);
}

function sanitizeRuleForPatch(rule) {
  if (!rule || typeof rule !== 'object') return null;
  const type = String(rule.type || '').trim();
  if (!type) return null;
  const next = { type };
  if (rule.parameters && typeof rule.parameters === 'object') {
    next.parameters = rule.parameters;
  }
  return next;
}

function sanitizeRulesForPatch(rules = []) {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((rule) => sanitizeRuleForPatch(rule))
    .filter(Boolean);
}

function ensureBaselineProtectionRules(rules = []) {
  const safeRules = sanitizeRulesForPatch(rules);

  if (!safeRules.some((rule) => rule.type === 'deletion')) {
    safeRules.push({ type: 'deletion' });
  }

  if (!safeRules.some((rule) => rule.type === 'non_fast_forward')) {
    safeRules.push({ type: 'non_fast_forward' });
  }

  if (!safeRules.some((rule) => rule.type === 'pull_request')) {
    safeRules.push({
      type: 'pull_request',
      parameters: {
        required_approving_review_count: 1,
        dismiss_stale_reviews_on_push: true,
        required_reviewers: [],
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: true,
        allowed_merge_methods: ['merge', 'squash', 'rebase']
      }
    });
  }

  return safeRules;
}

function upsertRequiredStatusChecksRule(rules = []) {
  const safeRules = ensureBaselineProtectionRules(rules);
  const ruleIndex = safeRules.findIndex((rule) => rule?.type === 'required_status_checks');
  const existing = ruleIndex >= 0 ? safeRules[ruleIndex] : null;
  const existingRequiredChecksRaw = Array.isArray(existing?.parameters?.required_status_checks)
    ? existing.parameters.required_status_checks
    : [];
  const existingChecks = normalizeRequiredChecks(
    existingRequiredChecksRaw.map((item) => item?.context)
  );
  const filteredExistingChecks = existingChecks.filter(
    (context) => !FORBIDDEN_REQUIRED_STATUS_CHECKS_MAIN.includes(context)
  );
  const mergedContexts = normalizeRequiredChecks([...filteredExistingChecks, ...REQUIRED_STATUS_CHECKS_MAIN]);
  const inheritedIntegrationId = existingRequiredChecksRaw.find(
    (item) => Number.isInteger(item?.integration_id)
  )?.integration_id;
  const mergedChecks = mergedContexts.map((context) => {
    const existingItem = existingRequiredChecksRaw.find((item) => String(item?.context || '') === context);
    const integrationId = Number.isInteger(existingItem?.integration_id)
      ? existingItem.integration_id
      : inheritedIntegrationId;
    if (Number.isInteger(integrationId)) {
      return {
        context,
        integration_id: integrationId
      };
    }
    return { context };
  });

  const nextRule = {
    type: 'required_status_checks',
    parameters: {
      strict_required_status_checks_policy: true,
      do_not_enforce_on_create: Boolean(existing?.parameters?.do_not_enforce_on_create),
      required_status_checks: mergedChecks
    }
  };

  if (ruleIndex >= 0) {
    safeRules[ruleIndex] = nextRule;
  } else {
    safeRules.push(nextRule);
  }
  return safeRules;
}

export function buildRulesetPatchPayload(currentRuleset = {}) {
  const payload = {
    name: currentRuleset.name || DEFAULT_RULESET_NAME,
    target: currentRuleset.target || 'branch',
    enforcement: currentRuleset.enforcement || 'active',
    conditions: currentRuleset.conditions || {
      ref_name: {
        include: ['~DEFAULT_BRANCH'],
        exclude: []
      }
    },
    rules: upsertRequiredStatusChecksRule(currentRuleset.rules),
    bypass_actors: Array.isArray(currentRuleset.bypass_actors) ? currentRuleset.bypass_actors : []
  };
  return payload;
}

export async function main() {
  const repo = getArg('repo', process.env.GITHUB_REPOSITORY || '');
  const rulesetName = getArg('ruleset-name', process.env.RULESET_NAME || DEFAULT_RULESET_NAME);
  if (!repo) throw new Error('Falta --repo=<owner/repo> o GITHUB_REPOSITORY');

  const rulesets = runGhJson(['api', `repos/${repo}/rulesets?per_page=100`]);
  const rulesetRef = selectRuleset(rulesets, rulesetName);
  if (!rulesetRef) {
    throw new Error(`No se encontro ruleset activo para main. nombre=${rulesetName}`);
  }
  const ruleset = fetchRulesetDetails(repo, rulesetRef.id);

  const before = evaluateRulesetCompliance(ruleset);
  if (before.ok) {
    process.stdout.write(`[ruleset:apply] Sin cambios. Ruleset ${ruleset.name} ya cumple el contrato.\n`);
    return;
  }

  const payload = buildRulesetPatchPayload(ruleset);
  runGhJson(
    [
      'api',
      `repos/${repo}/rulesets/${rulesetRef.id}`,
      '--method',
      'PUT',
      '--input',
      '-'
    ],
    process.env,
    JSON.stringify(payload)
  );

  const updated = fetchRulesetDetails(repo, rulesetRef.id);
  const after = evaluateRulesetCompliance(updated);
  if (!after.ok) {
    const currentContexts = extractStatusCheckContexts(updated);
    const missing = missingRequiredContexts(currentContexts, REQUIRED_STATUS_CHECKS_MAIN);
    const unexpected = unexpectedRequiredContexts(currentContexts, FORBIDDEN_REQUIRED_STATUS_CHECKS_MAIN);
    const reasons = [];
    if (missing.length > 0) reasons.push(`faltantes: ${missing.join(', ')}`);
    if (unexpected.length > 0) reasons.push(`forbidden presentes: ${unexpected.join(', ')}`);
    throw new Error(`Patch aplicado pero ruleset sigue incompleto: ${reasons.join(' | ')}`);
  }

  process.stdout.write(`[ruleset:apply] OK. Ruleset ${updated.name} actualizado con checks obligatorios.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[ruleset:apply] ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
