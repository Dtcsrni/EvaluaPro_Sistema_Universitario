import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function auditarCoberturaModelos({ schema, lifecycle }) {
  const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]);
  const start = lifecycle.indexOf('| Recurso de dominio | Modelos persistidos principales |');
  const end = lifecycle.indexOf('\n## Siguiente trabajo de auditoría', start);
  if (start < 0 || end < 0) throw new Error('RESOURCE_LIFECYCLE.md no contiene una matriz de recursos reconocible.');

  const matrix = lifecycle.slice(start, end);
  const declared = new Set();
  for (const line of matrix.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const columns = line.split('|');
    const modelColumn = columns[2] ?? '';
    for (const match of modelColumn.matchAll(/`([^`]+)`/g)) declared.add(match[1]);
  }

  const modelSet = new Set(models);
  const missing = models.filter((model) => !declared.has(model));
  const unknown = [...declared].filter((model) => !modelSet.has(model));
  return { totalModels: models.length, documentedModels: declared.size, missing, unknown };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const schema = fs.readFileSync(path.join(rootDir, 'apps/backend/prisma/schema.prisma'), 'utf8');
  const lifecycle = fs.readFileSync(path.join(rootDir, 'scripts/api/RESOURCE_LIFECYCLE.md'), 'utf8');
  const result = auditarCoberturaModelos({ schema, lifecycle });
  if (result.missing.length || result.unknown.length) {
    console.error(`[resource-lifecycle] cobertura incompleta: faltan=${result.missing.join(', ') || 'ninguno'}; desconocidos=${result.unknown.join(', ') || 'ninguno'}`);
    process.exitCode = 1;
  } else {
    console.log(`[resource-lifecycle] ${result.documentedModels}/${result.totalModels} modelos Prisma tienen ciclo de vida declarado.`);
  }
}
