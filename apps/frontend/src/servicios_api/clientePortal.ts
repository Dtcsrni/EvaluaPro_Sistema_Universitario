/**
 * Cliente API del portal alumno (Cloud Run).
 */
import {
  crearGestorEventosUso,
  DetalleErrorRemoto,
  ErrorRemoto,
  fetchConManejoErrores,
  mensajeUsuarioDeError
} from './clienteComun';

const basePortal = import.meta.env.VITE_PORTAL_BASE_URL || 'http://localhost:8080/api/portal';
const claveTokenAlumno = 'tokenAlumno';

export type { DetalleErrorRemoto };
export { ErrorRemoto };

export function guardarTokenAlumno(token: string) {
  localStorage.setItem(claveTokenAlumno, token);
}

export function obtenerTokenAlumno() {
  return localStorage.getItem(claveTokenAlumno);
}

export function limpiarTokenAlumno() {
  localStorage.removeItem(claveTokenAlumno);
}

export function crearClientePortal() {
  type EventoUso = {
    sessionId?: string;
    pantalla?: string;
    accion: string;
    exito?: boolean;
    duracionMs?: number;
    meta?: unknown;
  };

  const { registrarEventosUso } = crearGestorEventosUso<EventoUso>({
    obtenerToken: obtenerTokenAlumno,
    publicarLote: async (lote, token) => {
      const controller = new AbortController();
      const timer = globalThis.setTimeout(() => controller.abort(), 2500);
      try {
        await fetch(`${basePortal}/eventos-uso`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ eventos: lote }),
          keepalive: true,
          signal: controller.signal
        });
      } finally {
        globalThis.clearTimeout(timer);
      }
    }
  });

  type RequestOptions = { timeoutMs?: number };

  async function enviar<T>(ruta: string, payload: unknown, opciones?: RequestOptions): Promise<T> {
    return fetchConManejoErrores<T>({
      fetcher: (signal) =>
        fetch(`${basePortal}${ruta}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal
        }),
      mensajeServicio: 'Portal no disponible',
      timeoutMs: opciones?.timeoutMs ?? 15_000,
      toastUnreachable: {
        id: 'portal-unreachable',
        title: 'Sin conexion',
        message: 'No se pudo contactar el portal alumno.'
      },
      toastTimeout: {
        id: 'portal-timeout',
        title: 'Tiempo de espera',
        message: 'El portal tardo demasiado en responder.'
      },
      toastServerError: {
        id: 'portal-server-error',
        title: 'Portal con error',
        message: (status) => `El portal respondio con HTTP ${status}.`
      }
    });
  }

  async function obtener<T>(ruta: string, opciones?: RequestOptions): Promise<T> {
    const token = obtenerTokenAlumno();
    return fetchConManejoErrores<T>({
      fetcher: (signal) =>
        fetch(`${basePortal}${ruta}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          signal
        }),
      mensajeServicio: 'Portal no disponible',
      timeoutMs: opciones?.timeoutMs ?? 12_000,
      toastUnreachable: {
        id: 'portal-unreachable',
        title: 'Sin conexion',
        message: 'No se pudo contactar el portal alumno.'
      },
      toastTimeout: {
        id: 'portal-timeout',
        title: 'Tiempo de espera',
        message: 'El portal tardo demasiado en responder.'
      },
      toastServerError: {
        id: 'portal-server-error',
        title: 'Portal con error',
        message: (status) => `El portal respondio con HTTP ${status}.`
      }
    });
  }

  return { basePortal, enviar, obtener, registrarEventosUso, mensajeUsuarioDeError };
}
