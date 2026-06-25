/**
 * validacionesComercialCore
 *
 * Responsabilidad: Contrato de validaciones de entrada/salida del dominio.
 * Limites: No relajar reglas sin actualizar tests y contratos de API.
 */
import { z } from 'zod';

const moneda = z.string().trim().min(3).max(4).default('MXN');

export const esquemaCrearTenant = z
  .object({
    tenantId: z.string().trim().min(3).max(60),
    nombre: z.string().trim().min(3).max(200),
    tipoTenant: z.enum(['smb', 'enterprise', 'partner']).default('smb'),
    modalidad: z.enum(['saas', 'onprem']),
    estado: z.enum(['lead', 'trial', 'activo', 'past_due', 'suspendido', 'cancelado']).optional(),
    pais: z.string().trim().min(2).max(2).default('MX'),
    moneda,
    ownerDocenteId: z.string().trim().min(12),
    contacto: z
      .object({
        correo: z.string().trim().email().optional(),
        telefono: z.string().trim().min(7).max(30).optional(),
        nombre: z.string().trim().min(2).max(120).optional()
      })
      .optional(),
    configAislamiento: z
      .object({
        estrategia: z.enum(['shared', 'dedicated']).default('shared'),
        databaseUri: z.string().trim().min(1).optional(),
        databaseName: z.string().trim().min(1).optional()
      })
      .optional()
  })
  .strict();

export const esquemaActualizarTenant = esquemaCrearTenant
  .omit({ tenantId: true, ownerDocenteId: true })
  .partial()
  .strict();

export const esquemaCrearPlan = z
  .object({
    planId: z.string().trim().min(3).max(60),
    nombre: z.string().trim().min(3).max(200),
    lineaPersona: z.enum(['docente', 'coordinacion', 'institucional', 'socio_canal']),
    nivel: z.number().int().min(1).max(4),
    moneda,
    precioMensual: z.number().nonnegative(),
    precioAnual: z.number().nonnegative(),
    costoMensualEstimado: z.number().nonnegative(),
    margenObjetivoMinimo: z.number().min(0).max(0.99).default(0.6),
    limites: z
      .object({
        maxDocentes: z.number().int().nonnegative().optional(),
        maxAlumnos: z.number().int().nonnegative().optional(),
        maxSedes: z.number().int().nonnegative().optional(),
        maxIntegraciones: z.number().int().nonnegative().optional()
      })
      .optional(),
    slaHoras: z.number().int().positive().optional(),
    activo: z.boolean().optional()
  })
  .strict();

export const esquemaActualizarPlan = esquemaCrearPlan.omit({ planId: true }).partial().strict();

export const esquemaCambiarPlan = z
  .object({
    planId: z.string().trim().min(3),
    ciclo: z.enum(['mensual', 'anual']),
    fechaRenovacion: z.coerce.date().optional(),
    pasarela: z.enum(['mercadopago', 'manual']).optional()
  })
  .strict();

export const esquemaCrearSuscripcion = z
  .object({
    tenantId: z.string().trim().min(3),
    planId: z.string().trim().min(3),
    ciclo: z.enum(['mensual', 'anual']),
    estado: z.enum(['trial', 'activo', 'past_due', 'suspendido', 'cancelado']).default('trial'),
    activarTrial35Dias: z.boolean().default(true),
    pasarela: z.enum(['mercadopago', 'manual']).default('manual'),
    fechaRenovacion: z.coerce.date().optional()
  })
  .strict();

export const esquemaActualizarEstadoSuscripcion = z
  .object({
    estado: z.enum(['trial', 'activo', 'past_due', 'suspendido', 'cancelado']),
    motivo: z.string().trim().min(3).max(300).optional()
  })
  .strict();

export const esquemaAplicarCupon = z
  .object({
    codigo: z.string().trim().min(3).max(64)
  })
  .strict();

export const esquemaCrearCupon = z
  .object({
    codigo: z.string().trim().min(3).max(64),
    tipoDescuento: z.enum(['porcentaje', 'monto_fijo']),
    valorDescuento: z.number().positive(),
    moneda,
    vigenciaInicio: z.coerce.date(),
    vigenciaFin: z.coerce.date(),
    usoMaximo: z.number().int().positive().default(1),
    restricciones: z
      .object({
        planesPermitidos: z.array(z.string().trim().min(2)).optional(),
        personasPermitidas: z.array(z.string().trim().min(2)).optional(),
        nuevosClientesSolo: z.boolean().optional()
      })
      .optional(),
    activo: z.boolean().optional()
  })
  .strict();

export const esquemaActualizarCupon = esquemaCrearCupon.partial().strict();

export const esquemaCrearCampana = z
  .object({
    nombre: z.string().trim().min(3).max(200),
    segmento: z
      .object({
        lineaPersona: z.enum(['docente', 'coordinacion', 'institucional', 'socio_canal']).optional(),
        paises: z.array(z.string().trim().min(2).max(2)).optional(),
        estadoEmbudo: z.enum(['lead', 'trial', 'past_due', 'activo']).optional()
      })
      .optional(),
    oferta: z
      .object({
        planObjetivo: z.string().trim().min(2).optional(),
        cuponCodigo: z.string().trim().min(2).optional(),
        mensaje: z.string().trim().min(3).max(500).optional()
      })
      .optional(),
    canal: z.enum(['email', 'whatsapp', 'llamada', 'in_app']),
    presupuestoMxn: z.number().nonnegative().default(0),
    fechaInicio: z.coerce.date(),
    fechaFin: z.coerce.date(),
    estado: z.enum(['borrador', 'activa', 'pausada', 'cerrada']).optional(),
    kpiObjetivo: z
      .object({
        cplMax: z.number().nonnegative().optional(),
        conversionMin: z.number().min(0).max(1).optional(),
        paybackMesesMax: z.number().nonnegative().optional()
      })
      .optional()
  })
  .strict();

export const esquemaActualizarCampana = esquemaCrearCampana.partial().strict();

export const esquemaGenerarLicencia = z
  .object({
    tenantId: z.string().trim().min(3),
    tipo: z.enum(['saas', 'onprem']),
    expiraEn: z.coerce.date(),
    canalRelease: z.enum(['stable', 'beta']).default('stable')
  })
  .strict();

export const esquemaActivarLicencia = z
  .object({
    tenantId: z.string().trim().min(3),
    codigoActivacion: z.string().trim().min(10),
    huella: z.string().trim().min(8),
    host: z.string().trim().min(2),
    versionInstalada: z.string().trim().min(1).optional()
  })
  .strict();

export const esquemaHeartbeatLicencia = z
  .object({
    tokenLicencia: z.string().trim().min(10),
    tenantId: z.string().trim().min(3),
    huella: z.string().trim().min(8),
    host: z.string().trim().min(2),
    versionInstalada: z.string().trim().min(1).optional(),
    nonce: z.string().trim().min(8).max(180),
    contador: z.number().int().nonnegative()
  })
  .strict();

export const esquemaReasignarLicenciaDispositivo = z
  .object({
    huella: z.string().trim().min(8),
    host: z.string().trim().min(2),
    versionInstalada: z.string().trim().min(1).optional(),
    motivo: z.string().trim().min(5).max(300)
  })
  .strict();

export const esquemaRevocarLicencia = z
  .object({})
  .strict();

export const esquemaConsentimientoComercial = z
  .object({
    tenantId: z.string().trim().min(3),
    canal: z.enum(['web', 'contrato', 'api']).default('web'),
    finalidades: z
      .object({
        producto: z.boolean(),
        ventas: z.boolean(),
        marketing: z.boolean()
      })
      .strict(),
    versionAviso: z.string().trim().min(1),
    optOut: z
      .object({
        ventas: z.boolean().optional(),
        marketing: z.boolean().optional()
      })
      .optional()
  })
  .strict();

export const esquemaCrearPreferenciaMercadoPago = z
  .object({
    suscripcionId: z.string().trim().min(12),
    titulo: z.string().trim().min(3).max(180).optional(),
    monto: z.number().positive().optional(),
    moneda: z.string().trim().min(3).max(4).optional(),
    correoComprador: z.string().trim().email().optional(),
    referenciaExterna: z.string().trim().min(3).max(200).optional()
  })
  .strict();

export const esquemaEjecutarCicloCobranza = z
  .object({})
  .strict();

export const esquemaWebhookMercadoPago = z.record(z.string(), z.unknown());

export const esquemaCrearPlantillaNotificacion = z
  .object({
    clave: z.string().trim().min(3).max(120),
    evento: z.enum(['cobranza_recordatorio', 'cobranza_suspension_parcial', 'cobranza_suspension_total']),
    canal: z.enum(['email', 'whatsapp', 'crm']),
    idioma: z.string().trim().min(2).max(12).default('es-MX'),
    asunto: z.string().trim().min(3).max(200),
    contenido: z.string().trim().min(3).max(5000),
    activo: z.boolean().optional(),
    variables: z.array(z.string().trim().min(1).max(80)).optional()
  })
  .strict();

export const esquemaActualizarPlantillaNotificacion = esquemaCrearPlantillaNotificacion
  .omit({ clave: true })
  .partial()
  .strict();
