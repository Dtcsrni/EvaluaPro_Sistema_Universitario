import { configuracion } from '../../configuracion';
import { log, logError } from '../logging/logger';

type PayloadNotificacionWebhook = {
  canal: 'email' | 'whatsapp' | 'crm';
  destinatario: string;
  asunto: string;
  contenido: string;
  meta?: Record<string, unknown>;
};

export async function enviarCorreo(destinatario: string, asunto: string, contenido: string): Promise<boolean> {
  const email = String(destinatario || '').trim();
  if (!email) return false;

  if (!configuracion.correoModuloActivo) {
    log('warn', 'Modulo de correo desactivado por configuracion', {
      destino: email,
      asunto: String(asunto || '').slice(0, 120)
    });
    return false;
  }

  // Modo best-effort: deja evidencia operativa y delega entrega real a webhook si existe.
  log('info', 'Notificacion correo solicitada', {
    destino: email,
    asunto: String(asunto || '').slice(0, 120)
  });

  if (!configuracion.notificacionesWebhookUrl || !configuracion.notificacionesWebhookToken) {
    logError('Modulo de correo activo sin configuracion completa de webhook', undefined, {
      webhookUrl: Boolean(configuracion.notificacionesWebhookUrl),
      webhookToken: Boolean(configuracion.notificacionesWebhookToken)
    });
    return false;
  }

  return enviarNotificacionWebhook({
    canal: 'email',
    destinatario: email,
    asunto,
    contenido
  });
}

export async function enviarNotificacionWebhook(payload: PayloadNotificacionWebhook): Promise<boolean> {
  const url = String(configuracion.notificacionesWebhookUrl || '').trim();
  if (!url) return false;

  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(configuracion.notificacionesWebhookToken ? { Authorization: `Bearer ${configuracion.notificacionesWebhookToken}` } : {})
      },
      body: JSON.stringify({
        ...payload,
        source: 'evaluapro_comercial',
        timestamp: new Date().toISOString()
      })
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      logError('Webhook de notificaciones devolvio error', undefined, {
        status: respuesta.status,
        detalle: detalle.slice(0, 300)
      });
      return false;
    }
    return true;
  } catch (error) {
    logError('Fallo webhook de notificaciones', error);
    return false;
  }
}
