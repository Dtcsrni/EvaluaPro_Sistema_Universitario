#!/usr/bin/env node
/**
 * security-env-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * security-env-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * security-env-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * security-env-check
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.cwd();
const rutaEnv = path.join(raiz, '.env');
const modo = String(process.env.NODE_ENV || 'development').toLowerCase();
const estricto = /^(1|true|yes|si)$/i.test(String(process.env.STRICT_ENV_CHECK || ''));

function parsearEnv(texto) {
  const resultado = {};
  for (const lineaCruda of String(texto || '').split(/\r?\n/)) {
    const linea = lineaCruda.trim();
    if (!linea || linea.startsWith('#')) continue;
    const indice = linea.indexOf('=');
    if (indice < 0) continue;
    const clave = linea.slice(0, indice).trim();
    const valor = linea.slice(indice + 1).trim();
    resultado[clave] = valor;
  }
  return resultado;
}

const envLocal = fs.existsSync(rutaEnv) ? parsearEnv(fs.readFileSync(rutaEnv, 'utf8')) : {};
const env = { ...envLocal, ...process.env };

const requeridasSiempre = estricto ? ['MONGODB_URI'] : [];
const requeridasProduccion = ['JWT_SECRETO'];
const advertencias = [];
const errores = [];

for (const k of requeridasSiempre) {
  if (!String(env[k] || '').trim()) {
    errores.push(`Variable requerida ausente: ${k}`);
  }
}

if (modo === 'production') {
  for (const k of requeridasProduccion) {
    const valor = String(env[k] || '').trim();
    if (!valor) errores.push(`Variable requerida en producción ausente: ${k}`);
    if (valor && /cambia-este-secreto|admin|1234|test/i.test(valor)) {
      errores.push(`Valor inseguro en producción para ${k}`);
    }
  }
}

if (!String(env.CORS_ORIGENES || '').trim()) {
  advertencias.push('CORS_ORIGENES no está definido; se recomienda restringir por entorno.');
}

if (!String(env.PORTAL_ALUMNO_API_KEY || env.PORTAL_API_KEY || '').trim()) {
  advertencias.push('No se detectó API key de portal; validar antes de cloud deploy.');
}

for (const advertencia of advertencias) console.warn(`[env-check][warn] ${advertencia}`);
for (const error of errores) console.error(`[env-check][error] ${error}`);

if (errores.length > 0) process.exit(1);
console.log('[env-check] OK');
