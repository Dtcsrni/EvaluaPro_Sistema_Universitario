import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareVersions,
  normalizeResolvedHostDeclarationPath,
  readCurrentPublicApis,
  readCurrentCompositionApis,
  inspectModuleContracts,
  parseVersion,
  satisfiesRange,
  validateAppendOnlyHistory,
  validatePublicApiHistory,
  writeModuleContractReport
} from '../module-contract-check.mjs';

const temporaryRoots = [];

function fixture({
  importsA = "import '../b/index.js';",
  importsB = '',
  sourceA = '',
  sourceB = '',
  dependenciesA = [{ module: 'b', contractRange: '^1.0.0' }],
  dependenciesB = [],
  hostCompatibilityA = '>=1.2.0 <2.0.0',
  hostCompatibilityB = '>=1.2.0 <2.0.0',
  versionA = '1.0.0',
  versionB = '1.0.0',
  ownersA = ['User'],
  ownersB = [],
  compositionA = 'export const hostAdapter = true;',
  compositionB = 'export const hostAdapter = true;',
  entryA,
  aliasB
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-module-contract-'));
  temporaryRoots.push(root);
  const write = (rel, content) => {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  };
  const privateImports = aliasB ? "import '@b-private';" : importsA;
  write('src/modulos/a/index.ts', `${privateImports}\n${sourceA}\n`);
  write('src/modulos/b/index.ts', `${importsB}\n${sourceB}\n`);
  write('src/modulos/a/composition.ts', `${compositionA}\n`);
  write('src/modulos/b/composition.ts', `${compositionB}\n`);
  if (aliasB) write('src/modulos/b/private.ts', 'export const internal = true;\n');
  write('package.json', JSON.stringify({ version: '1.2.0' }));
  write('apps/backend/prisma/schema.prisma', 'model User {\n id String @id\n}\n');
  write('tsconfig.fixture.json', JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      baseUrl: '.',
      paths: aliasB ? { '@b-private': ['src/modulos/b/private.ts'] } : {}
    },
    include: ['src/modulos/**/*.ts']
  }));

  const apis = readCurrentPublicApis({ root, moduleRoot: 'src/modulos', tsconfigPath: 'tsconfig.fixture.json' });
  const compositionApis = readCurrentCompositionApis({ root, moduleRoot: 'src/modulos', tsconfigPath: 'tsconfig.fixture.json' });
  const module = (id, dependencies, hostCompatibility, persistenceModels, contractVersion = '1.0.0', entry = `src/modulos/${id}/index.ts`) => ({
    id,
    contractVersion,
    entry,
    compositionEntry: `src/modulos/${id}/composition.ts`,
    hostCompatibility,
    dependencies,
    persistenceModels,
    publicApiHistory: [{ version: contractVersion, exports: apis[id] }],
    compositionApiHistory: [{ version: contractVersion, exports: compositionApis[id] }]
  });
  write('contracts.json', JSON.stringify({
    schemaVersion: 2,
    host: { version: '1.2.0', compatibility: '>=1.2.0 <2.0.0' },
    persistence: { migrationStrategy: 'expand-migrate-contract', singleDatabase: true },
    modules: [
      module('a', dependenciesA, hostCompatibilityA, ownersA, versionA, entryA),
      module('b', dependenciesB, hostCompatibilityB, ownersB, versionB)
    ]
  }));
  return root;
}

const inspect = (root) => inspectModuleContracts({
  root,
  moduleRoot: 'src/modulos',
  manifestPath: 'contracts.json',
  prismaSchemaPath: 'apps/backend/prisma/schema.prisma',
  tsconfigPath: 'tsconfig.fixture.json'
});

test('normaliza rutas de tipos externos igual con node_modules local o junction', () => {
  const root = path.join(os.tmpdir(), 'evaluapro-contract-root');
  const hostSourceRoot = path.join(root, 'apps/backend/src');
  const localPackage = path.join(root, 'node_modules/@types/express-serve-static-core/index.d.ts');
  const junctionPackage = path.join(os.tmpdir(), 'evaluapro-dependency-store/node_modules/@types/express-serve-static-core/index.d.ts');

  const local = normalizeResolvedHostDeclarationPath(localPackage, hostSourceRoot, root);
  const throughJunction = normalizeResolvedHostDeclarationPath(junctionPackage, hostSourceRoot, root);

  assert.equal(local, '../../../node_modules/@types/express-serve-static-core/index.d.ts');
  assert.equal(throughJunction, local);
});

test('la base vigente registra todos los módulos, sin ciclos ni modelos huérfanos', () => {
  const result = inspectModuleContracts({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.modules, 21);
  assert.equal(result.dependencyPairs, 39);
  assert.equal(result.cycles.length, 0);
  assert.equal(result.declaredModelOwners, result.prismaModels);
  assert.ok(result.dependencyGraph.modulo_admin_docentes.includes('modulo_autenticacion'));
  assert.ok(result.transitiveConsumers.modulo_autenticacion.length > 0);
});

test('el contrato PDF versiona el cambio incompatible de Zod 4 y todos sus consumidores', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs/contracts/module-contracts.v2.json'), 'utf8'));
  const pdf = manifest.modules.find((item) => item.id === 'modulo_generacion_pdf');
  assert.equal(pdf.contractVersion, '2.0.0');
  assert.equal(pdf.publicApiHistory.at(-1).version, '2.0.0');
  for (const consumerId of [
    'modulo_calificacion',
    'modulo_escaneo_omr',
    'modulo_recuperacion_examenes',
    'modulo_sincronizacion_nube'
  ]) {
    const consumer = manifest.modules.find((item) => item.id === consumerId);
    assert.equal(consumer.dependencies.find((item) => item.module === 'modulo_generacion_pdf')?.contractRange, '^2.0.0', consumerId);
  }
});

test('el host del registro debe coincidir con la versión del producto', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '1.2.1' }), 'utf8');
  assert.ok(inspect(root).errors.some((error) => error.includes('host.version.mismatch')));
});

test('el host no puede importar archivos privados en lugar de composition.ts', () => {
  const root = fixture();
  const hostRoot = path.join(root, 'apps/backend/src/rutas.ts');
  fs.mkdirSync(path.dirname(hostRoot), { recursive: true });
  fs.writeFileSync(hostRoot, "import '../../../src/modulos/b/private.js';\n", 'utf8');
  fs.writeFileSync(path.join(root, 'src/modulos/b/private.ts'), 'export const internal = true;\n', 'utf8');
  assert.ok(inspect(root).errors.some((error) => error.includes('b.host.private-import')));
});

test('los servicios compartidos solo consumen la API de dominio index.ts', () => {
  const root = fixture();
  const sharedFile = path.join(root, 'apps/backend/src/compartido/servicio.ts');
  fs.mkdirSync(path.dirname(sharedFile), { recursive: true });
  fs.writeFileSync(sharedFile, "import '../../../../src/modulos/b/private.js';\n", 'utf8');
  fs.writeFileSync(path.join(root, 'src/modulos/b/private.ts'), 'export const internal = true;\n', 'utf8');
  assert.ok(inspect(root).errors.some((error) => error.includes('b.external.private-import')));
});

test('el composition root puede consumir solo la entrada de composición registrada', () => {
  const root = fixture();
  const hostRoot = path.join(root, 'apps/backend/src/rutas.ts');
  fs.mkdirSync(path.dirname(hostRoot), { recursive: true });
  fs.writeFileSync(hostRoot, "import '../../../src/modulos/b/composition.js';\n", 'utf8');
  const valid = inspect(root);
  assert.equal(valid.ok, true, valid.errors.join('\n'));

  fs.writeFileSync(hostRoot, "import '../../../src/modulos/b/index.js';\n", 'utf8');
  assert.ok(inspect(root).errors.some((error) => error.includes('b.host.private-import')));
});

test('detecta cambios a la API de composición sin bump ni snapshot nuevo', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'src/modulos/a/composition.ts'), 'export const hostAdapter = "changed";\n', 'utf8');
  assert.ok(inspect(root).errors.some((error) => error.includes('a.compositionApiHistory.drift')));
});

test('el historial de composición exige SemVer e impide reescritura del baseline', () => {
  const base = { schemaVersion: 2, modules: [{ id: 'a', compositionApiHistory: [{ version: '1.0.0', exports: [] }] }] };
  const appended = { schemaVersion: 2, modules: [{ id: 'a', compositionApiHistory: [{ version: '1.0.0', exports: [] }, { version: '1.1.0', exports: [{ name: 'mount', signature: '() => void' }] }] }] };
  const rewritten = { schemaVersion: 2, modules: [{ id: 'a', compositionApiHistory: [{ version: '1.0.0', exports: [{ name: 'broken', signature: '() => void' }] }] }] };
  assert.deepEqual(validateAppendOnlyHistory(base, appended), []);
  assert.ok(validateAppendOnlyHistory(base, rewritten).some((error) => error.includes('compositionApiHistory.immutable')));
});

test('las entradas públicas no cargan routers del composition root', () => {
  const root = path.join(process.cwd(), 'apps/backend/src/modulos');
  const modules = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const module of modules) {
    const entry = path.join(root, module.name, 'index.ts');
    if (!fs.existsSync(entry)) continue;
    const source = fs.readFileSync(entry, 'utf8');
    assert.doesNotMatch(source, /export\s+\{\s*default\s+as\s+\w+\s*\}\s+from\s+['"]\.\/rutas/, `${module.name} debe exponer rutas solo en el composition root`);
  }
});

test('acepta una integración pública con rangos compatibles y propietario único', () => {
  const result = inspect(fixture());
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('requiere que entry sea exactamente el index.ts público registrado', () => {
  const result = inspect(fixture({ entryA: 'src/modulos/a/private.ts' }));
  assert.ok(result.errors.some((error) => error.includes('a.entry')));
});

test('rechaza imports relativos y aliases que resuelven a archivos privados', () => {
  const relativeRoot = fixture({ importsA: "import '../b/private.js';" });
  fs.writeFileSync(path.join(relativeRoot, 'src/modulos/b/private.ts'), 'export const internal = true;\n');
  assert.ok(inspect(relativeRoot).errors.some((error) => error.includes('a.private-import')));

  const aliasRoot = fixture({ aliasB: true });
  assert.ok(inspect(aliasRoot).errors.some((error) => error.includes('a.private-import')));
});

test('incluye imports type, reexports y imports dinámicos literales en el grafo', () => {
  const root = fixture({
    importsA: "import type { B } from '../b/index.js';\nexport { b } from '../b/index.js';\nvoid import('../b/index.js');",
    sourceB: 'export interface B { id: string }\nexport const b = 1;'
  });
  const result = inspect(root);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.deepEqual(result.dependencyGraph.a, ['b']);
});

test('rechaza imports dinámicos y require no literales', () => {
  const root = fixture({ importsA: 'const name = "../b/index.js";\nvoid import(name);\nrequire(name);' });
  const errors = inspect(root).errors;
  assert.ok(errors.some((error) => error.includes('a.dynamic-import.nonliteral')));
  assert.equal(errors.filter((error) => error.includes('a.dynamic-import.nonliteral')).length, 2);
});

test('rechaza imports dinámicos y require no literales fuera de los módulos', () => {
  const root = fixture();
  const hostRoot = path.join(root, 'apps/backend/src/rutas.ts');
  const sharedFile = path.join(root, 'apps/backend/src/compartido/servicio.ts');
  fs.mkdirSync(path.dirname(hostRoot), { recursive: true });
  fs.mkdirSync(path.dirname(sharedFile), { recursive: true });
  fs.writeFileSync(hostRoot, 'void import(modulePath);\nrequire(modulePath);\n', 'utf8');
  fs.writeFileSync(sharedFile, 'void import(modulePath);\nrequire(modulePath);\n', 'utf8');

  const errors = inspect(root).errors;
  assert.equal(errors.filter((error) => error.includes('host.dynamic-import.nonliteral')).length, 2);
  assert.equal(errors.filter((error) => error.includes('external.dynamic-import.nonliteral')).length, 2);
});

test('rechaza dependencias reales ausentes del registro', () => {
  const result = inspect(fixture({ dependenciesA: [] }));
  assert.ok(result.errors.some((error) => error.includes('a.dependency.undeclared')));
});

test('rechaza ciclos entre módulos', () => {
  const result = inspect(fixture({ importsB: "import '../a/index.js';", dependenciesB: [{ module: 'a', contractRange: '^1.0.0' }] }));
  assert.ok(result.errors.some((error) => error.startsWith('dependency.cycle:')));
});

test('rechaza un rango de host incompatible', () => {
  const result = inspect(fixture({ hostCompatibilityB: '>=1.3.0 <2.0.0' }));
  assert.ok(result.errors.some((error) => error.includes('b.hostCompatibility')));
});

test('rechaza una versión de dependencia fuera del rango consumido', () => {
  const result = inspect(fixture({ versionB: '2.0.0' }));
  assert.ok(result.errors.some((error) => error.includes('a.dependency.incompatible')));
});

test('rechaza modelos sin propietario y modelos con varios propietarios', () => {
  const missing = inspect(fixture({ ownersA: [] }));
  assert.ok(missing.errors.some((error) => error.includes('persistence.owner.missing: User')));
  const duplicate = inspect(fixture({ ownersB: ['User'] }));
  assert.ok(duplicate.errors.some((error) => error.includes('persistence.owner.duplicate: User')));
});

test('extrae SemVer 2 válido e invalida prerelease numérico con cero inicial', () => {
  assert.ok(parseVersion('1.2.3-alpha.1+build.5'));
  assert.equal(parseVersion('1.2.3-01'), null);
  assert.equal(compareVersions(parseVersion('1.2.3+one'), parseVersion('1.2.3+two')), 0);
  assert.equal(compareVersions(parseVersion('1.2.3-alpha.2'), parseVersion('1.2.3-alpha.10')), -1);
  assert.equal(compareVersions(parseVersion('1.2.3-1'), parseVersion('1.2.3-alpha')), -1);
  assert.equal(compareVersions(parseVersion('1.2.3-alpha'), parseVersion('1.2.3')), -1);
  assert.equal(compareVersions(parseVersion('999999999999999999999.0.0'), parseVersion('999999999999999999998.0.0')), 1);
});

test('evalúa rangos exactos, caret, tilde, comparadores y casos frontera', () => {
  assert.equal(satisfiesRange('1.2.3+ci.1', '1.2.3'), true);
  assert.equal(satisfiesRange('0.2.9', '^0.2.3'), true);
  assert.equal(satisfiesRange('0.3.0', '^0.2.3'), false);
  assert.equal(satisfiesRange('0.0.4', '^0.0.3'), false);
  assert.equal(satisfiesRange('1.2.9', '~1.2.3'), true);
  assert.equal(satisfiesRange('1.3.0', '~1.2.3'), false);
  assert.equal(satisfiesRange('1.2.0', '>=1.2.0 <2.0.0'), true);
  assert.equal(satisfiesRange('2.0.0', '>=1.2.0 <2.0.0'), false);
  assert.equal(satisfiesRange('1.2.3-beta.2', '>=1.2.3-beta.1 <1.2.3'), true);
  assert.equal(satisfiesRange('1.2.3-beta.2', '>=1.2.0 <2.0.0'), false);
  assert.equal(satisfiesRange('1.2.3', '1.x'), false);
  assert.equal(satisfiesRange('1.2.3', '>=1.0.0 || <2.0.0'), false);
});

test('requiere bump major para cambios/remociones y minor para adiciones', () => {
  const descriptor = { id: 'a', contractVersion: '1.0.0', publicApiHistory: [{ version: '1.0.0', exports: [{ name: 'run', signature: '() => string' }] }] };
  assert.ok(validatePublicApiHistory(descriptor, []).some((error) => error.includes('drift')));
  descriptor.contractVersion = '1.1.0';
  descriptor.publicApiHistory.push({ version: '1.1.0', exports: [] });
  assert.ok(validatePublicApiHistory(descriptor, []).some((error) => error.includes('breaking')));
  descriptor.contractVersion = '2.0.0';
  descriptor.publicApiHistory[1] = { version: '2.0.0', exports: [] };
  assert.deepEqual(validatePublicApiHistory(descriptor, []), []);

  const additive = { id: 'b', contractVersion: '1.0.0', publicApiHistory: [{ version: '1.0.0', exports: [] }] };
  assert.ok(validatePublicApiHistory(additive, [{ name: 'newApi', signature: '() => void' }]).some((error) => error.includes('drift')));
  additive.contractVersion = '1.1.0';
  additive.publicApiHistory.push({ version: '1.1.0', exports: [{ name: 'newApi', signature: '() => void' }] });
  assert.deepEqual(validatePublicApiHistory(additive, additive.publicApiHistory[1].exports), []);
});

test('protege snapshots del branch base y permite solo agregar nuevos', () => {
  const base = { schemaVersion: 2, modules: [{ id: 'a', publicApiHistory: [{ version: '1.0.0', exports: [] }] }] };
  const appended = { schemaVersion: 2, modules: [{ id: 'a', publicApiHistory: [{ version: '1.0.0', exports: [] }, { version: '1.1.0', exports: [] }] }] };
  assert.deepEqual(validateAppendOnlyHistory(base, appended), []);
  const rewritten = { schemaVersion: 2, modules: [{ id: 'a', publicApiHistory: [{ version: '1.0.0', exports: [{ name: 'rewritten', signature: 'number' }] }] }] };
  assert.ok(validateAppendOnlyHistory(base, rewritten).some((error) => error.includes('immutable')));
  const removed = { schemaVersion: 2, modules: [{ id: 'a', publicApiHistory: [] }] };
  assert.ok(validateAppendOnlyHistory(base, removed).some((error) => error.includes('immutable')));
});

test('el reporte mantiene bytes, grafo y consumidores entre ejecuciones', () => {
  const root = fixture();
  const first = inspect(root);
  const second = inspect(root);
  assert.deepEqual(first.dependencyGraph, second.dependencyGraph);
  assert.deepEqual(first.transitiveConsumers, second.transitiveConsumers);
  const reportPath = writeModuleContractReport(first, root);
  const firstReport = fs.readFileSync(reportPath, 'utf8');
  writeModuleContractReport(second, root);
  assert.equal(fs.readFileSync(reportPath, 'utf8'), firstReport);
  assert.doesNotMatch(firstReport, /generatedAt/);
});

test.after(() => {
  for (const root of temporaryRoots) fs.rmSync(root, { recursive: true, force: true });
});
