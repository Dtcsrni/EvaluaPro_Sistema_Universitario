/**
 * Verifica contratos y límites de los módulos backend sin compilar ni ejecutar el producto.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';

const DEFAULTS = {
  moduleRoot: 'apps/backend/src/modulos',
  manifestPath: 'docs/contracts/module-contracts.v1.json',
  prismaSchemaPath: 'apps/backend/prisma/schema.prisma'
};

function parseVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/.exec(String(value ?? ''));
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ?? null } : null;
}

function compareVersions(a, b) {
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

function satisfiesRange(versionText, rangeText) {
  const version = parseVersion(versionText);
  if (!version || typeof rangeText !== 'string' || !rangeText.trim()) return false;
  const range = rangeText.trim();
  if (range.startsWith('^') || range.startsWith('~')) {
    const base = parseVersion(range.slice(1));
    if (!base || compareVersions(version, base) < 0) return false;
    if (range.startsWith('~')) return version.major === base.major && version.minor === base.minor;
    return base.major > 0 ? version.major === base.major : base.minor > 0 ? version.major === 0 && version.minor === base.minor : version.major === 0 && version.minor === 0 && version.patch === base.patch;
  }
  const constraints = range.split(/\s+/);
  if (constraints.length === 1) return constraints[0] === versionText;
  return constraints.every((constraint) => {
    const match = /^(>=|>|<=|<|=)(.+)$/.exec(constraint);
    if (!match) return false;
    const bound = parseVersion(match[2]);
    if (!bound) return false;
    const compared = compareVersions(version, bound);
    return match[1] === '>=' ? compared >= 0 : match[1] === '>' ? compared > 0 : match[1] === '<=' ? compared <= 0 : match[1] === '<' ? compared < 0 : compared === 0;
  });
}

function listTypeScriptFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listTypeScriptFiles(target));
    else if (/\.tsx?$/.test(entry.name)) files.push(target);
  }
  return files;
}

function moduleIdForPath(moduleRoot, filePath, moduleIds) {
  const firstSegment = path.relative(moduleRoot, filePath).split(path.sep)[0];
  return moduleIds.has(firstSegment) ? firstSegment : null;
}

function moduleSpecifierNodes(sourceFile) {
  const result = [];
  for (const statement of sourceFile.statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      result.push({ specifier: statement.moduleSpecifier.text, node: statement.moduleSpecifier });
    }
  }
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      result.push({ specifier: node.arguments[0].text, node: node.arguments[0] });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
}

function findCycles(graph) {
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const recorded = new Set();
  const visit = (moduleId) => {
    if (visiting.has(moduleId)) {
      const start = stack.indexOf(moduleId);
      const cycle = [...stack.slice(start), moduleId];
      const canonical = cycle.slice(0, -1).sort().join('|');
      if (!recorded.has(canonical)) {
        recorded.add(canonical);
        cycles.push(cycle);
      }
      return;
    }
    if (visited.has(moduleId)) return;
    visiting.add(moduleId);
    stack.push(moduleId);
    for (const dependency of graph.get(moduleId) ?? []) visit(dependency);
    stack.pop();
    visiting.delete(moduleId);
    visited.add(moduleId);
  };
  for (const moduleId of graph.keys()) visit(moduleId);
  return cycles;
}

export function inspectModuleContracts(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const moduleRoot = path.resolve(root, options.moduleRoot ?? DEFAULTS.moduleRoot);
  const manifestPath = path.resolve(root, options.manifestPath ?? DEFAULTS.manifestPath);
  const prismaSchemaPath = path.resolve(root, options.prismaSchemaPath ?? DEFAULTS.prismaSchemaPath);
  const errors = [];
  const moduleDirs = fs.existsSync(moduleRoot)
    ? fs.readdirSync(moduleRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    : [];
  const moduleIds = new Set(moduleDirs);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return { ok: false, errors: [`registry.read: ${error.message}`], modules: 0, dependencyPairs: 0, cycles: [] };
  }

  if (manifest.schemaVersion !== 1) errors.push(`registry.version: se esperaba 1; recibido ${manifest.schemaVersion}`);
  if (!parseVersion(manifest.host?.version)) errors.push(`host.version: SemVer inválido "${manifest.host?.version}"`);
  if (!satisfiesRange(manifest.host?.version, manifest.host?.compatibility)) errors.push(`host.compatibility: ${manifest.host?.version} no satisface "${manifest.host?.compatibility}"`);
  if (!Array.isArray(manifest.modules)) errors.push('registry.modules: debe ser un arreglo');
  const descriptors = Array.isArray(manifest.modules) ? manifest.modules : [];
  const descriptorsById = new Map();
  for (const descriptor of descriptors) {
    if (descriptorsById.has(descriptor.id)) errors.push(`module.duplicate: descriptor repetido "${descriptor.id}"`);
    else descriptorsById.set(descriptor.id, descriptor);
  }
  for (const moduleId of moduleDirs) if (!descriptorsById.has(moduleId)) errors.push(`module.missing: falta descriptor para ${moduleId}`);
  for (const id of descriptorsById.keys()) if (!moduleIds.has(id)) errors.push(`module.unknown: el registro contiene módulo inexistente "${id}"`);

  const graph = new Map(moduleDirs.map((id) => [id, new Set()]));
  for (const moduleId of moduleDirs) {
    const descriptor = descriptorsById.get(moduleId);
    if (!descriptor) continue;
    if (!parseVersion(descriptor.contractVersion)) errors.push(`${moduleId}.contractVersion: SemVer inválido "${descriptor.contractVersion}"`);
    if (!satisfiesRange(manifest.host?.version, descriptor.hostCompatibility)) errors.push(`${moduleId}.hostCompatibility: host ${manifest.host?.version} fuera de "${descriptor.hostCompatibility}"`);
    const entry = path.resolve(root, descriptor.entry ?? '');
    if (!descriptor.entry || !fs.existsSync(entry)) errors.push(`${moduleId}.entry: no existe "${descriptor.entry}"`);
    if (!Array.isArray(descriptor.dependencies)) errors.push(`${moduleId}.dependencies: debe ser un arreglo`);
    const declared = new Map();
    for (const dependency of Array.isArray(descriptor.dependencies) ? descriptor.dependencies : []) {
      if (!moduleIds.has(dependency.module)) {
        errors.push(`${moduleId}.dependency.unknown: módulo inexistente "${dependency.module}"`);
        continue;
      }
      if (declared.has(dependency.module)) errors.push(`${moduleId}.dependency.duplicate: dependencia repetida "${dependency.module}"`);
      declared.set(dependency.module, dependency.contractRange);
      const target = descriptorsById.get(dependency.module);
      if (!target || !parseVersion(target.contractVersion) || !satisfiesRange(target.contractVersion, dependency.contractRange)) {
        errors.push(`${moduleId}.dependency.incompatible: ${dependency.module}@${target?.contractVersion ?? 'missing'} no satisface "${dependency.contractRange}"`);
      }
    }
    descriptor._declaredDependencies = declared;
  }

  for (const moduleId of moduleDirs) {
    const directory = path.join(moduleRoot, moduleId);
    for (const filePath of listTypeScriptFiles(directory)) {
      const source = fs.readFileSync(filePath, 'utf8');
      const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
      for (const { specifier } of moduleSpecifierNodes(sourceFile)) {
        if (!specifier.startsWith('.')) continue;
        const targetPath = path.resolve(path.dirname(filePath), specifier);
        const targetModule = moduleIdForPath(moduleRoot, targetPath, moduleIds);
        if (!targetModule || targetModule === moduleId) continue;
        graph.get(moduleId).add(targetModule);
        if (path.basename(specifier) !== 'index.js' && path.basename(specifier) !== 'index.ts') {
          errors.push(`${moduleId}.private-import: ${path.relative(root, filePath)} importa ${specifier}; usa ${targetModule}/index.js`);
        }
      }
    }
  }

  for (const [moduleId, actual] of graph) {
    const descriptor = descriptorsById.get(moduleId);
    const declared = descriptor?._declaredDependencies ?? new Map();
    for (const dependency of actual) if (!declared.has(dependency)) errors.push(`${moduleId}.dependency.undeclared: importa ${dependency} sin declararlo`);
    for (const dependency of declared.keys()) if (!actual.has(dependency)) errors.push(`${moduleId}.dependency.unused: declara ${dependency} sin dependencia estática`);
  }
  const cycles = findCycles(graph);
  for (const cycle of cycles) errors.push(`dependency.cycle: ${cycle.join(' -> ')}`);

  let prismaModels = [];
  try {
    const schema = fs.readFileSync(prismaSchemaPath, 'utf8');
    prismaModels = [...schema.matchAll(/^\s*model\s+(\w+)\s*\{/gm)].map((match) => match[1]);
  } catch (error) {
    errors.push(`persistence.schema: ${error.message}`);
  }
  const modelOwners = new Map();
  for (const descriptor of descriptors) {
    if (!Array.isArray(descriptor.persistenceModels)) {
      errors.push(`${descriptor.id}.persistenceModels: debe ser un arreglo`);
      continue;
    }
    for (const model of descriptor.persistenceModels) {
      if (!modelOwners.has(model)) modelOwners.set(model, []);
      modelOwners.get(model).push(descriptor.id);
      if (!prismaModels.includes(model)) errors.push(`${descriptor.id}.persistence.unknown: modelo Prisma inexistente "${model}"`);
    }
  }
  for (const model of prismaModels) {
    const owners = modelOwners.get(model) ?? [];
    if (owners.length === 0) errors.push(`persistence.owner.missing: ${model} no tiene propietario`);
    if (owners.length > 1) errors.push(`persistence.owner.duplicate: ${model} tiene propietarios ${owners.join(', ')}`);
  }
  if (manifest.persistence?.migrationStrategy !== 'expand-migrate-contract') errors.push('persistence.strategy: se requiere expand-migrate-contract');
  if (manifest.persistence?.singleDatabase !== true) errors.push('persistence.database: el corte vigente requiere una sola base SQLite');

  for (const descriptor of descriptors) delete descriptor._declaredDependencies;
  return {
    ok: errors.length === 0,
    errors,
    modules: moduleDirs.length,
    dependencyPairs: [...graph.values()].reduce((total, dependencies) => total + dependencies.size, 0),
    cycles,
    prismaModels: prismaModels.length,
    declaredModelOwners: modelOwners.size
  };
}

function main() {
  const result = inspectModuleContracts();
  const reportPath = path.resolve(process.cwd(), 'reports/qa/latest/module-contracts.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify({ version: 1, gate: 'module-contracts', generatedAt: new Date().toISOString(), ...result }, null, 2)}\n`, 'utf8');
  console.log(`[module-contracts] ${result.ok ? 'OK' : 'FAIL'}: ${result.modules} módulos, ${result.dependencyPairs} dependencias, ${result.prismaModels} modelos Prisma.`);
  for (const error of result.errors) console.error(`- ${error}`);
  console.log(`[module-contracts] reporte: ${path.relative(process.cwd(), reportPath)}`);
  if (process.argv.includes('--strict') && !result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
