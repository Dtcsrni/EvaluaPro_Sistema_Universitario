/**
 * versionInfo.helpers.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VersionInfoPage } from '../src/ui/version/VersionInfoPage';
import {
  abrirVentanaVersion,
  obtenerVersionApp,
  obtenerVersionTecnicaApp
} from '../src/ui/version/versionInfo';

describe('version info helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('expone version visible y tecnica desde env y abre popup de version', () => {
    vi.stubEnv('VITE_APP_DISPLAY_VERSION', '1.0.0b');
    vi.stubEnv('VITE_APP_VERSION', '1.0.0');

    expect(obtenerVersionApp()).toBe('1.0.0b');
    expect(obtenerVersionTecnicaApp()).toBe('1.0.0');

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    abrirVentanaVersion('alumno');

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0]?.[0]).toContain('#/version-info?portal=alumno');
  });

  it('renderiza fallback tecnico, portal alumno y mensaje sin tecnologias cuando falta displayVersion', async () => {
    vi.stubEnv('VITE_APP_DISPLAY_VERSION', '');
    vi.stubEnv('VITE_APP_VERSION', '1.0.0');
    window.history.replaceState({}, '', '/#/version-info?portal=alumno');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        app: { name: 'evaluapro', version: '1.0.0' },
        technologies: [],
        repositoryUrl: '',
        system: { platform: 'win32', arch: 'x64', hostname: 'host', env: 'prod', generatedAt: '2026-03-20T00:00:00.000Z' },
        developer: { nombre: '', rol: '' },
        changelog: ''
      })
    }));

    render(<VersionInfoPage />);

    expect(await screen.findByText(/EvaluaPro · Portal Alumno/i)).toBeInTheDocument();
    expect(await screen.findByText(/evaluapro v1\.0\.0/i)).toBeInTheDocument();
    expect(screen.getByText(/Base técnica: 1\.0\.0/i)).toBeInTheDocument();
    expect(screen.getByText('Sin tecnologías registradas.')).toBeInTheDocument();
    expect(screen.getByText(/Plataforma:/i).closest('p')).toHaveTextContent('win32 / x64');
    expect(screen.getByText(/Nombre:/i).closest('p')).toHaveTextContent('Equipo EvaluaPro');
  });
});
