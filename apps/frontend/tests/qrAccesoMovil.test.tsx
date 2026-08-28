/**
 * qrAccesoMovil.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QrAccesoMovil } from '../src/apps/app_docente/QrAccesoMovil';

describe('QrAccesoMovil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ips: ['192.168.1.105'], preferida: '192.168.1.105' })
    });
  });

  it('renderiza el panel de QR móvil con IP detectada', async () => {
    render(<QrAccesoMovil vista="calificaciones" />);

    expect(screen.getByText(/QR movil/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByAltText(/QR para abrir en movil/i)).toBeInTheDocument();
    });
  });

  it('permite ingresar un host manual y lo guarda en localStorage', async () => {
    render(<QrAccesoMovil vista="entrega" />);

    await waitFor(() => {
      expect(screen.getByAltText(/QR para abrir en movil/i)).toBeInTheDocument();
    });

    // Forzar fallo de imagen para mostrar input
    const imgQr = screen.getByAltText(/QR para abrir en movil/i);
    fireEvent.error(imgQr);

    await waitFor(() => {
      expect(screen.getByLabelText(/IP o host del PC para QR/i)).toBeInTheDocument();
    });

    const inputHost = screen.getByLabelText(/IP o host del PC para QR/i);
    fireEvent.change(inputHost, { target: { value: '192.168.1.200' } });

    expect(localStorage.getItem('qrHostDocente')).toBe('192.168.1.200');
  });
});
