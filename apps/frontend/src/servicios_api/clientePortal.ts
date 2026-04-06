/**
 * Cliente API del portal alumno (Cloud Run).
 */
import {
  crearClienteJsonBase,
  crearGestorEventosUso,
  crearPublicadorEventosUsoJson,
  DetalleErrorRemoto,
  ErrorRemoto,
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
    publicarLote: crearPublicadorEventosUsoJson<EventoUso>({
      obtenerToken: obtenerTokenAlumno,
      url: `${basePortal}/eventos-uso`
    })
  });

  type RequestOptions = { timeoutMs?: number };
  const clienteBase = crearClienteJsonBase({
    baseUrl: basePortal,
    mensajeServicio: 'Portal no disponible',
    obtenerToken: obtenerTokenAlumno,
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

  return {
    basePortal,
    enviar: <T>(ruta: string, payload: unknown, opciones?: RequestOptions) => clienteBase.enviar<T>(ruta, payload, opciones),
    obtener: <T>(ruta: string, opciones?: RequestOptions) => clienteBase.obtener<T>(ruta, opciones),
    registrarEventosUso,
    mensajeUsuarioDeError
  };
}
