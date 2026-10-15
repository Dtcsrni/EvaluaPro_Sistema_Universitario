import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGateSummary } from '../testing/ci-gate-summary.mjs';

const coreNeeds = {
  detectar_cambios: {
    result: 'success',
    outputs: {
      escalation: 'affected',
      backend: 'true',
      gate_omr_tv_extended_gate: 'true',
      job_core_contract_docs_gov: 'false',
      job_core_backend_portal: 'true',
      job_core_frontend: 'false',
      job_core_security_compliance: 'false'
    }
  },
  core_contract_docs_gov: { result: 'skipped' },
  core_backend_portal: { result: 'success' },
  core_frontend: { result: 'skipped' },
  core_security_compliance: { result: 'skipped' }
};

const extendedNeeds = {
  verificaciones_core: { result: 'success' },
  detectar_cambios: {
    result: 'success',
    outputs: {
      escalation: 'full-extended',
      group_backend: 'true',
      gate_omr_tv_extended_gate: 'true',
      job_ext_funcionales: 'true',
      job_ext_perf_arquitectura: 'true',
      job_ext_compliance_evidencia: 'true'
    }
  },
  ext_funcionales: { result: 'success' },
  ext_perf_arquitectura: { result: 'success' },
  ext_compliance_evidencia: { result: 'success' }
};

test('Core acepta omisiones solo cuando el detector exitoso las excluye del plan', () => {
  const summary = buildGateSummary({ mode: 'core', eventName: 'pull_request', sha: 'abc123', needs: coreNeeds });
  assert.equal(summary.decision, 'success');
  assert.equal(summary.requiredJobs.core_backend_portal, true);
  assert.equal(summary.requiredJobs.core_frontend, false);
  assert.equal(summary.sha, 'abc123');
  assert.deepEqual(summary.matchedGroups, { backend: 'true' });

  assert.equal(buildGateSummary({
    mode: 'core', eventName: 'pull_request', needs: {
      ...coreNeeds,
      detectar_cambios: { ...coreNeeds.detectar_cambios, result: 'failure' }
    }
  }).decision, 'failure');
  assert.equal(buildGateSummary({
    mode: 'core', eventName: 'pull_request', needs: {
      ...coreNeeds,
      core_backend_portal: { result: 'skipped' }
    }
  }).decision, 'failure');
});

test('schedule y dispatch integral exigen todos los jobs Core/Extended', () => {
  const fullCoreNeeds = {
    ...coreNeeds,
    detectar_cambios: {
      ...coreNeeds.detectar_cambios,
      outputs: {
        ...coreNeeds.detectar_cambios.outputs,
        job_core_contract_docs_gov: 'false',
        job_core_backend_portal: 'false',
        job_core_frontend: 'false',
        job_core_security_compliance: 'false'
      }
    },
    core_contract_docs_gov: { result: 'success' },
    core_frontend: { result: 'success' },
    core_security_compliance: { result: 'success' }
  };
  const summary = buildGateSummary({ mode: 'core', eventName: 'schedule', needs: fullCoreNeeds });
  assert.equal(summary.decision, 'success');
  assert.equal(Object.values(summary.requiredJobs).every(Boolean), true);

  const extended = buildGateSummary({
    mode: 'extended', eventName: 'workflow_dispatch', forceFull: true, sha: 'deadbeef', needs: extendedNeeds
  });
  assert.equal(extended.decision, 'success');
  assert.equal(extended.fullRun, true);
  assert.deepEqual(Object.values(extended.requiredJobs), [true, true, true]);
  assert.equal(JSON.stringify(extended).includes('secret'), false);

  assert.equal(buildGateSummary({
    mode: 'extended', eventName: 'schedule', needs: {
      ...extendedNeeds,
      verificaciones_core: { result: 'failure' },
      ext_perf_arquitectura: { result: 'skipped' }
    }
  }).decision, 'failure');
});

test('las escalaciones full-core y full-extended hacen obligatorios todos sus jobs', () => {
  const escalatedCore = buildGateSummary({
    mode: 'core',
    eventName: 'pull_request',
    needs: {
      ...coreNeeds,
      detectar_cambios: {
        ...coreNeeds.detectar_cambios,
        outputs: {
          ...coreNeeds.detectar_cambios.outputs,
          escalation: 'full-core',
          job_core_contract_docs_gov: 'false',
          job_core_backend_portal: 'false',
          job_core_frontend: 'false',
          job_core_security_compliance: 'false'
        }
      },
      core_contract_docs_gov: { result: 'success' },
      core_backend_portal: { result: 'success' },
      core_frontend: { result: 'success' },
      core_security_compliance: { result: 'success' }
    }
  });
  assert.equal(escalatedCore.decision, 'success');
  assert.equal(Object.values(escalatedCore.requiredJobs).every(Boolean), true);

  const escalatedExtended = buildGateSummary({
    mode: 'extended',
    eventName: 'pull_request',
    needs: {
      ...extendedNeeds,
      detectar_cambios: {
        ...extendedNeeds.detectar_cambios,
        outputs: {
          ...extendedNeeds.detectar_cambios.outputs,
          escalation: 'full-extended',
          job_ext_funcionales: 'false',
          job_ext_perf_arquitectura: 'false',
          job_ext_compliance_evidencia: 'false'
        }
      }
    }
  });
  assert.equal(escalatedExtended.decision, 'success');
  assert.equal(Object.values(escalatedExtended.requiredJobs).every(Boolean), true);
  assert.equal(buildGateSummary({
    mode: 'extended',
    eventName: 'pull_request',
    needs: {
      ...extendedNeeds,
      detectar_cambios: {
        ...extendedNeeds.detectar_cambios,
        outputs: {
          ...extendedNeeds.detectar_cambios.outputs,
          escalation: 'full-extended',
          job_ext_funcionales: 'false'
        }
      },
      ext_funcionales: { result: 'skipped' }
    }
  }).decision, 'failure');
});

test('el plan incompleto falla cerrado', () => {
  const summary = buildGateSummary({
    mode: 'core', eventName: 'pull_request',
    needs: { ...coreNeeds, detectar_cambios: { result: 'success', outputs: {} } }
  });
  assert.equal(summary.decision, 'failure');
  assert.ok(summary.failures.some((failure) => failure.includes('no contiene un booleano válido')));
  assert.ok(summary.failures.some((failure) => failure.includes('escalación válida')));
});
