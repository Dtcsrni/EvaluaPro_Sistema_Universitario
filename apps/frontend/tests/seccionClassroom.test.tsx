import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeccionClassroom } from '../src/apps/app_docente/SeccionClassroomSync';
import { GuiaClassroomVisual } from '../src/apps/app_docente/GuiaClassroomVisual';
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
      if (ruta === '/evaluaciones/v2/classroom/estado') return { estado: {
        conectado: true, correoGoogle: 'docente@example.test', correoLogin: 'docente@example.test', identidadCoincidente: true
      } };
      if (ruta === '/evaluaciones/v2/classroom/oauth/iniciar') return { url: 'https://accounts.google.com/authorize' };
      return {};
    });
    vi.mocked(clienteApi.enviar).mockResolvedValue({ estado: { conectado: false } });
  });

  it('presenta consulta inicial antes de afirmar que no se pudo verificar la conexión', () => {
    vi.mocked(clienteApi.obtener).mockReturnValue(new Promise(() => {}) as never);
    renderSeccion();

    expect(screen.getByText('Consultando el estado de conexión…')).toBeInTheDocument();
    expect(screen.queryByText('No se pudo verificar la conexión')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explica que el estado no está confirmado y permite reintentar la consulta', async () => {
    let consultasEstado = 0;
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (ruta !== '/evaluaciones/v2/classroom/estado') return {};
      consultasEstado += 1;
      if (consultasEstado === 1) throw new Error('ECONNREFUSED');
      return { estado: { conectado: false, correoLogin: 'docente@example.test' } };
    });

    renderSeccion();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('No se pudo verificar la conexión')).toBeInTheDocument();
    expect(screen.getByText(/No hay un estado confirmado\. Selecciona Reintentar/)).toBeInTheDocument();
    expect(screen.queryByText('Cuenta Classroom no conectada')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Cuenta Classroom no conectada')).toBeInTheDocument();
    expect(consultasEstado).toBe(2);
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
      if (ruta === '/evaluaciones/v2/classroom/estado') return { estado: {
        conectado, correoLogin: 'docente@example.test', identidadCoincidente: conectado
      } };
      if (ruta === '/evaluaciones/v2/classroom/oauth/iniciar') return { url: 'https://accounts.google.com/authorize' };
      return {};
    });
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderSeccion();

    expect(await screen.findByText(/Autoriza con la misma cuenta que usas en EvaluaPro/)).toBeInTheDocument();
    expect(screen.getByText('Cuenta de inicio en EvaluaPro')).toBeInTheDocument();
    expect(screen.getByText('docente@example.test')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Conectar Google Classroom' }));
    const enlace = await screen.findByRole('link', { name: /Continuar con Google.*pestaña nueva/i });
    expect(enlace).toHaveAttribute('href', 'https://accounts.google.com/authorize');
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('status')).toHaveTextContent(/vence en 10 minutos/i);
    expect(screen.getByRole('status')).toHaveTextContent(/si vence o cancelas, solicita otro enlace/i);
    expect(screen.queryByRole('button', { name: 'Conectar Google Classroom' })).not.toBeInTheDocument();
    const solicitarOtroEnlace = screen.getByRole('button', { name: 'Solicitar otro enlace' });
    expect(solicitarOtroEnlace).toHaveClass('secundario');
    fireEvent.click(solicitarOtroEnlace);
    expect(await screen.findByRole('link', { name: /Continuar con Google.*pestaña nueva/i })).toHaveAttribute(
      'href',
      'https://accounts.google.com/authorize'
    );
    expect(clienteApi.obtener.mock.calls.filter(([ruta]) => ruta === '/evaluaciones/v2/classroom/oauth/iniciar')).toHaveLength(2);
    expect(abrir).not.toHaveBeenCalled();
    conectado = true;
    fireEvent(window, new Event('focus'));
    expect(await screen.findByText('Cuenta conectada')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Continuar con Google/i })).not.toBeInTheDocument();
    expect(clienteApi.obtener).not.toHaveBeenCalledWith('/evaluaciones/v2/classroom/cursos');
  });

  it('permite preparar y activar el enlace OAuth mediante teclado', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (ruta === '/evaluaciones/v2/classroom/estado') return { estado: { conectado: false } };
      if (ruta === '/evaluaciones/v2/classroom/oauth/iniciar') return { url: 'https://accounts.google.com/authorize' };
      return {};
    });
    const user = userEvent.setup();
    renderSeccion();

    const preparar = await screen.findByRole('button', { name: 'Conectar Google Classroom' });
    await user.tab();
    expect(preparar).toHaveFocus();
    await user.keyboard('{Enter}');

    const enlace = await screen.findByRole('link', { name: /Continuar con Google.*pestaña nueva/i });
    await user.tab();
    expect(enlace).toHaveFocus();
    const activarEnlace = vi.fn();
    enlace.addEventListener('click', (event) => {
      event.preventDefault();
      activarEnlace();
    });
    await user.keyboard('{Enter}');
    expect(activarEnlace).toHaveBeenCalledOnce();
  });

  it('permite reintentar una preparación fallida y reemplaza el error con el enlace', async () => {
    let fallo = true;
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (ruta === '/evaluaciones/v2/classroom/estado') return { estado: { conectado: false } };
      if (ruta === '/evaluaciones/v2/classroom/oauth/iniciar') {
        if (fallo) {
          fallo = false;
          throw new Error('El servicio OAuth no está disponible.');
        }
        return { url: 'https://accounts.google.com/authorize?state=demo' };
      }
      return {};
    });
    renderSeccion();

    fireEvent.click(await screen.findByRole('button', { name: 'Conectar Google Classroom' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio OAuth no está disponible.');
    expect(screen.queryByRole('link', { name: /Continuar con Google/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Conectar Google Classroom' }));
    expect(await screen.findByRole('link', { name: /Continuar con Google/i })).toHaveAttribute(
      'href',
      'https://accounts.google.com/authorize?state=demo'
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('evita solicitudes OAuth duplicadas y rechaza destinos externos no permitidos', async () => {
    let resolver: ((value: { url: string }) => void) | undefined;
    vi.mocked(clienteApi.obtener).mockImplementation((ruta) => {
      if (ruta === '/evaluaciones/v2/classroom/estado') return Promise.resolve({ estado: { conectado: false } });
      if (ruta === '/evaluaciones/v2/classroom/oauth/iniciar') {
        return new Promise((resolve) => { resolver = resolve; });
      }
      return Promise.resolve({});
    });
    renderSeccion();

    const preparar = await screen.findByRole('button', { name: 'Conectar Google Classroom' });
    fireEvent.click(preparar);
    expect(preparar).toBeDisabled();
    expect(preparar).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(preparar);
    expect(clienteApi.obtener.mock.calls.filter(([ruta]) => ruta === '/evaluaciones/v2/classroom/oauth/iniciar')).toHaveLength(1);

    resolver?.({ url: 'https://accounts.google.example.evil/authorize' });
    expect(await screen.findByRole('alert')).toHaveTextContent(/enlace de autorización no válido/i);
    expect(screen.queryByRole('link', { name: /Continuar con Google/i })).not.toBeInTheDocument();
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

  it('explica la falta de permiso para vincular sin mostrar una acción imposible', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ estado: { conectado: false } });
    renderSeccion({ puedeClassroomConectar: false });

    expect(await screen.findByText('Cuenta Classroom no conectada')).toBeInTheDocument();
    expect(screen.getByText(/no tiene permiso para vincular Google Classroom/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conectar Google Classroom' })).not.toBeInTheDocument();
  });

  it('explica la falta de permiso para administrar una conexión existente', async () => {
    renderSeccion({ puedeClassroomConectar: false });

    expect(await screen.findByText('Cuenta conectada')).toBeInTheDocument();
    expect(screen.getByText(/no tiene permiso para administrarla/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desconectar' })).not.toBeInTheDocument();
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

  it('muestra la actualización y descarta consultas de conexión que responden tarde', async () => {
    const pendientes: Array<(value: { estado: { conectado: boolean; correoGoogle?: string } }) => void> = [];
    let consultasEstado = 0;
    vi.mocked(clienteApi.obtener).mockImplementation((ruta) => {
      if (ruta === '/evaluaciones/v2/classroom/estado') {
        consultasEstado += 1;
        if (consultasEstado === 1) return Promise.resolve({ estado: { conectado: false } });
        return new Promise((resolve) => { pendientes.push(resolve); });
      }
      return Promise.resolve({ url: 'https://accounts.google.com/authorize' });
    });

    renderSeccion();
    const botonConectar = await screen.findByRole('button', { name: 'Conectar Google Classroom' });
    fireEvent.focus(window);
    fireEvent.focus(window);

    await waitFor(() => expect(consultasEstado).toBe(3));
    expect(screen.getByRole('status')).toHaveTextContent('Actualizando el estado de conexión');
    expect(botonConectar).toBeDisabled();

    pendientes[1]!({ estado: { conectado: true, correoGoogle: 'docente@example.test' } });
    expect(await screen.findByText('docente@example.test')).toBeInTheDocument();
    pendientes[0]!({ estado: { conectado: false } });
    await waitFor(() => expect(screen.getByText('Cuenta conectada')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Conectar Google Classroom' })).not.toBeInTheDocument();
  });

  it('conserva el último estado confirmado si falla una actualización y permite reintentar', async () => {
    let consultasEstado = 0;
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (ruta !== '/evaluaciones/v2/classroom/estado') return {};
      consultasEstado += 1;
      if (consultasEstado === 1) return { estado: { conectado: true, correoGoogle: 'docente@example.test' } };
      if (consultasEstado === 2) throw new Error('Servicio temporalmente no disponible.');
      return { estado: { conectado: false } };
    });
    renderSeccion();

    expect(await screen.findByText('Cuenta conectada')).toBeInTheDocument();
    fireEvent.focus(window);
    expect(await screen.findByText(/último estado confirmado: conectada/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Servicio temporalmente no disponible.');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' }));
    expect(await screen.findByText('Cuenta Classroom no conectada')).toBeInTheDocument();
    expect(screen.queryByText(/último estado confirmado: conectada/i)).not.toBeInTheDocument();
    expect(consultasEstado).toBe(3);
  });
});

describe('GuiaClassroomVisual', () => {
  it('explica qué datos consulta y evita afirmaciones de cifrado no aplicables a todos los entornos', () => {
    localStorage.removeItem('ep.guia.classroom.oculta');
    render(<GuiaClassroomVisual />);

    expect(screen.getByRole('region', { name: 'Ayuda: Sincronización con Google Classroom' })).toBeInTheDocument();
    expect(screen.getByText(/cursos, temas, listas de alumnos y actividades de Classroom/i)).toBeInTheDocument();
    expect(screen.getByText(/asigna cada estudiante a su registro de EvaluaPro; después guarda las vinculaciones del periodo/i)).toBeInTheDocument();
    expect(screen.getByText('Asignación manual')).toBeInTheDocument();
    expect(screen.queryByText(/AES-256|Google SSO|Token Cifrado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/autovinculación instantánea|Auto-match 1 Clic/i)).not.toBeInTheDocument();
    const ocultar = screen.getByRole('button', { name: 'Ocultar guía rápida' });
    expect(ocultar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(ocultar);
    expect(screen.getByRole('button', { name: /Ver guía rápida de sincronización con Google Classroom/i })).toBeInTheDocument();
  });
});
