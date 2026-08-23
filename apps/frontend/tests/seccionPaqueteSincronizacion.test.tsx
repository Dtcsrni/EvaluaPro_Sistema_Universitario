import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionPaqueteSincronizacion } from '../src/apps/app_docente/SeccionPaqueteSincronizacion';
import { emitToast } from '../src/ui/toast/toastBus';
import type { Periodo } from '../src/apps/app_docente/tipos';

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

const mockConfirm = vi.fn().mockResolvedValue(true);
vi.mock('../src/ui/feedback/ConfirmDialogProvider', () => ({
  useConfirmDialog: () => mockConfirm
}));

describe('SeccionPaqueteSincronizacion', () => {
  const periodosMock: Periodo[] = [
    { _id: 'per-1', nombre: 'Microbiología', activo: true }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la interfaz de backups y controles de exportación e importación', () => {
    render(
      <SeccionPaqueteSincronizacion
        periodos={periodosMock}
        docenteCorreo="docente@cuh.mx"
        onExportar={vi.fn()}
        onImportar={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Backups y exportaciones/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Incluir PDFs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exportar backup/i })).toBeInTheDocument();
    expect(screen.getByText(/Importar backup/i)).toBeInTheDocument();
  });

  it('permite exportar un paquete de sincronización', async () => {
    const mockExportar = vi.fn().mockResolvedValue({
      paqueteBase64: 'e30=',
      checksumSha256: 'abc123sha256hash',
      cifrado: true,
      exportadoEn: '2026-08-20T10:00:00.000Z',
      conteos: { preguntas: 10, plantillas: 3 }
    });

    render(
      <SeccionPaqueteSincronizacion
        periodos={periodosMock}
        docenteCorreo="docente@cuh.mx"
        onExportar={mockExportar}
        onImportar={vi.fn()}
      />
    );

    const botonExportar = screen.getByRole('button', { name: /Exportar backup/i });
    fireEvent.click(botonExportar);

    await waitFor(() => {
      expect(mockExportar).toHaveBeenCalled();
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Sincronizacion' })
    );
  });
});
