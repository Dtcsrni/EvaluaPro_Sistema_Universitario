/**
 * servicioClassroomGoogle
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import { ClientAuthentication, CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { configuracion } from '../../configuracion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { log } from '../../infraestructura/logging/logger.js';
import { IntegracionClassroom } from './modeloIntegracionClassroom.js';
import { descifrarTokenClassroom, protegerTokenClassroom } from './proteccionTokensClassroom.js';

const CLASSROOM_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.topics.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly'
];

const STATE_EXPIRA_SEGUNDOS = 10 * 60;
const CLASSROOM_REQUEST_TIMEOUT_MS = configuracion.classroomRequestTimeoutMs ?? 15_000;
const CLASSROOM_MAX_ATTEMPTS = 3;
const CLASSROOM_MAX_PAGES = configuracion.classroomMaxPages ?? 100;
const CLASSROOM_MAX_RETRY_AFTER_MS = 30_000;
const MAX_OAUTH_PENDIENTE = 8;
const renovacionesEnCurso = new Map<string, Promise<string>>();
const oauthPendiente = new Map<string, {
  docenteId: string;
  expectedGoogleSub: string;
  loginHint: string;
  frontendOrigin?: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  server: Server;
  expiracion: NodeJS.Timeout;
}>();
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
  const llaveLegacy = String(configuracion.classroomTokenCipherKey || '').trim();
  if (!configuracion.classroomEnabled || !clientId) {
    throw new ErrorAplicacion(
      'CLASSROOM_NO_CONFIG',
      'Google Classroom no está disponible en esta instalación docente. Actualiza EvaluaPro o contacta al administrador.',
      503
    );
  }
  return { clientId, llaveLegacy };
}

function crearClienteOauth(clientId: string, redirectUri?: string) {
  // Desktop es cliente público: PKCE protege el código y no se envía client_secret.
  return new OAuth2Client({
    clientId,
    redirectUri,
    clientAuthentication: ClientAuthentication.None
  });
}

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

function responderCallbackLoopback(res: import('node:http').ServerResponse, exito: boolean, mensaje: string) {
  const seguro = String(mensaje || '').replace(/[&<>"']/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter] || '');
  res.writeHead(exito ? 200 : 400, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
  res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Google Classroom · EvaluaPro</title><body><main><h1>${exito ? 'Classroom conectado' : 'No se pudo conectar Classroom'}</h1><p>${seguro}</p><p>Esta ventana se cerrará en un momento.</p></main><script>setTimeout(()=>{try{window.close()}catch{}},900)</script></body></html>`);
}

function cerrarOAuthPendiente(state: string) {
  const pendiente = oauthPendiente.get(state);
  if (!pendiente) return undefined;
  oauthPendiente.delete(state);
  clearTimeout(pendiente.expiracion);
  pendiente.server.close();
  return pendiente;
}

function esLoopback(address: string | undefined) {
  return address === '127.0.0.1' || address === '::ffff:127.0.0.1' || address === '::1';
}

async function completarOAuthDesktop(pendiente: NonNullable<ReturnType<typeof oauthPendiente.get>>, code: string) {
  const cliente = crearClienteOauth(pendiente.clientId, pendiente.redirectUri);
  const tokenRespuesta = await cliente.getToken({ code, codeVerifier: pendiente.codeVerifier, redirect_uri: pendiente.redirectUri });
  const tokens = tokenRespuesta.tokens || {};
  const idToken = typeof tokens.id_token === 'string' ? tokens.id_token : '';
  if (!idToken) throw new ErrorAplicacion('CLASSROOM_OAUTH_IDENTIDAD_AUSENTE', 'Google no devolvió una identidad verificable. Intenta conectar de nuevo.', 401);
  const ticket = await cliente.verifyIdToken({ idToken, audience: pendiente.clientId });
  const payload = ticket.getPayload();
  if (!payload?.email_verified || !payload.sub || payload.sub !== pendiente.expectedGoogleSub) {
    throw new ErrorAplicacion('CLASSROOM_GOOGLE_SUB_MISMATCH', 'La cuenta Google autorizada no coincide con la cuenta usada para iniciar sesión en EvaluaPro. La conexión anterior se conservó.', 403);
  }

  const existente = await IntegracionClassroom.findOne({ docenteId: pendiente.docenteId }).lean();
  const { llaveLegacy } = obtenerConfigClassroom();
  const refreshTokenPlano = typeof tokens.refresh_token === 'string' && tokens.refresh_token.trim()
    ? tokens.refresh_token.trim()
    : existente?.googleSub === pendiente.expectedGoogleSub && typeof existente?.refreshTokenCifrado === 'string'
      ? descifrarTokenClassroom(existente.refreshTokenCifrado, llaveLegacy).token
      : '';
  if (!refreshTokenPlano) {
    throw new ErrorAplicacion('CLASSROOM_OAUTH_REFRESH_TOKEN', 'Google no devolvió un refresh token. Reintenta conectando de nuevo y acepta el consentimiento solicitado.', 409);
  }

  const update: Record<string, unknown> = {
    docenteId: pendiente.docenteId,
    refreshTokenCifrado: protegerTokenClassroom(refreshTokenPlano),
    scope: typeof tokens.scope === 'string' ? tokens.scope : existente?.scope,
    correoGoogle: typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : existente?.correoGoogle,
    googleSub: payload.sub,
    activo: true,
    ultimoError: null
  };
  if (typeof tokens.access_token === 'string' && tokens.access_token) {
    update.accessTokenUltimoCifrado = protegerTokenClassroom(tokens.access_token);
  }
  if (typeof tokens.expiry_date === 'number' && Number.isFinite(tokens.expiry_date)) {
    update.accessTokenExpiraEn = new Date(tokens.expiry_date);
  }
  await IntegracionClassroom.updateOne({ docenteId: pendiente.docenteId }, { $set: update }, { upsert: true });
  return {
    docenteId: pendiente.docenteId,
    correoGoogle: typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : existente?.correoGoogle || null,
    conectado: true,
    frontendOrigin: pendiente.frontendOrigin || null
  };
}

async function procesarCallbackLoopback(server: Server, req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  if (req.method !== 'GET' || !esLoopback(req.socket.remoteAddress)) {
    responderCallbackLoopback(res, false, 'Solicitud de callback no permitida.');
    return;
  }
  let url: URL;
  try {
    url = new URL(req.url || '/', 'http://127.0.0.1');
  } catch {
    responderCallbackLoopback(res, false, 'Callback OAuth inválido.');
    return;
  }
  if (url.pathname !== '/oauth2callback') {
    responderCallbackLoopback(res, false, 'Ruta de callback inválida.');
    return;
  }
  const estados = url.searchParams.getAll('state');
  const codigos = url.searchParams.getAll('code');
  const erroresOauth = url.searchParams.getAll('error');
  const emisores = url.searchParams.getAll('iss');
  const respuestaCancelada = erroresOauth.length === 1 && codigos.length === 0;
  const respuestaConCodigo = erroresOauth.length === 0 && codigos.length === 1;
  if (estados.length !== 1 || emisores.length !== 1 || emisores[0] !== 'https://accounts.google.com' ||
      !(respuestaCancelada || respuestaConCodigo)) {
    responderCallbackLoopback(res, false, 'La respuesta de Google no contiene un state, código o emisor válido.');
    return;
  }
  const state = estados[0] || '';
  const pendiente = oauthPendiente.get(state);
  if (!pendiente || pendiente.server !== server) {
    responderCallbackLoopback(res, false, 'La solicitud OAuth venció, ya fue usada o no pertenece a esta instalación.');
    return;
  }
  cerrarOAuthPendiente(state);
  if (erroresOauth.length === 1) {
    responderCallbackLoopback(res, false, 'Google canceló la autorización. Puedes volver a intentarlo desde EvaluaPro.');
    return;
  }
  try {
    const resultado = await completarOAuthDesktop(pendiente, codigos[0] || '');
    responderCallbackLoopback(res, true, `Cuenta Classroom conectada: ${resultado.correoGoogle || 'cuenta Google verificada'}. Regresa a EvaluaPro.`);
  } catch (error) {
    const mensaje = error instanceof ErrorAplicacion ? error.message : 'No se pudo completar la conexión OAuth. Vuelve a intentarlo desde EvaluaPro.';
    responderCallbackLoopback(res, false, mensaje);
  }
}

export async function construirUrlOauthClassroom(
  docenteId: string,
  opciones: { frontendOrigin?: string; loginHint: string; expectedGoogleSub: string }
) {
  const loginHint = String(opciones.loginHint || '').trim().toLowerCase();
  const expectedGoogleSub = String(opciones.expectedGoogleSub || '').trim();
  if (!loginHint || !expectedGoogleSub) {
    throw new ErrorAplicacion('CLASSROOM_LOGIN_GOOGLE_REQUIRED', 'Inicia sesión en EvaluaPro con la cuenta Google que se vinculará a Classroom.', 409);
  }
  if (oauthPendiente.size >= MAX_OAUTH_PENDIENTE) {
    throw new ErrorAplicacion('CLASSROOM_OAUTH_LIMITE', 'Ya hay varias solicitudes OAuth pendientes. Cierra sus ventanas y vuelve a intentar.', 429);
  }
  const { clientId } = obtenerConfigClassroom();
  const server = createServer((req, res) => { void procesarCallbackLoopback(server, req, res); });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new ErrorAplicacion('CLASSROOM_OAUTH_LOOPBACK_ERROR', 'No se pudo abrir el callback local seguro de Google Classroom.', 503);
  }
  const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
  const state = randomBytes(32).toString('base64url');
  const cliente = crearClienteOauth(clientId, redirectUri);
  const { codeVerifier, codeChallenge } = await cliente.generateCodeVerifierAsync();
  if (!codeChallenge) {
    server.close();
    throw new ErrorAplicacion('CLASSROOM_OAUTH_PKCE_ERROR', 'No se pudo preparar PKCE para Google Classroom.', 503);
  }
  const expiracion = setTimeout(() => { cerrarOAuthPendiente(state); }, STATE_EXPIRA_SEGUNDOS * 1000);
  expiracion.unref?.();
  oauthPendiente.set(state, {
    docenteId,
    expectedGoogleSub,
    loginHint,
    ...(validarOriginFrontend(opciones.frontendOrigin) ? { frontendOrigin: validarOriginFrontend(opciones.frontendOrigin) } : {}),
    codeVerifier,
    clientId,
    redirectUri,
    server,
    expiracion
  });
  const url = cliente.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: CLASSROOM_SCOPES,
    login_hint: loginHint,
    state,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256
  });
  return { url, state, redirectUri };
}

async function renovarTokenAccesoClassroom(docenteId: string): Promise<string> {
  const { clientId, llaveLegacy } = obtenerConfigClassroom();
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

  const refreshAlmacenado = descifrarTokenClassroom(String(integracion.refreshTokenCifrado || ''), llaveLegacy);
  const refreshTokenPlano = refreshAlmacenado.token;
  if (refreshAlmacenado.migrado) {
    const cifradoAnterior = String(integracion.refreshTokenCifrado || '');
    const refreshTokenCifrado = protegerTokenClassroom(refreshTokenPlano);
    await IntegracionClassroom.updateOne(
      { _id: integracion._id, refreshTokenCifrado: cifradoAnterior },
      { $set: { refreshTokenCifrado } }
    );
    try {
      const verificado = await IntegracionClassroom.findOne({ _id: integracion._id }).lean();
      if (descifrarTokenClassroom(String(verificado?.refreshTokenCifrado || '')).token !== refreshTokenPlano) {
        throw new Error('token migration readback mismatch');
      }
    } catch {
      await IntegracionClassroom.updateOne(
        { _id: integracion._id, refreshTokenCifrado },
        { $set: { refreshTokenCifrado: cifradoAnterior } }
      );
      throw new ErrorAplicacion('CLASSROOM_MIGRACION_TOKEN_ERROR', 'No se pudo verificar la migración segura del token. La conexión anterior se conservó; vuelve a vincular Classroom si persiste.', 503);
    }
  }
  const cliente = crearClienteOauth(clientId);
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
        accessTokenUltimoCifrado: protegerTokenClassroom(accessToken),
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

export type ResultadoPaginacionClassroom<T> = {
  items: T[];
  completa: boolean;
  errorCode?: string;
};

export async function classroomGetAllConEstado<T extends Record<string, unknown>>(
  accessToken: string,
  path: string,
  listKey: string,
  query?: Record<string, string | number | undefined>,
  permitirResultadoParcial = true
): Promise<ResultadoPaginacionClassroom<T>> {
  const out: T[] = [];
  const idsRecibidos = new Set<string>();
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
      log('warn', 'Paginación Classroom incompleta por token repetido', {
        correlationId, ruta, paginas: pages, resultadosAcumulados: out.length,
        classification: 'repeated_page_token'
      });
      if (!permitirResultadoParcial) {
        throw new ErrorAplicacion('CLASSROOM_PAGINACION_INVALIDA', 'Google Classroom repitió un token de página; se detuvo la consulta.', 502);
      }
      return { items: out, completa: false, errorCode: 'CLASSROOM_PAGINACION_INVALIDA' };
    }
    if (pageToken) vistos.add(pageToken);
    if (pages >= CLASSROOM_MAX_PAGES) {
      log('warn', 'Paginación Classroom detenida por límite de páginas', {
        correlationId, ruta, paginas: pages, resultadosAcumulados: out.length,
        classification: 'page_limit'
      });
      if (!permitirResultadoParcial) {
        throw new ErrorAplicacion('CLASSROOM_PAGINACION_LIMITE', `La consulta excedió el límite de ${CLASSROOM_MAX_PAGES} páginas.`, 502);
      }
      return { items: out, completa: false, errorCode: 'CLASSROOM_PAGINACION_LIMITE' };
    }
    pages += 1;
    let payload: Record<string, unknown>;
    try {
      payload = await classroomGet(accessToken, path, {
        ...(query || {}),
        ...(pageToken ? { pageToken } : {})
      }, { correlationId, pagina: pages });
    } catch (error) {
      if (!permitirResultadoParcial || out.length === 0) throw error;
      const errorCode = error instanceof ErrorAplicacion ? error.codigo : 'CLASSROOM_PAGINACION_PARCIAL';
      return { items: out, completa: false, errorCode };
    }
    const items = Array.isArray(payload[listKey]) ? (payload[listKey] as T[]) : [];
    for (const item of items) {
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      if (id && idsRecibidos.has(id)) continue;
      if (id) idsRecibidos.add(id);
      out.push(item);
    }
    pageToken = typeof payload.nextPageToken === 'string' && payload.nextPageToken.trim() ? payload.nextPageToken.trim() : undefined;
  } while (pageToken);

  log('info', 'Paginación Classroom completada', {
    correlationId, ruta, paginas: pages, resultadosAcumulados: out.length
  });
  return { items: out, completa: true };
}

export async function classroomGetAll<T extends Record<string, unknown>>(
  accessToken: string,
  path: string,
  listKey: string,
  query?: Record<string, string | number | undefined>
): Promise<T[]> {
  const resultado = await classroomGetAllConEstado<T>(accessToken, path, listKey, query, false);
  if (!resultado.completa) {
    const message = resultado.errorCode === 'CLASSROOM_PAGINACION_LIMITE'
      ? `La consulta excedió el límite de ${CLASSROOM_MAX_PAGES} páginas.`
      : 'Google Classroom no permitió completar todas las páginas de resultados.';
    throw new ErrorAplicacion(resultado.errorCode || 'CLASSROOM_PAGINACION_PARCIAL', message, 502);
  }
  return resultado.items;
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

export async function listarActividadesClassroomConEstado(
  accessToken: string,
  courseId: string
): Promise<ResultadoPaginacionClassroom<Record<string, unknown>>> {
  return classroomGetAllConEstado<Record<string, unknown>>(
    accessToken,
    `courses/${encodeURIComponent(courseId)}/courseWork`,
    'courseWork',
    { pageSize: 100 }
  );
}

export async function listarTemasClassroomConEstado(
  accessToken: string,
  courseId: string
): Promise<ResultadoPaginacionClassroom<Record<string, unknown>>> {
  return classroomGetAllConEstado<Record<string, unknown>>(
    accessToken,
    `courses/${encodeURIComponent(courseId)}/topics`,
    'topic',
    { pageSize: 100 }
  );
}

export async function desconectarOauthClassroom(docenteId: string): Promise<void> {
  await IntegracionClassroom.deleteOne({ docenteId });
}
