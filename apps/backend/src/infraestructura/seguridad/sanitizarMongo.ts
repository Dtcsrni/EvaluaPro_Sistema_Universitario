/**
 * Sanitiza request payloads para mitigar inyeccion NoSQL en MongoDB.
 *
 * Motivo:
 * - En Express 5 `req.query` es un getter (no asignable), y `express-mongo-sanitize`
 *   intenta reasignarlo, causando errores 500.
 *
 * Estrategia:
 * - Elimina claves peligrosas (p. ej. `$gt`, `$where` o claves con `.`)
 * - No reasigna `req.query`; muta el objeto devuelto cuando es posible.
 *
 * Nota:
 * - Esto no reemplaza validacion (Zod) ni controles de autorizacion; es defensa
 *   en profundidad.
 */
import type { NextFunction, Request, Response } from 'express';

const CLAVES_PROHIBIDAS = new Set(['__proto__', 'prototype', 'constructor']);

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null) return false;
  return Object.prototype.toString.call(valor) === '[object Object]';
}

function esClavePeligrosa(clave: string): boolean {
  if (CLAVES_PROHIBIDAS.has(clave)) return true;
  return clave.startsWith('$') || clave.includes('.');
}

function sanitizarEnLugar(valor: unknown): void {
  if (Array.isArray(valor)) {
    for (const item of valor) sanitizarEnLugar(item);
    return;
  }

  if (!esObjetoPlano(valor)) return;

  for (const clave of Object.keys(valor)) {
    if (esClavePeligrosa(clave)) {
      delete valor[clave];
      continue;
    }
    sanitizarEnLugar(valor[clave]);
  }
}

export function sanitizarMongo() {
  return (req: Request, _res: Response, next: NextFunction) => {
    sanitizarEnLugar(req.body);
    // Express 5: `req.query` no es asignable; se sanitiza mutando el objeto actual.
    // Tipado: Express expone `req.query` como ParsedQs; tratamos como unknown.
    sanitizarEnLugar(req.query as unknown);
    sanitizarEnLugar(req.params);
    next();
  };
}
