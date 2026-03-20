import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  CLAVE_TEMA_PREFERENCIA,
  aplicarTemaDocumento,
  leerPreferenciaTema,
  resolverTema,
  siguientePreferenciaTema
} from '../src/tema/tema';

describe('tema unificado', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('usa auto por defecto y mantiene ciclo auto/light/dark', () => {
    expect(leerPreferenciaTema()).toBe('auto');
    expect(siguientePreferenciaTema('dark')).toBe('auto');
    expect(siguientePreferenciaTema('auto')).toBe('light');
    expect(siguientePreferenciaTema('light')).toBe('dark');
  });

  it('resuelve auto contra el sistema y actualiza theme-color', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
    localStorage.setItem(CLAVE_TEMA_PREFERENCIA, 'auto');
    const result = aplicarTemaDocumento('auto');
    expect(resolverTema('auto', 'day')).toBe('dark');
    expect(result.tema).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBeTruthy();
  });
});
