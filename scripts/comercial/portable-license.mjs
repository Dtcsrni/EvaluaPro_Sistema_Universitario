#!/usr/bin/env node
/**
 * portable-license
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * portable-license
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * Portable license tooling for EvaluaPro.
 * Commands:
 *   init-admin --root <dir> --holder "<name>" --out <file>
 *   verify --license <file> --public-keys <file>
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function getArg(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  if (idx < 0 || idx + 1 >= process.argv.length) return fallback;
  return String(process.argv[idx + 1] || fallback);
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function generateKeyring(rootDir) {
  ensureDir(rootDir);
  const privateKeyPath = path.join(rootDir, 'portable-license-private.pem');
  const publicKeysPath = path.join(rootDir, 'portable-license-public-keys.json');
  const kid = 'evalupro-premium-admin-r1';
  if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeysPath)) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 3072,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    fs.writeFileSync(privateKeyPath, privateKey, 'utf8');
    fs.writeFileSync(publicKeysPath, JSON.stringify({
      currentKid: kid,
      keys: {
        [kid]: publicKey
      }
    }, null, 2), 'utf8');
  }
  return { privateKeyPath, publicKeysPath, kid };
}

function signPayload(payload, privateKeyPem) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(canonicalize(payload));
  signer.end();
  return base64Url(signer.sign(privateKeyPem));
}

function verifyEnvelope(envelope, publicKeysPath) {
  const keyring = JSON.parse(fs.readFileSync(publicKeysPath, 'utf8'));
  const kid = String(envelope?.payload?.kid || '');
  const publicKey = keyring?.keys?.[kid];
  if (!publicKey) {
    return { ok: false, reason: 'kid_untrusted', kid };
  }
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(canonicalize(envelope.payload));
  verifier.end();
  const signature = String(envelope.signature || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = signature.length % 4 === 0 ? '' : '='.repeat(4 - (signature.length % 4));
  const valid = verifier.verify(publicKey, Buffer.from(signature + pad, 'base64'));
  return { ok: valid, reason: valid ? 'ok' : 'signature_invalid', kid };
}

function issueAdminPortableLicense() {
  const rootDir = path.resolve(getArg('--root', path.join(process.env.ProgramData || 'C:\\ProgramData', 'EvaluaPro', 'security')));
  const outPath = path.resolve(getArg('--out', path.join(rootDir, 'portable-license.epl')));
  const holderName = getArg('--holder', 'I.S.C. Erick Renato Vega Ceron');
  const issuedAt = new Date().toISOString();
  const maintenanceUntil = getArg('--maintenance-until', '2036-03-20T00:00:00.000Z');
  const { privateKeyPath, publicKeysPath, kid } = generateKeyring(rootDir);
  const payload = {
    version: 1,
    kind: 'evaluapro-portable-license',
    licenseId: getArg('--license-id', crypto.randomUUID()),
    holderName,
    tier: 'Premium Administrador',
    roles: ['superadmin_negocio', 'admin', 'docente', 'developer'],
    portable: true,
    channelPolicy: 'stable+beta',
    issuedAt,
    maintenanceUntil,
    kid,
    stepUp: {
      primary: 'windows_hello_or_fido2',
      fallback: 'totp',
      recovery: 'codes'
    }
  };
  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
  const envelope = {
    payload,
    signature: signPayload(payload, privateKeyPem)
  };
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(envelope, null, 2), 'utf8');
  process.stdout.write(JSON.stringify({
    ok: true,
    outPath,
    publicKeysPath,
    licenseId: payload.licenseId,
    holderName
  }));
}

function verifyPortableLicense() {
  const licensePath = path.resolve(getArg('--license'));
  const publicKeysPath = path.resolve(getArg('--public-keys'));
  const envelope = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
  const result = verifyEnvelope(envelope, publicKeysPath);
  process.stdout.write(JSON.stringify({
    ...result,
    payload: envelope.payload
  }));
  process.exit(result.ok ? 0 : 1);
}

const command = process.argv[2] || '';
if (command === 'init-admin') {
  issueAdminPortableLicense();
} else if (command === 'verify') {
  verifyPortableLicense();
} else {
  process.stderr.write('Uso: portable-license.mjs <init-admin|verify> [args]\n');
  process.exit(1);
}
