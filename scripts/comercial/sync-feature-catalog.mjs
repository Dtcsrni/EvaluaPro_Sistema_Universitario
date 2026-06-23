/**
 * sync-feature-catalog
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const rutasPath = path.join(repoRoot, 'apps', 'backend', 'src', 'rutas.ts');
const configPath = path.join(repoRoot, 'docs', 'comercial', 'feature-catalog.config.json');
const outMdPath = path.join(repoRoot, 'docs', 'comercial', 'FEATURE_CATALOG.md');
const outJsonPath = path.join(repoRoot, 'docs', 'comercial', 'feature-catalog.generated.json');
const rootReadmePath = path.join(repoRoot, 'README.md');

function nowIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseMountedPrefixes(rutasSource) {
  const matches = rutasSource.matchAll(/router\.use\('([^']+)'/g);
  const prefixes = new Set(['/metrics']);
  for (const m of matches) prefixes.add(m[1]);
  return prefixes;
}

function buildPersonaMaps(personas) {
  const labels = new Map();
  for (const persona of personas) {
    labels.set(persona.id, persona.etiquetasNivel || persona.tierLabels || {});
  }
  return { labels };
}

function formatAvailability(availability, persona, labels) {
  const tierId = availability?.[persona.id] ?? null;
  if (!tierId) return 'No';
  return labels.get(persona.id)?.[tierId] || tierId;
}

function summarizeByPersona(capabilities, personas) {
  const counts = new Map();
  for (const persona of personas) counts.set(persona.id, 0);

  for (const capability of capabilities) {
    for (const persona of personas) {
      if (capability.availability?.[persona.id]) {
        counts.set(persona.id, (counts.get(persona.id) || 0) + 1);
      }
    }
  }
  return counts;
}

function validateConfig(config) {
  if (!Array.isArray(config.personas) || config.personas.length === 0) {
    throw new Error('feature-catalog.config.json requiere el arreglo "personas".');
  }
  if (!Array.isArray(config.capabilities) || config.capabilities.length === 0) {
    throw new Error('feature-catalog.config.json requiere el arreglo "capabilities".');
  }

  const personaIds = new Set(config.personas.map((p) => p.id));
  for (const capability of config.capabilities) {
    if (!capability.availability || typeof capability.availability !== 'object') {
      throw new Error(`Capability ${capability.routePrefix} sin bloque availability.`);
    }
    for (const key of Object.keys(capability.availability)) {
      if (!personaIds.has(key)) {
        throw new Error(`Capability ${capability.routePrefix} tiene persona no declarada: ${key}`);
      }
    }
  }
}

function renderFeatureCatalog({ personas, capabilities, mountedPrefixes, labels }) {
  const generatedAt = nowIsoDate();
  const byCategory = new Map();
  for (const c of capabilities) {
    const status = mountedPrefixes.has(c.routePrefix) ? 'activa' : 'no-detectada';
    const enriched = { ...c, status };
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category).push(enriched);
  }

  const categories = [...byCategory.keys()].sort((a, b) => a.localeCompare(b, 'es'));
  const lines = [];
  lines.push('# Catalogo de Capacidades');
  lines.push('');
  lines.push('> Documento auto-generado. No editar manualmente.');
  lines.push(`> Fecha de sincronizacion: **${generatedAt}**`);
  lines.push('');
  lines.push('## Matriz por persona y nivel minimo');
  lines.push('');

  const header = ['Capacidad', 'Categoria', ...personas.map((p) => `${p.label} (nivel minimo)`), 'Estado tecnico', 'Evidencia'];
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`| ${header.map(() => '---').join(' | ')} |`);

  for (const c of capabilities) {
    const status = mountedPrefixes.has(c.routePrefix) ? 'Activa' : 'No detectada';
    const row = [
      `${c.name} (\`${c.routePrefix}\`)`,
      c.category,
      ...personas.map((persona) => formatAvailability(c.availability, persona, labels)),
      status,
      `\`${c.evidence}\``
    ];
    lines.push(`| ${row.join(' | ')} |`);
  }

  for (const category of categories) {
    lines.push('');
    lines.push(`## ${category}`);
    lines.push('');
    for (const c of byCategory.get(category).sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
      lines.push(`- **${c.name}** (\`${c.routePrefix}\`)`);
      for (const persona of personas) {
        lines.push(`  - ${persona.label}: ${formatAvailability(c.availability, persona, labels)}.`);
      }
      lines.push(`  - Estado: ${c.status}. Evidencia: \`${c.evidence}\`.`);
    }
  }

  return lines.join('\n') + '\n';
}

function updateRootReadmeFeatureBlock(personas, capabilities) {
  const markerStart = '<!-- AUTO:FEATURES:START -->';
  const markerEnd = '<!-- AUTO:FEATURES:END -->';
  const content = fs.readFileSync(rootReadmePath, 'utf8');
  const summary = [
    markerStart,
    '## Funciones Confiables por Persona',
    '',
    '_Lista auto-sincronizada desde rutas reales del backend + evidencia de pruebas._',
    '',
    `| Categoria | ${personas.map((p) => p.label).join(' | ')} |`,
    `| --- | ${personas.map(() => '---').join(' | ')} |`
  ];

  const categoryMap = new Map();
  for (const capability of capabilities) {
    if (!categoryMap.has(capability.category)) {
      categoryMap.set(capability.category, Object.fromEntries(personas.map((p) => [p.id, 0])));
    }
    const bucket = categoryMap.get(capability.category);
    for (const persona of personas) {
      if (capability.availability?.[persona.id]) bucket[persona.id] += 1;
    }
  }

  for (const [category, counts] of [...categoryMap.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))) {
    const rowCounts = personas.map((p) => String(counts[p.id] || 0));
    summary.push(`| ${category} | ${rowCounts.join(' | ')} |`);
  }

  const totals = summarizeByPersona(capabilities, personas);
  summary.push('');
  summary.push(`- Totales por persona: ${personas.map((p) => `${p.label}: ${totals.get(p.id) || 0}`).join(' · ')}.`);
  summary.push('- Catalogo completo: [docs/comercial/FEATURE_CATALOG.md](docs/comercial/FEATURE_CATALOG.md)');
  summary.push(markerEnd);

  const replacement = summary.join('\n');
  let next = content;
  if (content.includes(markerStart) && content.includes(markerEnd)) {
    next = content.replace(new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`), replacement);
  } else {
    next = `${content.trim()}\n\n${replacement}\n`;
  }
  fs.writeFileSync(rootReadmePath, next, 'utf8');
}

function main() {
  const rutasSource = fs.readFileSync(rutasPath, 'utf8');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  validateConfig(config);

  const mountedPrefixes = parseMountedPrefixes(rutasSource);
  const { labels } = buildPersonaMaps(config.personas);

  const markdown = renderFeatureCatalog({
    personas: config.personas,
    capabilities: config.capabilities,
    mountedPrefixes,
    labels
  });

  fs.writeFileSync(outMdPath, markdown, 'utf8');
  fs.writeFileSync(
    outJsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mountedPrefixes: [...mountedPrefixes].sort(),
        personas: config.personas,
        capabilities: config.capabilities.map((c) => ({
          ...c,
          status: mountedPrefixes.has(c.routePrefix) ? 'activa' : 'no-detectada'
        }))
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  updateRootReadmeFeatureBlock(config.personas, config.capabilities);
  console.log(`[docs:features:sync] actualizado ${path.relative(repoRoot, outMdPath)} y README.md`);
}

main();
