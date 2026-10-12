import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpdateAvailabilityBanner } from '../src/ui/version/UpdateAvailabilityBanner';
import { obtenerVersionTecnicaApp } from '../src/ui/version/versionInfo';

const installer = 'EvaluaPro-InstallerHub-docente-local.exe';
const stableRelease = {
  tag_name: 'v9.9.9',
  draft: false,
  prerelease: false,
  html_url: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/tag/v9.9.9',
  assets: [{ name: installer }, { name: `${installer}.sha256` }]
};

function mockRelease(release: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => release }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as Window & { chrome?: unknown }).chrome;
  window.sessionStorage.clear();
});

describe('UpdateAvailabilityBanner', () => {
  it('muestra release estable compatible y lanza el flujo local del Hub', async () => {
    mockRelease(stableRelease);
    const postMessage = vi.fn();
    Object.defineProperty(window, 'chrome', { configurable: true, value: { webview: { postMessage } } });

    render(<UpdateAvailabilityBanner />);

    const button = await screen.findByRole('button', { name: 'Actualizar a v9.9.9' });
    expect(screen.getByRole('status')).toHaveTextContent('v9.9.9');
    fireEvent.click(button);
    expect(postMessage).toHaveBeenCalledWith({ type: 'EVALUAPRO_UPDATE_HUB', version: '9.9.9' });
  });

  it.each([
    ['beta', { ...stableRelease, prerelease: true }],
    ['tag no semver estable', { ...stableRelease, tag_name: 'v9.9.9-beta.1' }],
    ['versión igual', { ...stableRelease, tag_name: `v${obtenerVersionTecnicaApp()}` }],
    ['versión anterior', { ...stableRelease, tag_name: 'v1.0.0' }],
    ['sin instalador', { ...stableRelease, assets: [{ name: `${installer}.sha256` }] }],
    ['URL externa', { ...stableRelease, html_url: 'https://example.invalid/release' }]
  ])('oculta candidatos no publicables (%s)', async (_label, candidate) => {
    mockRelease(candidate);
    render(<UpdateAvailabilityBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('pospone el aviso para esta sesión', async () => {
    mockRelease(stableRelease);
    render(<UpdateAvailabilityBanner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Posponer el aviso de la versión 9.9.9' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('no bloquea ni muestra errores cuando GitHub no está disponible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<UpdateAvailabilityBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
