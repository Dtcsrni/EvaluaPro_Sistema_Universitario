/**
 * servicioClassroomGoogle
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { cifrarTexto, descifrarTexto } from '../../compartido/seguridad/cifrado.js';
import { configuracion } from '../../configuracion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { log } from '../../infraestructura/logging/logger.js';
import { IntegracionClassroom } from './modeloIntegracionClassroom.js';

const CLASSROOM_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly'
];

const STATE_EXPIRA_SEGUNDOS = 10 * 60;
const CLASSROOM_REQUEST_TIMEOUT_MS = configuracion.classroomRequestTimeoutMs ?? 15_000;
const CLASSROOM_MAX_ATTEMPTS = 3;
const CLASSROOM_MAX_PAGES = configuracion.classroomMaxPages ?? 100;
const CLASSROOM_MAX_RETRY_AFTER_MS = 30_000;
const renovacionesEnCurso = new Map<string, Promise<string>>();
const COLECCIONES_CLASSROOM = new Set([
  'courses', 'courseWork', 'studentSubmissions', 'students', 'teachers', 'invitations',
  'announcements', 'topics', 'guardians', 'courseWorkMaterials'
]);

type ContextoLecturaClassroom = { correlationId?: string; pagina?: number };

function normalizarRutaClassroom(path: string): string {
  const segmentos = String(path || '').replace(/^\/+/, '').split('/');
  return segmentos
    .map((segmento, index) => index > 0 && COLECCIONES_CLASSROOM.has(segmentos[index - 1]!) ? ':id' : segmento)
    .join('/');
}

function valorSeguro(value: string | null | undefined, maxLength = 128): string | undefined {
  const cleaned = String(value || '').trim();
  return cleaned && cleaned.length <= maxLength && /^[A-Za-z0-9._:-]+$/.test(cleaned) ? cleaned : undefined;
}

function esEstadoTransitorio(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function leerRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  const candidate = Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1000
    : Date.parse(value) - Date.now();
  if (!Number.isFinite(candidate) || candidate < 0) return undefined;
  return Math.min(CLASSROOM_MAX_RETRY_AFTER_MS, candidate);
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function demoraReintento(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined) return retryAfterMs;
  const cap = Math.min(4_000, 250 * 2 ** Math.max(0, attempt - 1));
  return cap + Math.floor(Math.random() * Math.max(1, Math.floor(cap / 2)));
}

function obtenerConfigClassroom() {
  const clientId = String(configuracion.googleClassroomClientId || '').trim();
  const clientSecret = String(configuracion.googleClassroomClientSecret || '').trim();
  const redirectUri = String(configuracion.googleClassroomRedirectUri || '').trim();
  const llaveCifrado = String(configuracion.classroomTokenCipherKey || '').trim();

  if (!configuracion.classroomEnabled || !clientId || !clientSecret || !redirectUri) {
    throw new ErrorAplicacion(
      'CLASSROOM_NO_CONFIG',
      'Google Classroom no está configurado (clientId/clientSecret/redirectUri)',
      503
    );
  }
  if (!llaveCifrado) {
    throw new ErrorAplicacion('CLASSROOM_NO_CONFIG', 'Google Classroom no está configurado (llave de cifrado)', 503);
  }
  return { clientId, clientSecret, redirectUri, llaveCifrado };
}

function crearClienteOauth() {
  const { clientId, clientSecret, redirectUri } = obtenerConfigClassroom();
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

type EstadoOauthPayload = {
  docenteId: string;
  purpose: 'classroom_oauth';
  frontendOrigin?: string;
  loginHint: string;
  expectedGoogleSub: string;
};

function normalizarOrigin(valor: unknown): string | undefined {
  try {
    const origin = new URL(String(valor || '')).origin;
    if (!origin || origin === 'null') return undefined;
    return origin;
  } catch {
    return undefined;
  }
}

function validarOriginFrontend(frontendOrigin: string | undefined) {
  if (!frontendOrigin) return undefined;
  const origin = normalizarOrigin(frontendOrigin);
  if (!origin) return undefined;
  if (configuracion.corsOrigenes.includes(origin)) {
    return origin;
  }
  return undefined;
}

function crearEstadoOauth(docenteId: string, opciones: { frontendOrigin?: string; loginHint: string; expectedGoogleSub: string }) {
  const payload: EstadoOauthPayload = {
    docenteId,
    purpose: 'classroom_oauth',
    ...(validarOriginFrontend(opciones.frontendOrigin) ? { frontendOrigin: validarOriginFrontend(opciones.frontendOrigin) } : {}),
    loginHint: opciones.loginHint.trim().toLowerCase(),
    expectedGoogleSub: opciones.expectedGoogleSub.trim()
  };
  return jwt.sign(payload, configuracion.jwtSecreto, { expiresIn: STATE_EXPIRA_SEGUNDOS });
}

function validarEstadoOauth(state: string): EstadoOauthPayload {
  try {
    const payload = jwt.verify(state, configuracion.jwtSecreto) as Partial<EstadoOauthPayload>;
    if (!payload || payload.purpose !== 'classroom_oauth' || !payload.docenteId ||
        typeof payload.loginHint !== 'string' || !payload.loginHint ||
        typeof payload.expectedGoogleSub !== 'string' || !payload.expectedGoogleSub) {
      throw new ErrorAplicacion('CLASSROOM_OAUTH_ESTADO_INVALIDO', 'Estado OAuth inválido', 400);
    }
    return {
      docenteId: payload.docenteId,
      purpose: 'classroom_oauth',
      loginHint: payload.loginHint,
      expectedGoogleSub: payload.expectedGoogleSub,
      ...(validarOriginFrontend(payload.frontendOrigin) ? { frontendOrigin: validarOriginFrontend(payload.frontendOrigin) } : {})
    };
  } catch {
    throw new ErrorAplicacion('CLASSROOM_OAUTH_ESTADO_INVALIDO', 'Estado OAuth inválido o expirado', 400);
  }
}

async function obtenerPerfilGoogle(accessToken: string): Promise<{ email?: string; sub?: string }> {
  const respuesta = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(CLASSROOM_REQUEST_TIMEOUT_MS)
  });
  if (!respuesta.ok) {
    return {};
  }
  const payload = (await respuesta.json().catch(() => ({}))) as { email?: unknown; sub?: unknown };
  return {
    email: typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : undefined,
    sub: typeof payload.sub === 'string' ? payload.sub.trim() : undefined
  };
}

export function construirUrlOauthClassroom(
  docenteId: string,
  opciones: { frontendOrigin?: string; loginHint: string; expectedGoogleSub: string }
) {
  const loginHint = String(opciones.loginHint || '').trim().toLowerCase();
  const expectedGoogleSub = String(opciones.expectedGoogleSub || '').trim();
  if (!loginHint || !expectedGoogleSub) {
    throw new ErrorAplicacion('CLASSROOM_LOGIN_GOOGLE_REQUIRED', 'Inicia sesión en EvaluaPro con la cuenta Google que se vinculará a Classroom.', 409);
  }
  const cliente = crearClienteOauth();
  const state = crearEstadoOauth(docenteId, { ...opciones, loginHint, expectedGoogleSub });
  const url = cliente.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: CLASSROOM_SCOPES,
    login_hint: loginHint,
    state
  });
  return { url, state };
}

export async function completarOauthClassroom(params: { code: string; state: string }) {
  const code = String(params.code || '').trim();
  const state = String(params.state || '').trim();
  if (!code || !state) {
    throw new ErrorAplicacion('CLASSROOM_OAUTH_CODIGO_INVALIDO', 'OAuth callback incompleto', 400);
  }

  const { docenteId, frontendOrigin, expectedGoogleSub } = validarEstadoOauth(state);
  const cliente = crearClienteOauth();
  const tokensRespuesta = await cliente.getToken(code);
  const tokens = tokensRespuesta.tokens || {};

  const existente = await IntegracionClassroom.findOne({ docenteId }).lean();
  const { llaveCifrado } = obtenerConfigClassroom();

  const refreshTokenPlano =
    typeof tokens.refresh_token === 'string' && tokens.refresh_token.trim()
      ? tokens.refresh_token.trim()
      : existente?.googleSub === expectedGoogleSub &&
          typeof existente?.refreshTokenCifrado === 'string' && existente.refreshTokenCifrado.trim()
        ? descifrarTexto(existente.refreshTokenCifrado, llaveCifrado)
        : '';

  if (!refreshTokenPlano) {
    throw new ErrorAplicacion(
      'CLASSROOM_OAUTH_REFRESH_TOKEN',
      'No fue posible obtener refresh token. Reintenta conectando de nuevo.',
      409
    );
  }

  const accessToken = typeof tokens.access_token === 'string' ? tokens.access_token : '';
  const perfil = accessToken ? await obtenerPerfilGoogle(accessToken) : {};
  if (!perfil.sub || perfil.sub !== expectedGoogleSub) {
    throw new ErrorAplicacion(
      'CLASSROOM_GOOGLE_SUB_MISMATCH',
      'La cuenta Google autorizada no coincide con la cuenta usada para iniciar sesión en EvaluaPro. La conexión anterior se conservó.',
      403
    );
  }

  const update: Record<string, unknown> = {
    docenteId,
    refreshTokenCifrado: cifrarTexto(refreshTokenPlano, llaveCifrado),
    scope: typeof tokens.scope === 'string' ? tokens.scope : existente?.scope,
    correoGoogle: perfil.email || existente?.correoGoogle,
    googleSub: perfil.sub,
    activo: true,
    ultimoError: undefined
  };
  if (accessToken) {
    update.accessTokenUltimoCifrado = cifrarTexto(accessToken, llaveCifrado);
  }
  if (typeof tokens.expiry_date === 'number' && Number.isFinite(tokens.expiry_date)) {
    update.accessTokenExpiraEn = new Date(tokens.expiry_date);
  }

  await IntegracionClassroom.updateOne({ docenteId }, { $set: update }, { upsert: true });
  return {
    docenteId,
    correoGoogle: perfil.email || existente?.correoGoogle || null,
    conectado: true,
    frontendOrigin: frontendOrigin || null
  };
}

async function renovarTokenAccesoClassroom(docenteId: string): Promise<string> {
  const { llaveCifrado } = obtenerConfigClassroom();
  const [integracion, docente] = await Promise.all([
    IntegracionClassroom.findOne({ docenteId, activo: true }),
    prisma.docente.findUnique({ where: { id: docenteId }, select: { googleSub: true } })
  ]);
  if (!integracion || !docente?.googleSub) {
    throw new ErrorAplicacion('CLASSROOM_NO_CONECTADO', 'No hay una cuenta Classroom conectada para este docente', 404);
  }
  if (integracion.googleSub !== docente.googleSub) {
    throw new ErrorAplicacion(
      'CLASSROOM_GOOGLE_SUB_MISMATCH',
      'La cuenta Classroom vinculada no coincide con la cuenta usada para iniciar sesión en EvaluaPro. Vuelve a conectar esa misma cuenta.',
      403
    );
  }

  const refreshTokenPlano = descifrarTexto(String(integracion.refreshTokenCifrado || ''), llaveCifrado);
  const cliente = crearClienteOauth();
  cliente.setCredentials({ refresh_token: refreshTokenPlano });

  let tokenAcceso: { token?: string | null };
  try {
    tokenAcceso = await cliente.getAccessToken();
  } catch (error) {
    const codigoGoogle = String((error as { response?: { data?: { error?: unknown } } })?.response?.data?.error ?? '');
    if (codigoGoogle === 'invalid_grant' || codigoGoogle === 'invalid_token') {
      await IntegracionClassroom.updateOne(
        { _id: integracion._id },
        { $set: { ultimoError: 'Google requiere volver a autorizar Classroom' } }
      );
      throw new ErrorAplicacion('CLASSROOM_REAUTORIZAR', 'La autorización de Classroom venció o fue revocada. Vuelve a vincular la misma cuenta Google.', 401, { classification: 'invalid_grant' });
    }
    throw new ErrorAplicacion('CLASSROOM_TOKEN_RENOVACION_ERROR', 'No se pudo renovar la autorización de Google Classroom.', 503, { classification: 'token_refresh' });
  }
  const accessToken = String(tokenAcceso.token || '').trim();
  if (!accessToken) {
    await IntegracionClassroom.updateOne(
      { _id: integracion._id },
      { $set: { ultimoError: 'No se pudo renovar token de acceso para Classroom' } }
    );
    throw new ErrorAplicacion('CLASSROOM_TOKEN_INVALIDO', 'No se pudo obtener token de acceso Classroom', 502);
  }

  await IntegracionClassroom.updateOne(
    { _id: integracion._id },
    {
      $set: {
        accessTokenUltimoCifrado: cifrarTexto(accessToken, llaveCifrado),
        ultimoError: undefined
      }
    }
  );

  return accessToken;
}

export function obtenerTokenAccesoClassroom(docenteId: string): Promise<string> {
  const existing = renovacionesEnCurso.get(docenteId);
  if (existing) return existing;
  const renewal = renovarTokenAccesoClassroom(docenteId).finally(() => {
    if (renovacionesEnCurso.get(docenteId) === renewal) renovacionesEnCurso.delete(docenteId);
  });
  renovacionesEnCurso.set(docenteId, renewal);
  return renewal;
}

export async function classroomGet(
  accessToken: string,
  path: string,
  query?: Record<string, string | number | undefined>,
  contexto: ContextoLecturaClassroom = {}
): Promise<Record<string, unknown>> {
  const url = new URL(`https://classroom.googleapis.com/v1/${String(path || '').replace(/^\/+/, '')}`);
  Object.entries(query || {}).forEach(([clave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return;
    url.searchParams.set(clave, String(valor));
  });
  let ultimaRespuesta: Response | undefined;
  let payload: Record<string, unknown>;
  const correlationId = contexto.correlationId || randomUUID();
  const ruta = normalizarRutaClassroom(path);
  for (let attempt = 1; attempt <= CLASSROOM_MAX_ATTEMPTS; attempt += 1) {
    let respuesta: Response;
    const inicio = Date.now();
    try {
      respuesta = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(CLASSROOM_REQUEST_TIMEOUT_MS)
      });
    } catch {
      log('warn', 'Fallo de transporte al consultar Google Classroom', {
        correlationId, ruta, intento: attempt, latenciaMs: Date.now() - inicio,
        statusProveedor: null, ...(contexto.pagina ? { pagina: contexto.pagina } : {}),
        classification: 'network_or_timeout'
      });
      if (attempt < CLASSROOM_MAX_ATTEMPTS) {
        await esperar(demoraReintento(attempt));
        continue;
      }
      throw new ErrorAplicacion('CLASSROOM_RED_NO_DISPONIBLE', 'No fue posible consultar Google Classroom por un problema de red o tiempo de espera.', 503, { classification: 'network_or_timeout' });
    }

    ultimaRespuesta = respuesta;
    payload = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
    const latenciaMs = Date.now() - inicio;
    if (respuesta.ok) {
      log('info', 'Consulta a Google Classroom completada', {
        correlationId, ruta, intento: attempt, latenciaMs, statusProveedor: respuesta.status,
        ...(contexto.pagina ? { pagina: contexto.pagina } : {}),
        ...(valorSeguro(respuesta.headers.get('x-goog-request-id'))
          ? { requestId: valorSeguro(respuesta.headers.get('x-goog-request-id')) }
          : {})
      });
      return payload;
    }
    if (esEstadoTransitorio(respuesta.status) && attempt < CLASSROOM_MAX_ATTEMPTS) {
      await esperar(demoraReintento(attempt, leerRetryAfterMs(respuesta.headers.get('retry-after'))));
      continue;
    }

    const errorPayload = payload?.error as { status?: unknown; message?: unknown; errors?: Array<{ reason?: unknown }> } | undefined;
    const reason = typeof errorPayload?.status === 'string'
      ? errorPayload.status
      : errorPayload?.errors?.find((item) => typeof item?.reason === 'string')?.reason;
    const requestId = valorSeguro(respuesta.headers.get('x-goog-request-id')) ||
      valorSeguro(respuesta.headers.get('x-guploader-uploadid'));
    const status = respuesta.status;
    const codigo = status === 401 ? 'CLASSROOM_TOKEN_INVALIDO'
      : status === 403 ? 'CLASSROOM_PERMISOS_INSUFICIENTES'
        : status === 404 ? 'CLASSROOM_RECURSO_NO_ENCONTRADO'
          : status === 429 ? 'CLASSROOM_CUOTA_EXCEDIDA'
            : status >= 500 ? 'CLASSROOM_PROVEEDOR_ERROR' : 'CLASSROOM_API_ERROR';
    const mensaje = status === 401 ? 'Google Classroom requiere volver a autorizar la cuenta.'
      : status === 403 ? 'La cuenta vinculada no tiene permiso para consultar este recurso de Classroom.'
        : status === 404 ? 'El recurso de Classroom ya no está disponible para esta cuenta.'
          : status === 429 ? 'Google Classroom limitó temporalmente las consultas. Intenta más tarde.'
            : status >= 500 ? 'Google Classroom no está disponible temporalmente.'
              : 'Google Classroom rechazó la consulta.';
    const classification = status === 429 ? 'quota' : status === 403 ? 'permission' : status === 401 ? 'invalid_token' : status >= 500 ? 'provider' : 'request';
    log('warn', 'Google Classroom devolvió una respuesta de error', {
      correlationId, ruta, intento: attempt, latenciaMs, statusProveedor: status,
      classification,
      ...(contexto.pagina ? { pagina: contexto.pagina } : {}),
      ...(typeof reason === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(reason) ? { reason } : {}),
      ...(requestId ? { requestId } : {})
    });
    throw new ErrorAplicacion(codigo, mensaje, status >= 400 && status < 600 ? status : 502, {
      classification,
      ...(typeof reason === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(reason) ? { reason } : {}),
      ...(requestId ? { requestId } : {})
    });
  }
  const status = ultimaRespuesta?.status ?? 503;
  throw new ErrorAplicacion('CLASSROOM_PROVEEDOR_ERROR', 'Google Classroom no respondió después de varios intentos.', status);
}

export async function classroomGetAll<T extends Record<string, unknown>>(
  accessToken: string,
  path: string,
  listKey: string,
  query?: Record<string, string | number | undefined>
): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  const vistos = new Set<string>();
  let pages = 0;
  const correlationId = randomUUID();
  const ruta = normalizarRutaClassroom(path);

  do {
    if (pageToken && vistos.has(pageToken)) {
      log('warn', 'Paginación Classroom detenida por token repetido', {
        correlationId, ruta, paginas: pages, resultadosAcumulados: out.length,
        classification: 'repeated_page_token'
      });
      throw new ErrorAplicacion('CLASSROOM_PAGINACION_INVALIDA', 'Google Classroom repitió un token de página; se detuvo la consulta.', 502);
    }
    if (pageToken) vistos.add(pageToken);
    if (pages >= CLASSROOM_MAX_PAGES) {
      log('warn', 'Paginación Classroom detenida por límite de páginas', {
        correlationId, ruta, paginas: pages, resultadosAcumulados: out.length,
        classification: 'page_limit'
      });
      throw new ErrorAplicacion('CLASSROOM_PAGINACION_LIMITE', `La consulta excedió el límite de ${CLASSROOM_MAX_PAGES} páginas.`, 502);
    }
    pages += 1;
    const payload = await classroomGet(accessToken, path, {
      ...(query || {}),
      ...(pageToken ? { pageToken } : {})
    }, { correlationId, pagina: pages });
    const items = Array.isArray(payload[listKey]) ? (payload[listKey] as T[]) : [];
    out.push(...items);
    pageToken = typeof payload.nextPageToken === 'string' && payload.nextPageToken.trim() ? payload.nextPageToken.trim() : undefined;
  } while (pageToken);

  log('info', 'Paginación Classroom completada', {
    correlationId, ruta, paginas: pages, resultadosAcumulados: out.length
  });
  return out;
}

export async function listarCursosClassroom(accessToken: string): Promise<Array<Record<string, unknown>>> {
  return classroomGetAll<Record<string, unknown>>(accessToken, 'courses', 'courses', {
    teacherId: 'me',
    courseStates: 'ACTIVE',
    pageSize: 100
  });
}

export async function listarActividadesClassroom(accessToken: string, courseId: string): Promise<Array<Record<string, unknown>>> {
  return classroomGetAll<Record<string, unknown>>(
    accessToken,
    `courses/${encodeURIComponent(courseId)}/courseWork`,
    'courseWork',
    { pageSize: 100 }
  );
}

export async function desconectarOauthClassroom(docenteId: string): Promise<void> {
  await IntegracionClassroom.deleteOne({ docenteId });
}
