/**
 * servicioComercialCore
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import { enviarCorreo, enviarNotificacionWebhook } from '../../infraestructura/correo/servicioCorreo';
import { AuditoriaComercial } from './modeloAuditoriaComercial';
import { Campana } from './modeloCampana';
import { Cobranza } from './modeloCobranza';
import { ConsentimientoComercial } from './modeloConsentimientoComercial';
import { Cupon } from './modeloCupon';
import { EventoComercial } from './modeloEventoComercial';
import { Licencia } from './modeloLicencia';
import { PlanComercial } from './modeloPlanComercial';
import { PlantillaNotificacion } from './modeloPlantillaNotificacion';
import { Suscripcion } from './modeloSuscripcion';
import { Tenant } from './modeloTenant';
import { prisma } from '../../infraestructura/baseDatos/sqlite';

const MARGEN_MINIMO = 0.6;
const LICENCIA_ISSUER = 'evaluapro.licencias';
const LICENCIA_AUDIENCE = 'evaluapro.instalador';

export function calcularMargen(precio: number, costo: number): number {
  const p = Number(precio || 0);
  const c = Number(costo || 0);
  if (p <= 0) return 0;
  return (p - c) / p;
}

export function validarMargenMinimo(precio: number, costo: number, margenMinimo = MARGEN_MINIMO) {
  const margen = calcularMargen(precio, costo);
  if (margen < margenMinimo) {
    throw new ErrorAplicacion('MARGEN_INVALIDO', `El margen bruto (${(margen * 100).toFixed(2)}%) es menor al minimo requerido`, 422);
  }
  return margen;
}

export function generarHashSeguro(valor: string): string {
  return crypto.createHash('sha256').update(String(valor || '').trim()).digest('hex');
}

export function compararSeguro(a: string, b: string): boolean {
  const ah = Buffer.from(String(a || '').trim());
  const bh = Buffer.from(String(b || '').trim());
  if (ah.length !== bh.length) return false;
  return crypto.timingSafeEqual(ah, bh);
}

export function construirHuellaDispositivo(tenantId: string, huella: string, host: string): string {
  const base = [
    String(tenantId || '').trim().toLowerCase(),
    String(huella || '').trim().toLowerCase(),
    String(host || '').trim().toLowerCase()
  ].join('|');
  return generarHashSeguro(base);
}

export async function registrarAuditoriaComercial(params: {
  actorDocenteId?: string;
  tenantId?: string;
  accion: string;
  recurso: string;
  recursoId?: string;
  origen?: string;
  ip?: string;
  diff?: unknown;
}) {
  await AuditoriaComercial.create({
    actorDocenteId: params.actorDocenteId,
    tenantId: params.tenantId,
    accion: params.accion,
    recurso: params.recurso,
    recursoId: params.recursoId,
    origen: params.origen || 'panel_admin_negocio',
    ip: params.ip,
    diff: params.diff
  });
}

export async function validarConsentimientoTrial(tenantId: string) {
  const ultimo = await ConsentimientoComercial.findOne({ tenantId }).sort({ createdAt: -1 }).lean();
  if (!ultimo || !ultimo.finalidades?.producto || !ultimo.finalidades?.ventas) {
    throw new ErrorAplicacion('CONSENTIMIENTO_REQUERIDO', 'Se requiere consentimiento granular (producto y ventas) para activar trial', 422);
  }
}

export async function validarYAplicarCupon(params: {
  codigo: string;
  planId: string;
  lineaPersona: string;
  precioBase: number;
  costoMensualEstimado: number;
}): Promise<{ precioFinal: number; descuento: number; cuponId: string }> {
  const cupon = await Cupon.findOne({ codigo: String(params.codigo || '').trim().toUpperCase(), activo: true });
  if (!cupon) {
    throw new ErrorAplicacion('CUPON_NO_ENCONTRADO', 'Cupon no valido', 404);
  }

  const ahora = new Date();
  if (cupon.vigenciaInicio > ahora || cupon.vigenciaFin < ahora) {
    throw new ErrorAplicacion('CUPON_VENCIDO', 'Cupon fuera de vigencia', 422);
  }
  if ((cupon.usosActuales ?? 0) >= (cupon.usoMaximo ?? 0)) {
    throw new ErrorAplicacion('CUPON_AGOTADO', 'Cupon sin usos disponibles', 422);
  }

  const planesPermitidos = cupon.restricciones?.planesPermitidos ?? [];
  if (planesPermitidos.length > 0 && !planesPermitidos.includes(params.planId)) {
    throw new ErrorAplicacion('CUPON_RESTRINGIDO_PLAN', 'Cupon no aplica para este plan', 422);
  }

  const personasPermitidas = cupon.restricciones?.personasPermitidas ?? [];
  if (personasPermitidas.length > 0 && !personasPermitidas.includes(params.lineaPersona)) {
    throw new ErrorAplicacion('CUPON_RESTRINGIDO_PERSONA', 'Cupon no aplica para este perfil', 422);
  }

  const base = Number(params.precioBase || 0);
  const descuentoBruto = cupon.tipoDescuento === 'porcentaje'
    ? base * (Number(cupon.valorDescuento || 0) / 100)
    : Number(cupon.valorDescuento || 0);
  const precioFinal = Math.max(0, Number((base - descuentoBruto).toFixed(2)));
  const descuento = base > 0 ? Number(((base - precioFinal) / base).toFixed(6)) : 0;

  validarMargenMinimo(precioFinal, params.costoMensualEstimado);

  cupon.usosActuales = Number(cupon.usosActuales || 0) + 1;
  await cupon.save();

  return { precioFinal, descuento, cuponId: String(cupon._id) };
}

export function emitirTokenLicencia(payload: { licenciaId: string; tenantId: string; tipo: 'saas' | 'onprem'; canalRelease: 'stable' | 'beta'; jti?: string }) {
  const body = {
    licenciaId: payload.licenciaId,
    tenantId: payload.tenantId,
    tipo: payload.tipo,
    canalRelease: payload.canalRelease
  };
  const jwtid = payload.jti || crypto.randomUUID();
  if (configuracion.licenciaJwtAlgoritmo === 'RS256') {
    if (!configuracion.licenciaJwtKidActivo || !configuracion.licenciaJwtLlavePrivadaPem) {
      throw new ErrorAplicacion('LICENCIA_CRIPTO_CONFIG_INVALIDA', 'Configuracion RS256 incompleta para licencias', 500);
    }
    return jwt.sign(body, configuracion.licenciaJwtLlavePrivadaPem, {
      algorithm: 'RS256',
      keyid: configuracion.licenciaJwtKidActivo,
      issuer: LICENCIA_ISSUER,
      audience: LICENCIA_AUDIENCE,
      jwtid,
      notBefore: '0s',
      expiresIn: '90d'
    });
  }
  return jwt.sign(body, configuracion.licenciaJwtSecreto, {
    algorithm: 'HS256',
    issuer: LICENCIA_ISSUER,
    audience: LICENCIA_AUDIENCE,
    jwtid,
    notBefore: '0s',
    expiresIn: '90d'
  });
}

export function verificarTokenLicencia(token: string): { licenciaId: string; tenantId: string; tipo: 'saas' | 'onprem'; canalRelease: 'stable' | 'beta'; jti?: string } {
  const decoded = jwt.decode(token, { complete: true }) as { header?: { alg?: string; kid?: string } } | null;
  const alg = String(decoded?.header?.alg || '').trim().toUpperCase();
  let payload: unknown;
  if (alg === 'RS256') {
    const kid = String(decoded?.header?.kid || '').trim();
    const publicKey = configuracion.licenciaJwtLlavesPublicas[kid];
    if (!kid || !publicKey) {
      throw new ErrorAplicacion('LICENCIA_KID_INVALIDO', 'KID de licencia invalido o no confiable', 403);
    }
    payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: LICENCIA_ISSUER,
      audience: LICENCIA_AUDIENCE
    });
  } else if (alg === 'HS256' && configuracion.licenciaJwtPermitirLegacyHs256) {
    payload = jwt.verify(token, configuracion.licenciaJwtSecreto, {
      algorithms: ['HS256'],
      issuer: LICENCIA_ISSUER,
      audience: LICENCIA_AUDIENCE
    });
  } else {
    throw new ErrorAplicacion('LICENCIA_ALGORITMO_INVALIDO', 'Algoritmo de token no permitido', 403);
  }
  const typed = payload as {
    licenciaId: string;
    tenantId: string;
    tipo: 'saas' | 'onprem';
    canalRelease: 'stable' | 'beta';
    jti?: string;
  };
  return typed;
}

export function generarCodigoActivacion(): string {
  return `EVAL-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

export async function registrarEventoComercial(tenantId: string, evento: string, meta?: unknown) {
  await EventoComercial.create({ tenantId, evento, origen: 'sistema', meta });
}

export async function construirResumenDashboard() {
  const [
    totalTenants,
    suscripcionesActivas,
    suscripcionesPastDue,
    mrr,
    cobranzaPendiente,
    conversionTrial,
    churnMensual
  ] = await Promise.all([
    Tenant.countDocuments({}),
    Suscripcion.countDocuments({ estado: 'activo' }),
    Suscripcion.countDocuments({ estado: 'past_due' }),
    Suscripcion.aggregate([
      { $match: { estado: 'activo', ciclo: 'mensual' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$precioAplicado', 0] } } } }
    ]),
    Cobranza.aggregate([
      { $match: { estado: 'pendiente' } },
      { $group: { _id: null, total: { $sum: '$monto' } } }
    ]),
    (async () => {
      const trials = await Suscripcion.countDocuments({ estado: 'trial' });
      const activos = await Suscripcion.countDocuments({ estado: 'activo' });
      const base = trials + activos;
      return base > 0 ? activos / base : 0;
    })(),
    (async () => {
      const canceladas = await Suscripcion.countDocuments({ estado: 'cancelado' });
      const activas = await Suscripcion.countDocuments({ estado: 'activo' });
      return activas > 0 ? canceladas / activas : 0;
    })()
  ]);

  return {
    margenBrutoMinimo: MARGEN_MINIMO,
    totalTenants,
    suscripcionesActivas,
    suscripcionesPastDue,
    mrrMxn: Number(mrr[0]?.total || 0),
    cobranzaPendienteMxn: Number(cobranzaPendiente[0]?.total || 0),
    conversionTrial,
    churnMensual
  };
}

export async function crearCobranzaWebhookIdempotente(params: {
  webhookEventId?: string;
  pagoIdPasarela?: string;
  tenantId: string;
  suscripcionId?: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado';
  monto: number;
  moneda?: string;
  referenciaExterna?: string;
  metadata?: unknown;
}) {
  if (params.webhookEventId) {
    const existente = await Cobranza.findOne({ webhookEventId: params.webhookEventId }).lean();
    if (existente) return { registro: existente, duplicado: true };
  }
  if (params.pagoIdPasarela) {
    const existentePorPago = await Cobranza.findOne({
      pasarela: 'mercadopago',
      estado: params.estado,
      'metadata.pago.id': params.pagoIdPasarela
    }).lean();
    if (existentePorPago) return { registro: existentePorPago, duplicado: true };
  }

  const registro = await Cobranza.create({
    tenantId: params.tenantId,
    suscripcionId: params.suscripcionId,
    pasarela: 'mercadopago',
    estado: params.estado,
    monto: params.monto,
    moneda: (params.moneda || 'MXN').toUpperCase(),
    referenciaExterna: params.referenciaExterna,
    webhookEventId: params.webhookEventId,
    metadata: params.metadata
  });

  return { registro, duplicado: false };
}

export function validarTransicionEstadoSuscripcionPorCobranza(
  estadoActual: 'trial' | 'activo' | 'past_due' | 'suspendido' | 'cancelado',
  estadoCobranza: 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado'
): 'trial' | 'activo' | 'past_due' | 'suspendido' | 'cancelado' {
  if (estadoCobranza === 'aprobado') return 'activo';
  if (estadoCobranza === 'rechazado') return estadoActual === 'cancelado' ? 'cancelado' : 'past_due';
  if (estadoCobranza === 'cancelado') return estadoActual === 'activo' ? 'past_due' : 'cancelado';
  return estadoActual;
}

export function validarMontoCobranza(params: {
  esperado: number;
  recibido: number;
  toleranciaPct?: number;
  toleranciaAbs?: number;
}): boolean {
  const esperado = Number(params.esperado || 0);
  const recibido = Number(params.recibido || 0);
  if (!(esperado > 0) || !(recibido > 0)) return false;
  const toleranciaPct = Number(params.toleranciaPct ?? configuracion.cobranzaMontoToleranciaPct);
  const toleranciaAbs = Number(params.toleranciaAbs ?? configuracion.cobranzaMontoToleranciaAbs);
  const deltaPermitido = Math.max(toleranciaAbs, esperado * toleranciaPct);
  return Math.abs(recibido - esperado) <= deltaPermitido;
}

export async function crearPreferenciaMercadoPago(params: {
  tenantId: string;
  suscripcionId: string;
  titulo: string;
  monto: number;
  moneda: string;
  correoComprador?: string;
  referenciaExterna?: string;
}): Promise<{
  id: string;
  initPoint?: string;
  sandboxInitPoint?: string;
  raw: unknown;
}> {
  if (!configuracion.mercadoPagoAccessToken) {
    throw new ErrorAplicacion('MP_NO_CONFIG', 'Mercado Pago no esta configurado (access token)', 503);
  }

  const referencia = params.referenciaExterna || `${params.tenantId}|${params.suscripcionId}`;
  const body = {
    items: [
      {
        title: params.titulo,
        quantity: 1,
        currency_id: String(params.moneda || 'MXN').toUpperCase(),
        unit_price: Number(params.monto || 0)
      }
    ],
    payer: params.correoComprador ? { email: params.correoComprador } : undefined,
    metadata: {
      tenantId: params.tenantId,
      suscripcionId: params.suscripcionId
    },
    external_reference: referencia
  };

  const respuesta = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${configuracion.mercadoPagoAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new ErrorAplicacion('MP_PREFERENCIA_ERROR', `No se pudo crear preferencia Mercado Pago (${respuesta.status})`, 502, detalle);
  }

  const payload = (await respuesta.json()) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
  };

  if (!payload?.id) {
    throw new ErrorAplicacion('MP_PREFERENCIA_INVALIDA', 'Respuesta invalida al crear preferencia', 502, payload);
  }

  return {
    id: payload.id,
    initPoint: payload.init_point,
    sandboxInitPoint: payload.sandbox_init_point,
    raw: payload
  };
}

export async function consultarPagoMercadoPago(paymentId: string): Promise<{
  id: string;
  status: string;
  transactionAmount: number;
  currencyId: string;
  externalReference?: string;
  metadata?: Record<string, unknown>;
}> {
  if (!configuracion.mercadoPagoAccessToken) {
    throw new ErrorAplicacion('MP_NO_CONFIG', 'Mercado Pago no esta configurado (access token)', 503);
  }
  const id = String(paymentId || '').trim();
  if (!id) throw new ErrorAplicacion('MP_PAGO_ID_INVALIDO', 'paymentId requerido', 400);

  const respuesta = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${configuracion.mercadoPagoAccessToken}`
    }
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new ErrorAplicacion('MP_PAGO_CONSULTA_ERROR', `No se pudo consultar pago Mercado Pago (${respuesta.status})`, 502, detalle);
  }

  const payload = (await respuesta.json()) as {
    id?: number | string;
    status?: string;
    transaction_amount?: number;
    currency_id?: string;
    external_reference?: string;
    metadata?: Record<string, unknown>;
  };

  return {
    id: String(payload.id || id),
    status: String(payload.status || 'unknown').toLowerCase(),
    transactionAmount: Number(payload.transaction_amount || 0),
    currencyId: String(payload.currency_id || 'MXN').toUpperCase(),
    externalReference: payload.external_reference ? String(payload.external_reference) : undefined,
    metadata: payload.metadata
  };
}

export function mapearEstadoCobranzaDesdeMercadoPago(status: string): 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado' {
  const valor = String(status || '').toLowerCase();
  if (valor === 'approved') return 'aprobado';
  if (valor === 'rejected' || valor === 'charged_back') return 'rechazado';
  if (valor === 'cancelled' || valor === 'cancelled_by_user') return 'cancelado';
  return 'pendiente';
}

export function resolverAccionMora(params: {
  diasVencidos: number;
  diasSuspensionParcial?: number;
  diasSuspensionTotal?: number;
}): 'ninguna' | 'recordatorio' | 'suspension_parcial' | 'suspension_total' {
  const dias = Number(params.diasVencidos || 0);
  const parcial = Number(params.diasSuspensionParcial ?? configuracion.cobranzaDiasSuspensionParcial);
  const total = Number(params.diasSuspensionTotal ?? configuracion.cobranzaDiasSuspensionTotal);
  if (dias >= total) return 'suspension_total';
  if (dias >= parcial) return 'suspension_parcial';
  if (dias > 0) return 'recordatorio';
  return 'ninguna';
}

export function renderizarPlantillaTexto(template: string, context: Record<string, unknown>): string {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = context[key];
    return value == null ? '' : String(value);
  });
}

function plantillaPorDefecto(
  evento: 'cobranza_recordatorio' | 'cobranza_suspension_parcial' | 'cobranza_suspension_total',
  canal: 'email' | 'whatsapp' | 'crm'
): { asunto: string; contenido: string } {
  const base = {
    cobranza_recordatorio: {
      asunto: 'Recordatorio de pago - {{tenantNombre}}',
      contenido: 'Tu suscripcion EvaluaPro tiene {{diasVencidos}} dia(s) de atraso. Regulariza para evitar suspension.'
    },
    cobranza_suspension_parcial: {
      asunto: 'Suspension parcial - {{tenantNombre}}',
      contenido: 'Tu suscripcion fue suspendida parcialmente por {{diasVencidos}} dia(s) de mora.'
    },
    cobranza_suspension_total: {
      asunto: 'Suspension total - {{tenantNombre}}',
      contenido: 'Tu suscripcion fue cancelada por {{diasVencidos}} dia(s) de mora.'
    }
  }[evento];
  if (canal === 'whatsapp') {
    return {
      asunto: base.asunto.replace(' - ', ': '),
      contenido: base.contenido
    };
  }
  return base;
}

export async function resolverPlantillaNotificacion(
  evento: 'cobranza_recordatorio' | 'cobranza_suspension_parcial' | 'cobranza_suspension_total',
  canal: 'email' | 'whatsapp' | 'crm',
  idioma = 'es-MX'
): Promise<{ asunto: string; contenido: string }> {
  const plantilla = await PlantillaNotificacion.findOne({ evento, canal, idioma, activo: true }).lean();
  if (!plantilla) return plantillaPorDefecto(evento, canal);
  return {
    asunto: String(plantilla.asunto || '').trim(),
    contenido: String(plantilla.contenido || '').trim()
  };
}

export async function ejecutarCicloCobranzaAutomatica(params?: {
  origen?: 'manual' | 'scheduler';
  actorDocenteId?: string;
}): Promise<{
  revisadas: number;
  recordatorios: number;
  suspensionesParciales: number;
  suspensionesTotales: number;
}> {
  const ahora = new Date();
  const suscripciones = await Suscripcion.find({ estado: 'past_due' });
  let recordatorios = 0;
  let suspensionesParciales = 0;
  let suspensionesTotales = 0;

  for (const suscripcion of suscripciones) {
    const tenant = await Tenant.findOne({ tenantId: suscripcion.tenantId }).lean();
    const docOwner = tenant?.ownerDocenteId ? await prisma.docente.findUnique({ where: { id: tenant.ownerDocenteId } }) : null;
    const owner = docOwner ? {
      ...docOwner,
      _id: docOwner.id,
      roles: typeof docOwner.roles === 'string' ? JSON.parse(docOwner.roles) : docOwner.roles
    } : null;
    const correoDestino = String((tenant as { contacto?: { correo?: string } } | null)?.contacto?.correo || owner?.correo || '').trim().toLowerCase();
    const telefonoDestino = String((tenant as { contacto?: { telefono?: string } } | null)?.contacto?.telefono || '').trim();
    const nombreTenant = String((tenant as { nombre?: string } | null)?.nombre || suscripcion.tenantId).trim();
    const fechaBase = suscripcion.fechaRenovacion ?? suscripcion.updatedAt ?? suscripcion.createdAt ?? ahora;
    const diasVencidos = Math.floor((ahora.getTime() - new Date(fechaBase).getTime()) / (1000 * 60 * 60 * 24));
    const accion = resolverAccionMora({ diasVencidos });

    if (accion === 'recordatorio') {
      recordatorios += 1;
      await registrarEventoComercial(suscripcion.tenantId, 'cobranza_recordatorio', {
        suscripcionId: String(suscripcion._id),
        diasVencidos
      });
      const ctx = {
        tenantNombre: nombreTenant,
        tenantId: suscripcion.tenantId,
        diasVencidos,
        estadoSuscripcion: suscripcion.estado
      };
      const plantillaEmail = await resolverPlantillaNotificacion('cobranza_recordatorio', 'email');
      const plantillaWhats = await resolverPlantillaNotificacion('cobranza_recordatorio', 'whatsapp');
      if (correoDestino) {
        await enviarCorreo(
          correoDestino,
          renderizarPlantillaTexto(plantillaEmail.asunto, ctx),
          renderizarPlantillaTexto(plantillaEmail.contenido, ctx)
        );
      }
      if (telefonoDestino) {
        await enviarNotificacionWebhook({
          canal: 'whatsapp',
          destinatario: telefonoDestino,
          asunto: renderizarPlantillaTexto(plantillaWhats.asunto, ctx),
          contenido: renderizarPlantillaTexto(plantillaWhats.contenido, ctx)
        });
      }
      continue;
    }

    if (accion === 'suspension_parcial') {
      suspensionesParciales += 1;
      suscripcion.estado = 'suspendido';
      await suscripcion.save();
      await Tenant.updateOne({ tenantId: suscripcion.tenantId }, { $set: { estado: 'suspendido' } });
      await registrarEventoComercial(suscripcion.tenantId, 'cobranza_suspension_parcial', {
        suscripcionId: String(suscripcion._id),
        diasVencidos
      });
      const ctx = {
        tenantNombre: nombreTenant,
        tenantId: suscripcion.tenantId,
        diasVencidos,
        estadoSuscripcion: 'suspendido'
      };
      const plantillaEmail = await resolverPlantillaNotificacion('cobranza_suspension_parcial', 'email');
      const plantillaWhats = await resolverPlantillaNotificacion('cobranza_suspension_parcial', 'whatsapp');
      if (correoDestino) {
        await enviarCorreo(
          correoDestino,
          renderizarPlantillaTexto(plantillaEmail.asunto, ctx),
          renderizarPlantillaTexto(plantillaEmail.contenido, ctx)
        );
      }
      if (telefonoDestino) {
        await enviarNotificacionWebhook({
          canal: 'whatsapp',
          destinatario: telefonoDestino,
          asunto: renderizarPlantillaTexto(plantillaWhats.asunto, ctx),
          contenido: renderizarPlantillaTexto(plantillaWhats.contenido, ctx)
        });
      }
      await AuditoriaComercial.create({
        actorDocenteId: params?.actorDocenteId,
        tenantId: suscripcion.tenantId,
        accion: 'cobranza.suspension_parcial',
        recurso: 'suscripcion',
        recursoId: String(suscripcion._id),
        origen: params?.origen ?? 'scheduler',
        diff: { diasVencidos, estadoNuevo: 'suspendido' }
      });
      continue;
    }

    if (accion === 'suspension_total') {
      suspensionesTotales += 1;
      suscripcion.estado = 'cancelado';
      await suscripcion.save();
      await Tenant.updateOne({ tenantId: suscripcion.tenantId }, { $set: { estado: 'cancelado' } });
      await registrarEventoComercial(suscripcion.tenantId, 'cobranza_suspension_total', {
        suscripcionId: String(suscripcion._id),
        diasVencidos
      });
      const ctx = {
        tenantNombre: nombreTenant,
        tenantId: suscripcion.tenantId,
        diasVencidos,
        estadoSuscripcion: 'cancelado'
      };
      const plantillaEmail = await resolverPlantillaNotificacion('cobranza_suspension_total', 'email');
      const plantillaWhats = await resolverPlantillaNotificacion('cobranza_suspension_total', 'whatsapp');
      if (correoDestino) {
        await enviarCorreo(
          correoDestino,
          renderizarPlantillaTexto(plantillaEmail.asunto, ctx),
          renderizarPlantillaTexto(plantillaEmail.contenido, ctx)
        );
      }
      if (telefonoDestino) {
        await enviarNotificacionWebhook({
          canal: 'whatsapp',
          destinatario: telefonoDestino,
          asunto: renderizarPlantillaTexto(plantillaWhats.asunto, ctx),
          contenido: renderizarPlantillaTexto(plantillaWhats.contenido, ctx)
        });
      }
      await AuditoriaComercial.create({
        actorDocenteId: params?.actorDocenteId,
        tenantId: suscripcion.tenantId,
        accion: 'cobranza.suspension_total',
        recurso: 'suscripcion',
        recursoId: String(suscripcion._id),
        origen: params?.origen ?? 'scheduler',
        diff: { diasVencidos, estadoNuevo: 'cancelado' }
      });
    }
  }

  return {
    revisadas: suscripciones.length,
    recordatorios,
    suspensionesParciales,
    suspensionesTotales
  };
}

export function validarFirmaWebhookMercadoPago(
  signature: string | undefined,
  params?: {
    payloadId?: string;
    dataIdUrl?: string;
    requestId?: string;
    topic?: string;
    tipoEvento?: string;
    ahoraMs?: number;
    modoEstricto?: boolean;
    secretoOverride?: string;
  }
): boolean {
  const secreto = String(params?.secretoOverride || configuracion.mercadoPagoWebhookSecret || '').trim();
  const modoEstricto = params?.modoEstricto ?? configuracion.mercadoPagoWebhookFirmaEstrica;
  if (!secreto) return !modoEstricto;
  if (!signature) return false;
  const pares = String(signature || '')
    .split(',')
    .map((trozo) => trozo.trim())
    .map((trozo) => trozo.split('='))
    .filter((par) => par.length === 2);
  const mapa = Object.fromEntries(pares);
  const ts = Number(mapa.ts || 0);
  const v1 = String(mapa.v1 || '').trim().toLowerCase();
  if (!ts || !v1) return false;

  const ahora = Number(params?.ahoraMs || Date.now());
  const tsSeg = ts > 9_999_999_999 ? Math.floor(ts / 1000) : ts;
  const deltaSeg = Math.abs(Math.floor(ahora / 1000) - tsSeg);
  if (deltaSeg > configuracion.mercadoPagoWebhookMaxEdadSegundos) return false;

  const payloadIdUrl = String(params?.dataIdUrl || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const payloadId = String(payloadIdUrl || params?.payloadId || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const requestId = String(params?.requestId || '').trim();
  if (modoEstricto && (!payloadIdUrl || !requestId)) return false;
  const partes = [
    payloadId ? `id:${payloadId}` : '',
    requestId ? `request-id:${requestId}` : '',
    `ts:${ts}`
  ].filter(Boolean);
  const manifiesto = `${partes.join(';')};`;
  const esperada = crypto
    .createHmac('sha256', secreto)
    .update(manifiesto)
    .digest('hex')
    .toLowerCase();
  if (compararSeguro(esperada, v1)) return true;

  if (modoEstricto) return false;

  const legacyEsperado = crypto
    .createHmac('sha256', secreto)
    .update('mercadopago')
    .digest('hex');
  if (compararSeguro(signature, legacyEsperado)) return true;

  const candidatasLegacy = [
    `${ts}.${payloadId}`,
    `${ts}.${payloadId}.${requestId}`
  ]
    .map((base) => base.trim())
    .filter((base) => base.length > 4)
    .map((base) =>
      crypto
        .createHmac('sha256', secreto)
        .update(base)
        .digest('hex')
        .toLowerCase()
    );
  return candidatasLegacy.some((firma) => compararSeguro(firma, v1));
}

export { Tenant, PlanComercial, Suscripcion, Licencia, Cupon, Campana, EventoComercial, ConsentimientoComercial, Cobranza, AuditoriaComercial };
