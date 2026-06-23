/**
 * sincronizacionUtils
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { RegistroSincronizacion } from './tipos';

export type EstadoSincronizacion = 'ok' | 'error' | 'warn' | 'info';

export function formatearFechaSincronizacion(valor?: string | number | null) {
  if (!valor) return '-';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '-';
  return fecha.toLocaleString();
}

export function normalizarEstadoSincronizacion(estado?: string): { clase: EstadoSincronizacion; texto: string } {
  const lower = String(estado || '').toLowerCase();
  if (lower.includes('exitos')) return { clase: 'ok', texto: 'Exitosa' };
  if (lower.includes('fall')) return { clase: 'error', texto: 'Fallida' };
  if (lower.includes('pend')) return { clase: 'warn', texto: 'Pendiente' };
  return { clase: 'info', texto: 'Sin dato' };
}

export function ordenarSincronizacionesRecientes(lista: RegistroSincronizacion[]) {
  return [...lista].sort((a, b) => {
    const fechaA = new Date(a.ejecutadoEn || a.createdAt || 0).getTime();
    const fechaB = new Date(b.ejecutadoEn || b.createdAt || 0).getTime();
    return fechaB - fechaA;
  });
}

export function calcularTotalesPorEstado(lista: RegistroSincronizacion[]) {
  let exitosas = 0;
  let fallidas = 0;
  let pendientes = 0;

  for (const item of lista) {
    const estado = normalizarEstadoSincronizacion(item.estado).clase;
    if (estado === 'ok') exitosas += 1;
    else if (estado === 'error') fallidas += 1;
    else if (estado === 'warn') pendientes += 1;
  }

  return { exitosas, fallidas, pendientes };
}

export function filtrarHistorialSincronizacion(lista: RegistroSincronizacion[], filtro: string) {
  const query = String(filtro || '').trim().toLowerCase();
  if (!query) return lista;

  return lista.filter((item) => {
    const texto = [item.estado, item.tipo, item.ejecutadoEn, item.createdAt].join(' ').toLowerCase();
    return texto.includes(query);
  });
}

export function convertirFechaLocalAISO(valor: string): string | undefined {
  const limpio = String(valor || '').trim();
  if (!limpio) return undefined;
  const fecha = new Date(limpio);
  if (Number.isNaN(fecha.getTime())) return undefined;
  return fecha.toISOString();
}