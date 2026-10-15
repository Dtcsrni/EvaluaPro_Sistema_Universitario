import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildGateSummary } from '../testing/ci-gate-summary.mjs';

const groups = ['shared_core', 'backend', 'frontend', 'portal', 'installer', 'release', 'docs', 'compliance'];
const gates = [
  'flujo_docente_check', 'dataset_prodlike_check', 'omr_tv_extended_gate',
  'docente_alumno_e2e_check', 'global_grade_check', 'pdf_print_check',
  'classroom_audit_check', 'ux_visual_check', 'perf_check', 'perf_business_check',
  'clean_architecture_check', 'qa_manifest', 'dsr_flow_test', 'compliance_evidence'
];
const basePlan = {
  ...Object.fromEntries(groups.map((group) => [group, 'false'])),
  ...Object.fromEntries(gates.map((gate) => [`gate_${gate}`, 'false'])),
  job_core_contract_docs_gov: 'false',
  job_core_backend_portal: 'false',
  job_core_frontend: 'false',
  job_core_security_compliance: 'false',
  job_ext_funcionales: 'false',
  job_ext_perf_arquitectura: 'false',
  job_ext_compliance_evidencia: 'false'
};

const coreNeeds = {
  detectar_cambios: {
    result: 'success',
    outputs: {
      ...basePlan,
      escalation: 'affected',
      backend: 'true',
      gate_omr_tv_extended_gate: 'true',
      job_core_contract_docs_gov: 'false',
      job_core_backend_portal: 'true',
      job_ext_funcionales: 'true',
      job_core_frontend: 'false',
      job_core_security_compliance: 'true'
    }
  },
  core_contract_docs_gov: { result: 'skipped' },
  core_backend_portal: { result: 'success' },
  core_frontend: { result: 'skipped' },
  core_security_compliance: { result: 'success' }
};

const extendedNeeds = {
  verificaciones_core: { result: 'success' },
  detectar_cambios: {
    result: 'success',
    outputs: {
      ...basePlan,
      escalation: 'full-extended',
      backend: 'true',
      gate_omr_tv_extended_gate: 'true',
      job_core_backend_portal: 'true',
      job_core_security_compliance: 'true',
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
  assert.equal(summary.event, 'pull_request');
  assert.equal(summary.escalation, 'affected');
  assert.equal(summary.matchedGroups.backend, 'true');

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
        backend: 'false',
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
          backend: 'false',
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

test('un gate seleccionado no puede quedar fuera de su job Extended y el reporte no refleja salidas desconocidas', () => {
  const summary = buildGateSummary({
    mode: 'extended', eventName: 'pull_request', sha: 'feedface', needs: {
      ...extendedNeeds,
      detectar_cambios: {
        ...extendedNeeds.detectar_cambios,
        outputs: {
          ...extendedNeeds.detectar_cambios.outputs,
          escalation: 'affected',
          job_ext_funcionales: 'false',
          gate_omr_tv_extended_gate: 'true',
          group_email_personal: 'eve@example.invalid',
          gate_access_token: 'sensitive-value'
        }
      },
      ext_funcionales: { result: 'skipped' },
      ext_perf_arquitectura: { result: 'skipped' },
      ext_compliance_evidencia: { result: 'skipped' }
    }
  });

  assert.equal(summary.decision, 'failure');
  assert.ok(summary.failures.some((failure) => failure.includes('gate_omr_tv_extended_gate') && failure.includes('job_ext_funcionales')));
  assert.equal(JSON.stringify(summary).includes('eve@example.invalid'), false);
  assert.equal(JSON.stringify(summary).includes('sensitive-value'), false);
});

test('un job opcional solo acepta success o skipped; otros estados fallan', () => {
  const summary = buildGateSummary({
    mode: 'core', eventName: 'pull_request', needs: {
      ...coreNeeds,
      core_frontend: { result: 'cancelled' }
    }
  });
  assert.equal(summary.decision, 'failure');
});

test('un grupo afectado no puede declarar no requerido uno de sus jobs Core', () => {
  const summary = buildGateSummary({
    mode: 'core', eventName: 'pull_request', needs: {
      ...coreNeeds,
      detectar_cambios: {
        ...coreNeeds.detectar_cambios,
        outputs: {
          ...coreNeeds.detectar_cambios.outputs,
          job_core_security_compliance: 'false'
        }
      },
      core_security_compliance: { result: 'skipped' }
    }
  });

  assert.equal(summary.decision, 'failure');
  assert.ok(summary.failures.some((failure) => failure.includes('grupo backend') && failure.includes('job_core_security_compliance')));
});

test('el reporte agrega todos los grupos y gates declarados por el mapa de CI', () => {
  const map = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'ci/affected-test-map.json'), 'utf8'));
  const summary = buildGateSummary({ mode: 'core', eventName: 'pull_request', needs: coreNeeds });
  const mappedGates = Object.keys(map.gates).map((name) => `gate_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`);

  assert.deepEqual(Object.keys(summary.matchedGates).sort(), mappedGates.map((key) => key.slice('gate_'.length)).sort());
  assert.deepEqual(Object.keys(summary.matchedGroups).sort(), [...groups].sort());
});
