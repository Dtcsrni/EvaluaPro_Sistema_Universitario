import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ErrorAplicacion } from '../errores/errorAplicacion';

const IV_BYTES = 12;
const TAG_BYTES = 16;

function obtenerLlaveBinaria(llaveBase64: string): Buffer {
  const limpia = String(llaveBase64 || '').trim();
  if (!limpia) {
    throw new ErrorAplicacion('CIFRADO_NO_CONFIG', 'Llave de cifrado no configurada', 500);
  }
  const key = Buffer.from(limpia, 'base64');
  if (key.length !== 32) {
    throw new ErrorAplicacion('CIFRADO_LLAVE_INVALIDA', 'La llave de cifrado debe ser de 32 bytes en base64', 500);
  }
  return key;
}

export function cifrarTexto(textoPlano: string, llaveBase64: string): string {
  const key = obtenerLlaveBinaria(llaveBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(textoPlano || ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function descifrarTexto(textoCifradoBase64: string, llaveBase64: string): string {
  const key = obtenerLlaveBinaria(llaveBase64);
  const payload = Buffer.from(String(textoCifradoBase64 || ''), 'base64');
  if (payload.length <= IV_BYTES + TAG_BYTES) {
    throw new ErrorAplicacion('CIFRADO_PAYLOAD_INVALIDO', 'Payload cifrado invalido', 500);
  }
  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const data = payload.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString('utf8');
}
