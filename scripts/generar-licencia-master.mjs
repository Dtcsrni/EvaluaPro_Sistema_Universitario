#!/usr/bin/env node
/**
 * generar-licencia-master
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * generar-licencia-master
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * scripts/generar-licencia-master.mjs
 *
 * Utilidad para el Creador / Superadministrador de EvaluaPro para emitir
 * una licencia administrativa con máximas ventajas, vigencia extendida
 * y privilegios totales.
 */

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const args = process.argv.slice(2);
const tenantId = args[0] || 'docente-local';
const aniosVigencia = Number(args[1] || 10);

const jwtSecreto = process.env.LICENCIA_JWT_SECRETO || process.env.JWT_SECRETO || 'evaluapro-jwt-secreto-cambiar-en-produccion-min-32-chars';
const licenciaId = crypto.randomUUID();
const codigoActivacion = `EVAL-MASTER-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
const diasVigencia = aniosVigencia * 365;

const payload = {
  licenciaId,
  tenantId,
  tipo: 'onprem',
  canalRelease: 'stable',
  tier: 'institucional_multisede',
  rol: 'superadmin_master',
  capacidades: [
    'banco_preguntas_ilimitado',
    'omr_high_throughput',
    'sincronizacion_multisede',
    'firmas_digitales_avanzadas',
    'classroom_enterprise_sso',
    'compliance_retencion_extendida',
    'soporte_sla_master'
  ]
};

const tokenLicencia = jwt.sign(payload, jwtSecreto, {
  algorithm: 'HS256',
  issuer: 'evaluapro.licencias',
  audience: 'evaluapro.instalador',
  jwtid: crypto.randomUUID(),
  expiresIn: `${diasVigencia}d`
});

console.log('=====================================================');
console.log('       EVALUAPRO - LICENCIA ADMINISTRATIVA MASTER    ');
console.log('=====================================================');
console.log(` Tenant ID:           ${tenantId}`);
console.log(` Nivel / Tier:        Institucional Multisede (Máximo)`);
console.log(` Vigencia:            ${aniosVigencia} años (${diasVigencia} días)`);
console.log(` Código Activación:   ${codigoActivacion}`);
console.log('-----------------------------------------------------');
console.log(' Token JWT Criptográfico:');
console.log(tokenLicencia);
console.log('=====================================================');
console.log('Listo. Puedes ingresar este código de activación en la pantalla de bienvenida o en tu perfil docente.');
