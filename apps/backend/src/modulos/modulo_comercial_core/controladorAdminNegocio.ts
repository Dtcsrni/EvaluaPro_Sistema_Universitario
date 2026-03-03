import type { Response } from 'express';
import { Types } from 'mongoose';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import {
  AuditoriaComercial,
  Campana,
  Cobranza,
  ConsentimientoComercial,
  Cupon,
  Licencia,
  PlanComercial,
  Suscripcion,
  Tenant,
  calcularMargen,
  crearPreferenciaMercadoPago,
  construirResumenDashboard,
  construirHuellaDispositivo,
  emitirTokenLicencia,
  generarCodigoActivacion,
  generarHashSeguro,
  registrarAuditoriaComercial,
  validarConsentimientoTrial,
  validarMargenMinimo,
  validarYAplicarCupon,
  ejecutarCicloCobranzaAutomatica
} from './servicioComercialCore';
import { PlantillaNotificacion } from './modeloPlantillaNotificacion';

function obtenerIp(req: SolicitudDocente): string {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  return forwarded || req.ip || '';
}

export async function obtenerResumenDashboard(req: SolicitudDocente, res: Response) {
  obtenerDocenteId(req);
  const resumen = await construirResumenDashboard();
  res.json({ resumen });
}

export async function listarTenants(_req: SolicitudDocente, res: Response) {
  const items = await Tenant.find({}).sort({ createdAt: -1 }).lean();
  res.json({ tenants: items });
}

export async function crearTenant(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const tenant = await Tenant.create(req.body);
  await registrarAuditoriaComercial({
    actorDocenteId,
    tenantId: tenant.tenantId,
    accion: 'crear_tenant',
    recurso: 'tenant',
    recursoId: String(tenant._id),
    ip: obtenerIp(req),
    diff: req.body
  });
  res.status(201).json({ tenant });
}

export async function actualizarTenant(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const tenantId = String(req.params.id || '').trim().toLowerCase();
  const tenant = await Tenant.findOneAndUpdate({ tenantId }, { $set: req.body }, { returnDocument: 'after' }).lean();
  if (!tenant) throw new ErrorAplicacion('TENANT_NO_ENCONTRADO', 'Tenant no encontrado', 404);

  await registrarAuditoriaComercial({
    actorDocenteId,
    tenantId,
    accion: 'actualizar_tenant',
    recurso: 'tenant',
    recursoId: String(tenant._id),
    ip: obtenerIp(req),
    diff: req.body
  });

  res.json({ tenant });
}

export async function listarPlanes(_req: SolicitudDocente, res: Response) {
  const planes = await PlanComercial.find({}).sort({ lineaPersona: 1, nivel: 1 }).lean();
  res.json({ planes });
}

export async function crearPlan(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  validarMargenMinimo(req.body.precioMensual, req.body.costoMensualEstimado, req.body.margenObjetivoMinimo ?? 0.6);
  const plan = await PlanComercial.create(req.body);

  await registrarAuditoriaComercial({
    actorDocenteId,
    accion: 'crear_plan',
    recurso: 'plan',
    recursoId: String(plan._id),
    ip: obtenerIp(req),
    diff: req.body
  });

  res.status(201).json({ plan });
}

export async function actualizarPlan(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const planId = String(req.params.id || '').trim().toLowerCase();

  const existente = await PlanComercial.findOne({ planId });
  if (!existente) throw new ErrorAplicacion('PLAN_NO_ENCONTRADO', 'Plan no encontrado', 404);

  const precioMensual = typeof req.body.precioMensual === 'number' ? req.body.precioMensual : existente.precioMensual;
  const costoMensual = typeof req.body.costoMensualEstimado === 'number' ? req.body.costoMensualEstimado : existente.costoMensualEstimado;
  const margenMinimo = typeof req.body.margenObjetivoMinimo === 'number' ? req.body.margenObjetivoMinimo : existente.margenObjetivoMinimo;
  validarMargenMinimo(precioMensual, costoMensual, margenMinimo);

  const plan = await PlanComercial.findOneAndUpdate({ planId }, { $set: req.body }, { returnDocument: 'after' }).lean();
  await registrarAuditoriaComercial({
    actorDocenteId,
    accion: 'actualizar_plan',
    recurso: 'plan',
    recursoId: String(plan?._id || ''),
    ip: obtenerIp(req),
    diff: req.body
  });

  res.json({ plan });
}

export async function listarSuscripciones(_req: SolicitudDocente, res: Response) {
  const suscripciones = await Suscripcion.find({}).sort({ createdAt: -1 }).lean();
  res.json({ suscripciones });
}

export async function crearSuscripcion(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const tenantId = String(req.body.tenantId || '').trim().toLowerCase();
  const planId = String(req.body.planId || '').trim().toLowerCase();
  const ciclo = req.body.ciclo;
  const estado = req.body.estado;
  const activarTrial35Dias = Boolean(req.body.activarTrial35Dias);

  const [tenant, plan] = await Promise.all([
    Tenant.findOne({ tenantId }).lean(),
    PlanComercial.findOne({ planId, activo: true }).lean()
  ]);
  if (!tenant) throw new ErrorAplicacion('TENANT_NO_ENCONTRADO', 'Tenant no encontrado', 404);
  if (!plan) throw new ErrorAplicacion('PLAN_NO_ENCONTRADO', 'Plan no encontrado', 404);

  const existenteActiva = await Suscripcion.findOne({
    tenantId,
    estado: { $in: ['trial', 'activo', 'past_due'] }
  }).lean();
  if (existenteActiva) {
    throw new ErrorAplicacion('SUSCRIPCION_YA_EXISTE', 'Ya existe una suscripcion vigente para este tenant', 409);
  }

  validarMargenMinimo(plan.precioMensual, plan.costoMensualEstimado, plan.margenObjetivoMinimo ?? 0.6);
  if (estado === 'trial') {
    await validarConsentimientoTrial(tenantId);
  }

  const ahora = new Date();
  const terminaTrial = new Date(ahora.getTime() + 35 * 24 * 60 * 60 * 1000);
  const fechaRenovacion =
    req.body.fechaRenovacion ||
    (ciclo === 'anual'
      ? new Date(ahora.getTime() + 365 * 24 * 60 * 60 * 1000)
      : new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000));

  const suscripcion = await Suscripcion.create({
    tenantId,
    planId,
    ciclo,
    estado,
    trial: {
      activo: estado === 'trial' && activarTrial35Dias,
      iniciaEn: estado === 'trial' && activarTrial35Dias ? ahora : undefined,
      terminaEn: estado === 'trial' && activarTrial35Dias ? terminaTrial : undefined
    },
    fechaRenovacion,
    pasarela: req.body.pasarela,
    precioAplicado: ciclo === 'anual' ? plan.precioAnual : plan.precioMensual,
    descuentoAplicado: 0
  });

  await Tenant.updateOne(
    { tenantId },
    { $set: { estado: estado === 'trial' ? 'trial' : estado === 'activo' ? 'activo' : tenant.estado } }
  );

  await registrarAuditoriaComercial({
    actorDocenteId,
    tenantId,
    accion: 'crear_suscripcion',
    recurso: 'suscripcion',
    recursoId: String(suscripcion._id),
    ip: obtenerIp(req),
    diff: {
      planId,
      ciclo,
      estado,
      trial: suscripcion.trial
    }
  });

  res.status(201).json({ suscripcion });
}

export async function actualizarEstadoSuscripcion(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const id = String(req.params.id || '').trim();
  const estado = req.body.estado;
  const motivo = String(req.body.motivo || '').trim() || undefined;

  const suscripcion = await Suscripcion.findById(id);
  if (!suscripcion) throw new ErrorAplicacion('SUSCRIPCION_NO_ENCONTRADA', 'Suscripcion no encontrada', 404);

  suscripcion.estado = estado;
  await suscripcion.save();

  await Tenant.updateOne(
    { tenantId: suscripcion.tenantId },
    { $set: { estado: estado === 'activo' ? 'activo' : estado === 'past_due' ? 'past_due' : estado === 'cancelado' ? 'cancelado' : 'trial' } }
  );

  await registrarAuditoriaComercial({
    actorDocenteId,
    tenantId: suscripcion.tenantId,
    accion: 'actualizar_estado_suscripcion',
    recurso: 'suscripcion',
    recursoId: String(suscripcion._id),
    ip: obtenerIp(req),
    diff: { estado, motivo }
  });

  res.json({ suscripcion });
}

export async function cambiarPlanSuscripcion(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const suscripcionId = String(req.params.id || '').trim();
  const suscripcion = await Suscripcion.findById(suscripcionId);
  if (!suscripcion) throw new ErrorAplicacion('SUSCRIPCION_NO_ENCONTRADA', 'Suscripcion no encontrada', 404);

  const plan = await PlanComercial.findOne({ planId: String(req.body.planId || '').trim().toLowerCase(), activo: true }).lean();
  if (!plan) throw new ErrorAplicacion('PLAN_NO_ENCONTRADO', 'Plan no encontrado', 404);

  validarMargenMinimo(plan.precioMensual, plan.costoMensualEstimado, plan.margenObjetivoMinimo ?? 0.6);
  if (suscripcion.estado === 'trial') {
    await validarConsentimientoTrial(suscripcion.tenantId);
  }

  suscripcion.planId = plan.planId;
  suscripcion.ciclo = req.body.ciclo;
  suscripcion.fechaRenovacion = req.body.fechaRenovacion ?? suscripcion.fechaRenovacion;
  suscripcion.pasarela = req.body.pasarela ?? suscripcion.pasarela;
  suscripcion.precioAplicado = req.body.ciclo === 'anual' ? plan.precioAnual : plan.precioMensual;
  await suscripcion.save();

  await registrarAuditoriaComercial({
    actorDocenteId,
    tenantId: suscripcion.tenantId,
    accion: 'cambiar_plan_suscripcion',
    recurso: 'suscripcion',
    recursoId: String(suscripcion._id),
    ip: obtenerIp(req),
    diff: req.body
  });

  res.json({ suscripcion });
}

export async function aplicarCuponSuscripcion(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const suscripcionId = String(req.params.id || '').trim();
  const suscripcion = await Suscripcion.findById(suscripcionId);
  if (!suscripcion) throw new ErrorAplicacion('SUSCRIPCION_NO_ENCONTRADA', 'Suscripcion no encontrada', 404);

  const plan = await PlanComercial.findOne({ planId: suscripcion.planId, activo: true }).lean();
  if (!plan) throw new ErrorAplicacion('PLAN_NO_ENCONTRADO', 'Plan no encontrado', 404);

  const base = suscripcion.ciclo === 'anual' ? plan.precioAnual : plan.precioMensual;
  const aplicado = await validarYAplicarCupon({
    codigo: String(req.body.codigo || ''),
    planId: plan.planId,
    lineaPersona: plan.lineaPersona,
    precioBase: base,
    costoMensualEstimado: plan.costoMensualEstimado
  });

  suscripcion.precioAplicado = aplicado.precioFinal;
  suscripcion.descuentoAplicado = aplicado.descuento;
  await suscripcion.save();

  await registrarAuditoriaComercial({
    actorDocenteId,
    tenantId: suscripcion.tenantId,
    accion: 'aplicar_cupon_suscripcion',
    recurso: 'suscripcion',
    recursoId: String(suscripcion._id),
    ip: obtenerIp(req),
    diff: { codigo: req.body.codigo, descuento: aplicado.descuento }
  });

  res.json({ suscripcion, aplicado });
}

export async function listarCupones(_req: SolicitudDocente, res: Response) {
  const cupones = await Cupon.find({}).sort({ createdAt: -1 }).lean();
  res.json({ cupones });
}

export async function crearCupon(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const cupon = await Cupon.create({ ...req.body, codigo: String(req.body.codigo || '').trim().toUpperCase() });

  await registrarAuditoriaComercial({
    actorDocenteId,
    accion: 'crear_cupon',
    recurso: 'cupon',
    recursoId: String(cupon._id),
    ip: obtenerIp(req),
    diff: req.body
  });

  res.status(201).json({ cupon });
}

export async function actualizarCupon(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const id = String(req.params.id || '').trim();
  const cupon = await Cupon.findByIdAndUpdate(id, { $set: req.body }, { returnDocument: 'after' }).lean();
  if (!cupon) throw new ErrorAplicacion('CUPON_NO_ENCONTRADO', 'Cupon no encontrado', 404);

  await registrarAuditoriaComercial({
    actorDocenteId,
    accion: 'actualizar_cupon',
    recurso: 'cupon',
    recursoId: id,
    ip: obtenerIp(req),
    diff: req.body
  });

  res.json({ cupon });
}

export async function listarCampanas(_req: SolicitudDocente, res: Response) {
  const campanas = await Campana.find({}).sort({ createdAt: -1 }).lean();
  res.json({ campanas });
}

export async function crearCampana(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const campana = await Campana.create(req.body);

  await registrarAuditoriaComercial({
    actorDocenteId,
    accion: 'crear_campana',
    recurso: 'campana',
    recursoId: String(campana._id),
    ip: obtenerIp(req),
    diff: req.body
  });

  res.status(201).json({ campana });
}

export async function actualizarCampana(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const id = String(req.params.id || '').trim();
  const campana = await Campana.findByIdAndUpdate(id, { $set: req.body }, { returnDocument: 'after' }).lean();
  if (!campana) throw new ErrorAplicacion('CAMPANA_NO_ENCONTRADA', 'Campana no encontrada', 404);

  await registrarAuditoriaComercial({
    actorDocenteId,
    accion: 'actualizar_campana',
    recurso: 'campana',
    recursoId: id,
    ip: obtenerIp(req),
    diff: req.body
  });

  res.json({ campana });
}

export async function listarPlantillasNotificacion(_req: SolicitudDocente, res: Response) {
  const plantillas = await PlantillaNotificacion.find({}).sort({ evento: 1, canal: 1, idioma: 1 }).lean();
  res.json({ plantillas });
}

export async function crearPlantillaNotificacion(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const payload = {
    ...req.body,
    clave: String(req.body.clave || '').trim().toLowerCase()
  };
  const plantilla = await PlantillaNotificacion.create(payload);

  await registrarAuditoriaComercial({
    actorDocenteId,
    accion: 'crear_plantilla_notificacion',
    recurso: 'plantilla_notificacion',
    recursoId: String(plantilla._id),
    ip: obtenerIp(req),
    diff: payload
  });

  res.status(201).json({ plantilla });
}

export async function actualizarPlantillaNotificacion(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const id = String(req.params.id || '').trim();
  const plantilla = await PlantillaNotificacion.findByIdAndUpdate(id, { $set: req.body }, { returnDocument: 'after' }).lean();
  if (!plantilla) throw new ErrorAplicacion('PLANTILLA_NOTIFICACION_NO_ENCONTRADA', 'Plantilla no encontrada', 404);

  await registrarAuditoriaComercial({
    actorDocenteId,
    accion: 'actualizar_plantilla_notificacion',
    recurso: 'plantilla_notificacion',
    recursoId: id,
    ip: obtenerIp(req),
    diff: req.body
  });

  res.json({ plantilla });
}

export async function obtenerMetricasMrr(_req: SolicitudDocente, res: Response) {
  const activas = await Suscripcion.find({ estado: 'activo' }).lean();
  const totalMrr = activas.reduce((sum, item) => sum + Number(item.precioAplicado || 0), 0);
  const arr = totalMrr * 12;
  res.json({ mrrMxn: totalMrr, arrMxn: arr, suscripcionesActivas: activas.length });
}

export async function obtenerMetricasConversion(_req: SolicitudDocente, res: Response) {
  const trial = await Suscripcion.countDocuments({ estado: 'trial' });
  const activo = await Suscripcion.countDocuments({ estado: 'activo' });
  const base = trial + activo;
  res.json({ conversionTrial: base > 0 ? activo / base : 0, trial, activo });
}

export async function obtenerMetricasChurn(_req: SolicitudDocente, res: Response) {
  const canceladas = await Suscripcion.countDocuments({ estado: 'cancelado' });
  const activas = await Suscripcion.countDocuments({ estado: 'activo' });
  res.json({ churnMensual: activas > 0 ? canceladas / activas : 0, canceladas, activas });
}

export async function obtenerMetricasLtvCac(_req: SolicitudDocente, res: Response) {
  const mrr = await Suscripcion.aggregate([
    { $match: { estado: 'activo' } },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$precioAplicado', 0] } }, count: { $sum: 1 } } }
  ]);
  const promedio = Number(mrr[0]?.count || 0) > 0 ? Number(mrr[0]?.total || 0) / Number(mrr[0]?.count || 1) : 0;
  const churnEstimado = 0.08;
  const ltv = churnEstimado > 0 ? promedio / churnEstimado : 0;
  const cacEstimado = Math.max(200, promedio * 0.5);
  const ltvCac = cacEstimado > 0 ? ltv / cacEstimado : 0;
  const paybackMeses = promedio > 0 ? cacEstimado / promedio : 0;
  res.json({ ltv, cac: cacEstimado, ltvCac, paybackMeses });
}

export async function generarLicencia(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const tenantId = String(req.body.tenantId || '').trim().toLowerCase();
  const tenant = await Tenant.findOne({ tenantId }).lean();
  if (!tenant) throw new ErrorAplicacion('TENANT_NO_ENCONTRADO', 'Tenant no encontrado', 404);

  const tipo = req.body.tipo;
  const codigoActivacion = generarCodigoActivacion();
  const licenciaId = new Types.ObjectId();
  const tokenLicencia = emitirTokenLicencia({
    licenciaId: String(licenciaId),
    tenantId,
    tipo,
    canalRelease: req.body.canalRelease
  });
  const licencia = await Licencia.create({
    _id: licenciaId,
    tenantId,
    tipo,
    codigoActivacion,
    tokenLicencia,
    tokenLicenciaHash: generarHashSeguro(tokenLicencia),
    expiraEn: req.body.expiraEn,
    graciaOfflineDias: 7,
    estado: 'generada',
    ultimoCanalRelease: req.body.canalRelease
  });

  await registrarAuditoriaComercial({
    actorDocenteId,
    tenantId,
    accion: 'generar_licencia',
    recurso: 'licencia',
    recursoId: String(licencia._id),
    ip: obtenerIp(req),
    diff: { tipo, canalRelease: req.body.canalRelease }
  });

  res.status(201).json({
    licencia: {
      id: licencia._id,
      tenantId,
      tipo,
      estado: licencia.estado,
      codigoActivacion,
      tokenLicencia: licencia.tokenLicencia,
      expiraEn: licencia.expiraEn,
      canalRelease: licencia.ultimoCanalRelease
    }
  });
}

export async function revocarLicencia(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const id = String(req.params.id || '').trim();
  const licencia = await Licencia.findByIdAndUpdate(
    id,
    {
      $set: {
        estado: 'revocada',
        revocadaRazon: 'revocacion_manual',
        puntajeAnomalia: 100
      }
    },
    { returnDocument: 'after' }
  ).lean();
  if (!licencia) throw new ErrorAplicacion('LICENCIA_NO_ENCONTRADA', 'Licencia no encontrada', 404);

  await registrarAuditoriaComercial({
    actorDocenteId,
    tenantId: licencia.tenantId,
    accion: 'revocar_licencia',
    recurso: 'licencia',
    recursoId: id,
    ip: obtenerIp(req)
  });

  res.json({ licencia });
}

export async function reasignarLicenciaDispositivo(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const id = String(req.params.id || '').trim();
  const licencia = await Licencia.findById(id);
  if (!licencia) throw new ErrorAplicacion('LICENCIA_NO_ENCONTRADA', 'Licencia no encontrada', 404);
  if (licencia.estado === 'revocada') throw new ErrorAplicacion('LICENCIA_REVOCADA', 'No se puede reasignar una licencia revocada', 422);

  licencia.dispositivoVinculadoHash = construirHuellaDispositivo(licencia.tenantId, req.body.huella, req.body.host);
  licencia.metaDispositivo = {
    huella: req.body.huella,
    host: req.body.host,
    versionInstalada: req.body.versionInstalada
  };
  licencia.nonceUltimo = undefined;
  licencia.contadorHeartbeat = 0;
  licencia.intentosFallidos = 0;
  licencia.puntajeAnomalia = 0;
  await licencia.save();

  await registrarAuditoriaComercial({
    actorDocenteId,
    tenantId: licencia.tenantId,
    accion: 'reasignar_licencia_dispositivo',
    recurso: 'licencia',
    recursoId: id,
    ip: obtenerIp(req),
    diff: { motivo: req.body.motivo, host: req.body.host, versionInstalada: req.body.versionInstalada }
  });

  res.json({ licencia });
}

export async function listarCobranza(_req: SolicitudDocente, res: Response) {
  const cobros = await Cobranza.find({}).sort({ createdAt: -1 }).lean();
  res.json({ cobros });
}

export async function crearPreferenciaCobroMercadoPago(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const suscripcionId = String(req.body.suscripcionId || '').trim();
  const suscripcion = await Suscripcion.findById(suscripcionId).lean();
  if (!suscripcion) throw new ErrorAplicacion('SUSCRIPCION_NO_ENCONTRADA', 'Suscripcion no encontrada', 404);

  const tenant = await Tenant.findOne({ tenantId: suscripcion.tenantId }).lean();
  if (!tenant) throw new ErrorAplicacion('TENANT_NO_ENCONTRADO', 'Tenant no encontrado', 404);

  const monto = Number(req.body.monto || suscripcion.precioAplicado || 0);
  if (!(monto > 0)) throw new ErrorAplicacion('COBRO_MONTO_INVALIDO', 'Monto invalido', 422);

  const preferencia = await crearPreferenciaMercadoPago({
    tenantId: suscripcion.tenantId,
    suscripcionId,
    titulo: String(req.body.titulo || `EvaluaPro ${suscripcion.planId}`),
    monto,
    moneda: String(req.body.moneda || 'MXN').toUpperCase(),
    correoComprador: String(req.body.correoComprador || '').trim() || undefined,
    referenciaExterna: String(req.body.referenciaExterna || '').trim() || undefined
  });

  await Cobranza.create({
    tenantId: suscripcion.tenantId,
    suscripcionId: suscripcion._id,
    pasarela: 'mercadopago',
    estado: 'pendiente',
    monto,
    moneda: String(req.body.moneda || 'MXN').toUpperCase(),
    referenciaExterna: String(req.body.referenciaExterna || `${suscripcion.tenantId}|${suscripcionId}`),
    metadata: {
      preferenciaId: preferencia.id,
      initPoint: preferencia.initPoint
    }
  });

  await registrarAuditoriaComercial({
    actorDocenteId,
    tenantId: suscripcion.tenantId,
    accion: 'crear_preferencia_mercadopago',
    recurso: 'cobranza',
    recursoId: suscripcionId,
    ip: obtenerIp(req),
    diff: {
      monto,
      moneda: String(req.body.moneda || 'MXN').toUpperCase(),
      preferenciaId: preferencia.id
    }
  });

  res.status(201).json({ preferencia });
}

export async function ejecutarCicloCobranzaManual(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const resumen = await ejecutarCicloCobranzaAutomatica({
    origen: 'manual',
    actorDocenteId
  });

  await registrarAuditoriaComercial({
    actorDocenteId,
    accion: 'cobranza.ejecucion_manual',
    recurso: 'cobranza',
    recursoId: 'ciclo',
    ip: obtenerIp(req),
    diff: resumen
  });

  res.json({ resumen });
}

export async function registrarConsentimiento(req: SolicitudDocente, res: Response) {
  const actorDocenteId = obtenerDocenteId(req);
  const consentimiento = await ConsentimientoComercial.create(req.body);

  await registrarAuditoriaComercial({
    actorDocenteId,
    tenantId: consentimiento.tenantId,
    accion: 'registrar_consentimiento',
    recurso: 'consentimiento',
    recursoId: String(consentimiento._id),
    ip: obtenerIp(req),
    diff: req.body
  });

  res.status(201).json({ consentimiento });
}

export async function listarAuditoria(_req: SolicitudDocente, res: Response) {
  const auditoria = await AuditoriaComercial.find({}).sort({ createdAt: -1 }).limit(300).lean();
  res.json({ auditoria });
}

export async function listarLicencias(_req: SolicitudDocente, res: Response) {
  const licencias = await Licencia.find({}).sort({ createdAt: -1 }).lean();
  const ahora = Date.now();
  res.json({
    licencias: licencias.map((licencia) => {
      const horasSinHeartbeat = licencia.ultimoHeartbeatEn
        ? (ahora - new Date(licencia.ultimoHeartbeatEn).getTime()) / (1000 * 60 * 60)
        : null;
      return {
        ...licencia,
        horasSinHeartbeat,
        margenControl: {
          pendienteRevision: false,
          minimo: 0.6
        }
      };
    })
  });
}

export async function obtenerMetricasGuardrails(_req: SolicitudDocente, res: Response) {
  const planes = await PlanComercial.find({ activo: true }).lean();
  const resumen = planes.map((plan) => ({
    planId: plan.planId,
    margen: calcularMargen(plan.precioMensual, plan.costoMensualEstimado),
    margenObjetivoMinimo: plan.margenObjetivoMinimo ?? 0.6
  }));
  res.json({ guardrails: resumen });
}
