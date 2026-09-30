import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeccionClassroom } from '../src/apps/app_docente/SeccionClassroomSync';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: { obtener: vi.fn(), enviar: vi.fn(), actualizar: vi.fn(), baseApi: 'http://localhost:4000/api' }
}));
const confirmarMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock('../src/ui/feedback/ConfirmDialogProvider', () => ({ useConfirmDialog: () => confirmarMock }));

function renderSeccion(props?: Partial<React.ComponentProps<typeof SeccionClassroom>>) {
  return render(<SeccionClassroom
    puedeClassroomConectar
    puedeClassroomPull
    puedeConsultarCalificaciones
    classroomDisponible
    onAbrirCalificaciones={vi.fn()}
    {...props}
  />);
}

describe('SeccionClassroom: conexión y estado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmarMock.mockResolvedValue(true);
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (ruta === '/evaluaciones/v2/classroom/estado') return { estado: { conectado: true, correoGoogle: 'docente@example.test' } };
      if (ruta === '/evaluaciones/v2/classroom/oauth/iniciar') return { url: 'https://accounts.google.com/authorize' };
      return {};
    });
    vi.mocked(clienteApi.enviar).mockResolvedValue({ estado: { conectado: false } });
  });

  it('limita esta sección a la conexión y dirige la revisión de datos a Calificaciones', async () => {
    const onAbrirCalificaciones = vi.fn();
    renderSeccion({ onAbrirCalificaciones });

    expect(screen.getByRole('heading', { name: 'Google Classroom' })).toBeInTheDocument();
    expect(await screen.findByText('docente@example.test')).toBeInTheDocument();
    expect(screen.getByText(/No crea copias de las actividades ni modifica entregas o calificaciones/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar en Calificaciones' }));
    expect(onAbrirCalificaciones).toHaveBeenCalledOnce();
    expect(clienteApi.obtener).toHaveBeenCalledWith('/evaluaciones/v2/classroom/estado');
    expect(clienteApi.obtener).not.toHaveBeenCalledWith('/evaluaciones/v2/classroom/cursos');
    expect(clienteApi.obtener).not.toHaveBeenCalledWith(expect.stringContaining('/importaciones/historial'));
    expect(clienteApi.enviar).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Sincronizar calificaciones asignadas/i })).not.toBeInTheDocument();
  });

  it('inicia OAuth cuando está desconectada y permite volver a consultar el estado', async () => {
    let conectado = false;
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (ruta === '/evaluaciones/v2/classroom/estado') return { estado: { conectado } };
      if (ruta === '/evaluaciones/v2/classroom/oauth/iniciar') return { url: 'https://accounts.google.com/authorize' };
      return {};
    });
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSeccion();

    fireEvent.click(await screen.findByRole('button', { name: 'Conectar Google Classroom' }));
    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://accounts.google.com/authorize', '_blank', 'noopener,noreferrer'));
    conectado = true;
    fireEvent(window, new Event('focus'));
    expect(await screen.findByText('Cuenta conectada')).toBeInTheDocument();
    expect(clienteApi.obtener).not.toHaveBeenCalledWith('/evaluaciones/v2/classroom/cursos');
  });

  it('confirma y desconecta la cuenta, sin alterar cursos ni calificaciones', async () => {
    renderSeccion();
    fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));

    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/classroom/oauth/desconectar', {}));
    expect(confirmarMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Desconectar Google Classroom' }));
    expect(clienteApi.obtener).not.toHaveBeenCalledWith('/evaluaciones/v2/classroom/cursos');
    expect(clienteApi.enviar).toHaveBeenCalledTimes(1);
  });

  it('explica permisos y disponibilidad cuando no puede consultar Classroom', async () => {
    renderSeccion({ classroomDisponible: false, puedeClassroomPull: false, puedeClassroomConectar: false, puedeConsultarCalificaciones: false });
    expect(await screen.findByText(/no está disponible en este entorno/)).toBeInTheDocument();
    expect(screen.getByText('Estado de conexión no disponible')).toBeInTheDocument();
    expect(screen.getByText(/no tiene permiso para consultar el módulo de Calificaciones/)).toBeInTheDocument();
    expect(clienteApi.obtener).not.toHaveBeenCalled();
  });

  it('no reporta como deshabilitada una integración mientras espera las capacidades del backend', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (ruta === '/evaluaciones/v2/classroom/estado') return { estado: { conectado: false } };
      return {};
    });
    renderSeccion({ classroomDisponible: undefined });
    expect(screen.getByText(/Consultando disponibilidad de Google Classroom/)).toBeInTheDocument();
    expect(screen.queryByText(/no está disponible en este entorno/)).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Conectar Google Classroom' })).toBeDisabled();
  });
});
