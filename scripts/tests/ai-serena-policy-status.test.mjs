/**
 * ai-serena-policy-status.test
 *
 * Responsabilidad: Proteger el contrato de politica Serena repo/global.
 * Limites: Valida texto de configuracion aislado sin leer el HOME real.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectGlobalPolicyText,
  inspectRepoPolicyText
} from '../ai-serena-policy-status.mjs';

test('politica Serena repo acepta hook con recordatorio y regla de tokens', () => {
  const report = inspectRepoPolicyText({
    hasConfig: true,
    hasHooks: true,
    configText: `
[mcp_servers.serena]
args = ["start-mcp-server", "--project-from-cwd", "--context=codex"]
`,
    hooksText: `
{
  "statusMessage": "SERENA REQUIRED ALWAYS | SERENA TOKEN POLICY (MANDATORY)"
}
`
  });

  assert.equal(report.ready, true);
});

test('politica Serena global acepta servidor y hook de activacion', () => {
  const report = inspectGlobalPolicyText({
    hasConfig: true,
    hasHooks: true,
    configText: `
[features]
codex_hooks = true

[mcp_servers.serena]
command = "C:\\Users\\evega\\.local\\bin\\serena.exe"
args = ["start-mcp-server", "--project-from-cwd", "--context=codex"]
`,
    hooksText: `
{
  "statusMessage": "SERENA GLOBAL POLICY (REQUIRED ALWAYS) | Activate current repo as Serena project"
}
`
  });

  assert.equal(report.ready, true);
});
