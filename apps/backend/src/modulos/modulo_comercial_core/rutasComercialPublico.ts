import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { activarLicenciaPublica, heartbeatLicenciaPublica, webhookMercadoPago } from './controladorComercialPublico';
import { esquemaActivarLicencia, esquemaHeartbeatLicencia, esquemaWebhookMercadoPago } from './validacionesComercialCore';

const router = Router();

router.post('/licencias/activar', validarCuerpo(esquemaActivarLicencia, { strict: true }), activarLicenciaPublica);
router.post('/licencias/heartbeat', validarCuerpo(esquemaHeartbeatLicencia, { strict: true }), heartbeatLicenciaPublica);
router.post('/mercadopago/webhook', validarCuerpo(esquemaWebhookMercadoPago, { strict: true }), webhookMercadoPago);

export default router;
