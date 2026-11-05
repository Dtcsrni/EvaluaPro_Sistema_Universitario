/**
 * sincronizacion.behavior.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionSincronizacionEquipos } from '../src/apps/app_docente/SeccionSincronizacionEquipos';
import { SeccionSincronizacion } from '../src/apps/app_docente/SeccionSincronizacion';
import { SeccionPaqueteSincronizacion } from '../src/apps/app_docente/SeccionPaqueteSincronizacion';
import { SeccionInstantaneaLocal } from '../src/apps/app_docente/SeccionInstantaneaLocal';
import { SeccionConfiguracionSincronizacion } from '../src/apps/app_docente/SeccionConfiguracionSincronizacion';
import { GuiaSincronizacionVisual } from '../src/apps/app_docente/GuiaSincronizacionVisual';
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

  it('distingue el paquete de registros de la instantánea local completa y usa iconos compartidos', () => {
    localStorage.removeItem('ep.guia.sincronizacion.oculta');
    const { container } = render(<GuiaSincronizacionVisual />);

    const guia = screen.getByRole('region', { name: 'Ayuda: Sincronización y respaldos' });
    expect(guia).toHaveTextContent(/archivo \.ep-sync\.json/i);
    expect(guia).toHaveTextContent('filtrar por materia y fecha e incluir PDFs');
    expect(guia).toHaveTextContent(/Instantánea \.ep-snapshot/i);
    expect(guia).toHaveTextContent('La nube aplica la última escritura por registro');
    expect(guia).not.toHaveTextContent(/\.epbak|archivos zip|Cero Pérdida|LWW/i);
    expect(Array.from(container.querySelectorAll('svg[data-icono]')).map((icono) => icono.getAttribute('data-icono')))
      .toEqual(['sincronizacion', 'descargar', 'sincronizacion']);

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar guía rápida' }));
    const reabrir = screen.getByRole('button', { name: 'Ver guía rápida de sincronización' });
    expect(reabrir.querySelector('svg[data-icono]')).toHaveAttribute('data-icono', 'info');
    expect(reabrir).not.toHaveTextContent('💡');
  });

  it('ajusta el método de protección cuando las capacidades llegan de forma asíncrona', async () => {
    const onExportar = vi.fn(async () => ({
      archivo: new Blob(['snapshot']),
      nombreArchivo: 'snapshot.ep-snapshot',
      checksumSha256: 'a'.repeat(64),
      exportadoEn: new Date().toISOString(),
      conteos: { baseDatosBytes: 1, archivos: 0, archivosBytes: 0 }
    }));
    const propiedades = {
      puedeUsarContrasena: false,
      puedeUsarGoogle: false,
      onExportar,
      onImportar: vi.fn(async () => ({ mensaje: 'ok' }))
    };
    const vista = render(<SeccionInstantaneaLocal {...propiedades} />);
    vista.rerender(<SeccionInstantaneaLocal {...propiedades} puedeUsarContrasena />);

    const campo = await screen.findByLabelText(/Contraseña actual/i);
    fireEvent.change(campo, { target: { value: 'password-docente' } });
    fireEvent.click(screen.getByRole('button', { name: /Exportar respaldo completo/i }));

    await waitFor(() => expect(onExportar).toHaveBeenCalledWith({ metodo: 'contrasena', credencial: 'password-docente' }));
  });

  it('conserva juntos los metadatos de la última instantánea completada si falla una importación nueva', async () => {
    const conteos = { baseDatosBytes: 1024, archivos: 3, archivosBytes: 2048 };
    const onImportar = vi.fn()
      .mockResolvedValueOnce({ conteos })
      .mockResolvedValueOnce({ mensaje: 'Instantánea importada 1:1.', checksumSha256: 'a'.repeat(64), conteos })
      .mockRejectedValueOnce(new Error('Archivo inválido'));
    const crearArchivo = (name: string) => ({
      name,
      arrayBuffer: async () => new TextEncoder().encode('datos dummy').buffer
    } as File);

    render(
      <ConfirmDialogProvider>
        <SeccionInstantaneaLocal
          puedeUsarContrasena
          puedeUsarGoogle={false}
          onExportar={vi.fn(async () => ({
            archivo: new Blob(['respaldo dummy']),
            nombreArchivo: 'respaldo.ep-snapshot',
            checksumSha256: 'b'.repeat(64),
            exportadoEn: '2026-10-29T00:00:00.000Z',
            conteos
          }))}
          onImportar={onImportar}
        />
      </ConfirmDialogProvider>
    );

    const credencial = screen.getByLabelText(/Contraseña actual/i);
    expect(screen.getByRole('heading', { name: 'Respaldo completo del equipo' })).toBeInTheDocument();
    expect(screen.getByText(/\.ep-snapshot.*reemplaza los datos de este equipo/i)).toBeInTheDocument();
    const inputArchivo = screen.getByLabelText(/Importar respaldo completo \(\.ep-snapshot\)/i);
    fireEvent.change(credencial, { target: { value: 'clave-dummy' } });
    fireEvent.change(inputArchivo, { target: { files: [crearArchivo('primera.ep-snapshot')] } });
    expect(await screen.findByText('Archivo seleccionado: primera.ep-snapshot')).toBeInTheDocument();
    expect(screen.getByText(/Se creará un respaldo automático/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, reemplazar e importar' }));

    const resumen = await screen.findByText(/Último archivo completado:/i);
    expect(resumen).toHaveTextContent('primera.ep-snapshot');
    expect(resumen).toHaveTextContent('SQLite 1 KB · 3 archivos');

    fireEvent.change(credencial, { target: { value: 'clave-dummy' } });
    fireEvent.change(inputArchivo, { target: { files: [crearArchivo('segunda.ep-snapshot')] } });

    expect(await screen.findByText('Archivo inválido')).toBeInTheDocument();
    expect(screen.getByText(/Último archivo completado:/i)).toHaveTextContent('primera.ep-snapshot');
    expect(screen.queryByText(/segunda\.ep-snapshot/)).not.toBeInTheDocument();
  });

  it('guarda la carpeta de OneDrive desde el panel de configuración', async () => {
    const onConfigurar = vi.fn(async (directorio: string) => ({
      configurado: true,
      directorio,
      origen: 'docente' as const,
      proveedor: 'carpeta-sincronizada' as const,
      ttlMs: 60_000
    }));

    render(
      <SeccionConfiguracionSincronizacion
        estado={{ configurado: false, proveedor: 'carpeta-sincronizada', ttlMs: 60_000 }}
        onConfigurar={onConfigurar}
      />
    );

    const campoCarpeta = screen.getByLabelText(/Carpeta local sincronizada por OneDrive/i);
    expect(campoCarpeta).toHaveAttribute('placeholder', 'Ruta local de OneDrive');
    fireEvent.change(campoCarpeta, {
      target: { value: 'C:\\Users\\docente\\OneDrive\\EvaluaPro' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar carpeta/i }));

    await waitFor(() => expect(onConfigurar).toHaveBeenCalledWith('C:\\Users\\docente\\OneDrive\\EvaluaPro'));
    const mensajeExito = screen.getByText(/Carpeta guardada/i);
    expect(mensajeExito.closest('[role="status"]')).toBeInTheDocument();
    expect(mensajeExito.closest('[role="alert"]')).not.toBeInTheDocument();
  });

  it('anuncia como alerta el error al guardar la carpeta de sincronización', async () => {
    render(
      <SeccionConfiguracionSincronizacion
        estado={{ configurado: false, proveedor: 'carpeta-sincronizada', ttlMs: 60_000 }}
        onConfigurar={async () => { throw new Error('No se pudo guardar la carpeta por falta de permisos.'); }}
      />
    );

    fireEvent.change(screen.getByLabelText(/Carpeta local sincronizada por OneDrive/i), {
      target: { value: 'C:\\OneDrive\\EvaluaPro' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar carpeta/i }));

    const mensajeError = await screen.findByText(/No se pudo guardar la carpeta por falta de permisos/i);
    expect(mensajeError.closest('[role="alert"]')).toBeInTheDocument();
    expect(mensajeError.closest('[role="status"]')).not.toBeInTheDocument();
  });

  it('distingue una ruta sin guardar de la carpeta activa y vuelve a configurada al revertir el borrador', async () => {
    const rutaGuardada = 'C:\\OneDrive\\EvaluaPro';
    const vista = render(
      <SeccionConfiguracionSincronizacion
        estado={{ configurado: false, proveedor: 'carpeta-sincronizada', ttlMs: 60_000 }}
        onConfigurar={vi.fn(async (directorio: string) => ({
          configurado: true,
          directorio,
          origen: 'docente' as const,
          proveedor: 'carpeta-sincronizada' as const,
          ttlMs: 60_000
        }))}
      />
    );

    const panel = screen.getByTestId('configuracion-sincronizacion');
    const estado = within(panel).getByRole('status');
    const campoCarpeta = within(panel).getByLabelText(/Carpeta local sincronizada por OneDrive/i);
    expect(estado).toHaveTextContent('Sin configurar');

    fireEvent.change(campoCarpeta, { target: { value: rutaGuardada } });
    expect(estado).toHaveTextContent('Ruta sin guardar');

    vista.rerender(
      <SeccionConfiguracionSincronizacion
        estado={{ configurado: true, directorio: rutaGuardada, origen: 'docente', proveedor: 'carpeta-sincronizada', ttlMs: 60_000 }}
        onConfigurar={vi.fn(async () => ({
          configurado: true,
          directorio: rutaGuardada,
          origen: 'docente' as const,
          proveedor: 'carpeta-sincronizada' as const,
          ttlMs: 60_000
        }))}
      />
    );
    await waitFor(() => expect(estado).toHaveTextContent('Configurada'));

    fireEvent.change(campoCarpeta, { target: { value: 'C:\\OneDrive\\EvaluaPro-nueva' } });
    expect(estado).toHaveTextContent('Cambios sin guardar');
    fireEvent.change(campoCarpeta, { target: { value: rutaGuardada } });
    expect(estado).toHaveTextContent('Configurada');
  });

  it('asocia la ruta vacía con su error y no configura hasta que se corrija', async () => {
    const onConfigurar = vi.fn(async (directorio: string) => ({
      configurado: true,
      directorio,
      origen: 'docente' as const,
      proveedor: 'carpeta-sincronizada' as const,
      ttlMs: 60_000
    }));

    render(
      <SeccionConfiguracionSincronizacion
        estado={{ configurado: false, proveedor: 'carpeta-sincronizada', ttlMs: 60_000 }}
        onConfigurar={onConfigurar}
      />
    );

    const campoCarpeta = screen.getByLabelText(/Carpeta local sincronizada por OneDrive/i);
    fireEvent.click(screen.getByRole('button', { name: /Guardar carpeta/i }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Escribe o elige una carpeta local sincronizada por OneDrive.');
    expect(campoCarpeta).toHaveAttribute('aria-invalid', 'true');
    expect(campoCarpeta.getAttribute('aria-describedby')).toContain(error.id);
    expect(onConfigurar).not.toHaveBeenCalled();

    fireEvent.change(campoCarpeta, { target: { value: 'C:\\OneDrive\\EvaluaPro' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(campoCarpeta).not.toHaveAttribute('aria-invalid');

    fireEvent.click(screen.getByRole('button', { name: /Guardar carpeta/i }));
    await waitFor(() => expect(onConfigurar).toHaveBeenCalledWith('C:\\OneDrive\\EvaluaPro'));
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

    const desde = screen.getByLabelText(/Cambios desde \(opcional\)/i);
    const limite = screen.getByLabelText(/Máximo de paquetes por recibir/i);
    expect(desde).toHaveAccessibleDescription(/hora local del equipo.*último cursor guardado/i);
    expect(limite).toHaveAccessibleDescription(/de 1 a 20 paquetes por consulta.*inicial es 20/i);
    expect(limite).toHaveAttribute('max', '20');

    fireEvent.click(screen.getByRole('button', { name: /Enviar cambios/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));

    fireEvent.change(desde, { target: { value: '2026-02-13T12:15' } });
    fireEvent.change(limite, { target: { value: '50' } });
    expect(limite).toHaveValue(20);
    fireEvent.click(screen.getByLabelText(/Incluir PDFs en el envío/i));
    fireEvent.click(screen.getByRole('button', { name: /Traer cambios/i }));

    await waitFor(() => expect(pullMock).toHaveBeenCalledTimes(1));
    const payloadPush = pushMock.mock.calls[0]?.[0];
    const payloadPull = pullMock.mock.calls[0]?.[0];
    expect(payloadPush).toEqual(expect.objectContaining({ incluirPdfs: false }));
    expect(payloadPush).not.toHaveProperty('desde');
    expect(payloadPull).toEqual(
      expect.objectContaining({
        limite: 20,
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
        onExportarLocal={async () => ({
          archivo: new Blob(),
          nombreArchivo: 'instantanea.ep-snapshot',
          checksumSha256: 'hash',
          exportadoEn: new Date().toISOString(),
          conteos: { baseDatosBytes: 0, archivos: 0, archivosBytes: 0 }
        })}
        onImportarLocal={async () => ({ mensaje: 'ok' })}
        estadoLease={null}
        onAdquirirLease={async () => { throw new Error('no usado'); }}
        onActualizarEstadoLease={async () => true}
        onLiberarLease={async () => ({})}
        onPublicarNube={async () => ({ mensaje: 'ok' })}
        onImportarNube={async () => ({ mensaje: 'ok' })}
        puedeUsarContrasena={true}
        puedeUsarGoogle={false}
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

    fireEvent.click(screen.getByRole('button', { name: /Exportar paquete/i }));
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

    const input = screen.getByLabelText(/Importar paquete/i) as HTMLInputElement;
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

    const input = screen.getByLabelText(/Importar paquete/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [archivo] } });

    await waitFor(() => {
      expect(onImportar).toHaveBeenCalledTimes(0);
      expect(screen.getByText(/Este paquete venció/i)).toBeInTheDocument();
    });
  });

  it('rechaza un paquete incompatible con las reglas actuales', async () => {
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

    const input = screen.getByLabelText(/Importar paquete/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [archivo] } });

    await waitFor(() => {
      expect(onImportar).toHaveBeenCalledTimes(0);
      expect(screen.getByText(/Este paquete ya no es compatible con las reglas actuales/i)).toBeInTheDocument();
    });
  });
});

