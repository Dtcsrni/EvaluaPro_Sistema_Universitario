/**
 * autenticacionServicios.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas de servicios de autenticacion.
import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { crearHash, compararContrasena } from '../src/modulos/modulo_autenticacion/servicioHash.js';
import { crearTokenDocente, verificarTokenDocente } from '../src/modulos/modulo_autenticacion/servicioTokens.js';
import {
  crearSolicitudApiLocal,
  inspeccionarSolicitudApiLocal,
  intercambiarSolicitudApiLocal,
  resolverSolicitudApiLocal
} from '../src/modulos/modulo_autenticacion/servicioApiDelegado.js';

describe('servicioHash', () => {
  it('genera hash y valida contrasenas', async () => {
    const hash = await crearHash('Secreto123!');

    expect(hash).not.toBe('Secreto123!');
    await expect(compararContrasena('Secreto123!', hash)).resolves.toBe(true);
    await expect(compararContrasena('OtroSecreto', hash)).resolves.toBe(false);
  });
});

describe('servicioTokens', () => {
  it('crea y verifica tokens de docente', () => {
    const token = crearTokenDocente({ docenteId: 'docente-test' });
    const payload = verificarTokenDocente(token);

    expect(payload.docenteId).toBe('docente-test');
  });
});

describe('servicioApiDelegado', () => {
  it('requiere consentimiento, concede solo scopes disponibles y consume el intercambio una vez', () => {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const solicitud = crearSolicitudApiLocal({
      codeChallenge,
      nombreCliente: 'EvaluaPro API local',
      permisos: ['banco:leer', 'temarios:leer']
    });
    const disponible = new Set(['banco:leer', 'temarios:leer', 'cuenta:actualizar']);

    const inspeccion = inspeccionarSolicitudApiLocal(solicitud.codigo, disponible);
    expect(inspeccion).toMatchObject({ nombreCliente: 'EvaluaPro API local', permisosDisponibles: ['banco:leer', 'temarios:leer'] });
    expect(inspeccion).not.toHaveProperty('refreshToken');

    expect(resolverSolicitudApiLocal({
      solicitudId: solicitud.solicitudId,
      codigo: solicitud.codigo,
      permitir: true,
      docenteId: 'docente-1',
      permisosConcedidos: ['banco:leer'],
      permisosDisponibles: disponible,
      credencialId: 'credencial-1',
      refreshToken: 'epr_refresh-secret'
    })).toMatchObject({ estado: 'aprobada', permisos: ['banco:leer'] });

    expect(intercambiarSolicitudApiLocal({ solicitudId: solicitud.solicitudId, codeVerifier: verifier })).toEqual({
      estado: 'aprobada', refreshToken: 'epr_refresh-secret', credencialId: 'credencial-1'
    });
    expect(intercambiarSolicitudApiLocal({ solicitudId: solicitud.solicitudId, codeVerifier: verifier })).toEqual({
      estado: 'aprobada', refreshToken: 'epr_refresh-secret', credencialId: 'credencial-1'
    });
  });

  it('rechaza permisos no solicitados y expiración del código de verificación', () => {
    const now = Date.now();
    const verifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const solicitud = crearSolicitudApiLocal({ codeChallenge, nombreCliente: 'EvaluaPro CLI', permisos: ['banco:leer'] }, now);
    const inspeccion = inspeccionarSolicitudApiLocal(solicitud.codigo, new Set(['banco:leer']), now);
    expect(inspeccion?.permisosDisponibles).toEqual(['banco:leer']);
    expect(() => resolverSolicitudApiLocal({
      solicitudId: solicitud.solicitudId,
      codigo: solicitud.codigo,
      permitir: true,
      docenteId: 'docente-1',
      permisosConcedidos: ['temarios:leer'],
      permisosDisponibles: new Set(['temarios:leer']),
      credencialId: 'credencial-2',
      refreshToken: 'epr_other-secret'
    }, now)).toThrow('Solo puedes conceder permisos solicitados');
    expect(inspeccionarSolicitudApiLocal(solicitud.codigo, new Set(['banco:leer']), now + 6 * 60 * 1000)).toBeNull();
  });
});
