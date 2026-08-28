#!/usr/bin/env node
/**
 * pii-leak-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * pii-leak-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * pii-leak-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const tracked = execSync('git ls-files', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
  .toString('utf8')
  .split(/\r?\n/)
  .filter(Boolean);

const textExt = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml', '.env', '.txt']);
const allowEmailSuffix = ['@example.invalid', '@local.test', '@example.com'];
const scopedPathRegex = [/^backups\//i, /^tests\/fixtures\//i, /^reports\//i, /^apps\/backend\/storage\//i];
const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const jwtRegex = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const matriculaRegex = /\bCUH\d{6,}\b/g;

const findings = [];
for (const rel of tracked) {
  if (!scopedPathRegex.some((rx) => rx.test(rel))) continue;
  const ext = path.extname(rel).toLowerCase();
  if (!textExt.has(ext) && !rel.endsWith('.env.example')) continue;

  const abs = path.join(root, rel);
  const content = fs.readFileSync(abs, 'utf8');

  const emails = content.match(emailRegex) ?? [];
  for (const email of emails) {
    if (allowEmailSuffix.some((suffix) => email.toLowerCase().endsWith(suffix))) continue;
    findings.push({ tipo: 'correo', archivo: rel, valor: email });
  }

  const jwts = content.match(jwtRegex) ?? [];
  for (const token of jwts) {
    findings.push({ tipo: 'token', archivo: rel, valor: `${token.slice(0, 18)}...` });
  }

  const matriculas = content.match(matriculaRegex) ?? [];
  for (const matricula of matriculas) {
    findings.push({ tipo: 'matricula', archivo: rel, valor: matricula });
  }
}

if (findings.length > 0) {
  process.stderr.write(`[pii-leak-check] Hallazgos (${findings.length}):\n`);
  for (const item of findings.slice(0, 40)) {
    process.stderr.write(`- [${item.tipo}] ${item.archivo}: ${item.valor}\n`);
  }
  if (findings.length > 40) process.stderr.write(`... y ${findings.length - 40} mas\n`);
  process.exit(1);
}

process.stdout.write('[pii-leak-check] OK\n');
