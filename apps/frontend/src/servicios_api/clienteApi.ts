/**
 * Cliente API simple para frontend docente/alumno.
 */
import {
  crearClienteJsonBase,
  crearGestorEventosUso,
  crearPublicadorEventosUsoJson,
  DetalleErrorRemoto,
  ErrorRemoto,
  fetchConManejoErrores,
  mensajeUsuarioDeError
} from './clienteComun';

const baseApi = import.meta.env.VITE_API_BASE_URL || '/api';
const claveToken = 'tokenDocente';
const claveEquipoSincronizacion = 'evaluapro.equipo.sincronizacion';

export function obtenerIdEquipoSincronizacion(): string {
  try {
    const existente = String(localStorage.getItem(claveEquipoSincronizacion) || '').trim();
    if (/^[A-Za-z0-9._:-]{8,128}$/.test(existente)) return existente;
    const nuevo = typeof crypto?.randomUUID === 'function'
      ? `web-${crypto.randomUUID()}`
      : `web-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    localStorage.setItem(claveEquipoSincronizacion, nuevo);
    return nuevo;
  } catch {
    return 'web-efimero';
  }
}

export type { DetalleErrorRemoto };
export { ErrorRemoto };

export function guardarTokenDocente(token: string, persistente: boolean = true): boolean {
  const valor = String(token || '').trim();
  if (!valor) return false;

  try {
    if (persistente) {
      localStorage.setItem(claveToken, valor);
      sessionStorage.removeItem(claveToken);
    } else {
      sessionStorage.setItem(claveToken, valor);
      localStorage.removeItem(claveToken);
    }
    return obtenerTokenDocente() === valor;
  } catch {
    return false;
  }
}

export function obtenerTokenDocente() {
  return localStorage.getItem(claveToken) || sessionStorage.getItem(claveToken);
}

export function limpiarTokenDocente() {
  localStorage.removeItem(claveToken);
  sessionStorage.removeItem(claveToken);
}

function tokenDocenteEsPersistente() {
  try {
    return localStorage.getItem(claveToken) !== null;
  } catch {
    return true;
  }
}

export function crearClienteApi() {
  const inicioApp = Date.now();
  const silenciarDuranteArranque = () => Date.now() - inicioApp < 15_000;
  const retryApi = { intentos: 4, baseMs: 400, maxMs: 3000, jitterMs: 150 };

  type EventoUso = {
    sessionId?: string;
    pantalla?: string;
    accion: string;
    exito?: boolean;
    duracionMs?: number;
    meta?: unknown;
  };

  const { registrarEventosUso } = crearGestorEventosUso<EventoUso>({
    obtenerToken: obtenerTokenDocente,
    publicarLote: crearPublicadorEventosUsoJson<EventoUso>({
      obtenerToken: obtenerTokenDocente,
      url: `${baseApi}/analiticas/eventos-uso`,
      credentials: 'include',
      headers: { 'X-EvaluaPro-Equipo': obtenerIdEquipoSincronizacion() }
    })
  });

  type RequestOptions = { timeoutMs?: number };

  let refreshEnCurso: Promise<string | null> | null = null;

  async function intentarRefrescarToken(): Promise<string | null> {
    if (refreshEnCurso) return refreshEnCurso;
    refreshEnCurso = (async () => {
      try {
        const resp = await fetchConManejoErrores<{ token: string }>({
          fetcher: (signal) =>
            fetch(`${baseApi}/autenticacion/refrescar`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
              signal
            }),
          mensajeServicio: 'API no disponible',
          timeoutMs: 10_000,
          toastUnreachable: {
            id: 'api-unreachable',
            title: 'Sin conexion',
            message: 'No se pudo contactar la API docente.'
          },
          toastTimeout: {
            id: 'api-timeout',
            title: 'Tiempo de espera',
            message: 'La API tardo demasiado en responder.'
          },
          toastServerError: {
            id: 'api-server-error',
            title: 'API con error',
            message: (status) => `La API respondio con HTTP ${status}.`
          },
          retry: retryApi,
          silenciarUnreachable: silenciarDuranteArranque(),
          silenciarTimeout: silenciarDuranteArranque(),
          silenciarServerError: silenciarDuranteArranque()
        });

        if (resp?.token) {
          // Conserva la decisión original del usuario: un refresh no debe
          // convertir una sesión de pestaña en una sesión persistente.
          guardarTokenDocente(resp.token, tokenDocenteEsPersistente());
          return resp.token;
        }
        return null;
      } catch {
        return null;
      } finally {
        refreshEnCurso = null;
      }
    })();
    return refreshEnCurso;
  }

  const clienteBase = crearClienteJsonBase({
    baseUrl: baseApi,
    mensajeServicio: 'API no disponible',
    obtenerToken: obtenerTokenDocente,
    refrescarToken: intentarRefrescarToken,
    credentials: 'include',
    headers: { 'X-EvaluaPro-Equipo': obtenerIdEquipoSincronizacion() },
    retry: retryApi,
    silenciarDuranteArranque,
    toastUnreachable: {
      id: 'api-unreachable',
      title: 'Sin conexion',
      message: 'No se pudo contactar la API docente.'
    },
    toastTimeout: {
      id: 'api-timeout',
      title: 'Tiempo de espera',
      message: 'La API tardo demasiado en responder.'
    },
    toastServerError: {
      id: 'api-server-error',
      title: 'API con error',
      message: (status) => `La API respondio con HTTP ${status}.`
    }
  });

  async function enviarFormData<T>(ruta: string, formData: FormData): Promise<T> {
    const token = obtenerTokenDocente();
    const resp = await fetch(`${baseApi}${ruta}`, {
      method: 'POST',
      headers: { 'X-EvaluaPro-Equipo': obtenerIdEquipoSincronizacion(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
      body: formData
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({})) as { error?: { mensaje?: string } };
      throw new Error(body?.error?.mensaje ?? `Error HTTP ${resp.status}`);
    }
    return resp.json() as Promise<T>;
  }

  async function enviarBinario(ruta: string, body: ArrayBuffer | Uint8Array, opciones?: { contentType?: string; timeoutMs?: number }): Promise<Response> {
    const ejecutar = async (token: string | null) => {
      const controlador = new AbortController();
      const timeout = window.setTimeout(() => controlador.abort(), opciones?.timeoutMs ?? 120_000);
      try {
        return await fetch(`${baseApi}${ruta}`, {
          method: 'POST',
          headers: {
            'Content-Type': opciones?.contentType || 'application/octet-stream',
            'X-EvaluaPro-Equipo': obtenerIdEquipoSincronizacion(),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          credentials: 'include',
          body: body as unknown as BodyInit,
          signal: controlador.signal
        });
      } finally {
        window.clearTimeout(timeout);
      }
    };

    let respuesta = await ejecutar(obtenerTokenDocente());
    if (respuesta.status === 401) {
      const token = await intentarRefrescarToken();
      if (token) respuesta = await ejecutar(token);
    }
    if (!respuesta.ok) {
      const bodyError = await respuesta.json().catch(() => ({})) as { error?: { mensaje?: string } };
      throw new Error(bodyError?.error?.mensaje || `Error HTTP ${respuesta.status}`);
    }
    return respuesta;
  }

  async function obtenerBinario(ruta: string, opciones?: { timeoutMs?: number }): Promise<Response> {
    const ejecutar = async (token: string | null) => {
      const controlador = new AbortController();
      const timeout = window.setTimeout(() => controlador.abort(), opciones?.timeoutMs ?? 120_000);
      try {
        return await fetch(`${baseApi}${ruta}`, {
          method: 'GET',
          headers: {
            'X-EvaluaPro-Equipo': obtenerIdEquipoSincronizacion(),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          credentials: 'include',
          signal: controlador.signal
        });
      } finally {
        window.clearTimeout(timeout);
      }
    };

    let respuesta = await ejecutar(obtenerTokenDocente());
    if (respuesta.status === 401) {
      const token = await intentarRefrescarToken();
      if (token) respuesta = await ejecutar(token);
    }
    if (!respuesta.ok) {
      const bodyError = await respuesta.json().catch(() => ({})) as { error?: { mensaje?: string } };
      throw new Error(bodyError?.error?.mensaje || `Error HTTP ${respuesta.status}`);
    }
    return respuesta;
  }

  return {
    baseApi,
    obtener: <T>(ruta: string, opciones?: RequestOptions) => clienteBase.obtener<T>(ruta, opciones),
    enviar: <T>(ruta: string, payload: unknown, opciones?: RequestOptions) => clienteBase.enviar<T>(ruta, payload, opciones),
    actualizar: <T>(ruta: string, payload: unknown, opciones?: RequestOptions) => clienteBase.actualizar<T>(ruta, payload, opciones),
    eliminar: <T>(ruta: string, opciones?: RequestOptions) => clienteBase.eliminar<T>(ruta, opciones),
    enviarFormData,
    enviarBinario,
    obtenerBinario,
    registrarEventosUso,
    mensajeUsuarioDeError,
    intentarRefrescarToken
  };
}
