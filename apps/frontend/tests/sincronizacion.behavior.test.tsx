/**
 * sincronizacion.behavior.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionSincronizacionEquipos } from '../src/apps/app_docente/SeccionSincronizacionEquipos';
import { SeccionSincronizacion } from '../src/apps/app_docente/SeccionSincronizacion';
import { SeccionPaqueteSincronizacion } from '../src/apps/app_docente/SeccionPaqueteSincronizacion';
import { ConfirmDialogProvider } from '../src/ui/feedback/ConfirmDialogProvider';

const obtenerMock = vi.fn();

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: (...args: unknown[]) => obtenerMock(...args),
    registrarEventosUso: vi.fn(async () => ({}))
  }
}));

describe('sincronizacion UI behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envia push y pull con parametros de sincronizacion entre equipos', async () => {
    const pushMock = vi.fn(async () => ({
      mensaje: 'Push OK',
      conteos: { alumnos: 3 },
      cursor: '2026-02-13T00:00:00.000Z'
    }));
    const pullMock = vi.fn(async () => ({
      mensaje: 'Pull OK',
      paquetesRecibidos: 2,
      pdfsGuardados: 1,
      ultimoCursor: '2026-02-14T00:00:00.000Z'
    }));

    render(<SeccionSincronizacionEquipos onPushServidor={pushMock} onPullServidor={pullMock} />);

    fireEvent.click(screen.getByRole('button', { name: /Enviar cambios/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/Desde \(opcional\)/i), { target: { value: '2026-02-13T12:15' } });
    fireEvent.change(screen.getByLabelText(/Limite de paquetes pull/i), { target: { value: '50' } });
    fireEvent.click(screen.getByLabelText(/Incluir PDFs en push/i));
    fireEvent.click(screen.getByRole('button', { name: /Traer cambios/i }));

    await waitFor(() => expect(pullMock).toHaveBeenCalledTimes(1));
    const payloadPush = pushMock.mock.calls[0]?.[0];
    const payloadPull = pullMock.mock.calls[0]?.[0];
    expect(payloadPush).toEqual(expect.objectContaining({ incluirPdfs: false }));
    expect(payloadPull).toEqual(
      expect.objectContaining({
        limite: 50,
        desde: new Date('2026-02-13T12:15').toISOString()
      })
    );
  });

  it('consulta estado remoto y muestra resumen de sincronizacion', async () => {
    obtenerMock.mockResolvedValueOnce({
      sincronizaciones: [
        { _id: '2', tipo: 'sync_pull', estado: 'fallido', ejecutadoEn: '2026-02-13T10:00:00.000Z' },
        { _id: '1', tipo: 'sync_push', estado: 'exitoso', ejecutadoEn: '2026-02-13T11:00:00.000Z' }
      ]
    });

    render(
      <SeccionSincronizacion
        periodos={[]}
        periodosArchivados={[]}
        alumnos={[]}
        plantillas={[]}
        preguntas={[]}
        ultimaActualizacionDatos={Date.now()}
        docenteCorreo="doc@local.test"
        onPublicar={async () => ({})}
        onCodigo={async () => ({ codigo: 'ABC123' })}
        onExportarPaquete={async () => ({ paqueteBase64: 'abc', checksumSha256: 'hash', exportadoEn: new Date().toISOString(), conteos: {} })}
        onImportarPaquete={async () => ({ mensaje: 'ok' })}
        onPushServidor={async () => ({ mensaje: 'ok' })}
        onPullServidor={async () => ({ mensaje: 'ok' })}
      />
    );

    await waitFor(() => expect(obtenerMock).toHaveBeenCalled());
    expect(screen.getByText(/Estado de sincronización/i)).toBeInTheDocument();
    expect(screen.getByText(/SYNC_PUSH/i)).toBeInTheDocument();
  });

  it('importa paquete con validacion dry-run y aplicacion final', async () => {
    const onExportar = vi.fn(async () => ({
      paqueteBase64: 'cGFxdWV0ZQ==',
      checksumSha256: 'a'.repeat(64),
      exportadoEn: '2026-02-13T10:00:00.000Z',
      conteos: { alumnos: 1 }
    }));
    const onImportar = vi.fn(async (payload: { dryRun?: boolean }) => {
      if (payload.dryRun) return { conteos: { alumnos: 1, periodos: 1 } };
      return { mensaje: 'Paquete importado' };
    });

    render(
      <ConfirmDialogProvider>
        <SeccionPaqueteSincronizacion
          periodos={[]}
          docenteCorreo="doc@local.test"
          onExportar={onExportar}
          onImportar={onImportar}
        />
      </ConfirmDialogProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Exportar backup/i }));
    await waitFor(() => expect(onExportar).toHaveBeenCalledTimes(1));

    const contenidoArchivo = JSON.stringify({
      version: 1,
      paqueteBase64: 'cGFxdWV0ZQ==',
      checksumSha256: 'b'.repeat(64),
      docenteCorreo: 'doc@local.test'
    });
    const archivo = {
      name: 'respaldo.ep-sync.json',
      size: contenidoArchivo.length,
      text: vi.fn(async () => contenidoArchivo)
    } as unknown as File;

    const input = screen.getByLabelText(/Importar backup/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [archivo] } });

    const botonConfirmar = await screen.findByRole('button', { name: /Sí, importar paquete/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => expect(onImportar).toHaveBeenCalledTimes(2));
    expect(onImportar.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        dryRun: true,
        checksumSha256: 'b'.repeat(64)
      })
    );
    expect(onImportar.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        checksumSha256: 'b'.repeat(64),
        docenteCorreo: 'doc@local.test'
      })
    );
    expect(onImportar.mock.calls[1][0]).not.toHaveProperty('dryRun');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('rechaza backup expirado antes de llamar onImportar', async () => {
    const onImportar = vi.fn(async () => ({ mensaje: 'ok' }));

    render(
      <SeccionPaqueteSincronizacion periodos={[]} docenteCorreo="doc@local.test" onExportar={vi.fn(async () => ({
        paqueteBase64: 'cGFxdWV0ZQ==',
        checksumSha256: 'a'.repeat(64),
        exportadoEn: new Date().toISOString(),
        conteos: {}
      }))} onImportar={onImportar} />
    );

    const contenidoArchivo = JSON.stringify({
      version: 2,
      paqueteBase64: 'cGFxdWV0ZQ==',
      checksumSha256: 'b'.repeat(64),
      docenteCorreo: 'doc@local.test',
      backupMeta: {
        schemaVersion: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        ttlMs: 86_400_000,
        expiresAt: '2026-01-02T00:00:00.000Z',
        businessLogicFingerprint: 'sync-v2-lww-updatedAt-schema2'
      }
    });

    const archivo = {
      name: 'respaldo-expirado.ep-sync.json',
      size: contenidoArchivo.length,
      text: vi.fn(async () => contenidoArchivo)
    } as unknown as File;

    const input = screen.getByLabelText(/Importar backup/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [archivo] } });

    await waitFor(() => {
      expect(onImportar).toHaveBeenCalledTimes(0);
      expect(screen.getByText(/Backup expirado/i)).toBeInTheDocument();
    });
  });

  it('rechaza backup invalidado por fingerprint incompatible', async () => {
    const onImportar = vi.fn(async () => ({ mensaje: 'ok' }));

    render(
      <SeccionPaqueteSincronizacion periodos={[]} docenteCorreo="doc@local.test" onExportar={vi.fn(async () => ({
        paqueteBase64: 'cGFxdWV0ZQ==',
        checksumSha256: 'a'.repeat(64),
        exportadoEn: new Date().toISOString(),
        conteos: {}
      }))} onImportar={onImportar} />
    );

    const contenidoArchivo = JSON.stringify({
      version: 2,
      paqueteBase64: 'cGFxdWV0ZQ==',
      checksumSha256: 'b'.repeat(64),
      docenteCorreo: 'doc@local.test',
      backupMeta: {
        schemaVersion: 2,
        createdAt: new Date().toISOString(),
        ttlMs: 86_400_000,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        businessLogicFingerprint: 'sync-v2-breaking-change'
      }
    });

    const archivo = {
      name: 'respaldo-incompatible.ep-sync.json',
      size: contenidoArchivo.length,
      text: vi.fn(async () => contenidoArchivo)
    } as unknown as File;

    const input = screen.getByLabelText(/Importar backup/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [archivo] } });

    await waitFor(() => {
      expect(onImportar).toHaveBeenCalledTimes(0);
      expect(screen.getByText(/Backup invalidado/i)).toBeInTheDocument();
    });
  });
});

