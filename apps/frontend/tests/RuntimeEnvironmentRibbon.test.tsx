import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeEnvironmentRibbon } from '../src/ui/version/RuntimeEnvironmentRibbon';

describe('RuntimeEnvironmentRibbon', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('muestra entorno y versión en desarrollo', () => {
    vi.stubEnv('VITE_EVALUAPRO_MODE', 'dev');
    vi.stubEnv('VITE_APP_VERSION', '1.2.8');
    render(<RuntimeEnvironmentRibbon />);
    expect(screen.getByRole('status', { name: /DESARROLLO, versión 1\.2\.8, datos aislados/i })).toBeInTheDocument();
  });

  it('identifica pruebas y se oculta en producción', () => {
    vi.stubEnv('VITE_EVALUAPRO_MODE', 'test');
    const { rerender } = render(<RuntimeEnvironmentRibbon />);
    expect(screen.getByText('PRUEBAS')).toBeInTheDocument();
    vi.stubEnv('VITE_EVALUAPRO_MODE', 'prod');
    rerender(<RuntimeEnvironmentRibbon />);
    expect(screen.queryByTestId('runtime-environment-ribbon')).not.toBeInTheDocument();
  });
});
