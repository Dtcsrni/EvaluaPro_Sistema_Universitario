/**
 * Cliente HTTP para sincronizacion con portal.
 */
import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion';
import { configuracion } from '../../../configuracion';
import { createErrorServidorNoConfigurado, normalizarErrorServidorSincronizacion } from '../domain/erroresSincronizacion';
import type { PortalSyncTransport } from '../shared/tiposSync';

export class PortalSyncClient implements PortalSyncTransport {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async postJson<T>(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; payload: T }> {
    const respuesta = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify(body)
    });

    const payload = (await respuesta.json().catch(() => ({}))) as T;
    return { ok: respuesta.ok, status: respuesta.status, payload };
  }
}

export function crearClientePortal(tipo: 'PORTAL_NO_CONFIG' | 'SYNC_SERVIDOR_NO_CONFIG' = 'SYNC_SERVIDOR_NO_CONFIG') {
  if (!configuracion.portalAlumnoUrl || !configuracion.portalApiKey) {
    throw createErrorServidorNoConfigurado(tipo);
  }
  return new PortalSyncClient(configuracion.portalAlumnoUrl, configuracion.portalApiKey);
}

export function lanzarErrorRemoto(codigo: string, mensaje: string): never {
  throw normalizarErrorServidorSincronizacion(new ErrorAplicacion(codigo, mensaje, 502));
}
