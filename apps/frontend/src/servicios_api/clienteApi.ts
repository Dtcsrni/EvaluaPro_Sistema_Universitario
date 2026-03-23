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

const baseApi = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const claveToken = 'tokenDocente';

export type { DetalleErrorRemoto };
export { ErrorRemoto };

export function guardarTokenDocente(token: string) {
  localStorage.setItem(claveToken, token);
}

export function obtenerTokenDocente() {
  return localStorage.getItem(claveToken);
}

export function limpiarTokenDocente() {
  localStorage.removeItem(claveToken);
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
      credentials: 'include'
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
          guardarTokenDocente(resp.token);
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

  return {
    baseApi,
    obtener: <T>(ruta: string, opciones?: RequestOptions) => clienteBase.obtener<T>(ruta, opciones),
    enviar: <T>(ruta: string, payload: unknown, opciones?: RequestOptions) => clienteBase.enviar<T>(ruta, payload, opciones),
    actualizar: <T>(ruta: string, payload: unknown, opciones?: RequestOptions) => clienteBase.actualizar<T>(ruta, payload, opciones),
    eliminar: <T>(ruta: string, opciones?: RequestOptions) => clienteBase.eliminar<T>(ruta, opciones),
    registrarEventosUso,
    mensajeUsuarioDeError,
    intentarRefrescarToken
  };
}
