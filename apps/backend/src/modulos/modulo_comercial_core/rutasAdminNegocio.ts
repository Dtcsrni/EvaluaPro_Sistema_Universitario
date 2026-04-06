import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import {
  actualizarCampana,
  actualizarCupon,
  actualizarPlantillaNotificacion,
  actualizarPlan,
  actualizarEstadoSuscripcion,
  actualizarTenant,
  aplicarCuponSuscripcion,
  cambiarPlanSuscripcion,
  crearPreferenciaCobroMercadoPago,
  crearCampana,
  crearCupon,
  crearPlantillaNotificacion,
  crearPlan,
  crearSuscripcion,
  crearTenant,
  ejecutarCicloCobranzaManual,
  generarLicencia,
  listarAuditoria,
  listarCampanas,
  listarCobranza,
  listarCupones,
  listarLicencias,
  listarPlanes,
  listarPlantillasNotificacion,
  listarSuscripciones,
  listarTenants,
  obtenerMetricasChurn,
  obtenerMetricasConversion,
  obtenerMetricasGuardrails,
  obtenerMetricasLtvCac,
  obtenerMetricasMrr,
  obtenerResumenDashboard,
  reasignarLicenciaDispositivo,
  registrarConsentimiento,
  revocarLicencia
} from './controladorAdminNegocio';
import {
  esquemaActualizarCampana,
  esquemaActualizarCupon,
  esquemaActualizarPlantillaNotificacion,
  esquemaActualizarPlan,
  esquemaActualizarEstadoSuscripcion,
  esquemaActualizarTenant,
  esquemaAplicarCupon,
  esquemaCambiarPlan,
  esquemaConsentimientoComercial,
  esquemaCrearCampana,
  esquemaCrearCupon,
  esquemaEjecutarCicloCobranza,
  esquemaCrearPlantillaNotificacion,
  esquemaCrearPreferenciaMercadoPago,
  esquemaCrearPlan,
  esquemaCrearSuscripcion,
  esquemaCrearTenant,
  esquemaGenerarLicencia,
  esquemaRevocarLicencia,
  esquemaReasignarLicenciaDispositivo
} from './validacionesComercialCore';

const router = Router();

router.get('/dashboard/resumen', requerirPermiso('comercial:metricas:leer'), obtenerResumenDashboard);

router.get('/tenants', requerirPermiso('comercial:tenants:leer'), listarTenants);
router.post('/tenants', requerirPermiso('comercial:tenants:gestionar'), validarCuerpo(esquemaCrearTenant, { strict: true }), crearTenant);
router.patch('/tenants/:id', requerirPermiso('comercial:tenants:gestionar'), validarCuerpo(esquemaActualizarTenant, { strict: true }), actualizarTenant);
router.post('/tenants/:id', requerirPermiso('comercial:tenants:gestionar'), validarCuerpo(esquemaActualizarTenant, { strict: true }), actualizarTenant);

router.get('/planes', requerirPermiso('comercial:planes:leer'), listarPlanes);
router.post('/planes', requerirPermiso('comercial:planes:gestionar'), validarCuerpo(esquemaCrearPlan, { strict: true }), crearPlan);
router.patch('/planes/:id', requerirPermiso('comercial:planes:gestionar'), validarCuerpo(esquemaActualizarPlan, { strict: true }), actualizarPlan);
router.post('/planes/:id', requerirPermiso('comercial:planes:gestionar'), validarCuerpo(esquemaActualizarPlan, { strict: true }), actualizarPlan);

router.get('/suscripciones', requerirPermiso('comercial:suscripciones:leer'), listarSuscripciones);
router.post('/suscripciones', requerirPermiso('comercial:suscripciones:gestionar'), validarCuerpo(esquemaCrearSuscripcion, { strict: true }), crearSuscripcion);
router.post('/suscripciones/:id/cambiar-plan', requerirPermiso('comercial:suscripciones:gestionar'), validarCuerpo(esquemaCambiarPlan, { strict: true }), cambiarPlanSuscripcion);
router.post('/suscripciones/:id/aplicar-cupon', requerirPermiso('comercial:suscripciones:gestionar'), validarCuerpo(esquemaAplicarCupon, { strict: true }), aplicarCuponSuscripcion);
router.post('/suscripciones/:id/estado', requerirPermiso('comercial:suscripciones:gestionar'), validarCuerpo(esquemaActualizarEstadoSuscripcion, { strict: true }), actualizarEstadoSuscripcion);

router.get('/cupones', requerirPermiso('comercial:cupones:leer'), listarCupones);
router.post('/cupones', requerirPermiso('comercial:cupones:gestionar'), validarCuerpo(esquemaCrearCupon, { strict: true }), crearCupon);
router.patch('/cupones/:id', requerirPermiso('comercial:cupones:gestionar'), validarCuerpo(esquemaActualizarCupon, { strict: true }), actualizarCupon);
router.post('/cupones/:id', requerirPermiso('comercial:cupones:gestionar'), validarCuerpo(esquemaActualizarCupon, { strict: true }), actualizarCupon);

router.get('/campanas', requerirPermiso('comercial:campanas:leer'), listarCampanas);
router.post('/campanas', requerirPermiso('comercial:campanas:gestionar'), validarCuerpo(esquemaCrearCampana, { strict: true }), crearCampana);
router.patch('/campanas/:id', requerirPermiso('comercial:campanas:gestionar'), validarCuerpo(esquemaActualizarCampana, { strict: true }), actualizarCampana);
router.post('/campanas/:id', requerirPermiso('comercial:campanas:gestionar'), validarCuerpo(esquemaActualizarCampana, { strict: true }), actualizarCampana);
router.get('/plantillas-notificacion', requerirPermiso('comercial:campanas:leer'), listarPlantillasNotificacion);
router.post('/plantillas-notificacion', requerirPermiso('comercial:campanas:gestionar'), validarCuerpo(esquemaCrearPlantillaNotificacion, { strict: true }), crearPlantillaNotificacion);
router.patch('/plantillas-notificacion/:id', requerirPermiso('comercial:campanas:gestionar'), validarCuerpo(esquemaActualizarPlantillaNotificacion, { strict: true }), actualizarPlantillaNotificacion);
router.post('/plantillas-notificacion/:id', requerirPermiso('comercial:campanas:gestionar'), validarCuerpo(esquemaActualizarPlantillaNotificacion, { strict: true }), actualizarPlantillaNotificacion);

router.get('/metricas/mrr', requerirPermiso('comercial:metricas:leer'), obtenerMetricasMrr);
router.get('/metricas/conversion', requerirPermiso('comercial:metricas:leer'), obtenerMetricasConversion);
router.get('/metricas/churn', requerirPermiso('comercial:metricas:leer'), obtenerMetricasChurn);
router.get('/metricas/ltv-cac', requerirPermiso('comercial:metricas:leer'), obtenerMetricasLtvCac);
router.get('/metricas/guardrails', requerirPermiso('comercial:metricas:leer'), obtenerMetricasGuardrails);

router.get('/licencias', requerirPermiso('comercial:licencias:leer'), listarLicencias);
router.post('/licencias/generar', requerirPermiso('comercial:licencias:gestionar'), validarCuerpo(esquemaGenerarLicencia, { strict: true }), generarLicencia);
router.post(
  '/licencias/:id/revocar',
  requerirPermiso('comercial:licencias:revocar'),
  validarCuerpo(esquemaRevocarLicencia, { strict: true }),
  revocarLicencia
);
router.post(
  '/licencias/:id/reasignar-dispositivo',
  requerirPermiso('comercial:licencias:gestionar'),
  validarCuerpo(esquemaReasignarLicenciaDispositivo, { strict: true }),
  reasignarLicenciaDispositivo
);

router.get('/cobranza', requerirPermiso('comercial:cobranza:leer'), listarCobranza);
router.post(
  '/cobranza/mercadopago/preferencia',
  requerirPermiso('comercial:cobranza:gestionar'),
  validarCuerpo(esquemaCrearPreferenciaMercadoPago, { strict: true }),
  crearPreferenciaCobroMercadoPago
);
router.post(
  '/cobranza/ciclo/ejecutar',
  requerirPermiso('comercial:cobranza:gestionar'),
  validarCuerpo(esquemaEjecutarCicloCobranza, { strict: true }),
  ejecutarCicloCobranzaManual
);
router.post('/consentimientos', requerirPermiso('comercial:suscripciones:gestionar'), validarCuerpo(esquemaConsentimientoComercial, { strict: true }), registrarConsentimiento);
router.get('/auditoria', requerirPermiso('comercial:auditoria:leer'), listarAuditoria);

export default router;
