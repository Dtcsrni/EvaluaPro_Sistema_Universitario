/**
 * Errores normalizados de sincronizacion nube.
 */
import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion';

export function createErrorServidorNoConfigurado(codigo: 'SYNC_SERVIDOR_NO_CONFIG' | 'PORTAL_NO_CONFIG') {
  return new ErrorAplicacion(
    codigo,
    'Servidor de sincronizacion no configurado. Define PORTAL_ALUMNO_URL y PORTAL_ALUMNO_API_KEY.',
    503
  );
}

export function normalizarErrorServidorSincronizacion(error: unknown) {
  if (error instanceof ErrorAplicacion) return error;
  return new ErrorAplicacion(
    'SYNC_SERVIDOR_INALCANZABLE',
    'No se pudo conectar al servidor de sincronizacion. Verifica PORTAL_ALUMNO_URL y que el portal este en linea.',
    502,
    {
      causa: error instanceof Error ? error.message : String(error)
    }
  );
}
