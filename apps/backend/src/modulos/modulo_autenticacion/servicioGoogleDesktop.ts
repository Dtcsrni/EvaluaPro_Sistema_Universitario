/**
 * Flujo de login Google para instalaciones de escritorio docente.
 * Usa OAuth Desktop con PKCE; no depende de un origen JavaScript registrado.
 */
import { ClientAuthentication, CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { configuracion } from '../../configuracion.js';

const SCOPES_LOGIN = ['openid', 'email', 'profile'];
const FLOW_TTL_MS = 10 * 60_000;
const RESULT_TTL_MS = 2 * 60_000;
const MAX_FLOWS = 8;

type ResultadoFlujo =
  | { estado: 'pendiente' }
  | { estado: 'listo'; credential: string }
  | { estado: 'error'; codigo: string }
  | { estado: 'expirado' };

type FlujoOAuthGoogle = {
  flowId: string;
  state: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  server: Server;
  timer: NodeJS.Timeout;
  resultado: ResultadoFlujo;
};

const flujosPorId = new Map<string, FlujoOAuthGoogle>();
const flujosPorState = new Map<string, FlujoOAuthGoogle>();

function crearClienteOauth(clientId: string, redirectUri: string) {
  return new OAuth2Client({
    clientId,
    redirectUri,
    clientAuthentication: ClientAuthentication.None
  });
}

function responderCallback(res: ServerResponse, status: number, exito: boolean, mensaje: string) {
  const seguro = mensaje.replace(/[&<>"']/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter] || '');
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff'
  });
  res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Acceso Google · EvaluaPro</title><body><main><h1>${exito ? 'Autorización completada' : 'No se pudo completar el acceso'}</h1><p>${seguro}</p><p>Regresa a EvaluaPro. Esta ventana se cerrará en un momento.</p></main><script>setTimeout(()=>{try{window.close()}catch{}},1200)</script></body></html>`);
}

function esLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::ffff:127.0.0.1' || address === '::1';
}

function liberarListener(flujo: FlujoOAuthGoogle) {
  clearTimeout(flujo.timer);
  flujosPorState.delete(flujo.state);
  if (flujo.server.listening) flujo.server.close();
}

function eliminarFlujo(flujo: FlujoOAuthGoogle) {
  liberarListener(flujo);
  flujosPorId.delete(flujo.flowId);
}

function terminarFlujo(flujo: FlujoOAuthGoogle, resultado: ResultadoFlujo) {
  liberarListener(flujo);
  flujo.resultado = resultado;
  flujo.timer = setTimeout(() => eliminarFlujo(flujo), RESULT_TTL_MS);
  flujo.timer.unref?.();
}

function respuestaError(error: unknown): string {
  return error instanceof ErrorAplicacion && /^[A-Z0-9_]{1,64}$/.test(error.codigo)
    ? error.codigo
    : 'GOOGLE_DESKTOP_OAUTH_FAILED';
}

async function completarCallback(flujo: FlujoOAuthGoogle, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' || !esLoopback(req.socket.remoteAddress)) {
    responderCallback(res, 400, false, 'Solicitud de callback no permitida.');
    return;
  }

  let url: URL;
  try {
    url = new URL(req.url || '/', 'http://127.0.0.1');
  } catch {
    responderCallback(res, 400, false, 'Callback OAuth inválido.');
    return;
  }
  if (url.pathname !== '/oauth2callback') {
    responderCallback(res, 404, false, 'Ruta de callback inválida.');
    return;
  }

  const estados = url.searchParams.getAll('state');
  const codigos = url.searchParams.getAll('code');
  const errores = url.searchParams.getAll('error');
  const emisores = url.searchParams.getAll('iss');
  const cancelado = errores.length === 1 && codigos.length === 0;
  const autorizado = errores.length === 0 && codigos.length === 1;
  if (estados.length !== 1 || emisores.length !== 1 || emisores[0] !== 'https://accounts.google.com' || !(cancelado || autorizado)) {
    responderCallback(res, 400, false, 'La respuesta de Google no contiene un estado, código o emisor válido.');
    return;
  }
  if (estados[0] !== flujo.state || flujosPorState.get(flujo.state) !== flujo) {
    responderCallback(res, 400, false, 'La solicitud OAuth venció, ya fue usada o no pertenece a este inicio de sesión.');
    return;
  }

  liberarListener(flujo);
  if (cancelado) {
    terminarFlujo(flujo, { estado: 'error', codigo: 'GOOGLE_OAUTH_CANCELLED' });
    responderCallback(res, 200, false, 'Google canceló la autorización. Puedes volver a intentarlo desde EvaluaPro.');
    return;
  }

  try {
    const cliente = crearClienteOauth(flujo.clientId, flujo.redirectUri);
    const respuesta = await cliente.getToken({
      code: codigos[0] || '',
      codeVerifier: flujo.codeVerifier,
      redirect_uri: flujo.redirectUri
    });
    const credential = typeof respuesta.tokens?.id_token === 'string' ? respuesta.tokens.id_token : '';
    if (!credential) {
      throw new ErrorAplicacion('GOOGLE_CREDENCIAL_AUSENTE', 'Google no devolvió una identidad verificable.', 401);
    }
    const ticket = await cliente.verifyIdToken({ idToken: credential, audience: flujo.clientId });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new ErrorAplicacion('GOOGLE_CREDENCIAL_INVALIDA', 'Google no devolvió una identidad verificable.', 401);
    }
    if (payload.email_verified !== true) {
      throw new ErrorAplicacion('GOOGLE_EMAIL_NO_VERIFICADO', 'El correo de Google no está verificado.', 401);
    }
    terminarFlujo(flujo, { estado: 'listo', credential });
    responderCallback(res, 200, true, 'Google verificó tu identidad. Regresa a EvaluaPro para continuar.');
  } catch (error) {
    terminarFlujo(flujo, { estado: 'error', codigo: respuestaError(error) });
    responderCallback(res, 400, false, 'No se pudo verificar la identidad con Google. Intenta de nuevo desde EvaluaPro.');
  }
}

export async function iniciarOAuthGoogleDesktop(): Promise<{ flowId: string; url: string }> {
  const clientId = String(configuracion.googleDesktopClientId || '').trim();
  if (!clientId) {
    throw new ErrorAplicacion('GOOGLE_DESKTOP_NO_CONFIG', 'El login Google Desktop no está configurado en esta instalación.', 503);
  }
  if (flujosPorId.size >= MAX_FLOWS) {
    throw new ErrorAplicacion('GOOGLE_DESKTOP_OAUTH_LIMITE', 'Ya hay varios accesos Google pendientes. Cierra sus ventanas e inténtalo de nuevo.', 429);
  }

  const server = createServer((req, res) => {
    const flujo = Array.from(flujosPorState.values()).find((actual) => actual.server === server);
    if (flujo) void completarCallback(flujo, req, res);
    else responderCallback(res, 400, false, 'La solicitud OAuth ya no está disponible.');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new ErrorAplicacion('GOOGLE_DESKTOP_LOOPBACK_ERROR', 'No se pudo abrir el callback local de Google.', 503);
  }

  const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
  const cliente = crearClienteOauth(clientId, redirectUri);
  const { codeVerifier, codeChallenge } = await cliente.generateCodeVerifierAsync();
  if (!codeChallenge) {
    server.close();
    throw new ErrorAplicacion('GOOGLE_DESKTOP_PKCE_ERROR', 'No se pudo preparar la verificación segura de Google.', 503);
  }

  const flowId = randomBytes(32).toString('base64url');
  const state = randomBytes(32).toString('base64url');
  const flujo = {
    flowId,
    state,
    clientId,
    redirectUri,
    codeVerifier,
    server,
    timer: setTimeout(() => eliminarFlujo(flujo), FLOW_TTL_MS),
    resultado: { estado: 'pendiente' } as ResultadoFlujo
  };
  flujo.timer.unref?.();
  flujosPorId.set(flowId, flujo);
  flujosPorState.set(state, flujo);

  const url = cliente.generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    scope: SCOPES_LOGIN,
    state,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256
  });
  return { flowId, url };
}

export function obtenerResultadoOAuthGoogleDesktop(flowId: string): ResultadoFlujo {
  const flujo = flujosPorId.get(String(flowId || ''));
  return flujo ? flujo.resultado : { estado: 'expirado' };
}

export function confirmarResultadoOAuthGoogleDesktop(flowId: string): boolean {
  const flujo = flujosPorId.get(String(flowId || ''));
  if (!flujo || flujo.resultado.estado === 'pendiente') return false;
  eliminarFlujo(flujo);
  return true;
}

export function cancelarFlujoOAuthGoogleDesktop(flowId: string): boolean {
  const flujo = flujosPorId.get(String(flowId || ''));
  if (!flujo) return false;
  eliminarFlujo(flujo);
  return true;
}
