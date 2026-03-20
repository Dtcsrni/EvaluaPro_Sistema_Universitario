/**
 * versionInfoPage.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VersionInfoPage } from '../src/ui/version/VersionInfoPage';

describe('VersionInfoPage', () => {
  it('renderiza repo del desarrollador y tecnologías', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        app: { name: 'evaluapro', version: '1.0.0', displayVersion: '1.0.0b' },
        repositoryUrl: 'https://github.com/Dtcsrni',
        technologies: [
          { id: 'react', label: 'React', logoUrl: 'https://cdn.simpleicons.org/react/61DAFB', website: 'https://react.dev' },
          { id: 'typescript', label: 'TypeScript', logoUrl: 'https://cdn.simpleicons.org/typescript/3178C6', website: 'https://www.typescriptlang.org' }
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
    expect(repo).toHaveAttribute('href', 'https://github.com/Dtcsrni');
    expect(screen.getByText(/evaluapro v1\.0\.0b/i)).toBeInTheDocument();
    expect(screen.getByText(/Base técnica: 1\.0\.0/i)).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByAltText('React logo')).toBeInTheDocument();
    expect(screen.getByAltText('TypeScript logo')).toBeInTheDocument();
  });
});
