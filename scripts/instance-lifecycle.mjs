/**
 * Pure policy helpers for EvaluaPro installation instances.
 *
 * This module only classifies state and authorizes transitions. It never
 * deletes files, stops processes, or changes an installation.
 */
import { compareSemver } from './update-manager.mjs';

export const INSTANCE_STATES = Object.freeze([
  'unknown',
  'legacy',
  'repairable',
  'current',
  'local-ahead-of-official',
  'orphaned',
  'conflict'
]);

export function canApplyUpdate(currentVersion, candidateVersion) {
  const comparison = compareSemver(candidateVersion, currentVersion);
  if (comparison <= 0) {
    return {
      allowed: false,
      reason: comparison === 0 ? 'already-current' : 'local-ahead-of-official'
    };
  }
  return { allowed: true, reason: 'update-available' };
}

export function isSideBySideSafe(left = {}, right = {}) {
  const same = (a, b) => Boolean(a && b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  if (same(left.flavorId, right.flavorId)) return false;
  if (same(left.installDir, right.installDir)) return false;
  if (same(left.dataDir, right.dataDir)) return false;
  const leftPorts = Array.isArray(left.ports) ? left.ports : [];
  const rightPorts = Array.isArray(right.ports) ? right.ports : [];
  return !leftPorts.some((port) => rightPorts.some((candidate) => Number(port) === Number(candidate)));
}

export function classifyInstanceState({
  manifestPresent = false,
  payloadPresent = false,
  dataPresent = false,
  currentVersion = '',
  officialVersion = '',
  requestedFlavorId = '',
  discoveredFlavorId = '',
  sameInstallRoot = false,
  sameDataRoot = false,
  samePorts = false
} = {}) {
  if (sameInstallRoot || sameDataRoot || samePorts) return 'conflict';
  if (discoveredFlavorId && requestedFlavorId && discoveredFlavorId.toLowerCase() !== requestedFlavorId.toLowerCase()) return 'conflict';
  if (!manifestPresent && !payloadPresent && !dataPresent) return 'unknown';
  if (dataPresent && !manifestPresent && !payloadPresent) return 'orphaned';
  if ((manifestPresent || payloadPresent) && !dataPresent) return 'repairable';
  if (!manifestPresent || !payloadPresent) return 'legacy';
  if (officialVersion && currentVersion) {
    const comparison = compareSemver(currentVersion, officialVersion);
    if (comparison > 0) return 'local-ahead-of-official';
    if (comparison === 0) return 'current';
    return 'repairable';
  }
  return 'repairable';
}

export function lifecycleDecision(state, { destructiveCleanupConfirmed = false } = {}) {
  const normalized = String(state || 'unknown').toLowerCase();
  return {
    state: INSTANCE_STATES.includes(normalized) ? normalized : 'unknown',
    canRepair: ['legacy', 'repairable', 'orphaned', 'current', 'local-ahead-of-official'].includes(normalized),
    canUpdate: normalized === 'current' || normalized === 'local-ahead-of-official',
    canAutoDelete: false,
    cleanupRequiresExplicitConfirmation: !destructiveCleanupConfirmed,
    preserveDataByDefault: true
  };
}
