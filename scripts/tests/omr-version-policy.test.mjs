import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '../..');

function leer(relativo) {
  return fs.readFileSync(path.join(ROOT, relativo), 'utf8');
}

function leerJson(relativo) {
  return JSON.parse(leer(relativo));
}

const policy = leerJson('config/omr-version-policy.json');
const backendTemplate = leer('apps/backend/src/modulos/modulo_generacion_pdf/domain/templateCanonico.ts');
const backendTypes = leer('apps/backend/src/modulos/modulo_generacion_pdf/shared/tiposPdf.ts');
const frontendVersion = leer('apps/frontend/src/ui/version/versionInfo.ts');
const versionPage = leer('apps/frontend/src/ui/version/VersionInfoPage.tsx');
const shellDocente = leer('apps/frontend/src/apps/app_docente/ShellDocente.tsx');
const omrWorkflow = leer('apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasOmrWorkflow.tsx');
const omrActions = leer('apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasOmrActions.ts');
const packageJson = leerJson('package.json');

test('la política declara una única identidad OMR canónica', () => {
  assert.equal(policy.active.templateVersion, 4);
  assert.equal(policy.active.contractId, 'omr-canonical-v4');
  assert.equal(policy.active.displayLabel, 'OMR canónico · v4');
  assert.equal(policy.active.wireMarker, 'TV4');
  assert.equal(policy.oldVersionsOperational, false);
  assert.equal(policy.selectionRule, 'explicit-canonical-only');
  assert.equal(policy.rejectionRule, 'fail-closed');
});

test('backend y frontend usan la misma versión y etiqueta declaradas', () => {
  assert.match(backendTemplate, /TEMPLATE_VERSION_CANONICA:\s*TemplateVersion\s*=\s*4/);
  assert.match(backendTemplate, /OMR_CANONICAL_CONTRACT_ID\s*=\s*'omr-canonical-v4'/);
  assert.match(backendTemplate, /OMR_CANONICAL_DISPLAY_LABEL\s*=\s*'OMR canónico · v4'/);
  assert.match(backendTypes, /export type TemplateVersion\s*=\s*4/);
  assert.match(frontendVersion, /VITE_OMR_CANONICAL_VERSION/);
  assert.match(frontendVersion, /omr-canonical-v4/);
  assert.match(frontendVersion, /OMR canónico · v4/);
  assert.match(versionPage, /Contrato OMR:/);
  assert.match(versionPage, /Versiones antiguas:/);
});

test('la GUI marca el contrato activo y no presenta OMR V1', () => {
  assert.match(shellDocente, /OMR_CANONICAL_DISPLAY_LABEL/);
  assert.match(shellDocente, /chip-omr-contract/);
  assert.match(omrWorkflow, /OMR_CANONICAL_DISPLAY_LABEL/);
  assert.match(omrActions, /OMR_CANONICAL_DISPLAY_LABEL/);
  assert.doesNotMatch(`${shellDocente}\n${omrWorkflow}\n${omrActions}`, /OMR V1|assessment V1/i);
});

test('el gate de política está publicado en el contrato raíz', () => {
  assert.equal(packageJson.scripts['test:omr:version-policy'], 'node --test scripts/tests/omr-version-policy.test.mjs');
});

test('los artefactos históricos OMR/PDF fueron retirados del árbol activo', () => {
  const removedPaths = [
    'apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoLegacy.ts',
    'apps/backend/src/modulos/modulo_generacion_pdf/domain/layoutTemplateV9.ts',
    'apps/backend/src/modulos/modulo_generacion_pdf/domain/layoutTemplateV10.ts',
    'apps/backend/src/modulos/modulo_generacion_pdf/domain/templateCompat.ts',
    'apps/backend/src/modulos/modulo_generacion_pdf/domain/tv3Compat.ts',
    'apps/backend/src/modulos/modulo_generacion_pdf/domain/tv4Compat.ts',
    'apps/backend/src/modulos/modulo_generacion_pdf/infra/html',
    'apps/backend/src/modulos/modulo_generacion_pdf/infra/resolverPdfEngine.ts',
    'apps/backend/src/modulos/modulo_omr_v1',
    'apps/backend/scripts/omr-tv3-e2e.ts',
    'apps/backend/tests/omr.tv3.realGolden.test.ts',
    'apps/backend/tests/omr.v1.workflow.test.ts',
    'scripts/testing/run-omr-tv-gate.mjs',
    'omr_samples_tv3',
    'omr_samples_tv3_real_manual_min',
    'omr_samples_tv3_real_por_folio'
  ];
  for (const relativePath of removedPaths) {
    assert.equal(fs.existsSync(path.join(ROOT, relativePath)), false, relativePath);
  }
  assert.doesNotMatch(leer('apps/backend/tsconfig.json'), /modulo_omr_v1|layoutTemplateV9|infra\/html/);
  assert.doesNotMatch(leer('apps/backend/vitest.config.ts'), /omr\.tv3|omr\.v1|pdf\.renderer\.fallback|pdf\.visual\.baseline/);
});
