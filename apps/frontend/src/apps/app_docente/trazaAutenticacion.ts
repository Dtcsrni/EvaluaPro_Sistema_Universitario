const CLAVE_TRAZA_AUTENTICACION = 'evaluapro.auth.trace.v1';
const MAX_EVENTOS = 80;

export type CanalTrazabilidadAutenticacion = 'google' | 'contrasena' | 'sesion';
export type EtapaTrazabilidadAutenticacion =
  | 'widget_google_visible'
  | 'callback_google'
  | 'solicitud_api'
  | 'validacion_credencial_google'
  | 'busqueda_cuenta'
  | 'validacion_contrasena'
  | 'sesion_emitida'
  | 'token_guardado'
  | 'perfil_validado'
  | 'perfil_rechazado';
export type ResultadoTrazabilidadAutenticacion = 'iniciado' | 'exito' | 'error';

export type EventoTrazabilidadAutenticacion = {
  flowId: string;
  timestamp: string;
  canal: CanalTrazabilidadAutenticacion;
  etapa: EtapaTrazabilidadAutenticacion;
  resultado: ResultadoTrazabilidadAutenticacion;
  codigo?: string;
  httpStatus?: number;
  duracionMs?: number;
};

type NuevoEventoTrazabilidad = Omit<EventoTrazabilidadAutenticacion, 'timestamp'>;

const uuidValido = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codigoSeguro = /^[A-Z0-9_]{1,64}$/;
const etapas = new Set<EtapaTrazabilidadAutenticacion>([
  'widget_google_visible', 'callback_google', 'solicitud_api', 'validacion_credencial_google',
  'busqueda_cuenta', 'validacion_contrasena', 'sesion_emitida', 'token_guardado',
  'perfil_validado', 'perfil_rechazado'
]);

export function nuevoIdFlujoAutenticacion(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return '';
  }
}

function normalizarEvento(valor: unknown): EventoTrazabilidadAutenticacion | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const dato = valor as Record<string, unknown>;
  if (
    !esUuid(dato.flowId) ||
    !esTimestamp(dato.timestamp) ||
    !esCanal(dato.canal) ||
    !esEtapa(dato.etapa) ||
    !esResultado(dato.resultado)
  ) return null;

  const evento: EventoTrazabilidadAutenticacion = {
    flowId: dato.flowId,
    timestamp: dato.timestamp,
    canal: dato.canal,
    etapa: dato.etapa as EtapaTrazabilidadAutenticacion,
    resultado: dato.resultado
  };
  if (typeof dato.codigo === 'string' && codigoSeguro.test(dato.codigo)) evento.codigo = dato.codigo;
  if (typeof dato.httpStatus === 'number' && Number.isInteger(dato.httpStatus) && dato.httpStatus >= 100 && dato.httpStatus <= 599) {
    evento.httpStatus = dato.httpStatus;
  }
  if (typeof dato.duracionMs === 'number' && Number.isFinite(dato.duracionMs) && dato.duracionMs >= 0 && dato.duracionMs <= 600_000) {
    evento.duracionMs = Math.round(dato.duracionMs);
  }
  return evento;
}

function esUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && uuidValido.test(valor);
}

function esTimestamp(valor: unknown): valor is string {
  return typeof valor === 'string' && Number.isFinite(Date.parse(valor));
}

function esCanal(valor: unknown): valor is CanalTrazabilidadAutenticacion {
  return valor === 'google' || valor === 'contrasena' || valor === 'sesion';
}

function esEtapa(valor: unknown): valor is EtapaTrazabilidadAutenticacion {
  return typeof valor === 'string' && etapas.has(valor as EtapaTrazabilidadAutenticacion);
}

function esResultado(valor: unknown): valor is ResultadoTrazabilidadAutenticacion {
  return valor === 'iniciado' || valor === 'exito' || valor === 'error';
}

function leerEventosGuardados(): EventoTrazabilidadAutenticacion[] {
  try {
    const raw = globalThis.localStorage?.getItem(CLAVE_TRAZA_AUTENTICACION);
    if (!raw) return [];
    const valor: unknown = JSON.parse(raw);
    return Array.isArray(valor)
      ? valor.map(normalizarEvento).filter((evento): evento is EventoTrazabilidadAutenticacion => evento !== null).slice(-MAX_EVENTOS)
      : [];
  } catch {
    return [];
  }
}

export function registrarEventoTrazabilidadAutenticacion(evento: NuevoEventoTrazabilidad): void {
  if (!uuidValido.test(evento.flowId) || !etapas.has(evento.etapa)) return;
  try {
    const sanitizado = normalizarEvento({ ...evento, timestamp: new Date().toISOString() });
    if (!sanitizado) return;
    const eventos = [...leerEventosGuardados(), sanitizado].slice(-MAX_EVENTOS);
    globalThis.localStorage?.setItem(CLAVE_TRAZA_AUTENTICACION, JSON.stringify(eventos));
    console.info('[EvaluaPro auth-trace]', sanitizado);
  } catch {
    // La bitácora es diagnóstica: nunca debe interrumpir el acceso.
  }
}

export function leerTrazaAutenticacion(): EventoTrazabilidadAutenticacion[] {
  return leerEventosGuardados();
}

export function exportarTrazaAutenticacion(): string {
  return JSON.stringify({ schemaVersion: 1, eventos: leerEventosGuardados() }, null, 2);
}
