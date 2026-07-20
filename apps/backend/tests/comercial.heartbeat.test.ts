/**
 * comercial.heartbeat
 *
 * Responsabilidad: proteger contrato de heartbeat comercial y ventana offline.
 * Limites: prueba aislada del adaptador HTTP; no requiere Mongo ni red.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const licencia = {
  _id: 'lic-1',
  tenantId: 'tenant-1',
  estado: 'activa',
  expiraEn: new Date(Date.now() + 24 * 60 * 60 * 1000),
  tokenLicenciaHash: 'hash-token',
  dispositivoVinculadoHash: 'hash-device',
  nonceUltimo: 'nonce-anterior',
  contadorHeartbeat: 4,
  graciaOfflineDias: 90,
  ultimoCanalRelease: 'docente-local',
  ultimoHeartbeatEn: new Date(Date.now() - 2 * 60 * 60 * 1000),
  save: vi.fn().mockResolvedValue(undefined)
};

vi.mock('../src/configuracion', () => ({
  configuracion: { licenciaHeartbeatHoras: 12 }
}));

vi.mock('../src/modulos/modulo_comercial_core/servicioComercialCore', () => ({
  Licencia: { findById: vi.fn().mockResolvedValue(licencia) },
  Suscripcion: {},
  Tenant: {},
  compararSeguro: (a: string, b: string) => a === b,
  construirHuellaDispositivo: () => 'hash-device',
  consultarPagoMercadoPago: vi.fn(),
  crearCobranzaWebhookIdempotente: vi.fn(),
  generarHashSeguro: () => 'hash-token',
  mapearEstadoCobranzaDesdeMercadoPago: vi.fn(),
  registrarEventoComercial: vi.fn().mockResolvedValue(undefined),
  validarMontoCobranza: vi.fn(),
  validarFirmaWebhookMercadoPago: vi.fn(),
  validarTransicionEstadoSuscripcionPorCobranza: vi.fn(),
  verificarTokenLicencia: () => ({ tenantId: 'tenant-1', licenciaId: 'lic-1' })
}));

describe('heartbeatLicenciaPublica', () => {
  beforeEach(() => {
    licencia.save.mockClear();
    licencia.contadorHeartbeat = 4;
    licencia.nonceUltimo = 'nonce-anterior';
    licencia.ultimoHeartbeatEn = new Date(Date.now() - 2 * 60 * 60 * 1000);
  });

  it('actualiza heartbeat y calcula horas transcurridas y límite offline', async () => {
    const { heartbeatLicenciaPublica } = await import('../src/modulos/modulo_comercial_core/controladorComercialPublico');
    const res = { json: vi.fn() };
    await heartbeatLicenciaPublica({
      body: {
        tokenLicencia: 'token',
        tenantId: 'tenant-1',
        huella: 'device',
        host: 'host',
        versionInstalada: '0.0.0-dev',
        nonce: 'nonce-nuevo',
        contador: 5
      }
    } as never, res as never);

    expect(licencia.save).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      estado: 'activa',
      graciaOfflineDias: 90,
      limiteOfflineHoras: 2172
    }));
  });
});
