/**
 * ci-workflow-contract.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowPath = path.join(root, '.github', 'workflows', 'ci.yml');
const workflowDir = path.join(root, '.github', 'workflows');
const packageJsonPath = path.join(root, 'package.json');
const backendDockerfilePath = path.join(root, 'apps', 'backend', 'Dockerfile');
const frontendDockerfilePath = path.join(root, 'apps', 'frontend', 'Dockerfile');

function extractJobBlock(workflow, jobKey) {
  const startMarker = `  ${jobKey}:\n`;
  const start = workflow.indexOf(startMarker);
  assert.ok(start >= 0, `job no encontrado: ${jobKey}`);

  const rest = workflow.slice(start + startMarker.length);
  const nextJobMatch = rest.match(/\n  [a-z0-9_]+:\n/i);
  const end = nextJobMatch ? start + startMarker.length + nextJobMatch.index : workflow.length;
  return workflow.slice(start, end);
}

test('ext_perf_arquitectura prepara sharp antes de perf:check', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const block = extractJobBlock(workflow, 'ext_perf_arquitectura');

  assert.match(block, /run:\s*\|[\s\S]{0,120}npm ci --foreground-scripts/);
  assert.match(block, /Preparar runtime sharp \(linux-x64\)/);
  assert.match(block, /npm install --no-save --include=optional --os=linux --cpu=x64 sharp/);
  assert.match(block, /run:\s*npm run perf:check/);

  const setupIndex = block.indexOf('npm ci --foreground-scripts');
  const sharpIndex = block.indexOf('npm install --no-save --include=optional --os=linux --cpu=x64 sharp');
  const perfIndex = block.indexOf('run: npm run perf:check');

  assert.ok(setupIndex >= 0, 'faltante setup npm ci');
  assert.ok(sharpIndex > setupIndex, 'sharp debe ejecutarse despues de npm ci');
  assert.ok(perfIndex > sharpIndex, 'perf:check debe ejecutarse despues de preparar sharp');
});

test('ext_funcionales usa el gate OMR canónico', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const block = extractJobBlock(workflow, 'ext_funcionales');

  assert.match(block, /Etapa omr-canonical-real-gate/);
  assert.doesNotMatch(block, /OMR_TV_GATE_VERSION/);
  assert.match(block, /npm run test:omr:canonical:gate:ci/);
});

test('ext_funcionales ejecuta PDF print y visual juntos', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const block = extractJobBlock(workflow, 'ext_funcionales');

  assert.match(block, /Etapa pdf-print-check/);
  assert.match(block, /npm run test:pdf-print:ci/);
  assert.match(block, /npm run test:pdf-visual:ci/);
});

test('ext_funcionales conserva quality visual y journeys para UX', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const block = extractJobBlock(workflow, 'ext_funcionales');

  assert.match(block, /Etapa ux-visual-check/);
  assert.match(block, /npm run test:ux-quality:ci/);
  assert.match(block, /npm run test:ux-visual:ci/);
  assert.match(block, /npm run test:e2e:journeys:ci/);
});

test('core backend ejecuta auditoria focal classroom cuando el mapa la activa', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const block = extractJobBlock(workflow, 'core_backend_portal');

  assert.match(workflow, /gate_classroom_audit_check/);
  assert.match(block, /Etapa classroom-audit-check/);
  assert.match(block, /npm run test:classroom:audit:ci/);
});

test('core contract valida installer afectado sin depender del bundle release', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const block = extractJobBlock(workflow, 'core_contract_docs_gov');

  assert.match(block, /Etapa installer-contract-check/);
  assert.match(block, /needs\.detectar_cambios\.outputs\.installer == 'true'/);
  assert.match(block, /npm run test:installer-hub:contract/);
  assert.match(block, /npm run test:wix:policy/);
});

test('workflow CI unifica concurrency por repo fuente y branch fuente', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /github\.event\.pull_request\.head\.repo\.full_name \|\| github\.repository/);
  assert.match(workflow, /github\.event\.pull_request\.head\.ref \|\| github\.head_ref \|\| github\.ref_name/);
  assert.doesNotMatch(workflow, /group:\s*ci-\$\{\{\s*github\.workflow\s*\}\}-\$\{\{\s*github\.ref\s*\}\}/);
});

test('workflow CI expone force_full_ci y gating affected-only en extended', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /workflow_dispatch:\s+inputs:\s+force_full_ci:/s);
  assert.match(workflow, /job_ext_funcionales/);
  assert.match(workflow, /job_ext_perf_arquitectura/);
  assert.match(workflow, /job_ext_compliance_evidencia/);
  assert.match(workflow, /gate_flujo_docente_check/);
  assert.match(workflow, /gate_perf_check/);
  assert.match(workflow, /gate_qa_manifest/);
  assert.match(workflow, /inputs\.force_full_ci/);
  assert.match(workflow, /needs\.detectar_cambios\.outputs\.escalation == 'full-extended'/);
});

test('workflows core reservan push para ramas de integracion', () => {
  const coreWorkflows = [
    'ci.yml',
    'ci-backend.yml',
    'ci-docs.yml',
    'ci-frontend.yml',
    'ci-portal.yml'
  ];

  for (const workflowName of coreWorkflows) {
    const workflow = fs.readFileSync(path.join(workflowDir, workflowName), 'utf8');

    assert.match(workflow, /push:\s+branches:\s+- "main"\s+- "release\/\*\*"/s, workflowName);
    assert.match(workflow, /pull_request:/, workflowName);
    assert.doesNotMatch(workflow, /push:\s+branches:\s+- "\*\*"/s, workflowName);
  }
});

test('workflow CI mantiene schedule full para jobs extended', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const funcionales = extractJobBlock(workflow, 'ext_funcionales');
  const perf = extractJobBlock(workflow, 'ext_perf_arquitectura');
  const compliance = extractJobBlock(workflow, 'ext_compliance_evidencia');

  assert.match(funcionales, /github\.event_name == 'schedule'/);
  assert.match(perf, /github\.event_name == 'schedule'/);
  assert.match(compliance, /github\.event_name == 'schedule'/);
});

test('jobs extended generan Prisma antes de importar backend', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const cases = [
    ['ext_funcionales', 'run: npm run test:flujo-docente:ci'],
    ['ext_perf_arquitectura', 'run: npm run perf:check'],
    ['ext_compliance_evidencia', 'run: npm run test:compliance:dsr-flow']
  ];

  for (const [jobKey, firstBackendCommand] of cases) {
    const block = extractJobBlock(workflow, jobKey);
    const setupIndex = block.indexOf('npm ci --foreground-scripts');
    const prismaIndex = block.indexOf('npx prisma generate --config=apps/backend/prisma.config.mjs');
    const commandIndex = block.indexOf(firstBackendCommand);

    assert.ok(setupIndex >= 0, `${jobKey}: faltante npm ci`);
    assert.ok(prismaIndex > setupIndex, `${jobKey}: prisma generate debe ejecutarse despues de npm ci`);
    assert.ok(commandIndex > prismaIndex, `${jobKey}: comandos backend deben ejecutarse despues de prisma generate`);
  }
});

test('workflows usan actions oficiales compatibles con runtime Node 24', () => {
  const workflows = fs.readdirSync(workflowDir).filter((file) => /\.ya?ml$/i.test(file));
  const deprecatedRuntimeActions = [
    /actions\/checkout@v4/,
    /actions\/setup-node@v4/,
    /actions\/upload-artifact@v4/
  ];

  for (const workflow of workflows) {
    const content = fs.readFileSync(path.join(workflowDir, workflow), 'utf8');

    for (const action of deprecatedRuntimeActions) {
      assert.doesNotMatch(content, action, `${workflow} conserva ${action}`);
    }
  }
});

test('gate backend CI usa runner por lotes para evitar crashes monoliticos de workers', () => {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const gate = String(packageJson.scripts?.['test:backend:ci'] ?? '');

  assert.match(gate, /node scripts\/testing\/run-backend-test-batches\.mjs/);
});

test('release stable gate expone GH_TOKEN para gh cli', () => {
  const workflow = fs.readFileSync(path.join(workflowDir, 'release-stable-gate.yml'), 'utf8');

  assert.match(workflow, /GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/);
  assert.match(workflow, /validate-stable-promotion\.mjs/);
});

test('workflows de validacion reducen GITHUB_TOKEN a lectura', () => {
  const readOnlyWorkflows = [
    'ci.yml',
    'ci-backend.yml',
    'ci-frontend.yml',
    'ci-portal.yml',
    'ci-docs.yml',
    'ci-antivirus-gate.yml',
    'ci-policy-audit.yml'
  ];

  for (const workflowName of readOnlyWorkflows) {
    const workflow = fs.readFileSync(path.join(workflowDir, workflowName), 'utf8');
    assert.match(workflow, /^permissions:\s*\n\s+contents:\s*read\s*$/m, workflowName);
  }

  const installerWorkflow = fs.readFileSync(path.join(workflowDir, 'ci-installer-windows.yml'), 'utf8');
  assert.match(installerWorkflow, /^permissions:\s*\n\s+contents:\s*read\s*$/m);
  assert.match(installerWorkflow, /installer_windows:[\s\S]*?permissions:\s*\n\s+contents:\s*read/);
  assert.match(installerWorkflow, /publish_installer_release:[\s\S]*?permissions:\s*\n\s+contents:\s*write/);

  const beta = fs.readFileSync(path.join(workflowDir, 'release-beta.yml'), 'utf8');
  assert.match(beta, /^permissions:\s*\n\s+contents:\s*read\s*$/m);
  assert.match(beta, /beta_release:[\s\S]*?permissions:\s*\n\s+contents:\s*write/);

  const stable = fs.readFileSync(path.join(workflowDir, 'release-stable-gate.yml'), 'utf8');
  assert.match(stable, /^permissions:\s*\n\s+contents:\s*read\s*$/m);
  assert.match(stable, /promote_latest:[\s\S]*?permissions:\s*\n\s+contents:\s*write/);
  assert.doesNotMatch(stable.match(/stable_gate:[\s\S]*?promote_latest:/)?.[0] ?? '', /contents:\s*write/);

  const pages = fs.readFileSync(path.join(workflowDir, 'pages-marketing.yml'), 'utf8');
  assert.match(pages, /^permissions:\s*\n\s+contents:\s*read\s*$/m);
  assert.match(pages, /deploy:[\s\S]*?permissions:[\s\S]*?pages:\s*write[\s\S]*?id-token:\s*write/);
  assert.doesNotMatch(pages.match(/validate:[\s\S]*?deploy:/)?.[0] ?? '', /pages:\s*write|id-token:\s*write/);

  const autogen = fs.readFileSync(path.join(workflowDir, 'autogen-docs.yml'), 'utf8');
  assert.match(autogen, /^permissions:\s*\n\s+contents:\s*read\s*$/m);
  assert.match(autogen, /publish_docs:[\s\S]*?permissions:\s*\n\s+contents:\s*write/);

  const tagGuard = fs.readFileSync(path.join(workflowDir, 'tag-release-guard.yml'), 'utf8');
  assert.match(tagGuard, /^permissions:\s*\n\s+contents:\s*read\s*$/m);
  assert.match(tagGuard, /cleanup_invalid_tag:[\s\S]*?permissions:\s*\n\s+contents:\s*write/);
});

test('publicaciones externas serializan ejecuciones en curso', () => {
  const nonInterruptibleWorkflows = [
    'package.yml',
    'release-beta.yml',
    'release-stable-gate.yml',
    'tag-release-guard.yml'
  ];

  for (const workflowName of nonInterruptibleWorkflows) {
    const workflow = fs.readFileSync(path.join(workflowDir, workflowName), 'utf8');
    assert.match(workflow, /cancel-in-progress:\s*false/, workflowName);
  }

  const installerWorkflow = fs.readFileSync(path.join(workflowDir, 'ci-installer-windows.yml'), 'utf8');
  assert.match(installerWorkflow, /cancel-in-progress:\s*\$\{\{\s*!startsWith\(github\.ref, 'refs\/tags\/v'\)\s*\}\}/);
});

test('release beta automatica escucha CI Checks exitoso de main', () => {
  const beta = fs.readFileSync(path.join(workflowDir, 'release-beta.yml'), 'utf8');
  const triggers = beta.match(/^on:\n([\s\S]*?)^concurrency:/m)?.[1] ?? '';

  assert.match(triggers, /workflow_run:\n\s+workflows:\n\s+- ["']CI Checks["']\n\s+types:\s*\n\s+- completed\n\s+branches:\s*\n\s+- main/);
  assert.match(beta, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(beta, /github\.event\.workflow_run\.head_branch == 'main'/);
});

test('CI central concentra suites completas y cobertura sin excluir todo el código fuente', () => {
  const central = fs.readFileSync(workflowPath, 'utf8');
  const moduleWorkflows = ['ci-backend.yml', 'ci-frontend.yml', 'ci-portal.yml', 'ci-docs.yml'];

  assert.match(central, /npm -C apps\/backend run test:coverage/);
  assert.match(central, /npm run test:frontend:coverage:min/);
  assert.match(central, /npm -C apps\/portal_alumno_cloud run test:coverage/);
  assert.match(central, /npm run test:coverage:diff -- --apps backend,portal/);
  assert.match(central, /npm run test:coverage:diff -- --apps frontend/);
  assert.doesNotMatch(central, /DIFF_COVERAGE_IGNORE_PATH_SUBSTRINGS:[^\n]*apps\/(?:backend|frontend|portal_alumno_cloud)\/src(?:[;" ]|$)/);

  for (const name of moduleWorkflows) {
    const moduleWorkflow = fs.readFileSync(path.join(workflowDir, name), 'utf8');
    assert.doesNotMatch(moduleWorkflow, /test:coverage|test:coverage:diff|test:coverage:exclusions:debt/, name);
  }

  const backend = fs.readFileSync(path.join(workflowDir, 'ci-backend.yml'), 'utf8');
  const frontend = fs.readFileSync(path.join(workflowDir, 'ci-frontend.yml'), 'utf8');
  const portal = fs.readFileSync(path.join(workflowDir, 'ci-portal.yml'), 'utf8');
  const docs = fs.readFileSync(path.join(workflowDir, 'ci-docs.yml'), 'utf8');
  assert.match(backend, /test:omr:canonical:gate:ci/);
  assert.match(backend, /tests OMR criticos/);
  assert.match(frontend, /guard:wcag/);
  assert.match(portal, /run typecheck/);
  assert.match(docs, /run sdd:audit/);
});

test('package workflow rechaza tag que no coincide con package.json antes de publicar', () => {
  const workflow = fs.readFileSync(path.join(workflowDir, 'package.yml'), 'utf8');
  const validationIndex = workflow.indexOf('${GITHUB_REF_NAME#v}');
  const pushIndex = workflow.indexOf('docker push');

  assert.ok(validationIndex >= 0, 'falta validación de versión de tag');
  assert.ok(pushIndex > validationIndex, 'la validación debe ocurrir antes de publicar imágenes');
  assert.match(workflow, /no coincide con package\.json/);
});

test('qa:full genera el manifiesto despues de todos los reportes que incluye', () => {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const qaFull = String(packageJson.scripts?.['qa:full'] ?? '');
  const architectureIndex = qaFull.indexOf('qa:clean-architecture:check');
  const manifestIndex = qaFull.indexOf('test:qa:manifest');

  assert.ok(architectureIndex >= 0, 'qa:full debe ejecutar clean architecture');
  assert.ok(manifestIndex > architectureIndex, 'qa:full debe generar manifest despues de clean architecture');
  assert.equal(manifestIndex, qaFull.lastIndexOf('test:qa:manifest'), 'qa:full debe finalizar con el manifiesto actualizado');
});

test('release stable gate materializa manifest del instalador antes de validar', () => {
  const workflow = fs.readFileSync(path.join(workflowDir, 'release-stable-gate.yml'), 'utf8');
  const downloadIndex = workflow.indexOf('gh release download "$TAG"');
  const manifestIndex = workflow.indexOf('dist/installer/EvaluaPro-release-manifest.json');
  const validateIndex = workflow.indexOf('validate-stable-promotion.mjs');

  assert.ok(downloadIndex >= 0, 'release stable gate debe descargar manifest desde release assets');
  assert.ok(manifestIndex > downloadIndex, 'release stable gate debe materializar manifest en dist/installer');
  assert.ok(validateIndex > manifestIndex, 'release stable gate debe validar despues de descargar el manifest');
});

test('release stable gate genera QA fresco ligado al SHA candidato antes de validar', () => {
  const workflow = fs.readFileSync(path.join(workflowDir, 'release-stable-gate.yml'), 'utf8');
  const installIndex = workflow.indexOf('npm ci --foreground-scripts');
  const prismaIndex = workflow.indexOf('npx prisma generate --config=apps/backend/prisma.config.mjs');
  const playwrightIndex = workflow.indexOf('npx playwright install --with-deps chromium');
  const matrixIndex = workflow.indexOf('npm run gui:screen-matrix');
  const restoreIndex = workflow.indexOf('git restore -- docs/release/manual/gui-screen-matrix.md');
  const responsiveIndex = workflow.indexOf('npm run test:gui:responsive:e2e:ci');
  const qaIndex = workflow.indexOf('npm run qa:full');
  const validateIndex = workflow.indexOf('validate-stable-promotion.mjs');

  assert.ok(installIndex >= 0, 'release stable gate debe instalar dependencias');
  assert.ok(prismaIndex > installIndex, 'Prisma debe generarse despues de instalar dependencias');
  assert.ok(playwrightIndex > prismaIndex, 'Playwright debe instalarse despues de generar Prisma');
  assert.ok(matrixIndex > playwrightIndex, 'la matriz GUI debe generarse despues de instalar Chromium');
  assert.ok(restoreIndex > matrixIndex, 'el markdown generado debe restaurarse antes de medir limpieza');
  assert.ok(responsiveIndex > restoreIndex, 'E2E responsive debe generar capturas antes del manifiesto');
  assert.ok(qaIndex > responsiveIndex, 'QA completa debe generar manifiesto tras las capturas');
  assert.ok(validateIndex > qaIndex, 'el gate debe validar despues de generar QA del SHA actual');
  assert.match(workflow, /reports\/qa\/latest/);
});

test('CI frontend activa el mismo conjunto de guardas WCAG para push y pull request', () => {
  const workflow = fs.readFileSync(path.join(workflowDir, 'ci-frontend.yml'), 'utf8');
  const pushPaths = workflow.match(/  push:[\s\S]*?    paths:\n([\s\S]*?)  pull_request:/)?.[1] || '';
  const pullRequestPaths = workflow.match(/  pull_request:\n    paths:\n([\s\S]*?)  workflow_dispatch:/)?.[1] || '';
  const frontendMap = JSON.parse(fs.readFileSync(path.join(root, 'ci', 'affected-test-map.json'), 'utf8')).groups.frontend.paths;
  const guards = [
    'scripts/wcag-guard.mjs',
    'scripts/tests/ui-contrast-audit.mjs',
    'scripts/tests/wcag-guard.contract.test.mjs',
    'docs/WCAG_UI_POLICY.md'
  ];

  for (const guard of guards) {
    assert.ok(pushPaths.includes(guard), `push debe incluir ${guard}`);
    assert.ok(pullRequestPaths.includes(guard), `pull_request debe incluir ${guard}`);
    assert.ok(frontendMap.includes(guard), `el mapa affected CI debe asignar ${guard} al frontend`);
  }
});

test('guardas de release esperan al menos el timeout combinado del build y la publicación', () => {
  const installer = fs.readFileSync(path.join(workflowDir, 'ci-installer-windows.yml'), 'utf8');
  const tagGuard = fs.readFileSync(path.join(workflowDir, 'tag-release-guard.yml'), 'utf8');
  const stableGate = fs.readFileSync(path.join(workflowDir, 'release-stable-gate.yml'), 'utf8');
  const installerMinutes = Number(installer.match(/installer_windows:[\s\S]*?timeout-minutes:\s*(\d+)/)?.[1]);
  const publishMinutes = Number(installer.match(/publish_installer_release:[\s\S]*?timeout-minutes:\s*(\d+)/)?.[1]);
  const releaseWindowMinutes = installerMinutes + publishMinutes;
  const tagTimeoutMinutes = Number(tagGuard.match(/timeout-minutes:\s*(\d+)/)?.[1]);
  const tagAttempts = Number(tagGuard.match(/max_attempts=(\d+)/)?.[1]);
  const tagSleepSeconds = Number(tagGuard.match(/sleep_seconds=(\d+)/)?.[1]);
  const stableTimeoutMinutes = Number(stableGate.match(/timeout-minutes:\s*(\d+)/)?.[1]);
  const stableAttempts = Number(stableGate.match(/for attempt in \{1\.\.(\d+)\}/)?.[1]);

  assert.ok(tagAttempts * tagSleepSeconds / 60 >= releaseWindowMinutes, 'tag guard debe cubrir build MSI y publicacion');
  assert.ok(tagTimeoutMinutes >= tagAttempts * tagSleepSeconds / 60 + 10, 'timeout del tag guard debe cubrir la ventana y margen');
  assert.ok(stableAttempts * tagSleepSeconds / 60 >= releaseWindowMinutes, 'gate estable debe cubrir build MSI y publicacion');
  assert.ok(stableTimeoutMinutes >= releaseWindowMinutes + 90, 'gate estable debe dejar margen para QA completa');
});

test('release stable gate es el unico que promueve Latest despues de validar', () => {
  const installerWorkflow = fs.readFileSync(path.join(workflowDir, 'ci-installer-windows.yml'), 'utf8');
  const stableGateWorkflow = fs.readFileSync(path.join(workflowDir, 'release-stable-gate.yml'), 'utf8');
  const validateIndex = stableGateWorkflow.indexOf('validate-stable-promotion.mjs');
  const latestIndex = stableGateWorkflow.indexOf('gh release edit "v$TARGET_VERSION"');

  assert.match(installerWorkflow, /make_latest:\s*false/);
  assert.doesNotMatch(installerWorkflow, /make_latest:\s*\$\{\{[^}]*!\(/);
  assert.match(stableGateWorkflow, /promote_latest:[\s\S]*?permissions:\s*\n\s+contents:\s*write/);
  assert.ok(validateIndex >= 0, 'release stable gate debe ejecutar validate-stable-promotion');
  assert.ok(latestIndex > validateIndex, 'release stable gate debe marcar Latest solo despues de validar');
  assert.match(stableGateWorkflow.slice(latestIndex), /--latest/);
});

test('release stable gate valida SemVer numérico y pasa argumentos con array sin interpolacion shell', () => {
  const workflow = fs.readFileSync(path.join(workflowDir, 'release-stable-gate.yml'), 'utf8');
  const resolveIndex = workflow.indexOf('TARGET="${INPUT_VERSION:-$GITHUB_REF_NAME}"');
  const semverIndex = workflow.indexOf('La versión estable debe tener formato SemVer numérico X.Y.Z');
  const tagIndex = workflow.indexOf('TAG="v$TARGET_VERSION"');
  const argsIndex = workflow.indexOf('args=(');
  const invokeIndex = workflow.indexOf('node scripts/release/validate-stable-promotion.mjs "${args[@]}"');

  assert.ok(resolveIndex >= 0, 'la versión de entrada debe llegar por env');
  assert.ok(semverIndex > resolveIndex, 'SemVer numérico debe validarse antes de usar la versión');
  assert.ok(tagIndex > semverIndex, 'la tag del release debe construirse despues de validar SemVer');
  assert.ok(argsIndex >= 0, 'los argumentos deben componerse en un array Bash');
  assert.ok(invokeIndex > argsIndex, 'el CLI debe recibir el array como argumentos separados');
  assert.match(workflow, /INPUT_VERSION:\s*\$\{\{ inputs\.version \}\}/);
  assert.match(workflow, /EVIDENCE_DIR:\s*\$\{\{ inputs\.evidence_dir \}\}/);
});

test('Dockerfile backend incluye schema Prisma antes del build', () => {
  const dockerfile = fs.readFileSync(backendDockerfilePath, 'utf8');
  const prismaIndex = dockerfile.indexOf('COPY apps/backend/prisma ./apps/backend/prisma');
  const buildIndex = dockerfile.indexOf('npm --workspace apps/backend run build');

  assert.ok(prismaIndex >= 0, 'Dockerfile backend debe copiar apps/backend/prisma');
  assert.ok(buildIndex > prismaIndex, 'backend build debe ejecutarse despues de copiar Prisma');
});

test('Dockerfile frontend incluye el wrapper y la política de configuración del workspace', () => {
  const dockerfile = fs.readFileSync(frontendDockerfilePath, 'utf8');
  const scriptIndex = dockerfile.indexOf('COPY scripts/vite-build-safe.mjs ./scripts/vite-build-safe.mjs');
  const appVersionIndex = dockerfile.indexOf('COPY config/app-version.json ./config/app-version.json');
  const omrPolicyIndex = dockerfile.indexOf('COPY config/omr-version-policy.json ./config/omr-version-policy.json');
  const buildIndex = dockerfile.indexOf('npm --workspace apps/frontend run build');

  assert.ok(scriptIndex >= 0, 'Dockerfile frontend debe copiar scripts/vite-build-safe.mjs');
  assert.ok(appVersionIndex >= 0, 'Dockerfile frontend debe copiar config/app-version.json');
  assert.ok(omrPolicyIndex >= 0, 'Dockerfile frontend debe copiar config/omr-version-policy.json');
  assert.ok(buildIndex > scriptIndex, 'frontend build debe ejecutarse despues de copiar el wrapper');
  assert.ok(buildIndex > appVersionIndex, 'frontend build debe ejecutarse despues de copiar app-version');
  assert.ok(buildIndex > omrPolicyIndex, 'frontend build debe ejecutarse despues de copiar la politica OMR');
});
