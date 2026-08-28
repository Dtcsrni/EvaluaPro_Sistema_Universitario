#!/usr/bin/env node
/**
 * ruleset-main-contract
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * ruleset-main-contract
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * ruleset-main-contract
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */

export const REQUIRED_STATUS_CHECKS_MAIN = Object.freeze([
  'Verificaciones Core (PR bloqueante)',
  'Verificaciones Extendidas (Main/Release)',
  'Installer Windows (MSI + Bundle)',
  'Security CodeQL (JS/TS)'
]);

export const FORBIDDEN_REQUIRED_STATUS_CHECKS_MAIN = Object.freeze([
  'Backend Module',
  'Frontend Module',
  'Portal Module',
  'Docs Module'
]);

export const DEFAULT_RULESET_NAME = 'main-v1b-minimo';

export const REQUIRED_RULE_TYPES_MAIN = Object.freeze([
  'deletion',
  'non_fast_forward',
  'pull_request',
  'required_status_checks'
]);

export function normalizeRequiredChecks(requiredChecks = []) {
  return [...new Set(requiredChecks.map((value) => String(value || '').trim()).filter(Boolean))];
}

export function extractStatusCheckContexts(ruleset = {}) {
  const rules = Array.isArray(ruleset.rules) ? ruleset.rules : [];
  const requiredRule = rules.find((rule) => rule?.type === 'required_status_checks');
  if (!requiredRule || !requiredRule.parameters) return [];
  const checks = Array.isArray(requiredRule.parameters.required_status_checks)
    ? requiredRule.parameters.required_status_checks
    : [];
  return normalizeRequiredChecks(checks.map((item) => item?.context));
}

export function extractRuleTypes(ruleset = {}) {
  const rules = Array.isArray(ruleset.rules) ? ruleset.rules : [];
  return normalizeRequiredChecks(rules.map((rule) => rule?.type));
}

export function missingRequiredContexts(currentContexts = [], expectedContexts = REQUIRED_STATUS_CHECKS_MAIN) {
  const current = new Set(normalizeRequiredChecks(currentContexts));
  return normalizeRequiredChecks(expectedContexts).filter((expected) => !current.has(expected));
}

export function missingRequiredRuleTypes(currentRuleTypes = [], expectedRuleTypes = REQUIRED_RULE_TYPES_MAIN) {
  const current = new Set(normalizeRequiredChecks(currentRuleTypes));
  return normalizeRequiredChecks(expectedRuleTypes).filter((expected) => !current.has(expected));
}

export function unexpectedRequiredContexts(currentContexts = [], forbiddenContexts = FORBIDDEN_REQUIRED_STATUS_CHECKS_MAIN) {
  const current = new Set(normalizeRequiredChecks(currentContexts));
  return normalizeRequiredChecks(forbiddenContexts).filter((forbidden) => current.has(forbidden));
}

