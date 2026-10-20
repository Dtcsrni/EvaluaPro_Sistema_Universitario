/**
 * Verifica contratos y límites de los módulos backend sin compilar ni ejecutar el producto.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';

const DEFAULTS = {
  moduleRoot: 'apps/backend/src/modulos',
  manifestPath: 'docs/contracts/module-contracts.v2.json',
  legacyManifestPath: 'docs/contracts/module-contracts.v1.json',
  prismaSchemaPath: 'apps/backend/prisma/schema.prisma',
  tsconfigPath: 'apps/backend/tsconfig.json'
};

export function parseVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(String(value ?? ''));
  if (!match) return null;
  const prerelease = match[4] ? match[4].split('.') : [];
  if (prerelease.some((identifier) => /^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith('0'))) return null;
  return {
    major: BigInt(match[1]),
    minor: BigInt(match[2]),
    patch: BigInt(match[3]),
    prerelease,
    build: match[5] ? match[5].split('.') : []
  };
}

export function compareVersions(a, b) {
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    if (a.prerelease.length === b.prerelease.length) return 0;
    return a.prerelease.length === 0 ? 1 : -1;
  }
  const length = Math.min(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const left = a.prerelease[index];
    const right = b.prerelease[index];
    if (left === right) continue;
    const leftNumeric = /^\d+$/.test(left);
    const rightNumeric = /^\d+$/.test(right);
    if (leftNumeric && rightNumeric) return BigInt(left) < BigInt(right) ? -1 : 1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return left < right ? -1 : 1;
  }
  return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length < b.prerelease.length ? -1 : 1;
}

export function satisfiesRange(versionText, rangeText) {
  const version = parseVersion(versionText);
  if (!version || typeof rangeText !== 'string' || !rangeText.trim()) return false;
  const range = rangeText.trim();
  if (range.startsWith('^') || range.startsWith('~')) {
    const base = parseVersion(range.slice(1));
    if (!base || compareVersions(version, base) < 0) return false;
    const upper = range.startsWith('~')
      ? { major: base.major, minor: base.minor + 1n, patch: 0n, prerelease: [], build: [] }
      : base.major > 0
        ? { major: base.major + 1n, minor: 0n, patch: 0n, prerelease: [], build: [] }
        : base.minor > 0
          ? { major: 0n, minor: base.minor + 1n, patch: 0n, prerelease: [], build: [] }
          : { major: 0n, minor: 0n, patch: base.patch + 1n, prerelease: [], build: [] };
    if (compareVersions(version, upper) >= 0) return false;
    return permitsPrerelease(version, [{ version: base, operator: '>=' }, { version: upper, operator: '<' }]);
  }
  const exact = parseVersion(range);
  if (exact) return compareVersions(version, exact) === 0;
  const constraints = range.split(/\s+/);
  if (constraints.some((constraint) => !constraint)) return false;
  const parsed = constraints.map((constraint) => {
    const match = /^(>=|>|<=|<|=)(.+)$/.exec(constraint);
    const bound = match ? parseVersion(match[2]) : null;
    return match && bound ? { version: bound, operator: match[1] } : null;
  });
  if (parsed.length === 0 || parsed.some((constraint) => !constraint)) return false;
  const satisfies = parsed.every(({ version: bound, operator }) => {
    const compared = compareVersions(version, bound);
    return operator === '>=' ? compared >= 0 : operator === '>' ? compared > 0 : operator === '<=' ? compared <= 0 : operator === '<' ? compared < 0 : compared === 0;
  });
  return satisfies && permitsPrerelease(version, parsed);
}

function permitsPrerelease(version, constraints) {
  if (version.prerelease.length === 0) return true;
  return constraints.some(({ version: bound }) => bound.prerelease.length > 0 &&
    version.major === bound.major && version.minor === bound.minor && version.patch === bound.patch);
}

function listTypeScriptFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listTypeScriptFiles(target));
    else if (/\.tsx?$/.test(entry.name)) files.push(target);
  }
  return files;
}

function moduleIdForPath(moduleRoot, filePath, moduleIds) {
  const relative = path.relative(moduleRoot, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  const firstSegment = relative.split(path.sep)[0];
  return moduleIds.has(firstSegment) ? firstSegment : null;
}

function readTypeScriptCompilerOptions(root, tsconfigPath) {
  const absoluteConfigPath = path.resolve(root, tsconfigPath);
  if (!fs.existsSync(absoluteConfigPath)) {
    return {
      options: { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext },
      errors: []
    };
  }
  const read = ts.readConfigFile(absoluteConfigPath, ts.sys.readFile);
  if (read.error) return { options: {}, errors: [ts.flattenDiagnosticMessageText(read.error.messageText, '\n')] };
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(absoluteConfigPath), undefined, absoluteConfigPath);
  const errors = parsed.errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  return { options: parsed.options, errors };
}

function createTypeScriptProgram(root, tsconfigPath, compilerOptions) {
  const absoluteConfigPath = path.resolve(root, tsconfigPath);
  if (!fs.existsSync(absoluteConfigPath)) {
    const rootNames = listTypeScriptFiles(path.resolve(root, 'apps/backend/src'));
    return ts.createProgram(rootNames, compilerOptions);
  }
  const read = ts.readConfigFile(absoluteConfigPath, ts.sys.readFile);
  if (read.error) return null;
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(absoluteConfigPath), undefined, absoluteConfigPath);
  return ts.createProgram(parsed.fileNames, { ...parsed.options, ...compilerOptions });
}

function moduleSpecifierNodes(sourceFile) {
  const result = [];
  for (const statement of sourceFile.statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      result.push({ specifier: statement.moduleSpecifier.text, node: statement.moduleSpecifier, kind: 'static' });
    }
    if (ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference)) {
      const expression = statement.moduleReference.expression;
      if (expression && ts.isStringLiteral(expression)) result.push({ specifier: expression.text, node: expression, kind: 'static' });
    }
  }
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument)) result.push({ specifier: argument.text, node: argument, kind: 'dynamic' });
      else result.push({ specifier: null, node: argument ?? node, kind: 'dynamic' });
    }
    if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      if (ts.isLiteralTypeNode(argument) && ts.isStringLiteralLike(argument.literal)) {
        result.push({ specifier: argument.literal.text, node: argument.literal, kind: 'type' });
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument)) result.push({ specifier: argument.text, node: argument, kind: 'require' });
      else result.push({ specifier: null, node: argument ?? node, kind: 'require' });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
}

export function normalizeResolvedHostDeclarationPath(resolvedPath, hostSourceRoot, repositoryRoot) {
  const normalizedPath = resolvedPath.replaceAll('\\', '/');
  const segments = normalizedPath.split('/');
  const nodeModulesIndex = segments.lastIndexOf('node_modules');
  if (nodeModulesIndex >= 0 && nodeModulesIndex < segments.length - 1) {
    const logicalPath = path.resolve(repositoryRoot, 'node_modules', ...segments.slice(nodeModulesIndex + 1));
    return path.relative(hostSourceRoot, logicalPath).replaceAll(path.sep, '/');
  }
  return path.relative(hostSourceRoot, resolvedPath).replaceAll(path.sep, '/');
}

function normalizePublicSignature(signature, declaration, context) {
  const sourcePath = declaration.getSourceFile().fileName;
  const normalizedImports = signature.replace(/import\(["']([^"']+)["']\)/g, (_match, specifier) => {
    const resolved = ts.resolveModuleName(specifier, sourcePath, context.compilerOptions, ts.sys).resolvedModule?.resolvedFileName;
    if (!resolved) return `import(${JSON.stringify(specifier)})`;
    const targetModule = moduleIdForPath(context.moduleRoot, path.resolve(resolved), context.moduleIds);
    if (targetModule === context.moduleId) return 'import("#self")';
    if (targetModule) return `import("#module/${targetModule}")`;
    const relativeToBackend = normalizeResolvedHostDeclarationPath(
      resolved,
      path.resolve(path.dirname(context.moduleRoot)),
      context.repositoryRoot
    );
    return `import("#host/${relativeToBackend}")`;
  });
  return normalizedImports;
}

function extractPublicApi(program, entryPath, context) {
  const sourceFile = program?.getSourceFile(path.resolve(entryPath));
  if (!sourceFile) return null;
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) return null;
  return checker.getExportsOfModule(moduleSymbol).map((exportedSymbol) => {
    const symbol = exportedSymbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exportedSymbol) : exportedSymbol;
    const declaration = symbol.declarations?.[0] ?? sourceFile;
    const type = symbol.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface)
      ? checker.getDeclaredTypeOfSymbol(symbol)
      : checker.getTypeOfSymbolAtLocation(symbol, declaration);
    const signature = checker.typeToString(type, declaration, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias);
    return {
      name: exportedSymbol.getName(),
      signature: normalizePublicSignature(signature, declaration, context)
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function readCurrentPublicApis(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const moduleRoot = path.resolve(root, options.moduleRoot ?? DEFAULTS.moduleRoot);
  const tsconfigPath = options.tsconfigPath ?? DEFAULTS.tsconfigPath;
  const moduleIds = new Set(fs.readdirSync(moduleRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  const { options: compilerOptions, errors } = readTypeScriptCompilerOptions(root, tsconfigPath);
  if (errors.length) throw new Error(`No se pudo leer tsconfig: ${errors.join('; ')}`);
  const program = createTypeScriptProgram(root, tsconfigPath, compilerOptions);
  if (!program) throw new Error('No se pudo crear el programa TypeScript');
  const apiContext = { moduleRoot, moduleIds, compilerOptions, repositoryRoot: root };
  return Object.fromEntries([...moduleIds].sort().map((moduleId) => {
    const api = extractPublicApi(program, path.join(moduleRoot, moduleId, 'index.ts'), { ...apiContext, moduleId });
    if (!api) throw new Error(`No se pudo extraer la API de ${moduleId}`);
    return [moduleId, api];
  }));
}

export function readCurrentCompositionApis(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const moduleRoot = path.resolve(root, options.moduleRoot ?? DEFAULTS.moduleRoot);
  const tsconfigPath = options.tsconfigPath ?? DEFAULTS.tsconfigPath;
  const moduleIds = new Set(fs.readdirSync(moduleRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  const { options: compilerOptions, errors } = readTypeScriptCompilerOptions(root, tsconfigPath);
  if (errors.length) throw new Error(`No se pudo leer tsconfig: ${errors.join('; ')}`);
  const program = createTypeScriptProgram(root, tsconfigPath, compilerOptions);
  if (!program) throw new Error('No se pudo crear el programa TypeScript');
  const apiContext = { moduleRoot, moduleIds, compilerOptions, repositoryRoot: root };
  return Object.fromEntries([...moduleIds].sort().map((moduleId) => {
    const entryPath = path.join(moduleRoot, moduleId, 'composition.ts');
    const api = extractPublicApi(program, entryPath, { ...apiContext, moduleId });
    if (!api) throw new Error(`No se pudo extraer la API de composición de ${moduleId}`);
    return [moduleId, api];
  }));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function describeApiDrift(expectedExports, actualExports) {
  const expectedByName = new Map(expectedExports.map((item) => [item.name, item.signature]));
  const actualByName = new Map(actualExports.map((item) => [item.name, item.signature]));
  const changes = [];
  for (const [name, signature] of expectedByName) {
    if (!actualByName.has(name)) changes.push(`${name} (eliminado)`);
    else if (actualByName.get(name) !== signature) changes.push(`${name} (firma modificada)`);
  }
  for (const name of actualByName.keys()) {
    if (!expectedByName.has(name)) changes.push(`${name} (agregado)`);
  }
  return changes.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

export function compareApiSnapshots(previous, current, currentVersion) {
  const previousByName = new Map(previous.exports.map((item) => [item.name, item.signature]));
  const currentByName = new Map(current.exports.map((item) => [item.name, item.signature]));
  let breaking = false;
  let additive = false;
  for (const [name, signature] of previousByName) {
    if (!currentByName.has(name) || currentByName.get(name) !== signature) breaking = true;
  }
  for (const name of currentByName.keys()) if (!previousByName.has(name)) additive = true;

  const oldVersion = parseVersion(previous.version);
  const newVersion = parseVersion(currentVersion);
  if (!oldVersion || !newVersion || compareVersions(newVersion, oldVersion) <= 0) {
    return ['publicApiHistory.version: cada snapshot agregado requiere una version SemVer mayor que la anterior'];
  }
  if (breaking && newVersion.major <= oldVersion.major) {
    return [`publicApiHistory.breaking: ${previous.version} -> ${currentVersion} cambia o elimina exports; incremente major`];
  }
  if (!breaking && additive && newVersion.major === oldVersion.major && newVersion.minor <= oldVersion.minor) {
    return [`publicApiHistory.additive: ${previous.version} -> ${currentVersion} agrega exports; incremente minor o major`];
  }
  return [];
}

export function validatePublicApiHistory(descriptor, currentExports) {
  const errors = [];
  const history = descriptor.publicApiHistory;
  if (!Array.isArray(history) || history.length === 0) {
    return [`${descriptor.id}.publicApiHistory: requiere al menos un snapshot versionado`];
  }
  let previous = null;
  for (const [index, snapshot] of history.entries()) {
    if (!snapshot || !parseVersion(snapshot.version) || !Array.isArray(snapshot.exports)) {
      errors.push(`${descriptor.id}.publicApiHistory[${index}]: version SemVer y exports son obligatorios`);
      continue;
    }
    const exportNames = snapshot.exports.map((item) => item?.name);
    if (snapshot.exports.some((item) => !item || typeof item.name !== 'string' || typeof item.signature !== 'string') ||
        new Set(exportNames).size !== exportNames.length) {
      errors.push(`${descriptor.id}.publicApiHistory[${index}].exports: cada export debe tener nombre único y firma`);
    }
    const canonicalExports = [...snapshot.exports].sort((a, b) => String(a?.name).localeCompare(String(b?.name)));
    if (!sameJson(snapshot.exports, canonicalExports)) errors.push(`${descriptor.id}.publicApiHistory[${index}].exports: ordene por nombre`);
    if (previous) {
      errors.push(...compareApiSnapshots(previous, snapshot, snapshot.version).map((error) => `${descriptor.id}.${error}`));
    }
    previous = snapshot;
  }
  const latest = history.at(-1);
  if (latest?.version !== descriptor.contractVersion) {
    errors.push(`${descriptor.id}.publicApiHistory.latest: ${latest?.version ?? 'missing'} debe coincidir con contractVersion ${descriptor.contractVersion}`);
  }
  if (latest && !sameJson(latest.exports, currentExports)) {
    const drift = describeApiDrift(latest.exports, currentExports);
    const detail = drift.length
      ? `; diferencias: ${drift.join(', ')}`
      : '; diferencia estructural sin altas, bajas ni firmas distintas (revisar orden o forma del snapshot)';
    errors.push(`${descriptor.id}.publicApiHistory.drift: exports actuales no coinciden con el snapshot ${latest.version}${detail}; incremente contractVersion y agregue historial`);
  }
  return errors;
}

export function validateCompositionApiHistory(descriptor, currentExports) {
  const history = descriptor.compositionApiHistory;
  if (!Array.isArray(history) || history.length === 0) {
    return [`${descriptor.id}.compositionApiHistory: requiere al menos un snapshot versionado`];
  }
  const errors = [];
  let previous = null;
  for (const [index, snapshot] of history.entries()) {
    if (!snapshot || !parseVersion(snapshot.version) || !Array.isArray(snapshot.exports)) {
      errors.push(`${descriptor.id}.compositionApiHistory[${index}]: version SemVer y exports son obligatorios`);
      continue;
    }
    const exportNames = snapshot.exports.map((item) => item?.name);
    if (snapshot.exports.some((item) => !item || typeof item.name !== 'string' || typeof item.signature !== 'string') ||
        new Set(exportNames).size !== exportNames.length) {
      errors.push(`${descriptor.id}.compositionApiHistory[${index}].exports: cada export debe tener nombre único y firma`);
    }
    const canonicalExports = [...snapshot.exports].sort((a, b) => String(a?.name).localeCompare(String(b?.name)));
    if (!sameJson(snapshot.exports, canonicalExports)) errors.push(`${descriptor.id}.compositionApiHistory[${index}].exports: ordene por nombre`);
    if (previous) errors.push(...compareApiSnapshots(previous, snapshot, snapshot.version).map((error) => `${descriptor.id}.${error.replace('publicApiHistory', 'compositionApiHistory')}`));
    previous = snapshot;
  }
  const latest = history.at(-1);
  if (latest?.version !== descriptor.contractVersion) {
    errors.push(`${descriptor.id}.compositionApiHistory.latest: ${latest?.version ?? 'missing'} debe coincidir con contractVersion ${descriptor.contractVersion}`);
  }
  if (latest && !sameJson(latest.exports, currentExports)) {
    const drift = describeApiDrift(latest.exports, currentExports);
    const detail = drift.length
      ? `; diferencias: ${drift.join(', ')}`
      : '; diferencia estructural sin altas, bajas ni firmas distintas (revisar orden o forma del snapshot)';
    errors.push(`${descriptor.id}.compositionApiHistory.drift: exports de composición actuales no coinciden con el snapshot ${latest.version}${detail}; incremente contractVersion y agregue historial`);
  }
  return errors;
}

export function validateAppendOnlyHistory(baseManifest, currentManifest) {
  if (!baseManifest || baseManifest.schemaVersion < 2) return [];
  const errors = [];
  const currentById = new Map((currentManifest.modules ?? []).map((descriptor) => [descriptor.id, descriptor]));
  for (const oldDescriptor of baseManifest.modules ?? []) {
    const currentDescriptor = currentById.get(oldDescriptor.id);
    if (!currentDescriptor) {
      errors.push(`${oldDescriptor.id}.publicApiHistory.removed: no se elimina el descriptor durante una evolucion compatible`);
      continue;
    }
    for (const [field, oldHistory] of [
      ['publicApiHistory', oldDescriptor.publicApiHistory],
      ['compositionApiHistory', oldDescriptor.compositionApiHistory]
    ]) {
      if (!Array.isArray(oldHistory)) continue;
      const currentHistory = currentDescriptor[field] ?? [];
      const prefixMatches = oldHistory.every((snapshot, index) => sameJson(snapshot, currentHistory[index]));
      if (!prefixMatches) errors.push(`${oldDescriptor.id}.${field}.immutable: los snapshots previos de ${oldDescriptor.id} no se reescriben ni eliminan`);
    }
  }
  return errors;
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
  const tsconfigPath = options.tsconfigPath ?? DEFAULTS.tsconfigPath;
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

  const baseRef = options.baseRef ?? process.env.GITHUB_BASE_REF;
  if (baseRef) {
    let baseManifest = null;
    let baseReadError = null;
    for (const registryPath of [DEFAULTS.manifestPath, DEFAULTS.legacyManifestPath]) {
      for (const ref of [`origin/${baseRef}`, baseRef]) {
        try {
          baseManifest = JSON.parse(execFileSync('git', ['show', `${ref}:${registryPath}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
          break;
        } catch (error) {
          baseReadError = error;
        }
      }
      if (baseManifest) break;
    }
    if (!baseManifest) errors.push(`registry.base: no se pudo leer el contrato del branch base "${baseRef}": ${baseReadError?.message ?? 'no disponible'}`);
    else errors.push(...validateAppendOnlyHistory(baseManifest, manifest));
  }

  if (manifest.schemaVersion !== 2) errors.push(`registry.version: se esperaba 2; recibido ${manifest.schemaVersion}`);
  if (!parseVersion(manifest.host?.version)) errors.push(`host.version: SemVer inválido "${manifest.host?.version}"`);
  if (!satisfiesRange(manifest.host?.version, manifest.host?.compatibility)) errors.push(`host.compatibility: ${manifest.host?.version} no satisface "${manifest.host?.compatibility}"`);
  try {
    const packageVersion = JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf8')).version;
    if (manifest.host?.version !== packageVersion) errors.push(`host.version.mismatch: el registro declara ${manifest.host?.version ?? 'missing'} y package.json declara ${packageVersion ?? 'missing'}`);
  } catch (error) {
    errors.push(`host.package: no se pudo leer package.json (${error.message})`);
  }
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
  const compilerConfig = readTypeScriptCompilerOptions(root, tsconfigPath);
  errors.push(...compilerConfig.errors.map((error) => `typescript.config: ${error}`));
  const program = createTypeScriptProgram(root, tsconfigPath, compilerConfig.options);
  for (const moduleId of moduleDirs) {
    const descriptor = descriptorsById.get(moduleId);
    if (!descriptor) continue;
    if (!parseVersion(descriptor.contractVersion)) errors.push(`${moduleId}.contractVersion: SemVer inválido "${descriptor.contractVersion}"`);
    if (!satisfiesRange(manifest.host?.version, descriptor.hostCompatibility)) errors.push(`${moduleId}.hostCompatibility: host ${manifest.host?.version} fuera de "${descriptor.hostCompatibility}"`);
    const expectedEntry = path.join(moduleRoot, moduleId, 'index.ts');
    const expectedEntryRelative = path.relative(root, expectedEntry).replaceAll(path.sep, '/');
    if (descriptor.entry !== expectedEntryRelative || !fs.existsSync(expectedEntry)) {
      errors.push(`${moduleId}.entry: debe ser exactamente "${expectedEntryRelative}"`);
    }
    const expectedCompositionEntry = path.join(moduleRoot, moduleId, 'composition.ts');
    const expectedCompositionEntryRelative = path.relative(root, expectedCompositionEntry).replaceAll(path.sep, '/');
    if (descriptor.compositionEntry !== expectedCompositionEntryRelative || !fs.existsSync(expectedCompositionEntry)) {
      errors.push(`${moduleId}.compositionEntry: debe ser exactamente "${expectedCompositionEntryRelative}"`);
    }
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

  const apiContext = { moduleRoot, moduleIds, compilerOptions: compilerConfig.options, repositoryRoot: root };
  const currentApis = new Map();
  for (const moduleId of moduleDirs) {
    const directory = path.join(moduleRoot, moduleId);
    for (const filePath of listTypeScriptFiles(directory)) {
      const source = fs.readFileSync(filePath, 'utf8');
      const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
      for (const reference of moduleSpecifierNodes(sourceFile)) {
        const { specifier, kind } = reference;
        if (specifier === null) {
          if (kind === 'dynamic' || kind === 'require') errors.push(`${moduleId}.dynamic-import.nonliteral: ${path.relative(root, filePath)} contiene ${kind} no literal`);
          continue;
        }
        const targetPath = ts.resolveModuleName(specifier, filePath, compilerConfig.options, ts.sys).resolvedModule?.resolvedFileName;
        if (!targetPath) continue;
        const targetModule = moduleIdForPath(moduleRoot, path.resolve(targetPath), moduleIds);
        if (!targetModule || targetModule === moduleId) continue;
        graph.get(moduleId).add(targetModule);
        const targetEntry = path.resolve(moduleRoot, targetModule, 'index.ts');
        if (path.resolve(targetPath) !== targetEntry) {
          errors.push(`${moduleId}.private-import: ${path.relative(root, filePath)} resuelve ${specifier} a ${path.relative(root, targetPath)}; usa la entrada pública ${path.relative(root, targetEntry).replaceAll(path.sep, '/')}`);
        }
      }
    }
    const descriptor = descriptorsById.get(moduleId);
    if (program && descriptor) {
      const api = extractPublicApi(program, path.join(moduleRoot, moduleId, 'index.ts'), { ...apiContext, moduleId });
      if (!api) errors.push(`${moduleId}.publicApi: no se pudo leer la entrada TypeScript con el compilador`);
      else {
        currentApis.set(moduleId, api);
        errors.push(...validatePublicApiHistory(descriptor, api));
      }
      const compositionEntryPath = path.join(moduleRoot, moduleId, 'composition.ts');
      const compositionApi = extractPublicApi(program, compositionEntryPath, { ...apiContext, moduleId });
      if (!compositionApi) errors.push(`${moduleId}.compositionApi: no se pudo leer la entrada de composición con el compilador`);
      else errors.push(...validateCompositionApiHistory(descriptor, compositionApi));
    } else if (!program) errors.push('typescript.program: no se pudo crear el programa desde tsconfig');
  }

  const sourceRoot = path.resolve(root, options.sourceRoot ?? 'apps/backend/src');
  const compositionRoots = new Set(['rutas.ts', 'index.ts']);
  for (const filePath of listTypeScriptFiles(sourceRoot)) {
    const moduleId = moduleIdForPath(moduleRoot, filePath, moduleIds);
    if (moduleId) continue;
    const relativeSource = path.relative(sourceRoot, filePath).replaceAll(path.sep, '/');
    const isCompositionRoot = compositionRoots.has(relativeSource);
    const source = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
    for (const { specifier, kind } of moduleSpecifierNodes(sourceFile)) {
      if (specifier === null) {
        if (kind === 'dynamic' || kind === 'require') {
          const layer = isCompositionRoot ? 'host' : 'external';
          errors.push(`${layer}.dynamic-import.nonliteral: ${path.relative(root, filePath)} contiene ${kind} no literal`);
        }
        continue;
      }
      const targetPath = ts.resolveModuleName(specifier, filePath, compilerConfig.options, ts.sys).resolvedModule?.resolvedFileName;
      if (!targetPath) continue;
      const targetModule = moduleIdForPath(moduleRoot, path.resolve(targetPath), moduleIds);
      if (!targetModule) continue;
      const descriptor = descriptorsById.get(targetModule);
      const expectedEntry = isCompositionRoot
        ? path.resolve(root, descriptor?.compositionEntry ?? path.join(moduleRoot, targetModule, 'composition.ts'))
        : path.resolve(moduleRoot, targetModule, 'index.ts');
      if (path.resolve(targetPath) !== expectedEntry) {
        const surface = isCompositionRoot ? 'compositionEntry' : 'entry';
        const layer = isCompositionRoot ? 'host' : 'external';
        errors.push(`${targetModule}.${layer}.private-import: ${path.relative(root, filePath)} resuelve ${specifier} a ${path.relative(root, targetPath)}; usa la ${surface} ${path.relative(root, expectedEntry).replaceAll(path.sep, '/')}`);
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

  const dependencyGraph = Object.fromEntries([...graph].sort(([a], [b]) => a.localeCompare(b)).map(([id, deps]) => [id, [...deps].sort()]));
  const transitiveConsumers = Object.fromEntries(moduleDirs.map((id) => {
    const consumers = new Set();
    const visit = (dependency) => {
      for (const [consumer, dependencies] of graph) {
        if (dependencies.has(dependency) && !consumers.has(consumer)) {
          consumers.add(consumer);
          visit(consumer);
        }
      }
    };
    visit(id);
    return [id, [...consumers].sort()];
  }));

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
    dependencyGraph,
    transitiveConsumers,
    cycles,
    prismaModels: prismaModels.length,
    declaredModelOwners: modelOwners.size,
    persistenceOwners: Object.fromEntries([...modelOwners].sort(([a], [b]) => a.localeCompare(b)).map(([model, owners]) => [model, [...owners].sort()]))
  };
}

export function writeModuleContractReport(result, root = process.cwd()) {
  const reportPath = path.resolve(root, 'reports/qa/latest/module-contracts.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify({ version: 2, gate: 'module-contracts', ...result }, null, 2)}\n`, 'utf8');
  return reportPath;
}

function main() {
  const result = inspectModuleContracts();
  const reportPath = writeModuleContractReport(result);
  console.log(`[module-contracts] ${result.ok ? 'OK' : 'FAIL'}: ${result.modules} módulos, ${result.dependencyPairs} dependencias, ${result.prismaModels} modelos Prisma.`);
  for (const error of result.errors) console.error(`- ${error}`);
  console.log(`[module-contracts] reporte: ${path.relative(process.cwd(), reportPath)}`);
  if (process.argv.includes('--strict') && !result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
