#!/usr/bin/env node
/**
 * retention-policy-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * retention-policy-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs';

const envExample = fs.readFileSync('.env.example', 'utf8');
const requiredVars = [
  'COMPLIANCE_MODE',
  'DATA_RETENTION_DEFAULT_DAYS',
  'DATA_PURGE_CRON',
  'AUDIT_LOG_IMMUTABLE',
  'DPO_CONTACT_EMAIL',
  'LEGAL_NOTICE_VERSION'
];

const missingVars = requiredVars.filter((name) => !new RegExp(`^${name}=`, 'm').test(envExample));
if (missingVars.length > 0) {
  process.stderr.write(`[retention-policy-check] Variables faltantes en .env.example: ${missingVars.join(', ')}\n`);
  process.exit(1);
}

const retentionDoc = 'docs/legal/politica-conservacion-eliminacion.md';
if (!fs.existsSync(retentionDoc)) {
  process.stderr.write('[retention-policy-check] Falta docs/legal/politica-conservacion-eliminacion.md\n');
  process.exit(1);
}

const docText = fs.readFileSync(retentionDoc, 'utf8');
if (!/retenci[oó]n/i.test(docText) || !/expurgo|eliminaci[oó]n/i.test(docText)) {
  process.stderr.write('[retention-policy-check] El documento no contiene secciones minimas de retencion/expurgo\n');
  process.exit(1);
}

process.stdout.write('[retention-policy-check] OK\n');
