import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GestionApiLocal } from '../src/apps/app_docente/GestionApiLocal';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: { obtener: vi.fn(), enviar: vi.fn() }
}));

describe('GestionApiLocal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockResolvedValue({ credenciales: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
  });

  it('muestra permisos solicitados y permite conceder un subconjunto explícito', async () => {
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({
      solicitudId: 'sol-1', nombreCliente: 'EvaluaPro CLI', permisosSolicitados: ['banco:leer', 'banco:gestionar'],
      permisosDisponibles: ['banco:leer', 'banco:gestionar'], expiraEn: new Date(Date.now() + 60_000).toISOString()
    });
    render(<GestionApiLocal />);
    fireEvent.change(screen.getByLabelText('Código de autorización'), { target: { value: 'ABCDEFG2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar solicitud' }));
    expect(await screen.findByText('EvaluaPro CLI')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('banco:gestionar'));
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar permisos seleccionados' }));
    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/api-clientes/solicitudes/resolver', {
      codigo: 'ABCDEFG2', permitir: true, permisos: ['banco:leer']
    }));
    expect(clienteApi.obtener).toHaveBeenCalledWith('/autenticacion/api-clientes/credenciales');
  });
});
