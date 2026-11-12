import crypto from 'node:crypto';

export const PERMISOS_API_DELEGABLES = [
  'periodos:leer',
  'alumnos:leer',
  'temarios:leer',
  'banco:leer',
  'banco:gestionar',
  'banco:ingestar',
  'banco:revisar',
  'banco:publicar',
  'banco:archivar',
  'plantillas:leer',
  'plantillas:gestionar',
  'plantillas:previsualizar',
  'examenes:leer',
  'examenes:generar',
  'examenes:descargar',
  'omr:analizar',
  'calificaciones:calificar',
  'evaluaciones:leer',
  'analiticas:leer'
] as const;

export type PermisoApiDelegable = (typeof PERMISOS_API_DELEGABLES)[number];

type SolicitudApiLocal = {
  id: string;
  codigoHash: string;
  verifierHash: string;
  nombreCliente: string;
  permisosSolicitados: PermisoApiDelegable[];
  creadoEn: number;
  expiraEn: number;
  consumidaEn?: number;
  intentosCodigo: number;
  estado: 'pendiente' | 'aprobada' | 'denegada' | 'consumida' | 'expirada';
  docenteId?: string;
  credencialId?: string;
  refreshToken?: string;
};

const solicitudes = new Map<string, SolicitudApiLocal>();
const DURACION_SOLICITUD_MS = 5 * 60 * 1000;
const VENTANA_RECUPERACION_INTERCAMBIO_MS = 60 * 1000;
const MAX_SOLICITUDES_PENDIENTES = 100;
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function hash(valor: string) {
  return crypto.createHash('sha256').update(valor).digest('hex');
}

function compararHash(a: string, b: string) {
  const bytesA = Buffer.from(a, 'hex');
  const bytesB = Buffer.from(b, 'hex');
  return bytesA.length === bytesB.length && crypto.timingSafeEqual(bytesA, bytesB);
}

function compararTextoSeguro(a: string, b: string) {
  const bytesA = Buffer.from(a);
  const bytesB = Buffer.from(b);
  return bytesA.length === bytesB.length && crypto.timingSafeEqual(bytesA, bytesB);
}

function purgarSolicitudes(now = Date.now()) {
  for (const [id, solicitud] of solicitudes) {
    if (solicitud.expiraEn <= now || solicitud.estado === 'denegada' ||
      (solicitud.estado === 'consumida' && (solicitud.consumidaEn ?? 0) + VENTANA_RECUPERACION_INTERCAMBIO_MS <= now)) {
      solicitudes.delete(id);
    }
  }
}

function generarCodigoUsuario() {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (byte) => ALFABETO_CODIGO[byte & 31]).join('');
}

export function normalizarPermisosApi(value: unknown): PermisoApiDelegable[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > PERMISOS_API_DELEGABLES.length) {
    throw new TypeError('Selecciona al menos un permiso API admitido.');
  }
  const admitidos = new Set<string>(PERMISOS_API_DELEGABLES);
  const permisos = [...new Set(value.map((item) => String(item).trim()))];
  if (permisos.length !== value.length || permisos.some((permiso) => !admitidos.has(permiso))) {
    throw new TypeError('La solicitud contiene permisos API repetidos o no admitidos.');
  }
  return permisos as PermisoApiDelegable[];
}

export function crearSolicitudApiLocal(input: {
  codeChallenge: string;
  nombreCliente: string;
  permisos: unknown;
}, now = Date.now()) {
  purgarSolicitudes(now);
  if (solicitudes.size >= MAX_SOLICITUDES_PENDIENTES) throw new Error('Hay demasiadas solicitudes locales pendientes; intenta de nuevo más tarde.');
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.codeChallenge)) throw new TypeError('codeChallenge PKCE inválido.');
  const nombreCliente = String(input.nombreCliente || '').trim();
  if (nombreCliente.length < 2 || nombreCliente.length > 60 || /[\r\n\0]/.test(nombreCliente)) {
    throw new TypeError('nombreCliente debe tener entre 2 y 60 caracteres de una sola línea.');
  }
  const permisosSolicitados = normalizarPermisosApi(input.permisos);
  const id = crypto.randomUUID();
  const codigo = generarCodigoUsuario();
  const solicitud: SolicitudApiLocal = {
    id,
    codigoHash: hash(codigo),
    verifierHash: input.codeChallenge,
    nombreCliente,
    permisosSolicitados,
    creadoEn: now,
    expiraEn: now + DURACION_SOLICITUD_MS,
    intentosCodigo: 0,
    estado: 'pendiente'
  };
  solicitudes.set(id, solicitud);
  return { solicitudId: id, codigo, expiraEn: new Date(solicitud.expiraEn).toISOString() };
}

export function inspeccionarSolicitudApiLocal(codigoValue: unknown, permisosDisponibles: ReadonlySet<string>, now = Date.now()) {
  const codigo = String(codigoValue || '').trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(codigo)) return null;
  const codigoHash = hash(codigo);
  for (const solicitud of solicitudes.values()) {
    if (!compararHash(solicitud.codigoHash, codigoHash)) continue;
    solicitud.intentosCodigo += 1;
    if (solicitud.expiraEn <= now) {
      solicitud.estado = 'expirada';
      solicitudes.delete(solicitud.id);
      return null;
    }
    if (solicitud.intentosCodigo > 5 || solicitud.estado !== 'pendiente') return null;
    return {
      solicitudId: solicitud.id,
      nombreCliente: solicitud.nombreCliente,
      permisosSolicitados: [...solicitud.permisosSolicitados],
      permisosDisponibles: solicitud.permisosSolicitados.filter((permiso) => permisosDisponibles.has(permiso)),
      expiraEn: new Date(solicitud.expiraEn).toISOString()
    };
  }
  return null;
}

export function resolverSolicitudApiLocal(input: {
  solicitudId: string;
  codigo: string;
  permitir: boolean;
  docenteId: string;
  permisosConcedidos?: unknown;
  permisosDisponibles: ReadonlySet<string>;
  credencialId?: string;
  refreshToken?: string;
}, now = Date.now()) {
  const solicitud = solicitudes.get(input.solicitudId);
  if (!solicitud || solicitud.expiraEn <= now || solicitud.estado !== 'pendiente') return null;
  if (!compararHash(solicitud.codigoHash, hash(String(input.codigo || '').trim().toUpperCase()))) return null;
  if (!input.permitir) {
    solicitud.estado = 'denegada';
    return { estado: 'denegada' as const };
  }
  const permisos = normalizarPermisosApi(input.permisosConcedidos);
  if (permisos.some((permiso) => !solicitud.permisosSolicitados.includes(permiso) || !input.permisosDisponibles.has(permiso))) {
    throw new TypeError('Solo puedes conceder permisos solicitados y disponibles en tu cuenta.');
  }
  if (!input.credencialId || !input.refreshToken) throw new TypeError('Falta crear la credencial delegada antes de aprobar.');
  solicitud.estado = 'aprobada';
  solicitud.docenteId = input.docenteId;
  solicitud.credencialId = input.credencialId;
  solicitud.refreshToken = input.refreshToken;
  return { estado: 'aprobada' as const, credencialId: input.credencialId, permisos };
}

export function intercambiarSolicitudApiLocal(input: { solicitudId: string; codeVerifier: string }, now = Date.now()) {
  const solicitud = solicitudes.get(input.solicitudId);
  if (!solicitud || solicitud.expiraEn <= now) return { estado: 'expirada' as const };
  const challenge = crypto.createHash('sha256').update(input.codeVerifier).digest('base64url');
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(input.codeVerifier) || !compararTextoSeguro(solicitud.verifierHash, challenge)) {
    return { estado: 'no_autorizada' as const };
  }
  if (solicitud.estado === 'pendiente') return { estado: 'pendiente' as const };
  if (solicitud.estado === 'consumida' && solicitud.refreshToken && solicitud.credencialId &&
    (solicitud.consumidaEn ?? 0) + VENTANA_RECUPERACION_INTERCAMBIO_MS > now) {
    return { estado: 'aprobada' as const, refreshToken: solicitud.refreshToken, credencialId: solicitud.credencialId };
  }
  if (solicitud.estado !== 'aprobada' || !solicitud.refreshToken || !solicitud.credencialId) {
    return { estado: 'no_autorizada' as const };
  }
  const resultado = { estado: 'aprobada' as const, refreshToken: solicitud.refreshToken, credencialId: solicitud.credencialId };
  solicitud.estado = 'consumida';
  solicitud.consumidaEn = now;
  const solicitudId = solicitud.id;
  const timeout = setTimeout(() => {
    const vigente = solicitudes.get(solicitudId);
    if (vigente?.estado === 'consumida' && vigente.consumidaEn === now) {
      vigente.refreshToken = undefined;
      solicitudes.delete(solicitudId);
    }
  }, VENTANA_RECUPERACION_INTERCAMBIO_MS);
  timeout.unref();
  return resultado;
}

export function denegarSolicitudesApiLocalDocente(docenteId: string) {
  for (const solicitud of solicitudes.values()) {
    if (solicitud.docenteId === docenteId && solicitud.estado === 'pendiente') solicitud.estado = 'denegada';
  }
}

export function hashRefreshApi(token: string) {
  return hash(token);
}

export function crearRefreshApi() {
  return `epr_${crypto.randomBytes(32).toString('base64url')}`;
}
