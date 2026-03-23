/**
 * appAdminNegocio.navigation.test
 *
 * Cubre etiquetas de navegación y acciones de recarga del panel comercial
 * para sostener el diff coverage del shell principal.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppAdminNegocio } from '../src/apps/app_admin_negocio/AppAdminNegocio';
import { TemaProvider } from '../src/tema/TemaProvider';

function respuestaJson(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    headers: new Headers()
  } as Response;
}

describe('AppAdminNegocio navigation', () => {
  beforeEach(() => {
    localStorage.setItem('tokenDocente', 'token-comercial');
    (globalThis as typeof globalThis & { __TEST_DOCENTE__?: Record<string, unknown> }).__TEST_DOCENTE__ = {
      permisos: ['comercial:metricas:leer', 'comercial:tenants:leer']
    };

    vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/autenticacion/perfil')) {
        return respuestaJson({
          docente: {
            id: '1',
            nombreCompleto: 'Comercial Test',
            correo: 'comercial@test.dev',
            permisos: ['comercial:metricas:leer', 'comercial:tenants:leer']
          }
        });
      }
      if (url.includes('/autenticacion/capacidades-integraciones')) {
        return respuestaJson({ capacidadesIntegraciones: { smtpBackend: true } });
      }
      if (url.includes('/admin-negocio/dashboard/resumen')) {
        return respuestaJson({
          resumen: {
            totalTenants: 8,
            suscripcionesActivas: 5,
            suscripcionesPastDue: 2,
            mrrMxn: 12000,
            cobranzaPendienteMxn: 3400,
            conversionTrial: 0.5,
            churnMensual: 0.04,
            margenBrutoMinimo: 0.62
          }
        });
      }
      if (url.includes('/admin-negocio/tenants')) {
        return respuestaJson({ tenants: [] });
      }
      return respuestaJson({});
    });
  });

  it('expone etiquetas de vista y permite recargar la vista activa', async () => {
    const user = userEvent.setup();

    render(
      <TemaProvider>
        <AppAdminNegocio />
      </TemaProvider>
    );

    expect(await screen.findByText(/Panel de Negocio EvaluaPro/i)).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: /Vistas del panel de negocio/i });
    expect(screen.getByText(/Control Maestro Superadmin/i)).toBeInTheDocument();
    expect(within(nav).getByText(/Vista ejecutiva/i)).toBeInTheDocument();
    expect(within(nav).getByText(/Pricing/i)).toBeInTheDocument();
    expect(within(nav).getByText(/Recuperación/i)).toBeInTheDocument();
    expect(within(nav).getByText(/Evidencia/i)).toBeInTheDocument();
    await user.click(within(nav).getByRole('button', { name: /Tenants\s*Operación base/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Recargar\s*Sincroniza esta vista/i })).toBeInTheDocument();
    });

    const llamadasTenantsAntes = vi
      .mocked(global.fetch)
      .mock.calls.filter(([input]) => String(input).includes('/admin-negocio/tenants')).length;

    await user.click(screen.getByRole('button', { name: /Recargar\s*Sincroniza esta vista/i }));

    await waitFor(() => {
      const llamadasTenantsDespues = vi
        .mocked(global.fetch)
        .mock.calls.filter(([input]) => String(input).includes('/admin-negocio/tenants')).length;
      expect(llamadasTenantsDespues).toBeGreaterThan(llamadasTenantsAntes);
    });
  });
});
