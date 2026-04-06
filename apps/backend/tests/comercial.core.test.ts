import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  calcularMargen,
  compararSeguro,
  construirHuellaDispositivo,
  emitirTokenLicencia,
  generarHashSeguro,
  mapearEstadoCobranzaDesdeMercadoPago,
  generarCodigoActivacion,
  renderizarPlantillaTexto,
  resolverAccionMora,
  validarMontoCobranza,
  validarFirmaWebhookMercadoPago,
  validarMargenMinimo,
  validarTransicionEstadoSuscripcionPorCobranza,
  verificarTokenLicencia
} from '../src/modulos/modulo_comercial_core/servicioComercialCore';

describe('comercial core', () => {
  it('calcula margen bruto correctamente', () => {
    expect(calcularMargen(100, 30)).toBeCloseTo(0.7, 4);
  });

  it('rechaza margen por debajo de 60%', () => {
    expect(() => validarMargenMinimo(100, 50, 0.6)).toThrowError();
  });

  it('firma y verifica token de licencia', () => {
    const token = emitirTokenLicencia({
      licenciaId: 'lic_1',
      tenantId: 'tenant_demo',
      tipo: 'onprem',
      canalRelease: 'stable'
    });
    const payload = verificarTokenLicencia(token);
    expect(payload.licenciaId).toBe('lic_1');
    expect(payload.tenantId).toBe('tenant_demo');
  });

  it('mapea estados de Mercado Pago a cobranza interna', () => {
    expect(mapearEstadoCobranzaDesdeMercadoPago('approved')).toBe('aprobado');
    expect(mapearEstadoCobranzaDesdeMercadoPago('rejected')).toBe('rechazado');
    expect(mapearEstadoCobranzaDesdeMercadoPago('cancelled')).toBe('cancelado');
    expect(mapearEstadoCobranzaDesdeMercadoPago('in_process')).toBe('pendiente');
  });

  it('genera codigo de activacion con prefijo esperado', () => {
    const codigo = generarCodigoActivacion();
    expect(codigo.startsWith('EVAL-')).toBe(true);
    expect(codigo.length).toBeGreaterThan(10);
  });

  it('clasifica accion de mora por dias vencidos', () => {
    expect(resolverAccionMora({ diasVencidos: 0 })).toBe('ninguna');
    expect(resolverAccionMora({ diasVencidos: 1 })).toBe('recordatorio');
    expect(resolverAccionMora({ diasVencidos: 3 })).toBe('suspension_parcial');
    expect(resolverAccionMora({ diasVencidos: 10 })).toBe('suspension_total');
  });

  it('renderiza variables de plantilla de notificacion', () => {
    const salida = renderizarPlantillaTexto('Hola {{tenantNombre}}, mora {{diasVencidos}}', {
      tenantNombre: 'Facultad Demo',
      diasVencidos: 4
    });
    expect(salida).toBe('Hola Facultad Demo, mora 4');
  });

  it('genera hash deterministico y comparacion segura', () => {
    const hashA = generarHashSeguro('token-demo');
    const hashB = generarHashSeguro('token-demo');
    const hashC = generarHashSeguro('token-distinto');
    expect(hashA).toBe(hashB);
    expect(compararSeguro(hashA, hashB)).toBe(true);
    expect(compararSeguro(hashA, hashC)).toBe(false);
  });

  it('vincula huella de dispositivo por tenant+host+fingerprint', () => {
    const huellaA = construirHuellaDispositivo('tenant1', 'abc12345', 'host01');
    const huellaB = construirHuellaDispositivo('tenant1', 'abc12345', 'host01');
    const huellaC = construirHuellaDispositivo('tenant1', 'abc12345', 'host02');
    expect(huellaA).toBe(huellaB);
    expect(huellaA).not.toBe(huellaC);
  });

  it('valida transiciones de suscripcion desde estado de cobranza', () => {
    expect(validarTransicionEstadoSuscripcionPorCobranza('trial', 'aprobado')).toBe('activo');
    expect(validarTransicionEstadoSuscripcionPorCobranza('activo', 'rechazado')).toBe('past_due');
    expect(validarTransicionEstadoSuscripcionPorCobranza('cancelado', 'rechazado')).toBe('cancelado');
    expect(validarTransicionEstadoSuscripcionPorCobranza('activo', 'pendiente')).toBe('activo');
  });

  it('valida monto de cobranza dentro de tolerancia', () => {
    expect(validarMontoCobranza({ esperado: 1000, recibido: 1001, toleranciaPct: 0.03, toleranciaAbs: 1 })).toBe(true);
    expect(validarMontoCobranza({ esperado: 1000, recibido: 1090, toleranciaPct: 0.03, toleranciaAbs: 1 })).toBe(false);
  });

  it('valida firma webhook Mercado Pago con manifiesto oficial estricto', () => {
    const secreto = 'mp-secret-test';
    const ts = 1_734_830_000;
    const requestId = 'req-12345';
    const dataIdUrl = '123456789';
    const manifest = `id:${dataIdUrl};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', secreto).update(manifest).digest('hex');
    const signature = `ts=${ts},v1=${v1}`;
    const ok = validarFirmaWebhookMercadoPago(signature, {
      dataIdUrl,
      requestId,
      payloadId: dataIdUrl,
      secretoOverride: secreto,
      modoEstricto: true,
      ahoraMs: ts * 1000
    });
    expect(ok).toBe(true);
  });

  it('rechaza firma webhook en modo estricto si falta x-request-id', () => {
    const secreto = 'mp-secret-test';
    const ts = 1_734_830_000;
    const dataIdUrl = '123456789';
    const manifest = `id:${dataIdUrl};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', secreto).update(manifest).digest('hex');
    const signature = `ts=${ts},v1=${v1}`;
    const ok = validarFirmaWebhookMercadoPago(signature, {
      dataIdUrl,
      payloadId: dataIdUrl,
      secretoOverride: secreto,
      modoEstricto: true,
      ahoraMs: ts * 1000
    });
    expect(ok).toBe(false);
  });
});
