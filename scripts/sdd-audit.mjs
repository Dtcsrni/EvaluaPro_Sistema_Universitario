#!/usr/bin/env node
/**
 * sdd-audit
 *
 * Responsabilidad: Analizar todas las especificaciones bajo docs/specs/ y verificar
 * que cumplan con la política de Spec-Driven Development (SDD).
 * Límites: Solo diagnostica y falla con exit code 1 si hay violaciones.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const specsDir = path.join(repoRoot, 'docs/specs');

function parseFrontmatter(content) {
  const match = content.match(/^---([\s\S]*?)---/);
  if (!match) return null;

  const lines = match[1].split('\n');
  const metadata = {};
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join(':').trim();
      if (key) metadata[key] = val.replace(/^['"]|['"]$/g, ''); // Limpiar comillas
    }
  }
  return metadata;
}

export function validateSpecContent(filename, content) {
  const errors = [];

  // 1. Validar Frontmatter
  const metadata = parseFrontmatter(content);
  if (!metadata) {
    errors.push('YAML Frontmatter ausente o con formato inválido.');
    return { ok: false, errors };
  }

  const requiredFields = ['id', 'titulo', 'version', 'fecha', 'autor', 'modulo', 'estado'];
  for (const field of requiredFields) {
    if (!metadata[field]) {
      errors.push(`Campo requerido en frontmatter faltante: "${field}".`);
    }
  }

  if (metadata.estado && !['draft', 'approved', 'implemented'].includes(metadata.estado)) {
    errors.push(`Estado inválido: "${metadata.estado}". Debe ser draft, approved o implemented.`);
  }

  // 2. Validar Secciones Obligatorias
  const requiredHeaders = [
    '## Contexto',
    '## Requisitos Funcionales',
    '## Criterios de Aceptación',
    '## Matriz de Trazabilidad'
  ];

  for (const header of requiredHeaders) {
    if (!content.includes(header)) {
      errors.push(`Sección obligatoria faltante: "${header}".`);
    }
  }

  // 3. Validar Matriz de Trazabilidad y Existencia de Tests
  const lines = content.split('\n');
  let inMatrixSection = false;
  let testPathsFound = [];

  for (const line of lines) {
    if (line.trim().startsWith('## Matriz de Trazabilidad')) {
      inMatrixSection = true;
      continue;
    }
    if (inMatrixSection && line.trim().startsWith('## ')) {
      // Siguiente sección
      inMatrixSection = false;
    }

    if (inMatrixSection) {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length >= 4) {
        const potentialTest = parts[3]; // Tercera columna de datos en la tabla (ej. | ID | Desc | Test | Estado |)
        if (
          potentialTest &&
          potentialTest !== 'Archivo de Test Vinculado' && // Ignorar cabecera
          !potentialTest.startsWith('---') && // Ignorar separador de tabla
          (potentialTest.endsWith('.ts') ||
            potentialTest.endsWith('.tsx') ||
            potentialTest.endsWith('.js') ||
            potentialTest.endsWith('.jsx') ||
            potentialTest.endsWith('.mjs') ||
            potentialTest.endsWith('.cjs'))
        ) {
          // Limpiar backticks si los tiene
          const cleanedPath = potentialTest.replace(/`/g, '');
          testPathsFound.push(cleanedPath);
        }
      }
    }
  }

  for (const testPath of testPathsFound) {
    const fullTestPath = path.resolve(repoRoot, testPath);
    if (!fs.existsSync(fullTestPath)) {
      errors.push(`El archivo de test declarado en la matriz no existe: "${testPath}".`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    metadata,
    testPaths: testPathsFound
  };
}

export async function runSddAudit() {
  if (!fs.existsSync(specsDir)) {
    console.log('[sdd-audit] El directorio docs/specs/ no existe.');
    return { ok: true, reports: [] };
  }

  const files = fs.readdirSync(specsDir).filter((file) => file.endsWith('.spec.md') && file !== 'template.spec.md');
  let allOk = true;
  const reports = [];

  console.log(`[sdd-audit] Escaneando especificaciones en: ${specsDir}`);
  for (const file of files) {
    const filePath = path.join(specsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const result = validateSpecContent(file, content);

    reports.push({ file, ...result });
    if (!result.ok) {
      allOk = false;
      console.error(`\n[sdd-audit] Errores encontrados en "${file}":`);
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
    } else {
      console.log(`  ✓ ${file} (estado: ${result.metadata.estado}, tests vinculados: ${result.testPaths.length})`);
    }
  }

  return { ok: allOk, reports };
}

async function main() {
  try {
    const result = await runSddAudit();
    if (!result.ok) {
      console.error('\n[sdd-audit] Auditoría fallida. Spec-Driven Development no se cumple.');
      process.exit(1);
    }
    console.log('\n[sdd-audit] ¡Auditoría exitosa! Todas las especificaciones cumplen la política.');
  } catch (error) {
    console.error('[sdd-audit] Error fatal en la ejecución:', error);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
