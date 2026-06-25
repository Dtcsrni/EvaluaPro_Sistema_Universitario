/**
 * generar-llaves-licencia-rs256
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import crypto from 'node:crypto';

function nowKid() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `lic-${y}${m}${day}-${crypto.randomBytes(3).toString('hex')}`;
}

const kid = process.argv[2] || nowKid();
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 3072,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const escapedPrivate = privateKey.replace(/\n/g, '\\n');
const escapedPublic = publicKey.replace(/\n/g, '\\n');
const publicMap = { [kid]: escapedPublic };

const output = [
  `LICENCIA_JWT_KID_ACTIVO=${kid}`,
  `LICENCIA_JWT_LLAVE_PRIVADA_PEM=${escapedPrivate}`,
  `LICENCIA_JWT_LLAVE_PUBLICA_PEM=${escapedPublic}`,
  `LICENCIA_JWT_LLAVES_PUBLICAS_JSON=${JSON.stringify(publicMap)}`,
  'LICENCIA_JWT_PERMITIR_LEGACY_HS256=true'
].join('\n');

process.stdout.write(`${output}\n`);
