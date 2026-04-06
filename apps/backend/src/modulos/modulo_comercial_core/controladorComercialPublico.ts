import type { Request, Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import {
  Licencia,
  Suscripcion,
  Tenant,
  compararSeguro,
  construirHuellaDispositivo,
  consultarPagoMercadoPago,
  crearCobranzaWebhookIdempotente,
  generarHashSeguro,
  mapearEstadoCobranzaDesdeMercadoPago,
  registrarEventoComercial,
  validarMontoCobranza,
  validarFirmaWebhookMercadoPago,
  validarTransicionEstadoSuscripcionPorCobranza,
  verificarTokenLicencia
} from './servicioComercialCore';

const LIMITE_ANOMALIA_BLOQUEO = 3;

type LicenciaMutable = {
  _id: unknown;
  tenantId: string;
  intentosFallidos?: number;
  puntajeAnomalia?: number;
  estado?: string;
  revocadaRazon?: string;
  metaDispositivo?: {
    huella?: string;
    host?: string;
    versionInstalada?: string;
  };
  save: () => Promise<unknown>;
};

async function registrarIntentoLicenciaInvalida(params: {
  licencia: LicenciaMutable | null | undefined;
  tenantId?: string;
  motivo: string;
  huella?: string;
  host?: string;
}) {
  if (!params.licencia) return;
  params.licencia.intentosFallidos = Number(params.licencia.intentosFallidos || 0) + 1;
  params.licencia.puntajeAnomalia = Number(params.licencia.puntajeAnomalia || 0) + 1;
  params.licencia.metaDispositivo = {
    huella: params.huella,
    host: params.host,
    versionInstalada: params.licencia.metaDispositivo?.versionInstalada
  };
  if (Number(params.licencia.puntajeAnomalia || 0) >= LIMITE_ANOMALIA_BLOQUEO) {
    params.licencia.estado = 'revocada';
    params.licencia.revocadaRazon = `autobloqueo:${params.motivo}`;
  }
  await params.licencia.save();
  await registrarEventoComercial(params.tenantId || params.licencia.tenantId, 'licencia_anomalia', {
    licenciaId: String(params.licencia._id),
    motivo: params.motivo,
    intentosFallidos: params.licencia.intentosFallidos,
    puntajeAnomalia: params.licencia.puntajeAnomalia
  });
}

export async function activarLicenciaPublica(req: Request, res: Response) {
  const { tenantId, codigoActivacion, huella, host, versionInstalada } = req.body as {
    tenantId?: string;
    codigoActivacion?: string;
    huella?: string;
    host?: string;
    versionInstalada?: string;
  };

  const licencia = await Licencia.findOne({
    tenantId: String(tenantId || '').trim().toLowerCase(),
    codigoActivacion: String(codigoActivacion || '').trim(),
    estado: { $in: ['generada', 'activa'] }
  });

  if (!licencia) throw new ErrorAplicacion('LICENCIA_INVALIDA', 'No se pudo activar la licencia', 404);
  if (licencia.estado === 'revocada') throw new ErrorAplicacion('LICENCIA_REVOCADA', 'Licencia revocada', 403);
  if (licencia.expiraEn.getTime() < Date.now()) {
    licencia.estado = 'expirada';
    await licencia.save();
    throw new ErrorAplicacion('LICENCIA_EXPIRADA', 'Licencia expirada', 403);
  }

  const huellaHash = construirHuellaDispositivo(licencia.tenantId, String(huella || ''), String(host || ''));
  const hashActual = String(licencia.dispositivoVinculadoHash || '').trim();
  if (hashActual && !compararSeguro(hashActual, huellaHash)) {
    await registrarIntentoLicenciaInvalida({
      licencia,
      tenantId: licencia.tenantId,
      motivo: 'activacion_dispositivo_no_autorizado',
      huella,
      host
    });
    throw new ErrorAplicacion('LICENCIA_DISPOSITIVO_INVALIDO', 'La licencia ya esta vinculada a otro dispositivo', 403);
  }

  licencia.estado = 'activa';
  licencia.activadaEn = licencia.activadaEn || new Date();
  licencia.ultimoHeartbeatEn = new Date();
  licencia.dispositivoVinculadoHash = huellaHash;
  licencia.nonceUltimo = undefined;
  licencia.contadorHeartbeat = 0;
  licencia.intentosFallidos = 0;
  licencia.puntajeAnomalia = 0;
  licencia.metaDispositivo = {
    huella,
    host,
    versionInstalada
  };
  await licencia.save();

  await registrarEventoComercial(licencia.tenantId, 'licencia_activada', {
    licenciaId: String(licencia._id),
    host,
    versionInstalada
  });

  res.json({
    licencia: {
      tokenLicencia: licencia.tokenLicencia,
      expiraEn: licencia.expiraEn,
      graciaOfflineDias: licencia.graciaOfflineDias,
      canalRelease: licencia.ultimoCanalRelease
    }
  });
}

export async function heartbeatLicenciaPublica(req: Request, res: Response) {
  const { tokenLicencia, tenantId, huella, host, versionInstalada, nonce, contador } = req.body as {
    tokenLicencia?: string;
    tenantId?: string;
    huella?: string;
    host?: string;
    versionInstalada?: string;
    nonce?: string;
    contador?: number;
  };

  const token = String(tokenLicencia || '').trim();
  const payload = verificarTokenLicencia(token);
  if (payload.tenantId !== String(tenantId || '').trim().toLowerCase()) {
    throw new ErrorAplicacion('LICENCIA_TENANT_INVALIDO', 'Tenant no coincide con la licencia', 403);
  }

  const licencia = await Licencia.findById(payload.licenciaId);
  if (!licencia) throw new ErrorAplicacion('LICENCIA_NO_ENCONTRADA', 'Licencia no encontrada', 404);
  if (licencia.estado === 'revocada') throw new ErrorAplicacion('LICENCIA_REVOCADA', 'Licencia revocada', 403);

  const tokenHashRecibido = generarHashSeguro(token);
  if (!compararSeguro(String(licencia.tokenLicenciaHash || ''), tokenHashRecibido)) {
    await registrarIntentoLicenciaInvalida({
      licencia,
      tenantId: licencia.tenantId,
      motivo: 'token_hash_invalido',
      huella,
      host
    });
    throw new ErrorAplicacion('LICENCIA_TOKEN_INVALIDO', 'Token de licencia invalido', 403);
  }

  const huellaHash = construirHuellaDispositivo(licencia.tenantId, String(huella || ''), String(host || ''));
  const hashActual = String(licencia.dispositivoVinculadoHash || '').trim();
  if (hashActual && !compararSeguro(hashActual, huellaHash)) {
    await registrarIntentoLicenciaInvalida({
      licencia,
      tenantId: licencia.tenantId,
      motivo: 'heartbeat_dispositivo_no_autorizado',
      huella,
      host
    });
    throw new ErrorAplicacion('LICENCIA_DISPOSITIVO_INVALIDO', 'Dispositivo no autorizado', 403);
  }
  if (!hashActual) {
    licencia.dispositivoVinculadoHash = huellaHash;
  }

  const nonceNormalizado = String(nonce || '').trim();
  const contadorNormalizado = Number(contador ?? -1);
  if (contadorNormalizado <= Number(licencia.contadorHeartbeat || 0)) {
    await registrarIntentoLicenciaInvalida({
      licencia,
      tenantId: licencia.tenantId,
      motivo: 'heartbeat_replay_contador',
      huella,
      host
    });
    throw new ErrorAplicacion('LICENCIA_REPLAY_DETECTADO', 'Contador de heartbeat invalido', 409);
  }
  const nonceUltimo = String(licencia.nonceUltimo || '');
  if (nonceUltimo && compararSeguro(nonceUltimo, nonceNormalizado)) {
    await registrarIntentoLicenciaInvalida({
      licencia,
      tenantId: licencia.tenantId,
      motivo: 'heartbeat_replay_nonce',
      huella,
      host
    });
    throw new ErrorAplicacion('LICENCIA_REPLAY_DETECTADO', 'Nonce repetido', 409);
  }

  const ahora = new Date();
  licencia.ultimoHeartbeatEn = ahora;
  licencia.nonceUltimo = nonceNormalizado;
  licencia.contadorHeartbeat = contadorNormalizado;
  licencia.intentosFallidos = 0;
  licencia.metaDispositivo = { huella, host, versionInstalada };

  if (licencia.expiraEn.getTime() < ahora.getTime()) {
    licencia.estado = 'expirada';
  }

  await licencia.save();

  const horasSinHeartbeat = licencia.ultimoHeartbeatEn
    ? 0
    : configuracion.licenciaHeartbeatHoras + (licencia.graciaOfflineDias * 24);

  res.json({
    ok: licencia.estado !== 'revocada',
    estado: licencia.estado,
    expiraEn: licencia.expiraEn,
    horasSinHeartbeat,
    graciaOfflineDias: licencia.graciaOfflineDias,
    canalRelease: licencia.ultimoCanalRelease
  });
}

export async function webhookMercadoPago(req: Request, res: Response) {
  const firma = String(req.headers['x-signature'] || req.headers['x-mp-signature'] || '');
  const requestId = String(req.headers['x-request-id'] || '');
  const payloadWebhook = req.body as { data?: { id?: string }; id?: string };
  const payloadIdFirma = String(payloadWebhook.data?.id || payloadWebhook.id || '').trim();
  const dataIdUrl = String((req.query?.['data.id'] ?? req.query?.id ?? '') || '').trim();
  const topic = String((req.query?.topic ?? req.query?.type ?? '') || '').trim();
  if (!validarFirmaWebhookMercadoPago(firma || undefined, {
    payloadId: payloadIdFirma,
    dataIdUrl,
    requestId,
    topic
  })) {
    throw new ErrorAplicacion('WEBHOOK_FIRMA_INVALIDA', 'Firma de webhook invalida', 401);
  }

  const payload = req.body as {
    id?: string;
    eventId?: string;
    type?: string;
    data?: { id?: string; status?: string };
    metadata?: { tenantId?: string; suscripcionId?: string; monto?: number; moneda?: string; referencia?: string };
  };
  const tipoEvento = String(payload.type || '').trim().toLowerCase();
  const tipoEventoUrl = String((req.query?.type ?? req.query?.topic ?? '') || '').trim().toLowerCase();
  if (tipoEvento && tipoEventoUrl && tipoEvento !== tipoEventoUrl) {
    throw new ErrorAplicacion('WEBHOOK_EVENTO_INCONSISTENTE', 'Inconsistencia entre tipo de evento URL y payload', 422);
  }
  if (tipoEvento && !tipoEvento.includes('payment')) {
    return res.status(202).json({ ok: true, ignorado: true, motivo: 'evento_no_payment' });
  }

  const webhookEventId = String(payload.eventId || payload.id || '').trim() || undefined;
  const paymentId = String(payload.data?.id || payload.id || '').trim();
  if (!paymentId) throw new ErrorAplicacion('WEBHOOK_PAYMENT_ID_REQUERIDO', 'Webhook sin payment id', 422);

  const pago = await consultarPagoMercadoPago(paymentId);
  const externalReference = String(pago.externalReference || payload.metadata?.referencia || '').trim();
  const [tenantIdFromRef, suscripcionIdFromRef] = externalReference.includes('|')
    ? externalReference.split('|')
    : ['', ''];

  const tenantId = String(
    payload.metadata?.tenantId ||
    pago.metadata?.tenantId ||
    tenantIdFromRef ||
    ''
  )
    .trim()
    .toLowerCase();
  const suscripcionId = String(
    payload.metadata?.suscripcionId ||
    pago.metadata?.suscripcionId ||
    suscripcionIdFromRef ||
    ''
  )
    .trim();

  if (!tenantId) throw new ErrorAplicacion('WEBHOOK_TENANT_REQUERIDO', 'Webhook sin tenant asociado', 422);
  if (!suscripcionId) throw new ErrorAplicacion('WEBHOOK_SUSCRIPCION_REQUERIDA', 'Webhook sin suscripcion asociada', 422);

  const [suscripcion, tenant] = await Promise.all([
    Suscripcion.findById(suscripcionId),
    Tenant.findOne({ tenantId }).lean()
  ]);
  if (!suscripcion) throw new ErrorAplicacion('WEBHOOK_SUSCRIPCION_INVALIDA', 'Suscripcion no encontrada para webhook', 422);
  if (!tenant) throw new ErrorAplicacion('WEBHOOK_TENANT_INVALIDO', 'Tenant no encontrado para webhook', 422);
  if (suscripcion.tenantId !== tenantId) {
    throw new ErrorAplicacion('WEBHOOK_TENANT_SUSCRIPCION_MISMATCH', 'Tenant/suscripcion inconsistente en webhook', 422);
  }

  const estado = mapearEstadoCobranzaDesdeMercadoPago(pago.status);
  const montoPago = Number(pago.transactionAmount || payload.metadata?.monto || 0);
  const monedaPago = String(pago.currencyId || payload.metadata?.moneda || 'MXN').toUpperCase();
  const monedaTenant = String(tenant.moneda || 'MXN').toUpperCase();
  if (monedaPago !== monedaTenant) {
    await registrarEventoComercial(tenantId, 'cobranza_anomalia', {
      paymentId,
      motivo: 'moneda_invalida',
      monedaPago,
      monedaTenant
    });
    throw new ErrorAplicacion('WEBHOOK_MONEDA_INVALIDA', 'Moneda de pago no coincide con tenant', 422);
  }

  const montoEsperado = Number(suscripcion.precioAplicado || 0);
  if (estado === 'aprobado' && !validarMontoCobranza({ esperado: montoEsperado, recibido: montoPago })) {
    await registrarEventoComercial(tenantId, 'cobranza_anomalia', {
      paymentId,
      motivo: 'monto_fuera_tolerancia',
      montoEsperado,
      montoPago
    });
    throw new ErrorAplicacion('WEBHOOK_MONTO_INVALIDO', 'Monto pagado fuera de tolerancia permitida', 422);
  }

  const resultado = await crearCobranzaWebhookIdempotente({
    webhookEventId,
    pagoIdPasarela: pago.id,
    tenantId,
    suscripcionId,
    estado,
    monto: montoPago,
    moneda: monedaPago,
    referenciaExterna: externalReference || undefined,
    metadata: {
      webhook: payload,
      pago
    }
  });

  if (!resultado.duplicado) {
    suscripcion.estado = validarTransicionEstadoSuscripcionPorCobranza(suscripcion.estado, estado);
    await suscripcion.save();
  }

  res.status(200).json({ ok: true, duplicado: resultado.duplicado });
}
