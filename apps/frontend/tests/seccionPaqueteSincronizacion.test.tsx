/**
 * seccionPaqueteSincronizacion.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
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

  it('renderiza la interfaz de paquetes y explica sus controles de exportación', () => {
    render(
      <SeccionPaqueteSincronizacion
        periodos={periodosMock}
        docenteCorreo="docente@cuh.mx"
        onExportar={vi.fn()}
        onImportar={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Paquetes entre equipos/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Incluir archivos PDF \(aumenta el tamaño del paquete\)/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Cambios desde \(opcional\)/i)).toHaveAttribute('aria-describedby', 'sync-paquete-desde-ayuda');
    expect(screen.getByText(/Déjalo vacío para no filtrar por fecha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exportar paquete/i })).toBeInTheDocument();
    expect(screen.getByText(/Importar paquete/i)).toBeInTheDocument();
  });

  it('permite exportar un paquete de sincronización', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:sync-backup');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
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

    const botonExportar = screen.getByRole('button', { name: /Exportar paquete/i });
    fireEvent.click(botonExportar);

    await waitFor(() => {
      expect(mockExportar).toHaveBeenCalled();
    });

    expect(screen.getByText(/Paquete exportado \(descarga iniciada\)/i)).toHaveAttribute('role', 'status');
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('anuncia el error de exportación junto al formulario sin duplicarlo en un toast', async () => {
    render(
      <SeccionPaqueteSincronizacion
        periodos={periodosMock}
        docenteCorreo="docente@cuh.mx"
        onExportar={vi.fn().mockRejectedValue(new Error('No hay conexión'))}
        onImportar={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Exportar paquete/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No hay conexión/i);
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('anuncia el error de importación junto al formulario sin duplicarlo en un toast', async () => {
    const onImportar = vi.fn().mockRejectedValue(new Error('Checksum no válido'));
    render(
      <SeccionPaqueteSincronizacion
        periodos={periodosMock}
        docenteCorreo="docente@cuh.mx"
        onExportar={vi.fn()}
        onImportar={onImportar}
      />
    );
    const archivo = new File([JSON.stringify({ paqueteBase64: 'e30=' })], 'backup.json', {
      type: 'application/json'
    });
    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input as HTMLInputElement, { target: { files: [archivo] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/Checksum no válido/i);
    expect(onImportar).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    expect(emitToast).not.toHaveBeenCalled();
    expect(screen.queryByText('Archivo importado')).not.toBeInTheDocument();
  });

  it('no presenta como importado un archivo cuya importación fue cancelada', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    render(
      <SeccionPaqueteSincronizacion
        periodos={periodosMock}
        docenteCorreo="docente@cuh.mx"
        onExportar={vi.fn()}
        onImportar={vi.fn().mockResolvedValue({ conteos: { alumnos: 3 } })}
      />
    );

    const archivo = new File([JSON.stringify({ paqueteBase64: 'e30=' })], 'backup-cancelado.json', {
      type: 'application/json'
    });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [archivo] }
    });

    expect(await screen.findByRole('status')).toHaveTextContent(/Importación cancelada/i);
    expect(screen.queryByText('Archivo importado')).not.toBeInTheDocument();
  });

  it('muestra el archivo en el resumen solo después de importarlo', async () => {
    mockConfirm.mockResolvedValueOnce(true);
    const archivo = new File([JSON.stringify({ paqueteBase64: 'e30=' })], 'backup-aplicado.json', {
      type: 'application/json'
    });
    render(
      <SeccionPaqueteSincronizacion
        periodos={periodosMock}
        docenteCorreo="docente@cuh.mx"
        onExportar={vi.fn()}
        onImportar={vi.fn()
          .mockResolvedValueOnce({ conteos: { alumnos: 3 } })
          .mockResolvedValueOnce({ mensaje: 'Importación completada' })}
      />
    );

    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [archivo] }
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Importación completada');
    expect(screen.getByText('Archivo importado')).toBeInTheDocument();
    expect(screen.getByText('backup-aplicado.json')).toBeInTheDocument();
  });
});
