/**
 * logger
 *
 * Responsabilidad: Configuracion de logging estructurado para el servicio.
 * Limites: No exponer secretos en logs ni degradar trazabilidad por requestId.
 */
export type NivelLog = 'info' | 'warn' | 'error' | 'ok' | 'system';

type Meta = Record<string, unknown>;

const servicio = 'api-docente';
const env = process.env.NODE_ENV ?? 'development';

function logsSilenciados(): boolean {
  const raw = String(process.env.EVALUAPRO_LOG_SILENT || process.env.EVALUAPRO_SILENT_LOGS || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'si';
}

function serializarError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return { value: String(error) };
}

function nivelEstandar(level: NivelLog): 'info' | 'warn' | 'error' {
  if (level === 'warn') return 'warn';
  if (level === 'error') return 'error';
  return 'info';
}

export function log(level: NivelLog, msg: string, meta: Meta = {}) {
  if (logsSilenciados()) return;
  const levelStd = nivelEstandar(level);
  const entry = {
    timestamp: new Date().toISOString(),
    service: servicio,
    env,
    level: levelStd,
    message: msg,
    ...meta
  };

  const line = JSON.stringify(entry);
  if (levelStd === 'error') console.error(line);
  else if (levelStd === 'warn') console.warn(line);
  else console.log(line);
}

export function logError(msg: string, error?: unknown, meta: Meta = {}) {
  log('error', msg, { ...meta, error: serializarError(error) });
}
