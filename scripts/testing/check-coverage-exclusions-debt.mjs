/**
 * check-coverage-exclusions-debt
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const debtFile = path.join(rootDir, 'docs', 'tdd-exclusions-debt.json');

function parseIsoDate(value) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function todayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function normalizeEntry(entry) {
  return {
    id: String(entry?.id ?? '').trim(),
    file: String(entry?.file ?? '').trim(),
    pattern: String(entry?.pattern ?? '').trim(),
    owner: String(entry?.owner ?? '').trim(),
    dueDate: String(entry?.dueDate ?? '').trim(),
    status: String(entry?.status ?? 'temporary').trim()
  };
}

function validateShape(entry, failures) {
  if (!entry.id || !entry.file || !entry.pattern || !entry.owner) {
    failures.push(`[invalid] Entrada incompleta: ${JSON.stringify(entry)}`);
    return false;
  }
  return true;
}

function validateDueDate(entry, today, failures) {
  if (entry.status !== 'temporary') return;
  const parsedDue = parseIsoDate(entry.dueDate);
  if (!parsedDue) {
    failures.push(`[${entry.id}] dueDate inválida: ${entry.dueDate}`);
    return;
  }
  if (today > parsedDue) {
    failures.push(`[${entry.id}] Deuda vencida (${entry.dueDate}) owner=${entry.owner} file=${entry.file}`);
  }
}

async function validateEntry(entryRaw, today, failures) {
  const entry = normalizeEntry(entryRaw);
  if (!validateShape(entry, failures)) return;

  const absFile = path.join(rootDir, entry.file);
  let fileContent = '';
  try {
    fileContent = await fs.readFile(absFile, 'utf8');
  } catch {
    failures.push(`[${entry.id}] Archivo no encontrado: ${entry.file}`);
    return;
  }

  if (!fileContent.includes(entry.pattern)) {
    failures.push(`[${entry.id}] Patrón no encontrado en ${entry.file}: ${entry.pattern}`);
  }

  validateDueDate(entry, today, failures);
}

async function main() {
  let debt;
  try {
    debt = await readJson(debtFile);
  } catch (error) {
    console.error(`[coverage-exclusions-debt] No se pudo leer ${path.relative(rootDir, debtFile)}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const entries = Array.isArray(debt?.entries) ? debt.entries : [];
  if (entries.length === 0) {
    console.error('[coverage-exclusions-debt] No hay entradas registradas en deuda de exclusiones.');
    process.exit(1);
  }

  const today = todayUtcDate();
  const failures = [];

  for (const entry of entries) {
    await validateEntry(entry, today, failures);
  }

  if (failures.length > 0) {
    console.error('[coverage-exclusions-debt] FALLO: hay deuda de exclusiones inválida o vencida.');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log(`[coverage-exclusions-debt] OK (${entries.length} entradas verificadas)`);
}

await main();
