import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeccionAutenticacion } from '../src/apps/app_docente/SeccionAutenticacion';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';

describe('login docente OAuth Desktop', () => {
  afterEach(() => {
    delete (window as Window & { chrome?: unknown }).chrome;
    vi.restoreAllMocks();
  });

  it('permite obtener la credencial por Desktop aunque GIS web no esté configurado', async () => {
    const popup = {
      location: { replace: vi.fn() },
      closed: false,
      close: vi.fn()
    } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    const onIngresar = vi.fn();
    const enviar = vi.spyOn(clienteApi, 'enviar').mockImplementation(async (ruta: string) => {
      if (ruta.endsWith('/google-desktop/iniciar')) return { flowId: 'f'.repeat(43), url: 'https://accounts.google.com/mock' } as never;
      if (ruta.endsWith('/google-desktop/resultado')) return { estado: 'listo', credential: 'desktop-verified-id-token' } as never;
      if (ruta.endsWith('/google-desktop/confirmar')) return { confirmado: true } as never;
      if (ruta.endsWith('/autenticacion/google')) return { token: 'docente-session-token' } as never;
      return { cancelado: true } as never;
    });

    render(
      <SeccionAutenticacion
        onIngresar={onIngresar}
        oauthGoogleDisponible={false}
        oauthGoogleBackendDisponible={false}
        oauthGoogleDesktopDisponible
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /acceder con google/i }));

    await waitFor(() => expect(onIngresar).toHaveBeenCalledWith('docente-session-token', true, expect.any(String)), { timeout: 5000 });
    expect(popup.location.replace).toHaveBeenCalledWith('https://accounts.google.com/mock');
    expect(enviar).toHaveBeenCalledWith('/autenticacion/google-desktop/confirmar', { flowId: 'f'.repeat(43) });
  });

  it('solicita al host nativo abrir OAuth en el navegador del sistema', async () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'chrome', { configurable: true, value: { webview: { postMessage } } });
    vi.spyOn(window, 'open').mockReturnValue(null);
    const onIngresar = vi.fn();
    vi.spyOn(clienteApi, 'enviar').mockImplementation(async (ruta: string) => {
      if (ruta.endsWith('/google-desktop/iniciar')) return { flowId: 'g'.repeat(43), url: 'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic' } as never;
      if (ruta.endsWith('/google-desktop/resultado')) return { estado: 'listo', credential: 'desktop-verified-id-token' } as never;
      if (ruta.endsWith('/autenticacion/google')) return { token: 'docente-session-token' } as never;
      return { confirmado: true } as never;
    });

    render(
      <SeccionAutenticacion
        onIngresar={onIngresar}
        oauthGoogleDisponible={false}
        oauthGoogleDesktopDisponible
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /acceder con google/i }));

    await waitFor(() => expect(postMessage).toHaveBeenCalledWith({
      type: 'EVALUAPRO_OPEN_EXTERNAL_URL',
      url: 'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic'
    }), { timeout: 5000 });
    expect(window.open).not.toHaveBeenCalled();
    await waitFor(() => expect(onIngresar).toHaveBeenCalledWith('docente-session-token', true, expect.any(String)), { timeout: 5000 });
  });

  it('permite cancelar la espera y libera el flujo', async () => {
    vi.spyOn(window, 'open').mockReturnValue({ close: vi.fn(), closed: false, location: { replace: vi.fn() } } as unknown as Window);
    const enviar = vi.spyOn(clienteApi, 'enviar').mockImplementation(async (ruta: string) => {
      if (ruta.endsWith('/google-desktop/iniciar')) return { flowId: 'c'.repeat(43), url: 'https://accounts.google.com/mock' } as never;
      if (ruta.endsWith('/google-desktop/resultado')) return { estado: 'pendiente' } as never;
      return { cancelado: true } as never;
    });
    render(<SeccionAutenticacion onIngresar={() => {}} oauthGoogleDisponible={false} oauthGoogleDesktopDisponible />);

    fireEvent.click(screen.getByRole('button', { name: /acceder con google/i }));
    await screen.findByRole('button', { name: 'Cancelar' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.getByText('Acceso con Google cancelado.', { exact: true })).toBeInTheDocument(), { timeout: 5000 });
    await waitFor(() => expect(enviar).toHaveBeenCalledWith('/autenticacion/google-desktop/cancelar', { flowId: 'c'.repeat(43) }));
  });
});
