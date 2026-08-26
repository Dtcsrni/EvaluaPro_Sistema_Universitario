/**
 * versionInfoPage.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VersionInfoPage } from '../src/ui/version/VersionInfoPage';

describe('VersionInfoPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('renderiza repo del desarrollador y tecnologías', async () => {
    vi.stubEnv('VITE_APP_DISPLAY_VERSION', '1.0.0b');
    vi.stubEnv('VITE_APP_VERSION', '1.0.0');

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        app: { name: 'evaluapro', version: '1.0.0', displayVersion: '1.0.0b' },
        repositoryUrl: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario',
        technologies: [
          { id: 'react', label: 'React', website: 'https://react.dev' },
          { id: 'typescript', label: 'TypeScript', website: 'https://www.typescriptlang.org' }
        ],
        developer: { nombre: 'I.S.C. Erick Renato Vega Ceron', rol: 'Desarrollo' },
        system: { node: 'v24.0.0', generatedAt: new Date().toISOString() },
        changelog: '# Changelog'
      })
    } as Response);

    render(<VersionInfoPage />);

    await waitFor(() => {
      expect(screen.getByText('Repositorio del desarrollador')).toBeInTheDocument();
    });

    const repo = screen.getByRole('link', { name: 'Repositorio del desarrollador' });
    expect(repo).toHaveAttribute('href', 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario');
    expect(screen.getByText(/evaluapro v1\.0\.0b/i)).toBeInTheDocument();
    expect(screen.getByText(/Base técnica: 1\.0\.0/i)).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });
});
