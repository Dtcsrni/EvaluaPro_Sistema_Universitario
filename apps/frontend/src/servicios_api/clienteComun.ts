/**
 * clienteComun
 *
 * Responsabilidad: Cliente compartido de comunicacion HTTP y normalizacion de errores.
 * Limites: Cambios pueden afectar todo el frontend.
 */
import { emitToast, type ToastAction } from '../ui/toast/toastBus';

export type TipoSesion = 'docente' | 'alumno';

const EVENT_SESION_INVALIDADA = 'app:sesion-invalidada';

export function emitirSesionInvalidada(tipo: TipoSesion) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_SESION_INVALIDADA, { detail: { tipo } }));
  } catch {
    // ignore
  }
}

export function accionCerrarSesion(tipo: TipoSesion): ToastAction {
  return {
    label: 'Cerrar sesion',
    onClick: () => emitirSesionInvalidada(tipo)
  };
}

export function accionToastSesionParaError(error: unknown, tipo: TipoSesion): ToastAction | undefined {
  if (error instanceof ErrorRemoto) {
    const detalle = error.detalle;
    const status = detalle?.status;
    const codigo = detalle?.codigo?.toUpperCase();
    // No mostrar accion de "Cerrar sesion" para flujos de login/registro que
    // pueden devolver 401 (credenciales invalidas, cuenta no registrada, etc.).
    const sinAccionCerrarSesion = new Set([
      'CREDENCIALES_INVALIDAS',
      'DOCENTE_NO_REGISTRADO',
      'DOCENTE_SIN_CONTRASENA',
      'GOOGLE_SUB_MISMATCH',
      'GOOGLE_OAUTH_REQUIRED'
    ]);

    if (status === 401) {
      if (codigo && sinAccionCerrarSesion.has(codigo)) return undefined;
      return accionCerrarSesion(tipo);
    }

    if (codigo?.includes('TOKEN')) return accionCerrarSesion(tipo);
    if (codigo?.includes('NO_AUTORIZ') && status === 401) return accionCerrarSesion(tipo);
  }
  return undefined;
}

export type DetalleErrorRemoto = {
  status?: number;
  codigo?: string;
  mensaje?: string;
  detalles?: unknown;
};

export class ErrorRemoto extends Error {
  detalle: DetalleErrorRemoto;

  constructor(mensaje: string, detalle: DetalleErrorRemoto = {}) {
    super(mensaje);
    this.detalle = detalle;
  }
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function esAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  return typeof error === 'object' && error !== null && 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

function tieneJson(respuesta: unknown): respuesta is { json: () => Promise<unknown> } {
  return esObjeto(respuesta) && typeof respuesta['json'] === 'function';
}

function tieneText(respuesta: unknown): respuesta is { text: () => Promise<string> } {
  return esObjeto(respuesta) && typeof respuesta['text'] === 'function';
}

function tieneClone(respuesta: unknown): respuesta is { clone: () => unknown } {
  return esObjeto(respuesta) && typeof respuesta['clone'] === 'function';
}

function obtenerStatus(respuesta: unknown): number | undefined {
  return esObjeto(respuesta) && typeof respuesta['status'] === 'number' ? (respuesta['status'] as number) : undefined;
}

export async function leerErrorRemoto(respuesta: unknown): Promise<DetalleErrorRemoto> {
  const status = obtenerStatus(respuesta);
  const base: DetalleErrorRemoto = { status };

  try {
    let data: unknown = null;
    let textoFallback: string | undefined;

    // Preferimos leer el cuerpo como texto desde un clone() para poder:
    // - parsear JSON manualmente (cuando el content-type es incorrecto)
    // - conservar mensaje si el body no es JSON (texto/HTML)
    if (tieneClone(respuesta) && tieneText(respuesta)) {
      try {
        const clon = respuesta.clone();
        if (tieneText(clon)) {
          const texto = await clon.text().catch(() => '');
          const limpio = String(texto ?? '').trim();
          if (limpio) {
            textoFallback = limpio;
            try {
              data = JSON.parse(limpio);
            } catch {
              data = null;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // Si no pudimos extraer desde clone/text, intentamos con json() directo.
    if (data === null && tieneJson(respuesta)) {
      data = await respuesta.json().catch(() => null);
    }

    const err = esObjeto(data) ? data['error'] : undefined;
    if (esObjeto(err)) {
      return {
        ...base,
        codigo: typeof err['codigo'] === 'string' ? err['codigo'] : undefined,
        mensaje: typeof err['mensaje'] === 'string' ? err['mensaje'] : undefined,
        detalles: err['detalles']
      };
    }
    if (typeof err === 'string') {
      const detalle = esObjeto(data) ? (data['detalle'] ?? data['detalles']) : undefined;
      return {
        ...base,
        mensaje: err,
        detalles: detalle !== undefined ? String(detalle) : undefined
      };
    }

    // Formatos alternativos tolerados: { codigo, mensaje, detalles } o { message }.
    if (esObjeto(data)) {
      const mensaje =
        typeof data['mensaje'] === 'string'
          ? (data['mensaje'] as string)
          : typeof data['message'] === 'string'
            ? (data['message'] as string)
            : undefined;
      const codigo = typeof data['codigo'] === 'string' ? (data['codigo'] as string) : undefined;
      const detalles = data['detalles'];
      if (mensaje || codigo || detalles !== undefined) {
        return { ...base, codigo, mensaje, detalles };
      }
    }

    // Si el body era texto no-JSON, lo usamos como mensaje.
    if (textoFallback) {
      return { ...base, mensaje: textoFallback };
    }

    return base;
  } catch {
    return base;
  }
}

export async function leerJsonOk<T>(respuesta: unknown, mensajeServicio: string): Promise<T> {
  const status = obtenerStatus(respuesta);
  if (status === 204 || status === 205) {
    return undefined as T;
  }

  if (!tieneJson(respuesta)) {
    throw new ErrorRemoto(mensajeServicio, { mensaje: 'Respuesta invalida', detalles: 'La respuesta no incluye JSON.' });
  }

  try {
    return (await respuesta.json()) as T;
  } catch (error) {
    throw new ErrorRemoto(mensajeServicio, { mensaje: 'Respuesta invalida', detalles: String(error) });
  }
}

export function crearGestorEventosUso<EventoUso>(opts: {
  obtenerToken: () => string | null;
  publicarLote: (lote: EventoUso[], token: string) => Promise<void>;
}) {
  const colaEventos: EventoUso[] = [];
  let flushEnCurso = false;
  let flushTimer: number | null = null;

  async function flushEventosUso() {
    const token = opts.obtenerToken();
    if (!token) {
      colaEventos.length = 0;
      return;
    }
    if (flushEnCurso) return;
    if (!colaEventos.length) return;
    flushEnCurso = true;

    try {
      while (colaEventos.length) {
        const lote = colaEventos.splice(0, 100);
        await opts.publicarLote(lote, token);
      }
    } catch {
      // best-effort: si falla, descartamos para no crecer sin límite.
      colaEventos.length = 0;
    } finally {
      flushEnCurso = false;
    }
  }

  function programarFlush() {
    if (flushTimer) return;
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      void flushEventosUso();
    }, 1200);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushEventosUso();
    });
    window.addEventListener('pagehide', () => {
      void flushEventosUso();
    });
  }

  async function registrarEventosUso(payload: { eventos: EventoUso[] }) {
    if (!payload?.eventos?.length) return;
    colaEventos.push(...payload.eventos);
    if (colaEventos.length >= 20) {
      void flushEventosUso();
      return;
    }
    programarFlush();
  }

  return { registrarEventosUso };
}

function mensajeAmigablePorStatus(status?: number): string | undefined {
  if (status === 401) return 'No se pudo autenticar. Verifica tus datos e intenta de nuevo.';
  if (status === 403) return 'No tienes permiso para realizar esta accion.';
  if (status === 404) return 'No se encontro el recurso solicitado.';
  if (status === 408) return 'La solicitud tardo demasiado. Intenta de nuevo.';
  if (status === 409) return 'Conflicto al guardar. Actualiza e intenta otra vez.';
  if (status === 413) return 'El archivo o datos son demasiado grandes.';
  if (status === 422) return 'Datos invalidos. Revisa los campos e intenta de nuevo.';
  if (status === 429) return 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.';
  if (typeof status === 'number' && status >= 500) return 'El servicio tuvo un problema. Intenta mas tarde.';
  return undefined;
}

function mensajeAmigablePorCodigo(codigo?: string): string | undefined {
  if (!codigo) return undefined;
  const c = codigo.toUpperCase();
  if (c.includes('CREDENCIALES_INVALIDAS')) return 'Correo o contrasena incorrectos.';
  if (c.includes('DOCENTE_NO_REGISTRADO')) return 'No existe una cuenta de docente para ese correo.';
  if (c.includes('DOCENTE_SIN_CONTRASENA')) return 'Esta cuenta no tiene contrasena. Ingresa con Google o define una contrasena.';
  if (c.includes('GOOGLE_SUB_MISMATCH')) return 'La cuenta de Google no coincide con el docente.';
  if (c.includes('GOOGLE_OAUTH_REQUIRED')) return 'Esta instalación requiere inicio de sesión con Google.';
  if (c.includes('TOKEN') && c.includes('INVALID')) return 'Tu sesion expiro. Inicia sesion de nuevo.';
  if (c.includes('TOKEN') && c.includes('EXPIR')) return 'Tu sesion expiro. Inicia sesion de nuevo.';
  if (c.includes('DATOS_INVALID')) return 'Datos invalidos. Revisa los campos e intenta de nuevo.';
  if (c.includes('SYNC_SERVIDOR_NO_CONFIG') || c.includes('PORTAL_NO_CONFIG')) {
    return 'Servidor de sincronizacion no configurado. Define PORTAL_ALUMNO_URL y PORTAL_ALUMNO_API_KEY.';
  }
  if (c.includes('SYNC_SERVIDOR_INALCANZABLE')) {
    return 'No se pudo conectar al servidor de sincronizacion. Verifica la URL y que el portal este en linea.';
  }
  if (c.includes('CLASSROOM_NO_CONFIG')) {
    return 'Google Classroom no esta configurado en el backend. Define GOOGLE_CLASSROOM_CLIENT_ID, GOOGLE_CLASSROOM_CLIENT_SECRET, GOOGLE_CLASSROOM_REDIRECT_URI y CLASSROOM_TOKEN_CIPHER_KEY.';
  }
  if (c.includes('EXAMEN_NO_ENCONTR')) return 'No se encontro el examen solicitado.';
  if (c.includes('EXAMEN_YA_ENTREGAD')) return 'Este examen ya fue entregado.';
  if (c.includes('PDF_NO_DISPON')) return 'El PDF no esta disponible aun.';
  if (c.includes('ERROR_INTERNO')) return 'Ocurrio un error interno. Intenta mas tarde.';
  return undefined;
}

function limpiarMensajeTecnico(texto?: string): string | undefined {
  if (!texto) return undefined;
  const limpio = texto.trim();
  if (!limpio) return undefined;
  if (limpio.startsWith('{') && limpio.endsWith('}')) {
    try {
      const parsed = JSON.parse(limpio);
      if (parsed && typeof parsed === 'object') {
        const msg = parsed['mensaje'] || parsed['error'] || parsed['message'];
        if (typeof msg === 'string') return limpiarMensajeTecnico(msg);
      }
    } catch {
      // ignore
    }
  }
  if (limpio.includes('ECONNREFUSED') || limpio.includes('Backend API no disponible') || limpio.includes('Failed to fetch')) {
    return 'Servidor local no disponible. Verifica que el backend de EvaluaPro este iniciado.';
  }
  return limpio;
}

export function mensajeUsuarioDeError(error: unknown, fallback: string): string {
  if (error instanceof ErrorRemoto) {
    const detalle = error.detalle;
    const status = detalle?.status;
    const codigo = typeof detalle?.codigo === 'string' ? detalle.codigo.toUpperCase() : undefined;

    if (codigo?.includes('NO_AUTORIZ')) {
      if (status === 401) return 'Tu sesion expiro. Inicia sesion de nuevo.';
      if (status === 403) return 'No tienes permiso para realizar esta accion.';
    }

    const porCodigo = mensajeAmigablePorCodigo(detalle?.codigo);
    if (porCodigo) return porCodigo;

    if (detalle?.mensaje) {
      const limpio = limpiarMensajeTecnico(detalle.mensaje);
      if (limpio) return limpio;
    }

    const porStatus = mensajeAmigablePorStatus(detalle?.status);
    if (porStatus) return porStatus;

    if (detalle?.codigo) return 'Error: ' + detalle.codigo;
    return fallback;
  }

  if (error instanceof Error && error.message) {
    const limpio = limpiarMensajeTecnico(error.message);
    if (limpio) return limpio;
  }
  return fallback;
}

export function sugerenciaUsuarioDeError(error: unknown): string | undefined {
  if (error instanceof ErrorRemoto) {
    const detalle = error.detalle;
    const status = detalle?.status;
    const codigo = typeof detalle?.codigo === 'string' ? detalle.codigo.toUpperCase() : undefined;
    const textoError = String(detalle?.mensaje || '') + ' ' + String(detalle?.detalles || '') + ' ' + String(error);

    if (textoError.includes('ECONNREFUSED') || textoError.includes('Backend API no disponible')) {
      return 'Tip: inicia el servicio backend de EvaluaPro o recarga la pagina.';
    }

    if (codigo?.includes('SYNC_SERVIDOR_NO_CONFIG') || codigo?.includes('PORTAL_NO_CONFIG')) {
      return 'Tip: configura PORTAL_ALUMNO_URL y PORTAL_ALUMNO_API_KEY.';
    }
    if (codigo?.includes('SYNC_SERVIDOR_INALCANZABLE')) {
      return 'Tip: verifica la URL del portal y su conectividad.';
    }
    if (codigo?.includes('CLASSROOM_NO_CONFIG')) {
      return 'Tip: configura credenciales OAuth de Classroom y reinicia el backend.';
    }

    if (status === 401) {
      if (codigo?.includes('CREDENCIALES_INVALIDAS')) return undefined;
      if (codigo?.includes('DOCENTE_NO_REGISTRADO')) return 'Tip: crea tu cuenta desde "Registrar".';
      if (codigo?.includes('DOCENTE_SIN_CONTRASENA')) return 'Tip: ingresa con Google o define una contrasena.';
      if (codigo?.includes('GOOGLE_SUB_MISMATCH')) return 'Tip: usa la misma cuenta de Google vinculada.';
      if (codigo?.includes('GOOGLE_OAUTH_REQUIRED')) return 'Tip: usa el botón de Google.';
      return 'Tip: inicia sesion de nuevo.';
    }
    if (status === 403) return 'Tip: revisa tus permisos o el rol.';
    if (status === 408) return 'Tip: revisa tu conexion e intenta de nuevo.';
    if (status === 429) return 'Tip: espera unos segundos e intenta de nuevo.';
    if (typeof status === 'number' && status >= 500) return 'Tip: intenta mas tarde.';

    if (codigo?.includes('TOKEN')) return 'Tip: inicia sesion de nuevo.';
    if (codigo?.includes('NO_AUTORIZ')) return 'Tip: revisa tus permisos o el rol.';
    if (codigo?.includes('DATOS_INVALID')) return 'Tip: revisa los campos e intenta de nuevo.';
  }
  return undefined;
}

function normalizarTextoComparacion(texto: string): string {
  return String(texto || '')
    .toLowerCase()
    .replace(/^tip:\s*/i, '')
    .replace(/[.!?:;,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mensajeUsuarioDeErrorConSugerencia(error: unknown, fallback: string): string {
  const base = mensajeUsuarioDeError(error, fallback);
  const tip = sugerenciaUsuarioDeError(error);
  if (!tip) return base;
  const baseNorm = normalizarTextoComparacion(base);
  const tipNorm = normalizarTextoComparacion(tip);
  if (!tipNorm) return base;
  if (baseNorm.includes(tipNorm) || tipNorm.includes(baseNorm)) return base;
  return base + ' ' + tip;
}

export function onSesionInvalidada(handler: (tipo: TipoSesion) => void) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent;
    const detail = (custom.detail || {}) as { tipo?: unknown };
    const tipo = detail.tipo;
    if (tipo === 'docente' || tipo === 'alumno') handler(tipo);
  };
  window.addEventListener(EVENT_SESION_INVALIDADA, listener);
  return () => window.removeEventListener(EVENT_SESION_INVALIDADA, listener);
}

export async function fetchConManejoErrores<T>(opts: {
  fetcher: (signal: AbortSignal) => Promise<unknown>;
  mensajeServicio: string;
  timeoutMs?: number;
  toastUnreachable: { id: string; title: string; message: string };
  toastTimeout?: { id: string; title: string; message: string };
  toastServerError: { id: string; title: string; message: (status: number | undefined) => string };
  retry?: { intentos?: number; baseMs?: number; maxMs?: number; jitterMs?: number };
  silenciarUnreachable?: boolean;
  silenciarTimeout?: boolean;
  silenciarServerError?: boolean;
}): Promise<T> {
  const retryCfg = {
    intentos: opts.retry?.intentos ?? 2,
    baseMs: opts.retry?.baseMs ?? 250,
    maxMs: opts.retry?.maxMs ?? 1500,
    jitterMs: opts.retry?.jitterMs ?? 120
  };
  const maxIntentos = Math.max(0, retryCfg.intentos);
  const retryableStatus = new Set([502, 503, 504, 429]);

  const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const calcularEspera = (intento: number) => {
    const base = retryCfg.baseMs * Math.pow(2, Math.max(0, intento - 1));
    const cap = Math.min(retryCfg.maxMs, base);
    const jitter = retryCfg.jitterMs > 0 ? Math.floor(Math.random() * retryCfg.jitterMs) : 0;
    return cap + jitter;
  };

  let ultimoError: unknown;

  for (let intento = 0; intento <= maxIntentos; intento += 1) {
    let respuesta: unknown;
    try {
      const controller = new AbortController();
      const timeoutMs = opts.timeoutMs ?? 12_000;
      const timer = timeoutMs > 0 ? globalThis.setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        respuesta = await opts.fetcher(controller.signal);
      } finally {
        if (timer) globalThis.clearTimeout(timer);
      }
    } catch (error) {
      ultimoError = error;
      if (intento < maxIntentos) {
        await esperar(calcularEspera(intento + 1));
        continue;
      }

      if (esAbortError(error)) {
        const toast = opts.toastTimeout ?? {
          id: opts.toastUnreachable.id + '-timeout',
          title: 'Tiempo de espera',
          message: 'La solicitud tardo demasiado. Intenta de nuevo.'
        };
        if (!opts.silenciarTimeout) {
          emitToast({ id: toast.id, level: 'error', title: toast.title, message: toast.message, durationMs: 5200 });
        }
        throw new ErrorRemoto(opts.mensajeServicio, { mensaje: toast.message, detalles: 'AbortError', status: 408 });
      }

      if (!opts.silenciarUnreachable) {
        emitToast({
          id: opts.toastUnreachable.id,
          level: 'error',
          title: opts.toastUnreachable.title,
          message: opts.toastUnreachable.message,
          durationMs: 5200
        });
      }
      throw new ErrorRemoto(opts.mensajeServicio, { mensaje: 'Sin conexion', detalles: String(error) });
    }

    const ok = esObjeto(respuesta) && typeof respuesta['ok'] === 'boolean' ? (respuesta['ok'] as boolean) : false;
    const status = esObjeto(respuesta) && typeof respuesta['status'] === 'number' ? (respuesta['status'] as number) : undefined;

    if (!ok) {
      if (status !== undefined && retryableStatus.has(status) && intento < maxIntentos) {
        await esperar(calcularEspera(intento + 1));
        continue;
      }
      const detalle = await leerErrorRemoto(respuesta);
      if (status !== undefined && status >= 500) {
        if (!opts.silenciarServerError) {
          emitToast({
            id: opts.toastServerError.id,
            level: 'error',
            title: opts.toastServerError.title,
            message: opts.toastServerError.message(status),
            durationMs: 5200
          });
        }
      }
      throw new ErrorRemoto(opts.mensajeServicio, { ...detalle, status });
    }

    return leerJsonOk<T>(respuesta, opts.mensajeServicio);
  }

  throw new ErrorRemoto(opts.mensajeServicio, { mensaje: 'Sin conexion', detalles: String(ultimoError) });
}

type ToastDescriptor = {
  id: string;
  title: string;
  message: string;
};

type ToastServerDescriptor = {
  id: string;
  title: string;
  message: (status: number | undefined) => string;
};

type RetryDescriptor = {
  intentos?: number;
  baseMs?: number;
  maxMs?: number;
  jitterMs?: number;
};

type ClienteRequestOptions = {
  timeoutMs?: number;
};

type CrearClienteJsonBaseOptions = {
  baseUrl: string;
  mensajeServicio: string;
  obtenerToken?: () => string | null;
  refrescarToken?: () => Promise<string | null>;
  credentials?: RequestCredentials;
  retry?: RetryDescriptor;
  silenciarDuranteArranque?: () => boolean;
  toastUnreachable: ToastDescriptor;
  toastTimeout: ToastDescriptor;
  toastServerError: ToastServerDescriptor;
};

export function crearPublicadorEventosUsoJson<EventoUso>(opts: {
  obtenerToken: () => string | null;
  url: string;
  credentials?: RequestCredentials;
}) {
  return async (lote: EventoUso[], token: string) => {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), 2500);
    try {
      await fetch(opts.url, {
        method: 'POST',
        credentials: opts.credentials,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ eventos: lote }),
        keepalive: true,
        signal: controller.signal
      });
    } finally {
      globalThis.clearTimeout(timer);
    }
  };
}

export function crearClienteJsonBase(opts: CrearClienteJsonBaseOptions) {
  const withJsonHeaders = (token: string | null, includeJsonContentType: boolean) => ({
    ...(includeJsonContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: 'Bearer ' + token } : {})
  });

  const solicitar = async <T>(
    ruta: string,
    {
      method = 'GET',
      payload,
      timeoutMs = 12_000
    }: ClienteRequestOptions & { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; payload?: unknown } = {}
  ): Promise<T> => {
    const token = opts.obtenerToken?.() ?? null;
    const includeJsonContentType = method !== 'GET' && method !== 'DELETE';
    const silenciar = opts.silenciarDuranteArranque?.() ?? false;

    return fetchConManejoErrores<T>({
      fetcher: async (signal) => {
        const ejecutar = (activeToken: string | null) =>
          fetch(opts.baseUrl + ruta, {
            method,
            credentials: opts.credentials,
            headers: withJsonHeaders(activeToken, includeJsonContentType),
            body: payload === undefined ? undefined : JSON.stringify(payload),
            signal
          });

        let respuesta = await ejecutar(token);
        if ((respuesta as Response).status === 401 && opts.refrescarToken) {
          const nuevoToken = await opts.refrescarToken();
          if (nuevoToken) respuesta = await ejecutar(nuevoToken);
        }
        return respuesta;
      },
      mensajeServicio: opts.mensajeServicio,
      timeoutMs,
      toastUnreachable: opts.toastUnreachable,
      toastTimeout: opts.toastTimeout,
      toastServerError: opts.toastServerError,
      retry: opts.retry,
      silenciarUnreachable: silenciar,
      silenciarTimeout: silenciar,
      silenciarServerError: silenciar
    });
  };

  return {
    obtener: <T>(ruta: string, opciones?: ClienteRequestOptions) => solicitar<T>(ruta, { method: 'GET', timeoutMs: opciones?.timeoutMs }),
    enviar: <T>(ruta: string, payload: unknown, opciones?: ClienteRequestOptions) =>
      solicitar<T>(ruta, { method: 'POST', payload, timeoutMs: opciones?.timeoutMs ?? 15_000 }),
    actualizar: <T>(ruta: string, payload: unknown, opciones?: ClienteRequestOptions) =>
      solicitar<T>(ruta, { method: 'PUT', payload, timeoutMs: opciones?.timeoutMs ?? 15_000 }),
    eliminar: <T>(ruta: string, opciones?: ClienteRequestOptions) =>
      solicitar<T>(ruta, { method: 'DELETE', timeoutMs: opciones?.timeoutMs ?? 15_000 })
  };
}
