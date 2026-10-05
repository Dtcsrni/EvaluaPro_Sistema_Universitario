/**
 * security-workflow-policy.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function extractRunScripts(workflow) {
  const lines = workflow.split(/\r?\n/);
  const scripts = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)run:\s*(.*)$/);
    if (!match) continue;

    const indent = match[1].length;
    const value = match[2].trim();
    if (value && !/^[|>]\+?-?$/.test(value)) {
      scripts.push(value);
      continue;
    }

    const body = [];
    for (let bodyIndex = index + 1; bodyIndex < lines.length; bodyIndex += 1) {
      const line = lines[bodyIndex];
      if (line.trim() && line.match(/^\s*/)[0].length <= indent) break;
      body.push(line);
    }
    scripts.push(body.join('\n'));
  }

  return scripts;
}

test('workflow CodeQL existe y contiene contrato minimo', () => {
  const workflowPath = path.join(root, '.github', 'workflows', 'security-codeql.yml');
  assert.equal(fs.existsSync(workflowPath), true);
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /name:\s*Security CodeQL/i);
  assert.match(workflow, /pull_request:/i);
  assert.match(workflow, /push:/i);
  assert.match(workflow, /github\/codeql-action\/init@/i);
  assert.match(workflow, /github\/codeql-action\/analyze@/i);
  assert.match(workflow, /javascript-typescript/i);
});

test('todas las GitHub Actions externas están fijadas a un SHA completo', () => {
  const workflows = fs.readdirSync(path.join(root, '.github', 'workflows')).filter((name) => /\.ya?ml$/i.test(name));
  const pinnedSha = /^[0-9a-f]{40}$/i;

  for (const workflowName of workflows) {
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', workflowName), 'utf8');
    for (const [, reference] of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
      if (reference.startsWith('./') || reference.startsWith('docker://')) continue;
      const at = reference.lastIndexOf('@');
      assert.ok(at > 0, `${workflowName}: falta pin SHA en ${reference}`);
      assert.match(reference.slice(at + 1), pinnedSha, `${workflowName}: referencia flotante ${reference}`);
    }
  }
});

test('workflows no interpolan expresiones GitHub directamente en bloques run', () => {
  const workflows = [
    'autogen-docs.yml',
    'ci-backend.yml',
    'ci-frontend.yml',
    'ci-portal.yml',
    'ci.yml',
    'ci-installer-windows.yml',
    'package.yml',
    'release-beta.yml',
    'release-stable-gate.yml'
  ];

  for (const workflowName of workflows) {
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', workflowName), 'utf8');
    const runScripts = extractRunScripts(workflow);
    const declaredRunCount = workflow.match(/^\s+run:/gm)?.length ?? 0;
    assert.ok(declaredRunCount > 0, `${workflowName} debe contener bloques run`);
    assert.equal(runScripts.length, declaredRunCount, `${workflowName} debe analizar todos sus bloques run`);
    for (const [index, script] of runScripts.entries()) {
      assert.equal(script.includes('${{'), false, `${workflowName} run #${index + 1} interpola contexto GitHub dentro del script`);
    }
  }
});

test('refs de PR y tag se validan desde env antes de usarse en fetch, push o URLs', () => {
  for (const workflowName of ['ci-backend.yml', 'ci-frontend.yml', 'ci-portal.yml', 'ci.yml']) {
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', workflowName), 'utf8');
    assert.match(workflow, /BASE_REF:\s*\$\{\{ github\.base_ref \}\}/, workflowName);
    assert.match(workflow, /git check-ref-format "refs\/heads\/\$BASE_REF"/, workflowName);
    assert.match(workflow, /git fetch --depth=1 origin "refs\/heads\/\$BASE_REF:refs\/remotes\/origin\/\$BASE_REF"/, workflowName);
  }

  const docsWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'autogen-docs.yml'), 'utf8');
  assert.match(docsWorkflow, /TARGET_BRANCH:\s*\$\{\{ github\.ref_name \}\}/);
  assert.match(docsWorkflow, /\$GITHUB_REF" != refs\/heads\/\*/);
  assert.match(docsWorkflow, /git check-ref-format "refs\/heads\/\$TARGET_BRANCH"/);
  assert.match(docsWorkflow, /git push origin "HEAD:refs\/heads\/\$TARGET_BRANCH"/);

  const installerWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci-installer-windows.yml'), 'utf8');
  assert.match(installerWorkflow, /RELEASE_TAG:\s*\$\{\{ github\.ref_name \}\}/);
  assert.match(installerWorkflow, /RELEASE_REPOSITORY:\s*\$\{\{ github\.repository \}\}/);
  assert.match(installerWorkflow, /\$tag -notmatch '\^v\(0\|\[1-9\]\[0-9\]\*\)/);
  assert.match(installerWorkflow, /https:\/\/github\.com\/\$repository\/releases\/download\/\$tag/);
});

test('metadatos de imágenes y beta se validan antes de construir comandos o rutas', () => {
  const packageWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'package.yml'), 'utf8');
  assert.match(packageWorkflow, /API_IMAGE:\s*\$\{\{ steps\.meta\.outputs\.api_image \}\}/);
  assert.match(packageWorkflow, /IMAGE_VERSION:\s*\$\{\{ steps\.meta\.outputs\.version \}\}/);
  assert.match(packageWorkflow, /docker build[\s\S]*-t "\$API_IMAGE:\$IMAGE_VERSION"/);
  assert.match(packageWorkflow, /docker push "\$WEB_IMAGE:\$IMAGE_VERSION"/);
  assert.match(packageWorkflow, /docker image inspect "\$API_IMAGE:\$IMAGE_VERSION"/);
  assert.match(packageWorkflow, /Metadata de imagen inválida para publicación/);

  const betaWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'release-beta.yml'), 'utf8');
  assert.match(betaWorkflow, /BETA_TAG:\s*\$\{\{ needs\.beta_gate\.outputs\.beta_tag \}\}/);
  assert.match(betaWorkflow, /BETA_VERSION:\s*\$\{\{ needs\.beta_gate\.outputs\.beta_version \}\}/);
  assert.match(betaWorkflow, /Formato de tag beta inválido/);
  assert.match(betaWorkflow, /Version beta inválida para buscar notas/);
  assert.match(betaWorkflow, /releases\/download\/\$tag/);
});

