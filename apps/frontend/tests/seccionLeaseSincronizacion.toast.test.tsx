import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorRemoto } from '../src/servicios_api/clienteApi';
import { ToastProvider } from '../src/ui/toast/ToastProvider';
import { SeccionLeaseSincronizacion, type EstadoLeaseUI } from '../src/apps/app_docente/SeccionLeaseSincronizacion';

vi.mock('../src/ui/feedback/ConfirmDialogProvider', () => ({
  useConfirmDialog: () => vi.fn(async () => false)
}));

const estadoDisponible: EstadoLeaseUI = {
  configurado: true,
  directorio: 'C:\\EvaluaPro\\sync',
  proveedor: 'carpeta-sincronizada',
  ttlMs: 60_000,
  modo: 'disponible'
};

function renderCoordinacion(
  onAdquirir: () => Promise<EstadoLeaseUI>,
  opciones: {
    estado?: EstadoLeaseUI;
    onPublicar?: () => Promise<{ mensaje?: string }>;
    onActualizarEstado?: () => Promise<boolean>;
  } = {}
) {
  return render(
    <ToastProvider>
      <SeccionLeaseSincronizacion
        estado={opciones.estado ?? estadoDisponible}
        puedeUsarContrasena
        puedeUsarGoogle={false}
        onAdquirir={onAdquirir}
        onActualizarEstado={opciones.onActualizarEstado ?? vi.fn(async () => true)}
        onLiberar={vi.fn(async () => undefined)}
        onPublicar={opciones.onPublicar ?? vi.fn(async () => ({}))}
        onImportar={vi.fn(async () => ({}))}
      />
    </ToastProvider>
  );
}

describe('SeccionLeaseSincronizacion: errores y toast contextual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mantiene el detalle como alerta contextual sin repetirlo en un toast', async () => {
    renderCoordinacion(vi.fn().mockRejectedValue(new Error('No se pudo adquirir el control de edición.')));

    fireEvent.click(screen.getByRole('button', { name: 'Tomar control de edición' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo adquirir el control de edición.');
    expect(screen.queryByRole('group', { name: 'Control ocupado' })).not.toBeInTheDocument();
  });

  it('en solo lectura evita intentar adquirir un lease ocupado y permite actualizar disponibilidad', async () => {
    const estadoSoloLectura: EstadoLeaseUI = {
      ...estadoDisponible,
      modo: 'solo_lectura',
      lease: {
        leaseId: 'lease-remoto-dummy', equipoId: 'equipo-remoto-dummy',
        adquiridoEn: '2026-11-03T16:00:00.000Z', ultimoHeartbeatEn: '2026-11-03T16:01:00.000Z',
        expiraEn: '2026-11-03T16:02:00.000Z', propio: false
      }
    };
    const onActualizarEstado = vi.fn(async () => true);
    renderCoordinacion(vi.fn(async () => estadoDisponible), { estado: estadoSoloLectura, onActualizarEstado });

    expect(screen.getByText(/Otro equipo tiene el control hasta aproximadamente/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tomar control de edición' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Protección de publicación')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar disponibilidad' }));

    expect(onActualizarEstado).toHaveBeenCalledTimes(1);
    expect((await screen.findByText('Estado del control actualizado.')).closest('[role="status"]')).toBeInTheDocument();
  });

  it('si falla la consulta de disponibilidad conserva el lease conocido y anuncia el error', async () => {
    const estadoSoloLectura: EstadoLeaseUI = {
      ...estadoDisponible,
      modo: 'solo_lectura',
      lease: {
        leaseId: 'lease-remoto-dummy', equipoId: 'equipo-remoto-dummy',
        adquiridoEn: '2030-11-03T16:00:00.000Z', ultimoHeartbeatEn: '2030-11-03T16:01:00.000Z',
        expiraEn: '2030-11-03T16:02:00.000Z', propio: false
      }
    };
    renderCoordinacion(vi.fn(async () => estadoDisponible), {
      estado: estadoSoloLectura,
      onActualizarEstado: vi.fn(async () => false)
    });

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar disponibilidad' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo actualizar la disponibilidad. Conservamos el último estado conocido; vuelve a intentarlo.');
    expect(screen.getByText(/Otro equipo tiene el control hasta aproximadamente/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tomar control de edición' })).not.toBeInTheDocument();
  });

  it('solo añade un toast si aporta una acción de recuperación de sesión distinta', async () => {
    renderCoordinacion(vi.fn().mockRejectedValue(new ErrorRemoto('Sesión vencida.', { status: 401 })));

    fireEvent.click(screen.getByRole('button', { name: 'Tomar control de edición' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo autenticar. Verifica tus datos e intenta de nuevo.');
    const toast = await screen.findByRole('group', { name: 'Renueva tu sesión docente' });
    expect(toast).toHaveTextContent('El detalle está en Trabajo coordinado. Cierra sesión y vuelve a entrar para renovar el acceso.');
    expect(within(toast).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(toast).not.toHaveTextContent('No se pudo autenticar. Verifica tus datos e intenta de nuevo.');
  });

  it('expone como alerta la credencial faltante y no inicia la publicación', async () => {
    const onPublicar = vi.fn(async () => ({ mensaje: 'Snapshot publicado.' }));
    const estadoPropio: EstadoLeaseUI = {
      ...estadoDisponible,
      modo: 'escritura',
      lease: {
        leaseId: 'lease-dummy', equipoId: 'equipo-dummy', adquiridoEn: '',
        ultimoHeartbeatEn: '', expiraEn: new Date(Date.now() + 60_000).toISOString(), propio: true
      }
    };
    renderCoordinacion(vi.fn(async () => estadoPropio), { estado: estadoPropio, onPublicar });

    fireEvent.click(screen.getByRole('button', { name: 'Publicar y liberar' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Escribe la contraseña actual/i);
    expect(onPublicar).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Sincronización en nube' })).not.toBeInTheDocument();
  });

  it('anuncia una publicación exitosa en contexto sin duplicarla en toast', async () => {
    const onPublicar = vi.fn(async () => ({ mensaje: 'Snapshot publicado correctamente.' }));
    const estadoPropio: EstadoLeaseUI = {
      ...estadoDisponible,
      modo: 'escritura',
      lease: {
        leaseId: 'lease-dummy', equipoId: 'equipo-dummy', adquiridoEn: '',
        ultimoHeartbeatEn: '', expiraEn: new Date(Date.now() + 60_000).toISOString(), propio: true
      }
    };
    renderCoordinacion(vi.fn(async () => estadoPropio), { estado: estadoPropio, onPublicar });
    fireEvent.change(screen.getByLabelText(/Contraseña actual/i), { target: { value: 'clave-dummy-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar y liberar' }));

    const mensajeExito = await screen.findByText('Snapshot publicado correctamente.');
    expect(mensajeExito.closest('[role="status"]')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Sincronización en nube' })).not.toBeInTheDocument();
  });
});
