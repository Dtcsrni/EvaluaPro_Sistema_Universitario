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
        changelog: '# Changelog\n\n## [1.0.0] - 2026-09-22\n\n### Added\n- Nuevo panel de novedades'
      })
    } as Response);

    render(<VersionInfoPage />);

    await waitFor(() => {
      expect(screen.getByText('Versión y novedades')).toBeInTheDocument();
    });

    const repo = screen.getByRole('link', { name: /Ver repositorio/i });
    expect(repo).toHaveAttribute('href', 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario');
    expect(screen.getByText('1.0.0b')).toBeInTheDocument();
    expect(screen.getByText(/Versión técnica 1\.0\.0/i)).toBeInTheDocument();
    expect(screen.getByText('React 19.2.4')).toBeInTheDocument();
    expect(screen.getByText('TypeScript 5.9.3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Licencias' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AGPL-3.0-or-later' })).toHaveAttribute(
      'href',
      'https://www.gnu.org/licenses/agpl.html'
    );
    expect(screen.getByText((_, element) => element?.tagName === 'P'
      && element.textContent?.includes('licencia ISC') === true)).toBeInTheDocument();
    expect(screen.getByText('Consultar el aviso completo de Lucide')).toBeInTheDocument();
    expect(screen.getByText(/THE SOFTWARE IS PROVIDED "AS IS"/)).toBeInTheDocument();
    expect(screen.getByText('Nuevo panel de novedades')).toBeInTheDocument();
  });
});
