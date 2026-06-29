/**
 * app.selector.test
 *
 * Cubre el selector de shell principal por destino y el wrapping opcional
 * de Google OAuth para evitar regresiones de cobertura difusa en App.tsx.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  googleProvider: vi.fn(({ clientId, children }: { clientId: string; children: React.ReactNode }) => (
    <div data-testid="google-provider" data-client-id={clientId}>
      {children}
    </div>
  ))
}));

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: mocks.googleProvider
}));

vi.mock('../src/apps/app_alumno/AppAlumno', () => ({
  AppAlumno: () => <div>App Alumno Mock</div>
}));

vi.mock('../src/apps/app_admin_negocio/AppAdminNegocio', () => ({
  AppAdminNegocio: () => <div>App Admin Negocio Mock</div>
}));

vi.mock('../src/apps/app_docente/AppDocente', () => ({
  AppDocente: () => <div>App Docente Mock</div>
}));

vi.mock('../src/ui/version/VersionInfoPage', () => ({
  VersionInfoPage: () => <div>Version Info Mock</div>
}));

vi.mock('../src/ui/ux/tooltip/TooltipLayer', () => ({
  TooltipLayer: () => <div data-testid="tooltip-layer">Tooltip Layer Mock</div>
}));

import App from '../src/App';

describe('App selector', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState({}, '', '/');
    document.title = '';
    document.head.innerHTML = '';
    mocks.googleProvider.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState({}, '', '/');
  });

  it('renderiza alumno sin Google OAuth y marca el destino en el shell', () => {
    vi.stubEnv('VITE_APP_DESTINO', 'alumno');
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-client-id');

    render(<App />);

    expect(screen.getByText('App Alumno Mock')).toBeInTheDocument();
    expect(screen.queryByTestId('google-provider')).not.toBeInTheDocument();
    expect(document.querySelector('main[data-app-destino="alumno"]')).toHaveClass('page', 'page--alumno');
    expect(screen.getByTestId('tooltip-layer')).toBeInTheDocument();
    expect(document.title).toBe('Portal Alumno - EvaluaPro');
  });

  it('envuelve admin negocio con Google OAuth cuando hay client id configurado', () => {
    vi.stubEnv('VITE_APP_DESTINO', 'admin_negocio');
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-client-id');

    render(<App />);

    expect(screen.getByText('App Admin Negocio Mock')).toBeInTheDocument();
    expect(screen.getByTestId('google-provider')).toHaveAttribute('data-client-id', 'google-client-id');
    expect(document.querySelector('main[data-app-destino="admin_negocio"]')).toHaveClass('page--admin_negocio');
    expect(document.title).toBe('Panel de Negocio - EvaluaPro');
  });

  it('muestra version info sin tooltip cuando la ruta hash apunta a esa vista', () => {
    vi.stubEnv('VITE_APP_DESTINO', 'docente');
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-client-id');
    window.history.replaceState({}, '', '/#/version-info');

    render(<App />);

    expect(screen.getByText('Version Info Mock')).toBeInTheDocument();
    expect(screen.queryByTestId('tooltip-layer')).not.toBeInTheDocument();
    expect(screen.getByTestId('google-provider')).toBeInTheDocument();
    expect(document.querySelector('main[data-app-destino="docente"]')).toHaveClass('page--docente');
  });
});
