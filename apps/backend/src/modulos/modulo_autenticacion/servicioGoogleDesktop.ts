/**
 * Flujo de login Google para instalaciones de escritorio docente.
 * Usa OAuth Desktop con PKCE; no depende de un origen JavaScript registrado.
 */
import { ClientAuthentication, CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { configuracion } from '../../configuracion.js';
import { log } from '../../infraestructura/logging/logger.js';

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
  const clientSecret = String(configuracion.googleDesktopClientSecret || '').trim();
  return new OAuth2Client({
    clientId,
    ...(clientSecret ? { clientSecret } : {}),
    redirectUri,
    clientAuthentication: clientSecret
      ? ClientAuthentication.ClientSecretPost
      : ClientAuthentication.None
  });
}

function responderCallback(res: ServerResponse, status: number, exito: boolean, mensaje: string) {
  const seguro = mensaje.replace(/[&<>"']/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter] || '');
  const nonce = randomBytes(18).toString('base64');
  const titulo = exito ? 'Autorización completada' : 'No se pudo completar el acceso';
  const etiqueta = exito ? 'Autorización verificada' : 'No se completó la autorización';
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'content-security-policy': `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    'permissions-policy': 'camera=(), microphone=(), geolocation=()'
  });
  res.end(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#081a2c">
  <title>${titulo} · EvaluaPro</title>
  <style nonce="${nonce}">
    :root { color-scheme: dark; font-family: Inter, "Segoe UI", system-ui, sans-serif; font-synthesis: none; text-rendering: optimizeLegibility; }
    * { box-sizing: border-box; }
    body { min-width: 280px; min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; color: #e8f2ff; background: radial-gradient(ellipse at 50% 0%, #173d61 0%, #0b223a 48%, #071525 100%); }
    main { width: min(100%, 520px); padding: clamp(28px, 7vw, 48px); text-align: center; background: #102841; border: 1px solid #35536e; border-radius: 24px; box-shadow: 0 24px 72px #020b16a8; }
    .marca { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 34px; color: #d9eaff; font-size: 15px; font-weight: 700; letter-spacing: .02em; }
    .isotipo { display: grid; width: 38px; height: 38px; place-items: center; color: #78e2ef; background: #123d54; border: 1px solid #36869a; border-radius: 12px; }
    .estado { display: grid; width: 72px; height: 72px; place-items: center; margin: 0 auto 22px; color: ${exito ? '#72e2c0' : '#ffbd8b'}; background: ${exito ? '#123f42' : '#493044'}; border: 1px solid ${exito ? '#328b79' : '#bd7182'}; border-radius: 50%; }
    .estado svg, .isotipo svg { width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
    .eyebrow { margin: 0 0 10px; color: #a8c4dd; font-size: 12px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; color: #f5f9ff; font-size: clamp(25px, 6vw, 34px); line-height: 1.2; letter-spacing: -.025em; }
    .mensaje { margin: 16px 0 0; color: #d6e5f4; font-size: 16px; line-height: 1.6; }
    .regreso { margin: 26px 0 0; padding: 16px; color: #c7d9eb; background: #0a2035; border: 1px solid #294863; border-radius: 14px; font-size: 14px; line-height: 1.55; }
    button { min-height: 46px; margin-top: 22px; padding: 0 22px; color: #061b2b; background: #8ce6ed; border: 2px solid #8ce6ed; border-radius: 12px; font: inherit; font-size: 15px; font-weight: 750; cursor: pointer; }
    button:hover { background: #b3f3f4; border-color: #b3f3f4; }
    button:focus-visible { outline: 3px solid #fff; outline-offset: 4px; }
    @media (max-width: 420px) { body { padding: 16px; } main { border-radius: 20px; } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
  </style>
</head>
<body>
  <main>
    <div class="marca"><span class="isotipo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 5.5v15M8 7h8M8 11h6"/></svg></span><span>EvaluaPro <span aria-hidden="true">·</span> Plataforma Docente</span></div>
    <div class="estado" aria-hidden="true">${exito ? '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01"/><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>'}</div>
    <p class="eyebrow">${etiqueta}</p>
    <h1>${titulo}</h1>
    <p class="mensaje" role="${exito ? 'status' : 'alert'}">${seguro}</p>
    <p class="regreso">Vuelve a EvaluaPro para continuar. Intentaremos cerrar esta pestaña automáticamente.</p>
    <p class="regreso" id="alternativa" role="status" hidden>Si la pestaña sigue abierta, ciérrala y regresa a EvaluaPro.</p>
    <button type="button" id="volver">Cerrar ventana</button>
  </main>
  <script nonce="${nonce}">
    history.replaceState(null, document.title, location.pathname);
    const alternativa = document.getElementById('alternativa');
    const cerrar = () => { try { window.close(); } catch {} };
    const cerrarConAyuda = () => { cerrar(); window.setTimeout(() => { if (alternativa) alternativa.hidden = false; }, 700); };
    document.getElementById('volver')?.addEventListener('click', cerrarConAyuda);
    window.setTimeout(cerrarConAyuda, 2500);
  </script>
</body>
</html>`);
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
  if (error instanceof ErrorAplicacion && /^[A-Z0-9_]{1,64}$/.test(error.codigo)) return error.codigo;
  if (!error || typeof error !== 'object') return 'GOOGLE_DESKTOP_OAUTH_FAILED';

  const detalle = error as {
    code?: unknown;
    response?: { status?: unknown; data?: { error?: unknown } };
  };
  const erroresProveedor = new Set(['invalid_grant', 'invalid_client', 'invalid_request', 'unauthorized_client', 'invalid_scope', 'deleted_client']);
  const codigoProveedor = detalle.response?.data?.error;
  if (typeof codigoProveedor === 'string' && erroresProveedor.has(codigoProveedor)) {
    return `GOOGLE_DESKTOP_${codigoProveedor.toUpperCase()}`;
  }

  const erroresRed = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE']);
  if (typeof detalle.code === 'string' && erroresRed.has(detalle.code)) return 'GOOGLE_DESKTOP_NETWORK_ERROR';

  return Number.isInteger(detalle.response?.status)
    ? 'GOOGLE_DESKTOP_PROVIDER_HTTP_ERROR'
    : 'GOOGLE_DESKTOP_OAUTH_FAILED';
}

function causaErrorProveedor(error: unknown): string {
  if (!error || typeof error !== 'object') return 'sin_detalle';
  const respuesta = (error as { response?: { data?: { error_description?: unknown } } }).response;
  const descripcion = typeof respuesta?.data?.error_description === 'string'
    ? respuesta.data.error_description.toLowerCase()
    : '';
  if (/redirect_uri|redirect uri/.test(descripcion)) return 'redirect_uri';
  if (/code_verifier|code verifier|code_challenge|code challenge|pkce/.test(descripcion)) return 'pkce';
  if (/client_secret|client secret|client authentication/.test(descripcion)) return 'autenticacion_cliente';
  if (/client_id|client id/.test(descripcion)) return 'client_id';
  if (/grant_type|grant type/.test(descripcion)) return 'grant_type';
  if (/required|missing|not provided/.test(descripcion)) return 'parametro_requerido';
  if (/unsupported|not supported/.test(descripcion)) return 'metodo_no_soportado';
  return 'sin_detalle';
}

function respuestaProveedorSegura(valor: unknown, clave = ''): unknown {
  if (/(?:access|refresh|id)?_?token|secret|credential|authorization|code|state|verifier|cookie|password/i.test(clave)) {
    return '[REDACTED]';
  }
  if (typeof valor === 'string') {
    return valor
      .replace(/\b(code|state|token|secret|credential|verifier)=([^&\s]+)/gi, '$1=[REDACTED]')
      .replace(/(https?:\/\/[^?\s"'<>]+)\?[^\s"'<>]*/gi, '$1?[REDACTED]')
      .replace(/\bBearer\s+[^\s"'<>]+/gi, 'Bearer [REDACTED]');
  }
  if (Array.isArray(valor)) return valor.map((elemento) => respuestaProveedorSegura(elemento));
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([nombre, contenido]) => [
      nombre,
      respuestaProveedorSegura(contenido, nombre)
    ]));
  }
  return valor;
}

async function completarCallback(flujo: FlujoOAuthGoogle, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' || !esLoopback(req.socket.remoteAddress)) {
    responderCallback(res, 400, false, 'Solicitud de callback no permitida.');
    return;
  }

  let url: URL;
  let etapa = 'canje_codigo';
  try {
    url = new URL(req.url || '/', 'http://127.0.0.1');
  } catch {
    responderCallback(res, 400, false, 'Callback OAuth inválido.');
    return;
  }
  if (url.pathname !== '/') {
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
    etapa = 'verificar_id_token';
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
    const codigo = respuestaError(error);
    const respuesta = error && typeof error === 'object'
      ? (error as { response?: { status?: unknown; data?: unknown } }).response
      : undefined;
    const meta = { etapa, codigo, causa: causaErrorProveedor(error) };
    log('warn', 'Falló el callback OAuth Desktop de Google.', meta);
    if (process.env.EVALUAPRO_OAUTH_DEBUG_LOCAL === '1' && respuesta) {
      log('warn', 'Respuesta completa de error de Google (campos sensibles redactados).', {
        ...meta,
        status: respuesta.status,
        body: respuestaProveedorSegura(respuesta.data)
      });
    }
    terminarFlujo(flujo, { estado: 'error', codigo });
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

  const redirectUri = `http://127.0.0.1:${address.port}`;
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
