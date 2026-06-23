/**
 * ruleset-main.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORBIDDEN_REQUIRED_STATUS_CHECKS_MAIN,
  REQUIRED_RULE_TYPES_MAIN,
  REQUIRED_STATUS_CHECKS_MAIN,
  missingRequiredRuleTypes,
  missingRequiredContexts,
  unexpectedRequiredContexts
} from '../devops/ruleset-main-contract.mjs';
import { buildRulesetPatchPayload } from '../devops/apply-ruleset-main.mjs';

test('ruleset contract exige Extended + Installer Windows en main', () => {
  assert.equal(REQUIRED_STATUS_CHECKS_MAIN.includes('Verificaciones Extendidas (Main/Release)'), true);
  assert.equal(REQUIRED_STATUS_CHECKS_MAIN.includes('Installer Windows (MSI + Bundle)'), true);
});

test('missingRequiredContexts detecta faltantes del contract', () => {
  const current = ['Verificaciones Core (PR bloqueante)'];
  const missing = missingRequiredContexts(current, REQUIRED_STATUS_CHECKS_MAIN);
  assert.equal(missing.includes('Verificaciones Extendidas (Main/Release)'), true);
  assert.equal(missing.includes('Installer Windows (MSI + Bundle)'), true);
});

test('missingRequiredRuleTypes detecta reglas base de protección faltantes', () => {
  const currentRuleTypes = ['required_status_checks'];
  const missing = missingRequiredRuleTypes(currentRuleTypes, REQUIRED_RULE_TYPES_MAIN);
  assert.equal(missing.includes('deletion'), true);
  assert.equal(missing.includes('non_fast_forward'), true);
  assert.equal(missing.includes('pull_request'), true);
});

test('unexpectedRequiredContexts detecta checks modulares prohibidos en branch protection', () => {
  const current = ['Verificaciones Core (PR bloqueante)', 'Backend Module'];
  const unexpected = unexpectedRequiredContexts(current, FORBIDDEN_REQUIRED_STATUS_CHECKS_MAIN);
  assert.equal(unexpected.includes('Backend Module'), true);
});

test('apply payload preserva reglas y agrega required checks obligatorios', () => {
  const payload = buildRulesetPatchPayload({
    name: 'main-v1b-minimo',
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        include: ['~DEFAULT_BRANCH'],
        exclude: []
      }
    },
    rules: [
      { type: 'non_fast_forward' },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [{ context: 'Verificaciones Core (PR bloqueante)', integration_id: null }]
        }
      }
    ]
  });

  const checks = payload.rules
    .find((rule) => rule.type === 'required_status_checks')
    .parameters.required_status_checks.map((item) => item.context);
  assert.equal(payload.rules.some((rule) => rule.type === 'non_fast_forward'), true);
  assert.equal(checks.includes('Verificaciones Extendidas (Main/Release)'), true);
  assert.equal(checks.includes('Installer Windows (MSI + Bundle)'), true);
});

test('apply payload elimina checks modulares prohibidos del required_status_checks', () => {
  const payload = buildRulesetPatchPayload({
    name: 'main-v1b-minimo',
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        include: ['~DEFAULT_BRANCH'],
        exclude: []
      }
    },
    rules: [
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [
            { context: 'Verificaciones Core (PR bloqueante)', integration_id: null },
            { context: 'Backend Module', integration_id: null }
          ]
        }
      }
    ]
  });

  const checks = payload.rules
    .find((rule) => rule.type === 'required_status_checks')
    .parameters.required_status_checks.map((item) => item.context);
  assert.equal(checks.includes('Backend Module'), false);
  assert.equal(checks.includes('Verificaciones Core (PR bloqueante)'), true);
});

test('apply payload sanea reglas a campos permitidos para GitHub API', () => {
  const payload = buildRulesetPatchPayload({
    name: 'main-v1b-minimo',
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        include: ['~DEFAULT_BRANCH'],
        exclude: []
      }
    },
    rules: [
      {
        id: 123,
        type: 'non_fast_forward',
        source_type: 'Repository',
        source: 'repo-id'
      }
    ]
  });

  const nonFastForward = payload.rules.find((rule) => rule.type === 'non_fast_forward');
  assert.equal(Boolean(nonFastForward), true);
  assert.equal(Object.prototype.hasOwnProperty.call(nonFastForward, 'id'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(nonFastForward, 'source_type'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(nonFastForward, 'source'), false);
});

test('apply payload hereda integration_id en required_status_checks nuevos', () => {
  const payload = buildRulesetPatchPayload({
    name: 'main-v1b-minimo',
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        include: ['~DEFAULT_BRANCH'],
        exclude: []
      }
    },
    rules: [
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          do_not_enforce_on_create: false,
          required_status_checks: [
            { context: 'Verificaciones Core (PR bloqueante)', integration_id: 15368 }
          ]
        }
      }
    ]
  });

  const checks = payload.rules
    .find((rule) => rule.type === 'required_status_checks')
    .parameters.required_status_checks;
  const extended = checks.find((item) => item.context === 'Verificaciones Extendidas (Main/Release)');
  assert.equal(Number(extended?.integration_id), 15368);
});

test('apply payload repone reglas base cuando faltan', () => {
  const payload = buildRulesetPatchPayload({
    name: 'main-v1b-minimo',
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        include: ['~DEFAULT_BRANCH'],
        exclude: []
      }
    },
    rules: [
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [{ context: 'Verificaciones Core (PR bloqueante)', integration_id: 15368 }]
        }
      }
    ]
  });

  const ruleTypes = payload.rules.map((rule) => rule.type);
  assert.equal(ruleTypes.includes('deletion'), true);
  assert.equal(ruleTypes.includes('non_fast_forward'), true);
  assert.equal(ruleTypes.includes('pull_request'), true);
  assert.equal(ruleTypes.includes('required_status_checks'), true);
});

test('apply payload desactiva aprobación obligatoria en pull_request', () => {
  const payload = buildRulesetPatchPayload({
    name: 'main-v1b-minimo',
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        include: ['~DEFAULT_BRANCH'],
        exclude: []
      }
    },
    rules: [
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 2,
          dismiss_stale_reviews_on_push: true,
          required_reviewers: [],
          require_code_owner_review: true,
          require_last_push_approval: true,
          required_review_thread_resolution: true,
          allowed_merge_methods: ['merge', 'squash', 'rebase']
        }
      }
    ]
  });

  const pullRequestRule = payload.rules.find((rule) => rule.type === 'pull_request');
  assert.equal(Number(pullRequestRule?.parameters?.required_approving_review_count), 0);
  assert.equal(Boolean(pullRequestRule?.parameters?.required_review_thread_resolution), false);
  assert.equal(Boolean(pullRequestRule?.parameters?.require_last_push_approval), false);
});

