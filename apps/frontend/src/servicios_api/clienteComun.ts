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
      'GOOGLE_SUB_MISMATCH'
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

function obtenerStatus(respuesta: unknown): number | undefined {
  return esObjeto(respuesta) && typeof respuesta['status'] === 'number' ? (respuesta['status'] as number) : undefined;
}

export async function leerErrorRemoto(respuesta: unknown): Promise<DetalleErrorRemoto> {
  const status = obtenerStatus(respuesta);
  const base: DetalleErrorRemoto = { status };

  if (!tieneJson(respuesta)) return base;

  try {
    const data: unknown = await respuesta.json().catch(() => null);
    const err = esObjeto(data) ? data['error'] : undefined;
    if (esObjeto(err)) {
      return {
        ...base,
        codigo: typeof err['codigo'] === 'string' ? err['codigo'] : undefined,
        mensaje: typeof err['mensaje'] === 'string' ? err['mensaje'] : undefined,
        detalles: err['detalles']
      };
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
  // 401 puede ser: sesion/token expiro o credenciales invalidas. Preferimos
  // resolver por `codigo` cuando este disponible y dejar aqui un fallback neutro.
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
  if (c.includes('TOKEN') && c.includes('INVALID')) return 'Tu sesion expiro. Inicia sesion de nuevo.';
  if (c.includes('TOKEN') && c.includes('EXPIR')) return 'Tu sesion expiro. Inicia sesion de nuevo.';
  if (c.includes('DATOS_INVALID')) return 'Datos invalidos. Revisa los campos e intenta de nuevo.';
  if (c.includes('EXAMEN_NO_ENCONTR')) return 'No se encontro el examen solicitado.';
  if (c.includes('PDF_NO_DISPON')) return 'El PDF no esta disponible aun.';
  if (c.includes('ERROR_INTERNO')) return 'Ocurrio un error interno. Intenta mas tarde.';
  return undefined;
}

export function mensajeUsuarioDeError(error: unknown, fallback: string): string {
  if (error instanceof ErrorRemoto) {
    const detalle = error.detalle;
    const status = detalle?.status;
    const codigo = typeof detalle?.codigo === 'string' ? detalle.codigo.toUpperCase() : undefined;

    // Caso especial: "NO_AUTORIZADO" se usa tanto para 401 (sesion requerida)
    // como para 403 (sin permisos). Lo resolvemos considerando el status.
    if (codigo?.includes('NO_AUTORIZ')) {
      if (status === 401) return 'Tu sesion expiro. Inicia sesion de nuevo.';
      if (status === 403) return 'No tienes permiso para realizar esta accion.';
    }

    const porCodigo = mensajeAmigablePorCodigo(detalle?.codigo);
    if (porCodigo) return porCodigo;

    // Preferimos el mensaje específico del backend (cuando existe)
    // antes de caer en un mensaje genérico por status (ej: 409).
    if (detalle?.mensaje) return detalle.mensaje;

    const porStatus = mensajeAmigablePorStatus(detalle?.status);
    if (porStatus) return porStatus;

    if (detalle?.codigo) return `Error: ${detalle.codigo}`;
    return fallback;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function sugerenciaUsuarioDeError(error: unknown): string | undefined {
  if (error instanceof ErrorRemoto) {
    const detalle = error.detalle;
    const status = detalle?.status;
    const codigo = typeof detalle?.codigo === 'string' ? detalle.codigo.toUpperCase() : undefined;

    if (status === 401) {
      if (codigo?.includes('CREDENCIALES_INVALIDAS')) return undefined;
      if (codigo?.includes('DOCENTE_NO_REGISTRADO')) return 'Tip: crea tu cuenta desde "Registrar".';
      if (codigo?.includes('DOCENTE_SIN_CONTRASENA')) return 'Tip: ingresa con Google o define una contrasena.';
      if (codigo?.includes('GOOGLE_SUB_MISMATCH')) return 'Tip: usa la misma cuenta de Google vinculada.';
      return 'Tip: inicia sesion de nuevo.';
    }
    if (status === 403) return 'Tip: revisa tus permisos o el rol.';
    if (status === 408) return 'Tip: revisa tu conexion e intenta de nuevo.';
    if (status === 429) return 'Tip: espera unos segundos e intenta de nuevo.';
    if (typeof status === 'number' && status >= 500) return 'Tip: intenta mas tarde.';

    // Fallback por codigo cuando no hay status.
    if (codigo?.includes('TOKEN')) return 'Tip: inicia sesion de nuevo.';
    if (codigo?.includes('NO_AUTORIZ')) return 'Tip: revisa tus permisos o el rol.';
    if (codigo?.includes('DATOS_INVALID')) return 'Tip: revisa los campos e intenta de nuevo.';
  }
  return undefined;
}

export function mensajeUsuarioDeErrorConSugerencia(error: unknown, fallback: string): string {
  const base = mensajeUsuarioDeError(error, fallback);
  const tip = sugerenciaUsuarioDeError(error);
  if (!tip) return base;
  if (base.toLowerCase().includes(tip.toLowerCase())) return base;
  return `${base} ${tip}`;
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
}): Promise<T> {
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
    if (esAbortError(error)) {
      const toast = opts.toastTimeout ?? {
        id: `${opts.toastUnreachable.id}-timeout`,
        title: 'Tiempo de espera',
        message: 'La solicitud tardo demasiado. Intenta de nuevo.'
      };
      emitToast({ id: toast.id, level: 'error', title: toast.title, message: toast.message, durationMs: 5200 });
      throw new ErrorRemoto(opts.mensajeServicio, { mensaje: toast.message, detalles: 'AbortError', status: 408 });
    }

    emitToast({
      id: opts.toastUnreachable.id,
      level: 'error',
      title: opts.toastUnreachable.title,
      message: opts.toastUnreachable.message,
      durationMs: 5200
    });
    throw new ErrorRemoto(opts.mensajeServicio, { mensaje: 'Sin conexion', detalles: String(error) });
  }

  const ok = esObjeto(respuesta) && typeof respuesta['ok'] === 'boolean' ? (respuesta['ok'] as boolean) : false;
  const status = esObjeto(respuesta) && typeof respuesta['status'] === 'number' ? (respuesta['status'] as number) : undefined;

  if (!ok) {
    const detalle = await leerErrorRemoto(respuesta);
    if (status !== undefined && status >= 500) {
      emitToast({
        id: opts.toastServerError.id,
        level: 'error',
        title: opts.toastServerError.title,
        message: opts.toastServerError.message(status),
        durationMs: 5200
      });
    }
    throw new ErrorRemoto(opts.mensajeServicio, { ...detalle, status });
  }

  return leerJsonOk<T>(respuesta, opts.mensajeServicio);
}
