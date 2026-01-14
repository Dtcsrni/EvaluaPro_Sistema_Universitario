// Pruebas de servicios de autenticacion.
import { describe, expect, it } from 'vitest';
import { crearHash, compararContrasena } from '../src/modulos/modulo_autenticacion/servicioHash';
import { crearTokenDocente, verificarTokenDocente } from '../src/modulos/modulo_autenticacion/servicioTokens';

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
