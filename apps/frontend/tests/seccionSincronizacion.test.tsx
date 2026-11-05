import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeccionSincronizacion } from '../src/apps/app_docente/SeccionSincronizacion';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({ clienteApi: { obtener: vi.fn() } }));
vi.mock('../src/apps/app_docente/GuiaSincronizacionVisual', () => ({ GuiaSincronizacionVisual: () => null }));
vi.mock('../src/apps/app_docente/SeccionPaqueteSincronizacion', () => ({ SeccionPaqueteSincronizacion: () => <h2 id="sync-paquetes-heading" tabIndex={-1}>Paquetes entre equipos</h2> }));
vi.mock('../src/apps/app_docente/SeccionInstantaneaLocal', () => ({ SeccionInstantaneaLocal: () => <h2 id="sync-respaldo-heading" tabIndex={-1}>Respaldo completo del equipo</h2> }));
vi.mock('../src/apps/app_docente/SeccionLeaseSincronizacion', () => ({ SeccionLeaseSincronizacion: ({ estado }: { estado?: { configurado?: boolean } | null }) => estado?.configurado ? <h2 id="sync-coordinado-heading" tabIndex={-1}>Trabajo coordinado entre equipos</h2> : null }));
vi.mock('../src/apps/app_docente/SeccionSincronizacionEquipos', () => ({ SeccionSincronizacionEquipos: () => <h2 id="sync-equipos-heading" tabIndex={-1}>Sincronización entre equipos</h2> }));
vi.mock('../src/apps/app_docente/SeccionPublicar', () => ({ SeccionPublicar: () => <h2 id="sync-publicacion-heading" tabIndex={-1}>Publicación y acceso al Portal Alumno</h2> }));

function propsBase(): ComponentProps<typeof SeccionSincronizacion> {
  return {
    periodos: [],
    periodosArchivados: [],
    alumnos: [],
    plantillas: [],
    preguntas: [],
    ultimaActualizacionDatos: null,
    docenteCorreo: 'docente@example.test',
    onPublicar: vi.fn(async () => undefined),
    onCodigo: vi.fn(async () => ({})),
    onListarCodigos: vi.fn(async () => ({ codigosAcceso: [] })),
    onExpirarCodigo: vi.fn(async (codigoAccesoId: string) => ({ expirado: true, codigoAccesoId })),
    onExportarPaquete: vi.fn(async () => ({ paqueteBase64: '', checksumSha256: '', exportadoEn: '', conteos: {} })),
    onImportarPaquete: vi.fn(async () => ({})),
    onExportarLocal: vi.fn(async () => ({
      archivo: new Blob(), nombreArchivo: 'respaldo.ep', checksumSha256: 'hash', exportadoEn: '',
      conteos: { baseDatosBytes: 0, archivos: 0, archivosBytes: 0 }
    })),
    onImportarLocal: vi.fn(async () => ({})),
    estadoLease: null,
    onAdquirirLease: vi.fn(async () => ({ configurado: false, proveedor: 'carpeta-sincronizada', ttlMs: 0, modo: 'disponible' })),
    onActualizarEstadoLease: vi.fn(async () => true),
    onLiberarLease: vi.fn(async () => undefined),
    onPublicarNube: vi.fn(async () => ({})),
    onImportarNube: vi.fn(async () => ({})),
    puedeUsarContrasena: false,
    puedeUsarGoogle: false,
    onPushServidor: vi.fn(async () => ({})),
    onPullServidor: vi.fn(async () => ({}))
  };
}

describe('SeccionSincronizacion: estado e historial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockResolvedValue({ sincronizaciones: [] });
  });

  it('mantiene los KPI fuera de regiones vivas y describe el estado reciente en forma concisa', async () => {
    const { container } = render(<SeccionSincronizacion {...propsBase()} ultimaActualizacionDatos={Date.parse('2026-10-29T12:00:00.000Z')} />);

    const heading = screen.getByRole('heading', { name: 'Sincronización y respaldos' });
    expect(heading.querySelector('svg')).toBeNull();
    const iconoCabecera = container.querySelector('.sincronizacion-panel__icon-orb [data-icono="sincronizacion"]');
    expect(iconoCabecera).toBeInTheDocument();
    expect(iconoCabecera).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Envía y recibe cambios del portal, transfiere paquetes entre equipos y administra respaldos completos.')).toBeInTheDocument();
    expect(screen.getByText('Revisa los últimos envíos, recepciones, publicaciones y respaldos.')).toBeInTheDocument();
    expect(await screen.findByText('Aún no hay operaciones de sincronización registradas.')).toBeInTheDocument();
    const ayuda = screen.getByRole('complementary', { name: 'Ayuda: Opciones de publicación y transferencia' });
    expect(ayuda).toHaveTextContent('.ep-sync.json contiene registros exportables');
    expect(ayuda).toHaveTextContent('.ep-snapshot transfiere la SQLite');
    expect(ayuda).toHaveTextContent('filtrar por materia y fecha e incluir PDFs');
    expect(ayuda).not.toHaveTextContent(/\.epbak|toda tu base de datos|con un solo clic/i);
    const kpis = container.querySelector('.banco-header-kpis');
    expect(kpis).toHaveAttribute('role', 'group');
    expect(kpis).not.toHaveAttribute('aria-live');
    expect(container.querySelector('.banco-mini-kpi--temaactual')).toHaveAttribute(
      'data-tooltip', 'Plantillas de examen incluidas en los datos locales.'
    );
    expect(container.querySelector('.sincronizacion-status-pill')).toHaveTextContent('Sin operaciones recientes');
    expect(screen.getByText('Éxitos recientes')).toBeInTheDocument();
    expect(screen.getByText(/^Datos locales cargados:/)).toBeInTheDocument();
  });

  it('muestra carga inicial antes de confirmar que el historial está vacío', async () => {
    vi.mocked(clienteApi.obtener).mockReturnValue(new Promise(() => {}) as never);
    render(<SeccionSincronizacion {...propsBase()} />);

    expect(document.querySelector('.sincronizacion-status-pill')).toHaveTextContent('Consultando historial');
    expect(screen.queryByText('Aún no hay operaciones de sincronización registradas.')).not.toBeInTheDocument();
  });

  it('ofrece acceso directo a las tareas visibles y solo enlaza la coordinación configurada', () => {
    const props = propsBase();
    const { rerender } = render(<SeccionSincronizacion {...props} />);
    const nav = screen.getByRole('navigation', { name: 'Tareas de sincronización' });
    const enlaces = within(nav).getAllByRole('link');
    expect(enlaces.map((enlace) => enlace.getAttribute('href'))).toEqual([
      '#sync-publicacion-heading', '#sync-paquetes-heading', '#sync-respaldo-heading', '#sync-equipos-heading'
    ]);
    for (const enlace of enlaces) {
      const destino = document.querySelector(enlace.getAttribute('href')!);
      expect(destino).toHaveAttribute('tabindex', '-1');
      expect(destino).toBeInTheDocument();
    }
    expect(within(nav).queryByRole('link', { name: 'Trabajo coordinado entre equipos' })).not.toBeInTheDocument();

    rerender(<SeccionSincronizacion {...props} estadoLease={{ configurado: true } as NonNullable<typeof props.estadoLease>} />);
    expect(within(screen.getByRole('navigation', { name: 'Tareas de sincronización' })).getByRole('link', { name: 'Trabajo coordinado entre equipos' })).toHaveAttribute('href', '#sync-coordinado-heading');
  });

  it('no confunde una consulta fallida con un historial vacío y deja reintentar', async () => {
    vi.mocked(clienteApi.obtener).mockRejectedValue(new Error('API sin respuesta'));
    render(<SeccionSincronizacion {...propsBase()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('API sin respuesta');
    expect(screen.queryByText('Aún no hay operaciones de sincronización registradas.')).not.toBeInTheDocument();
    expect(document.querySelector('.sincronizacion-status-pill')).toHaveTextContent('No se pudo consultar');

    fireEvent.click(screen.getByRole('button', { name: /Actualizar estado/i }));
    await waitFor(() => expect(clienteApi.obtener).toHaveBeenCalledTimes(2));
  });

  it('conserva el último historial disponible al fallar una actualización posterior', async () => {
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ sincronizaciones: [{ _id: 'evt-1', estado: 'exitoso', tipo: 'push', createdAt: '2026-10-28T12:00:00.000Z', resumen: 'Paquete recibido' }] })
      .mockRejectedValueOnce(new Error('Se perdió la conexión'));
    render(<SeccionSincronizacion {...propsBase()} />);

    expect(await screen.findByText('Paquete recibido')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Actualizar estado/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Se perdió la conexión');
    expect(screen.getByText('Paquete recibido')).toBeInTheDocument();
    expect(screen.queryByText('Aún no hay operaciones de sincronización registradas.')).not.toBeInTheDocument();
    expect(document.querySelector('.sincronizacion-status-pill')).toHaveTextContent('Historial desactualizado');
  });

  it('distingue un filtro sin coincidencias y ofrece limpiar el filtro', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({
      sincronizaciones: [{ _id: 'evt-1', estado: 'exitoso', tipo: 'push', createdAt: '2026-10-28T12:00:00.000Z', resumen: 'Paquete recibido' }]
    });
    render(<SeccionSincronizacion {...propsBase()} />);

    expect(await screen.findByText('Paquete recibido')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar en historial' }), { target: { value: 'sin coincidencia' } });
    expect(screen.getByText(/No hay eventos recientes que coincidan/)).toHaveAttribute('role', 'status');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtro' }));
    expect(screen.getByText('Paquete recibido')).toBeInTheDocument();
  });
});
