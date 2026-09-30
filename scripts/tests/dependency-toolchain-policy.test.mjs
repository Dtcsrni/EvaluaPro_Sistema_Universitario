import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('Node, npm y .NET tienen versiones estables fijadas y compatibles', () => {
  const pkg = readJson('package.json');
  const sdk = readJson('global.json');
  assert.equal(pkg.packageManager, 'npm@12.1.0');
  assert.equal(pkg.engines.node, '>=24.15.0');
  assert.equal(pkg.engines.npm, '>=12.1.0');
  assert.equal(sdk.sdk.version, '10.0.401');
  assert.equal(sdk.sdk.allowPrerelease, false);
});

test('npm 12 permite solo scripts requeridos y fijados, niega descargas opcionales', () => {
  const scripts = readJson('package.json').allowScripts;
  for (const key of ['@prisma/engines@7.10.0', 'better-sqlite3@12.11.1', 'esbuild@0.28.1', 'prisma@7.10.0']) {
    assert.equal(scripts[key], true, `falta aprobación explícita para ${key}`);
  }
  assert.equal(scripts['puppeteer@25.3.0'], false);
  assert.equal(scripts['tesseract.js@7.0.0'], false);
});

test('Prisma 7 SQLite usa adapter y URLs externas a los schemas', () => {
  for (const app of ['apps/backend', 'apps/portal_alumno_cloud']) {
    const pkg = readJson(`${app}/package.json`);
    const schema = fs.readFileSync(path.join(root, app, 'prisma/schema.prisma'), 'utf8');
    const config = fs.readFileSync(path.join(root, app, 'prisma.config.mjs'), 'utf8');
    assert.equal(pkg.dependencies['@prisma/client'], '^7.10.0');
    assert.equal(pkg.dependencies['@prisma/adapter-better-sqlite3'], '^7.10.0');
    assert.equal(pkg.devDependencies.prisma, '^7.10.0');
    assert.match(config, /datasource:\s*\{\s*url:/);
    assert.doesNotMatch(schema, /url\s*=\s*env\(/);
  }
});

test('WiX y Burn usan v7 y aceptación explícita de la EULA wix7', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build-msi.ps1'), 'utf8');
  const csproj = fs.readFileSync(path.join(root, 'packaging/wix/BurnBootstrapperApp/EvaluaPro.BurnBootstrapperApp.csproj'), 'utf8');
  assert.match(build, /eula', 'accept', 'wix7/);
  assert.match(build, /wixext7/);
  assert.match(csproj, /WixToolset\.BootstrapperApplicationApi" Version="7\.0\.0"/);
  for (const file of ['.github/workflows/ci-installer-windows.yml', '.github/workflows/release-beta.yml']) {
    const workflow = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(workflow, /dotnet-version:\s*10\.0\.x/);
    assert.match(workflow, /wix --version/);
    assert.match(workflow, /wix eula accept wix7/);
  }
});

test('locks de npm cubren todas las dependencias declaradas por cada proyecto', () => {
  for (const project of ['.', 'apps/backend', 'apps/frontend', 'apps/portal_alumno_cloud']) {
    const pkg = readJson(path.join(project, 'package.json'));
    const lock = readJson(path.join(project, 'package-lock.json'));
    assert.equal(lock.packages[''].name, pkg.name);
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [name, version] of Object.entries(pkg[section] ?? {})) {
        const entry = lock.packages[''].dependencies?.[name]
          ?? lock.packages[''].devDependencies?.[name]
          ?? lock.packages[''].optionalDependencies?.[name];
        assert.equal(entry, version, `${project}: lock desactualizado para ${name}`);
      }
    }
  }
});
