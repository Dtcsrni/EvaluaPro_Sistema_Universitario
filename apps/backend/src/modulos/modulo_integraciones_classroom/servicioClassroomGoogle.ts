/**
 * servicioClassroomGoogle
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { cifrarTexto, descifrarTexto } from '../../compartido/seguridad/cifrado';
import { configuracion } from '../../configuracion';
import { IntegracionClassroom } from './modeloIntegracionClassroom';

const CLASSROOM_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly'
];

const STATE_EXPIRA_SEGUNDOS = 10 * 60;

function obtenerConfigClassroom() {
  const clientId = String(configuracion.googleClassroomClientId || configuracion.googleOauthClientId || '').trim();
  const clientSecret = String(configuracion.googleClassroomClientSecret || '').trim();
  const redirectUri = String(configuracion.googleClassroomRedirectUri || '').trim();
  const llaveCifrado = String(configuracion.classroomTokenCipherKey || '').trim();

  if (!clientId || !clientSecret || !redirectUri) {
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

function crearEstadoOauth(docenteId: string, frontendOrigin?: string) {
  const payload: EstadoOauthPayload = {
    docenteId,
    purpose: 'classroom_oauth',
    ...(validarOriginFrontend(frontendOrigin) ? { frontendOrigin: validarOriginFrontend(frontendOrigin) } : {})
  };
  return jwt.sign(payload, configuracion.jwtSecreto, { expiresIn: STATE_EXPIRA_SEGUNDOS });
}

function validarEstadoOauth(state: string): EstadoOauthPayload {
  try {
    const payload = jwt.verify(state, configuracion.jwtSecreto) as Partial<EstadoOauthPayload>;
    if (!payload || payload.purpose !== 'classroom_oauth' || !payload.docenteId) {
      throw new ErrorAplicacion('CLASSROOM_OAUTH_ESTADO_INVALIDO', 'Estado OAuth inválido', 400);
    }
    return {
      docenteId: payload.docenteId,
      purpose: 'classroom_oauth',
      ...(validarOriginFrontend(payload.frontendOrigin) ? { frontendOrigin: validarOriginFrontend(payload.frontendOrigin) } : {})
    };
  } catch {
    throw new ErrorAplicacion('CLASSROOM_OAUTH_ESTADO_INVALIDO', 'Estado OAuth inválido o expirado', 400);
  }
}

async function obtenerPerfilGoogle(accessToken: string): Promise<{ email?: string; sub?: string }> {
  const respuesta = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
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

export function construirUrlOauthClassroom(docenteId: string, opciones?: { frontendOrigin?: string }) {
  const cliente = crearClienteOauth();
  const state = crearEstadoOauth(docenteId, opciones?.frontendOrigin);
  const url = cliente.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: CLASSROOM_SCOPES,
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

  const { docenteId, frontendOrigin } = validarEstadoOauth(state);
  const cliente = crearClienteOauth();
  const tokensRespuesta = await cliente.getToken(code);
  const tokens = tokensRespuesta.tokens || {};

  const existente = await IntegracionClassroom.findOne({ docenteId }).lean();
  const { llaveCifrado } = obtenerConfigClassroom();

  const refreshTokenPlano =
    typeof tokens.refresh_token === 'string' && tokens.refresh_token.trim()
      ? tokens.refresh_token.trim()
      : typeof existente?.refreshTokenCifrado === 'string' && existente.refreshTokenCifrado.trim()
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

  const update: Record<string, unknown> = {
    docenteId,
    refreshTokenCifrado: cifrarTexto(refreshTokenPlano, llaveCifrado),
    scope: typeof tokens.scope === 'string' ? tokens.scope : existente?.scope,
    correoGoogle: perfil.email || existente?.correoGoogle,
    googleUserId: perfil.sub || existente?.googleUserId,
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

export async function obtenerTokenAccesoClassroom(docenteId: string): Promise<string> {
  const { llaveCifrado } = obtenerConfigClassroom();
  const integracion = await IntegracionClassroom.findOne({ docenteId, activo: true });
  if (!integracion) {
    throw new ErrorAplicacion('CLASSROOM_NO_CONECTADO', 'No hay una cuenta Classroom conectada para este docente', 404);
  }

  const refreshTokenPlano = descifrarTexto(String(integracion.refreshTokenCifrado || ''), llaveCifrado);
  const cliente = crearClienteOauth();
  cliente.setCredentials({ refresh_token: refreshTokenPlano });

  const tokenAcceso = await cliente.getAccessToken();
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

export async function classroomGet(
  accessToken: string,
  path: string,
  query?: Record<string, string | number | undefined>
): Promise<Record<string, unknown>> {
  const url = new URL(`https://classroom.googleapis.com/v1/${String(path || '').replace(/^\/+/, '')}`);
  Object.entries(query || {}).forEach(([clave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return;
    url.searchParams.set(clave, String(valor));
  });
  const respuesta = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!respuesta.ok) {
    const errorPayload = payload?.error as { message?: unknown } | undefined;
    const mensaje = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Error al consultar Google Classroom';
    throw new ErrorAplicacion('CLASSROOM_API_ERROR', mensaje, 502);
  }
  return payload;
}

export async function classroomGetAll<T extends Record<string, unknown>>(
  accessToken: string,
  path: string,
  listKey: string,
  query?: Record<string, string | number | undefined>
): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;

  do {
    const payload = await classroomGet(accessToken, path, {
      ...(query || {}),
      ...(pageToken ? { pageToken } : {})
    });
    const items = Array.isArray(payload[listKey]) ? (payload[listKey] as T[]) : [];
    out.push(...items);
    pageToken = typeof payload.nextPageToken === 'string' && payload.nextPageToken.trim() ? payload.nextPageToken.trim() : undefined;
  } while (pageToken);

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
