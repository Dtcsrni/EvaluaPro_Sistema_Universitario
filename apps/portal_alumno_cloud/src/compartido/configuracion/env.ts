/**
 * env
 *
 * Responsabilidad: Centralizar carga segura de `.env` y parseos básicos del portal.
 * Limites: Solo utilidades de infraestructura/configuración.
 */
import dotenv from 'dotenv';
import path from 'node:path';

export function cargarDotenvRaizSiAplica(entorno: string) {
  if (entorno === 'test') return;
  dotenv.config({
    quiet: true,
    path: path.resolve(__dirname, '..', '..', '..', '..', '.env')
  });
}

export function parsearNumeroSeguro(valor: unknown, porDefecto: number, { min, max }: { min?: number; max?: number } = {}) {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return porDefecto;
  const clampedMax = typeof max === 'number' ? Math.min(max, n) : n;
  return typeof min === 'number' ? Math.max(min, clampedMax) : clampedMax;
}

export function parsearListaCsv(valor: unknown) {
  return String(valor ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
