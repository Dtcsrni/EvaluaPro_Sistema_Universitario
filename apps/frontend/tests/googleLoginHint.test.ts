import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CUENTA_INSTITUCIONAL_INICIAL,
  obtenerLoginHintGoogle,
  recordarLoginGoogleInstitucional
} from '../src/apps/app_docente/googleLoginHint';

describe('preferencia local de login Google institucional', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('sugiere la cuenta institucional inicial si aún no hay una guardada', () => {
    expect(obtenerLoginHintGoogle()).toBe(CUENTA_INSTITUCIONAL_INICIAL);
  });

  it('recuerda y reutiliza el último correo institucional', () => {
    expect(recordarLoginGoogleInstitucional(' docente@CUH.MX ')).toBe('docente@CUH.MX');
    expect(obtenerLoginHintGoogle()).toBe('docente@CUH.MX');
  });

  it('rechaza dominios personales y valores no textuales sin borrar la preferencia previa', () => {
    recordarLoginGoogleInstitucional('docente@cuh.mx');
    expect(recordarLoginGoogleInstitucional('evega12@gmail.com')).toBeNull();
    expect(recordarLoginGoogleInstitucional(null)).toBeNull();
    expect(obtenerLoginHintGoogle()).toBe('docente@cuh.mx');
  });

  it('tolera localStorage bloqueado y mantiene un valor inicial utilizable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

    expect(obtenerLoginHintGoogle()).toBe(CUENTA_INSTITUCIONAL_INICIAL);
    expect(recordarLoginGoogleInstitucional('docente@cuh.mx')).toBe('docente@cuh.mx');
  });
});
