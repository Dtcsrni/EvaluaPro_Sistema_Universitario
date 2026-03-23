/**
 * Configuracion centralizada del backend.
 */
import dotenv from 'dotenv';
import path from 'node:path';

const entorno = process.env.NODE_ENV ?? 'development';
if (entorno !== 'production' && entorno !== 'test') {
  // Dotenv v17 puede emitir logs informativos; se silencian para mantener
  // pruebas y consola limpias. En producción no se debe rellenar config crítica
  // desde `.env`; solo se admite el entorno real del proceso.
  // En test tampoco se carga el `.env` del repo para evitar que secretos o flags
  // locales alteren contratos de integración esperados por la suite.
  dotenv.config({
    quiet: true,
    path: path.resolve(__dirname, '..', '..', '..', '.env')
  });
}

const puerto = Number(process.env.PUERTO_API ?? process.env.PORT ?? 4000);
const mongoUri = process.env.MONGODB_URI ?? process.env.MONGO_URI ?? '';
const limiteJson = process.env.LIMITE_JSON ?? '10mb';
const corsOrigenes = (process.env.CORS_ORIGENES ?? 'http://localhost:5173')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

const dominiosCorreoPermitidos = (process.env.DOMINIOS_CORREO_PERMITIDOS ?? '')
  .split(',')
  .map((dominio) => dominio.trim().toLowerCase().replace(/^@/, ''))
  .filter(Boolean);

function parsearNumeroSeguro(valor: unknown, porDefecto: number, { min, max }: { min?: number; max?: number } = {}) {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return porDefecto;
  const clampedMax = typeof max === 'number' ? Math.min(max, n) : n;
  const clamped = typeof min === 'number' ? Math.max(min, clampedMax) : clampedMax;
  return clamped;
}
// En producción, el secreto JWT debe ser proporcionado por entorno.
// En desarrollo/test se permite un valor por defecto para facilitar el setup.
const jwtSecreto = process.env.JWT_SECRETO ?? '';
if (entorno === 'production' && !jwtSecreto) {
  throw new Error('JWT_SECRETO es requerido en producción');
}
if (entorno === 'production' && !mongoUri) {
  throw new Error('MONGODB_URI es requerido en producción');
}
const jwtSecretoEfectivo = jwtSecreto || 'cambia-este-secreto';
const omrQrHmacSecret = String(process.env.OMR_QR_HMAC_SECRET ?? jwtSecretoEfectivo).trim() || jwtSecretoEfectivo;
const omrQrHmacKeyId = String(process.env.OMR_QR_HMAC_KEY_ID ?? process.env.OMR_QR_RECOVERY_KEY_ID ?? 'qr-h1-v1').trim() || 'qr-h1-v1';
const omrRecoveryKeyId =
  String(process.env.OMR_QR_RECOVERY_KEY_ID ?? process.env.OMR_QR_HMAC_KEY_ID ?? 'recovery-h1-v1').trim() || 'recovery-h1-v1';
const omrRecoverySecret =
  String(process.env.OMR_QR_RECOVERY_SECRET ?? process.env.OMR_QR_HMAC_SECRET ?? jwtSecretoEfectivo).trim() || omrQrHmacSecret;
function parsearMapaSecretos(raw: string, fallbackKeyId: string, fallbackSecret: string) {
  const mapa: Record<string, string> = {};
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      for (const [keyId, secret] of Object.entries(parsed ?? {})) {
        const normalizedKeyId = String(keyId ?? '').trim();
        const normalizedSecret = String(secret ?? '').trim();
        if (!normalizedKeyId || !normalizedSecret) continue;
        mapa[normalizedKeyId] = normalizedSecret;
      }
    } catch {
      // Se conserva fallback de una sola clave para no romper arranque.
    }
  }
  if (!mapa[fallbackKeyId]) {
    mapa[fallbackKeyId] = fallbackSecret;
  }
  return mapa;
}
const omrQrHmacSecrets = parsearMapaSecretos(
  String(process.env.OMR_QR_HMAC_SECRETS_JSON ?? '').trim(),
  omrQrHmacKeyId,
  omrQrHmacSecret
);
const omrRecoverySecrets = parsearMapaSecretos(
  String(process.env.OMR_QR_RECOVERY_SECRETS_JSON ?? '').trim(),
  omrRecoveryKeyId,
  omrRecoverySecret
);
const jwtExpiraHoras = Number(process.env.JWT_EXPIRA_HORAS ?? 8);
const refreshTokenDias = Number(process.env.REFRESH_TOKEN_DIAS ?? 30);
const passwordResetTokenMinutes = parsearNumeroSeguro(process.env.PASSWORD_RESET_TOKEN_MINUTES, 30, { min: 5, max: 180 });
const passwordResetUrlBase = String(process.env.PASSWORD_RESET_URL_BASE ?? '').trim();
const googleOauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
const googleClassroomClientId = process.env.GOOGLE_CLASSROOM_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
const googleClassroomClientSecret = process.env.GOOGLE_CLASSROOM_CLIENT_SECRET ?? '';
const googleClassroomRedirectUri = process.env.GOOGLE_CLASSROOM_REDIRECT_URI ?? '';
const classroomTokenCipherKey = process.env.CLASSROOM_TOKEN_CIPHER_KEY ?? '';
const requireGoogleOAuth = ['1', 'true', 'yes', 'on'].includes(String(process.env.REQUIRE_GOOGLE_OAUTH ?? '').trim().toLowerCase());
const codigoAccesoHoras = Number(process.env.CODIGO_ACCESO_HORAS ?? 12);
const portalAlumnoUrl = process.env.PORTAL_ALUMNO_URL ?? '';
const portalApiKey = process.env.PORTAL_ALUMNO_API_KEY ?? '';
const corsOrigenesRaw = String(process.env.CORS_ORIGENES ?? '').trim();
if (entorno === 'production' && !portalAlumnoUrl) {
  throw new Error('PORTAL_ALUMNO_URL es requerido en producción');
}
if (entorno === 'production' && !portalApiKey) {
  throw new Error('PORTAL_ALUMNO_API_KEY es requerido en producción');
}
if (entorno === 'production' && !corsOrigenesRaw) {
  throw new Error('CORS_ORIGENES es requerido en producción');
}

// Rate limit: configurable por entorno para tuning y para pruebas deterministas.
// Defaults conservan el comportamiento anterior.
const rateLimitWindowMs = parsearNumeroSeguro(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, {
  min: 1_000,
  max: 24 * 60 * 60 * 1000
});
const rateLimitLimit = parsearNumeroSeguro(process.env.RATE_LIMIT_LIMIT, 300, { min: 1, max: 10_000 });
const rateLimitCredencialesLimit = parsearNumeroSeguro(
  process.env.RATE_LIMIT_CREDENCIALES_LIMIT,
  entorno === 'production' ? 40 : 120,
  { min: 1, max: 10_000 }
);
const rateLimitRefrescoLimit = parsearNumeroSeguro(
  process.env.RATE_LIMIT_REFRESCO_LIMIT,
  entorno === 'production' ? 240 : 600,
  { min: 1, max: 10_000 }
);

// OMR: limite del tamaño de la imagen en base64 (en caracteres) para evitar payloads abusivos.
// Nota: base64 suele inflar ~33%, por eso se controla por longitud de string.
const omrImagenBase64MaxChars = parsearNumeroSeguro(process.env.OMR_IMAGEN_BASE64_MAX_CHARS, 2_000_000, {
  min: 1_000,
  max: 50_000_000
});

const complianceModeRaw = String(process.env.COMPLIANCE_MODE ?? 'private').trim().toLowerCase();
const complianceMode: 'private' | 'public-hidalgo' = complianceModeRaw === 'public-hidalgo' ? 'public-hidalgo' : 'private';
const dataRetentionDefaultDays = parsearNumeroSeguro(process.env.DATA_RETENTION_DEFAULT_DAYS, 365, {
  min: 1,
  max: 3650
});
const dataPurgeCron = String(process.env.DATA_PURGE_CRON ?? '0 3 * * *').trim();
const auditLogImmutable = ['1', 'true', 'yes'].includes(String(process.env.AUDIT_LOG_IMMUTABLE ?? 'true').toLowerCase());
const dpoContactEmail = String(process.env.DPO_CONTACT_EMAIL ?? 'armsystechno@gmail.com').trim();
const legalNoticeVersion = String(process.env.LEGAL_NOTICE_VERSION ?? '2026.02').trim();
const superadminGoogleEmails = [
  'armsystechno@gmail.com',
  'erick.vega@cuh.mx'
];
const mercadoPagoAccessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN ?? '').trim();
const mercadoPagoWebhookSecret = String(process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '').trim();
const mercadoPagoWebhookMaxEdadSegundos = parsearNumeroSeguro(process.env.MERCADOPAGO_WEBHOOK_MAX_EDAD_SEGUNDOS, 300, { min: 30, max: 3600 });
const mercadoPagoWebhookFirmaEstrica = ['1', 'true', 'yes'].includes(String(process.env.MERCADOPAGO_WEBHOOK_FIRMA_ESTRICTA ?? 'true').toLowerCase());
const cobranzaMontoToleranciaPct = parsearNumeroSeguro(process.env.COBRANZA_MONTO_TOLERANCIA_PCT, 0.03, { min: 0, max: 0.2 });
const cobranzaMontoToleranciaAbs = parsearNumeroSeguro(process.env.COBRANZA_MONTO_TOLERANCIA_ABS, 1, { min: 0, max: 1000 });
const licenciaJwtSecreto = String(process.env.LICENCIA_JWT_SECRETO ?? jwtSecretoEfectivo).trim();
const licenciaJwtKidActivo = String(process.env.LICENCIA_JWT_KID_ACTIVO ?? '').trim();
const licenciaJwtLlavePrivadaPem = String(process.env.LICENCIA_JWT_LLAVE_PRIVADA_PEM ?? '').trim().replace(/\\n/g, '\n');
const licenciaJwtLlavePublicaPem = String(process.env.LICENCIA_JWT_LLAVE_PUBLICA_PEM ?? '').trim().replace(/\\n/g, '\n');
const licenciaJwtPermitirLegacyHs256 = ['1', 'true', 'yes'].includes(String(process.env.LICENCIA_JWT_PERMITIR_LEGACY_HS256 ?? 'true').toLowerCase());
const licenciaJwtLlavesPublicas: Record<string, string> = (() => {
  const base: Record<string, string> = {};
  if (licenciaJwtKidActivo && licenciaJwtLlavePublicaPem) {
    base[licenciaJwtKidActivo] = licenciaJwtLlavePublicaPem;
  }
  const raw = String(process.env.LICENCIA_JWT_LLAVES_PUBLICAS_JSON ?? '').trim();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [kid, key] of Object.entries(parsed || {})) {
      if (!kid || !key) continue;
      base[String(kid).trim()] = String(key).replace(/\\n/g, '\n').trim();
    }
  } catch {
    // Mantener fallback seguro sin romper arranque.
  }
  return base;
})();
const licenciaJwtAlgoritmo = licenciaJwtKidActivo && licenciaJwtLlavePrivadaPem ? 'RS256' : 'HS256';
const licenciaHeartbeatHoras = parsearNumeroSeguro(process.env.LICENCIA_HEARTBEAT_HORAS, 12, { min: 1, max: 168 });
const licenciaGraciaOfflineDias = parsearNumeroSeguro(process.env.LICENCIA_GRACIA_OFFLINE_DIAS, 7, { min: 1, max: 30 });
const cobranzaAutomaticaIntervalMin = parsearNumeroSeguro(process.env.COBRANZA_AUTOMATICA_INTERVAL_MIN, 30, { min: 5, max: 1440 });
const cobranzaDiasSuspensionParcial = parsearNumeroSeguro(process.env.COBRANZA_DIAS_SUSPENSION_PARCIAL, 3, { min: 1, max: 60 });
const cobranzaDiasSuspensionTotal = parsearNumeroSeguro(process.env.COBRANZA_DIAS_SUSPENSION_TOTAL, 10, { min: 2, max: 120 });
const notificacionesWebhookUrl = String(process.env.NOTIFICACIONES_WEBHOOK_URL ?? '').trim();
const notificacionesWebhookToken = String(process.env.NOTIFICACIONES_WEBHOOK_TOKEN ?? '').trim();
const correoModuloActivo = (() => {
  const raw = String(process.env.CORREO_MODULO_ACTIVO ?? '').trim().toLowerCase();
  if (!raw) return Boolean(notificacionesWebhookUrl);
  return ['1', 'true', 'yes', 'on'].includes(raw);
})();
const passwordResetEnabled = (() => {
  const raw = String(process.env.PASSWORD_RESET_ENABLED ?? '').trim().toLowerCase();
  if (raw) return ['1', 'true', 'yes', 'on'].includes(raw);
  if (entorno === 'production') return Boolean(correoModuloActivo && passwordResetUrlBase);
  return true;
})();
if (correoModuloActivo && (!notificacionesWebhookUrl || !notificacionesWebhookToken)) {
  throw new Error('CORREO_MODULO_ACTIVO=1 requiere NOTIFICACIONES_WEBHOOK_URL y NOTIFICACIONES_WEBHOOK_TOKEN');
}

export const configuracion = {
  puerto,
  mongoUri,
  entorno,
  limiteJson,
  corsOrigenes,
  dominiosCorreoPermitidos,
  jwtSecreto: jwtSecretoEfectivo,
  omrQrHmacSecret,
  omrQrHmacKeyId,
  omrQrHmacSecrets,
  omrRecoveryKeyId,
  omrRecoverySecret,
  omrRecoverySecrets,
  jwtExpiraHoras,
  refreshTokenDias,
  passwordResetTokenMinutes,
  passwordResetUrlBase,
  passwordResetEnabled,
  googleOauthClientId,
  googleClassroomClientId,
  googleClassroomClientSecret,
  googleClassroomRedirectUri,
  classroomTokenCipherKey,
  requireGoogleOAuth,
  codigoAccesoHoras,
  portalAlumnoUrl,
  portalApiKey,
  rateLimitWindowMs,
  rateLimitLimit,
  rateLimitCredencialesLimit,
  rateLimitRefrescoLimit,
  omrImagenBase64MaxChars,
  complianceMode,
  dataRetentionDefaultDays,
  dataPurgeCron,
  auditLogImmutable,
  dpoContactEmail,
  legalNoticeVersion,
  superadminGoogleEmails,
  mercadoPagoAccessToken,
  mercadoPagoWebhookSecret,
  mercadoPagoWebhookMaxEdadSegundos,
  mercadoPagoWebhookFirmaEstrica,
  cobranzaMontoToleranciaPct,
  cobranzaMontoToleranciaAbs,
  licenciaJwtSecreto,
  licenciaJwtAlgoritmo,
  licenciaJwtKidActivo,
  licenciaJwtLlavePrivadaPem,
  licenciaJwtLlavesPublicas,
  licenciaJwtPermitirLegacyHs256,
  licenciaHeartbeatHoras,
  licenciaGraciaOfflineDias,
  cobranzaAutomaticaIntervalMin,
  cobranzaDiasSuspensionParcial,
  cobranzaDiasSuspensionTotal,
  notificacionesWebhookUrl,
  notificacionesWebhookToken,
  correoModuloActivo
};
