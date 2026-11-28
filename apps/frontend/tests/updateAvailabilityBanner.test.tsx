import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpdateAvailabilityBanner } from '../src/ui/version/UpdateAvailabilityBanner';
import { obtenerVersionTecnicaHub } from '../src/ui/version/versionInfo';

const installer = 'EvaluaPro-InstallerHub-docente-local-v9.9.9.exe';
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
  it('muestra release estable compatible y abre la pantalla local del Hub', async () => {
    mockRelease(stableRelease);
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    render(<UpdateAvailabilityBanner />);

    const button = await screen.findByRole('button', { name: 'Actualizar Hub a v9.9.9' });
    expect(screen.getByRole('status')).toHaveTextContent('v9.9.9');
    fireEvent.click(button);
    expect(open).toHaveBeenCalledWith('http://127.0.0.1:4519/update?run=1', '_blank', 'noopener,noreferrer');
  });

  it('abre el panel local del supervisor cuando la app corre en navegador', async () => {
    mockRelease(stableRelease);
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    render(<UpdateAvailabilityBanner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Actualizar Hub a v9.9.9' }));
    expect(open).toHaveBeenCalledWith('http://127.0.0.1:4519/update?run=1', '_blank', 'noopener,noreferrer');
  });

  it('reconoce el tag hub-v usado por la release estable del Installer Hub', async () => {
    mockRelease({
      ...stableRelease,
      tag_name: 'hub-v9.9.9',
      html_url: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/tag/hub-v9.9.9'
    });

    render(<UpdateAvailabilityBanner />);
    expect(await screen.findByRole('button', { name: 'Actualizar Hub a v9.9.9' })).toBeInTheDocument();
  });

  it('oculta una release Hub igual a la versión instalada aunque la app tenga otro número', async () => {
    const versionHub = obtenerVersionTecnicaHub();
    const installerActual = `EvaluaPro-InstallerHub-docente-local-v${versionHub}.exe`;
    mockRelease({
      ...stableRelease,
      tag_name: `hub-v${versionHub}`,
      html_url: `https://github.com/${'Dtcsrni'}/EvaluaPro_Sistema_Universitario/releases/tag/hub-v${versionHub}`,
      assets: [{ name: installerActual }, { name: `${installerActual}.sha256` }]
    });

    render(<UpdateAvailabilityBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    ['beta', { ...stableRelease, prerelease: true }],
    ['tag no semver estable', { ...stableRelease, tag_name: 'v9.9.9-beta.1' }],
    ['versión anterior', { ...stableRelease, tag_name: 'v1.0.0' }],
    ['sin instalador', { ...stableRelease, assets: [{ name: `${installer}.sha256` }] }],
    ['asset heredado sin versión', { ...stableRelease, assets: [{ name: 'EvaluaPro-InstallerHub-docente-local.exe' }, { name: 'EvaluaPro-InstallerHub-docente-local.exe.sha256' }] }],
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
    fireEvent.click(await screen.findByRole('button', { name: 'Posponer el aviso del Installer Hub v9.9.9' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('no bloquea ni muestra errores cuando GitHub no está disponible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<UpdateAvailabilityBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
