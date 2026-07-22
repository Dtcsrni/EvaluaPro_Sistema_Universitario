/**
 * import-backup
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHmac } from 'node:crypto';

const BACKUP_LOGIC_FINGERPRINT = 'sync-v2-lww-updatedAt-schema2';

function parseEnvFile(ruta) {
  const contenido = readFileSync(ruta, 'utf8');
  const env = {};
  for (const linea of contenido.split(/\r?\n/)) {
    const recorte = linea.trim();
    if (!recorte || recorte.startsWith('#')) continue;
    const idx = recorte.indexOf('=');
    if (idx === -1) continue;
    const clave = recorte.slice(0, idx).trim();
    const valor = recorte.slice(idx + 1).trim();
    if (!clave) continue;
    env[clave] = valor;
  }
  return env;
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function crearJwt({ secreto, docenteId, roles, expiraHoras }) {
  const ahora = Math.floor(Date.now() / 1000);
  const payload = {
    docenteId,
    roles,
    iat: ahora,
    exp: ahora + expiraHoras * 60 * 60
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const headB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = `${headB64}.${payloadB64}`;
  const firma = createHmac('sha256', secreto).update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${firma}`;
}

function obtenerDocenteIdDesdePaquete(paqueteBase64) {
  const buffer = Buffer.from(paqueteBase64, 'base64');
  const json = gunzipSync(buffer).toString('utf8');
  const paquete = JSON.parse(json);
  return {
    docenteId: String(paquete?.docenteId || '').trim(),
    docenteCorreo: String(paquete?.docenteCorreo || '').trim()
  };
}

function intentarEliminarBackup(rutaAbsoluta, motivo) {
  try {
    unlinkSync(rutaAbsoluta);
    console.error(`${motivo}. Archivo eliminado: ${rutaAbsoluta}`);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    console.error(`${motivo}. No se pudo eliminar archivo (${detalle}): ${rutaAbsoluta}`);
  }
}

function validarBackupMeta({ metaRaw, rutaAbsoluta }) {
  if (!metaRaw || typeof metaRaw !== 'object') {
    return;
  }

  const meta = metaRaw;
  const expiresAt = String(meta.expiresAt || '').trim();
  const fingerprint = String(meta.businessLogicFingerprint || '').trim();

  if (!expiresAt) {
    intentarEliminarBackup(rutaAbsoluta, 'Backup invalido: falta backupMeta.expiresAt');
    process.exit(1);
  }

  const expiraMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiraMs)) {
    intentarEliminarBackup(rutaAbsoluta, 'Backup invalido: backupMeta.expiresAt no es una fecha valida');
    process.exit(1);
  }

  if (Date.now() > expiraMs) {
    intentarEliminarBackup(rutaAbsoluta, 'Backup expirado');
    process.exit(1);
  }

  if (fingerprint && fingerprint !== BACKUP_LOGIC_FINGERPRINT) {
    intentarEliminarBackup(rutaAbsoluta, 'Backup invalidado por cambio de logica de negocio');
    process.exit(1);
  }
}

async function main() {
  const rutaEntrada = process.argv[2];
  if (!rutaEntrada) {
    console.error('Uso: node scripts/import-backup.mjs <ruta-archivo.ep-sync.json>');
    process.exit(1);
  }

  const rutaAbsoluta = resolve(rutaEntrada);
  const env = parseEnvFile(resolve('.env'));
  const puerto = Number(env.PUERTO_API || 4000);
  const secreto = String(env.JWT_SECRETO || '').trim();
  const expiraHoras = Number(env.JWT_EXPIRA_HORAS || 8);

  if (!secreto) {
    console.error('JWT_SECRETO no definido en .env');
    process.exit(1);
  }

  const contenido = readFileSync(rutaAbsoluta, 'utf8');
  const json = JSON.parse(contenido);
  validarBackupMeta({ metaRaw: json?.backupMeta, rutaAbsoluta });

  const paqueteBase64 = String(json?.paqueteBase64 || '').trim();
  const checksumSha256 = String(json?.checksumSha256 || '').trim();
  const docenteArchivo = String(json?.docenteCorreo || '').trim();

  if (!paqueteBase64) {
    console.error('El archivo no contiene paqueteBase64.');
    process.exit(1);
  }

  const { docenteId, docenteCorreo } = obtenerDocenteIdDesdePaquete(paqueteBase64);
  if (!docenteId) {
    console.error('No se pudo obtener docenteId desde el paquete.');
    process.exit(1);
  }

  const token = crearJwt({ secreto, docenteId, roles: ['admin'], expiraHoras });
  const url = `http://localhost:${puerto}/api/sincronizaciones/paquete/importar`;
  const payload = {
    paqueteBase64,
    ...(checksumSha256 ? { checksumSha256 } : {}),
    ...(docenteArchivo || docenteCorreo ? { docenteCorreo: docenteArchivo || docenteCorreo } : {})
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const texto = await res.text();
  let data = null;
  try {
    data = JSON.parse(texto);
  } catch {
    data = texto;
  }

  if (!res.ok) {
    console.error('Error al importar:', res.status, data);
    process.exit(1);
  }

  console.log('Importacion completada:', data);
}

main().catch((error) => {
  console.error('Fallo inesperado:', error);
  process.exit(1);
});
