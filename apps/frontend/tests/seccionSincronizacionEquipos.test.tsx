/**
 * seccionSincronizacionEquipos.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionSincronizacionEquipos } from '../src/apps/app_docente/SeccionSincronizacionEquipos';
import { emitToast } from '../src/ui/toast/toastBus';
import type { RespuestaSyncPull, RespuestaSyncPush } from '../src/apps/app_docente/tipos';

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionSincronizacionEquipos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la interfaz de sincronización entre equipos con sus controles', () => {
    render(
      <SeccionSincronizacionEquipos
        onPushServidor={vi.fn()}
        onPullServidor={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Sincronización entre equipos/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Incluir PDFs en el envío/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar cambios \(push\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Traer cambios \(pull\)/i })).toBeInTheDocument();
  });

  it('permite enviar cambios (push) al servidor intermedio con PDFs opcionales', async () => {
    const mockPush = vi.fn().mockResolvedValue({
      ok: true,
      mensaje: 'Paquete de 15 registros enviado con éxito',
      cursor: '2026-08-20T12:00:00.000Z',
      conteos: { preguntas: 5, plantillas: 2, examenes: 8 }
    } as RespuestaSyncPush);

    render(
      <SeccionSincronizacionEquipos
        onPushServidor={mockPush}
        onPullServidor={vi.fn()}
      />
    );

    const checkboxPdfs = screen.getByRole('checkbox', { name: /Incluir PDFs en el envío/i });
    fireEvent.click(checkboxPdfs);

    const botonPush = screen.getByRole('button', { name: /Enviar cambios \(push\)/i });
    fireEvent.click(botonPush);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          incluirPdfs: true
        })
      );
    });

    expect(screen.getByText(/Paquete de 15 registros enviado con éxito/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Paquete de 15 registros enviado/i);
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('permite traer cambios (pull) y muestra el reporte de paquetes recibidos', async () => {
    const mockPull = vi.fn().mockResolvedValue({
      ok: true,
      mensaje: 'Sincronización completada',
      ultimoCursor: '2026-08-20T14:00:00.000Z',
      paquetesRecibidos: 3,
      pdfsGuardados: 6
    } as RespuestaSyncPull);

    render(
      <SeccionSincronizacionEquipos
        onPushServidor={vi.fn()}
        onPullServidor={mockPull}
      />
    );

    const inputLimite = screen.getByLabelText(/Máximo de paquetes por recibir/i);
    fireEvent.change(inputLimite, { target: { value: '50' } });
    expect(inputLimite).toHaveValue(20);
    expect(inputLimite).toHaveAttribute('max', '20');

    const botonPull = screen.getByRole('button', { name: /Traer cambios \(pull\)/i });
    fireEvent.click(botonPull);

    await waitFor(() => {
      expect(mockPull).toHaveBeenCalledWith(
        expect.objectContaining({
          limite: 20
        })
      );
    });

    expect(await screen.findByText(/Paquetes recibidos: 3 · PDFs guardados: 6/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Sincronización completada/i);
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('maneja y muestra errores en caso de fallo durante push o pull', async () => {
    const mockPush = vi.fn().mockRejectedValue(new Error('Servidor intermedio no responde'));

    render(
      <SeccionSincronizacionEquipos
        onPushServidor={mockPush}
        onPullServidor={vi.fn()}
      />
    );

    const botonPush = screen.getByRole('button', { name: /Enviar cambios \(push\)/i });
    fireEvent.click(botonPush);

    await waitFor(() => {
      expect(screen.getByText(/Servidor intermedio no responde/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/Servidor intermedio no responde/i);
    expect(emitToast).not.toHaveBeenCalled();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('reemplaza el reporte previo cuando falla la operación siguiente', async () => {
    const mockPush = vi.fn().mockResolvedValue({
      ok: true,
      mensaje: 'Paquete de 15 registros enviado con éxito',
      conteos: { preguntas: 15 }
    } as RespuestaSyncPush);
    const mockPull = vi.fn().mockRejectedValue(new Error('No se pudieron traer los cambios'));

    render(<SeccionSincronizacionEquipos onPushServidor={mockPush} onPullServidor={mockPull} />);

    fireEvent.click(screen.getByRole('button', { name: /Enviar cambios \(push\)/i }));
    expect(await screen.findByText(/Paquete de 15 registros enviado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Traer cambios \(pull\)/i }));

    expect(await screen.findByText(/No se pudieron traer los cambios/i)).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText(/preguntas: 15/i)).not.toBeInTheDocument();
  });

  it('impide ejecutar operaciones de envío y recepción al mismo tiempo', async () => {
    let resolver: ((respuesta: RespuestaSyncPush) => void) | undefined;
    const mockPush = vi.fn(() => new Promise<RespuestaSyncPush>((resolve) => { resolver = resolve; }));

    render(<SeccionSincronizacionEquipos onPushServidor={mockPush} onPullServidor={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Enviar cambios \(push\)/i }));
    expect(screen.getByRole('button', { name: /Traer cambios \(pull\)/i })).toBeDisabled();

    resolver?.({ ok: true, mensaje: 'Envío completado' } as RespuestaSyncPush);
    await waitFor(() => expect(screen.getByRole('button', { name: /Traer cambios \(pull\)/i })).toBeEnabled());
  });
});
