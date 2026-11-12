/**
 * seccionAsistencias.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionAsistencias } from '../src/apps/app_docente/SeccionAsistencias';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { emitToast } from '../src/ui/toast/toastBus';
import { ErrorRemoto } from '../src/servicios_api/clienteComun';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    eliminar: vi.fn()
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionAsistencias (Resiliencia)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('presenta un encabezado preciso y no duplica el icono junto al título', () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [], reglas: [] });
    render(<SeccionAsistencias periodos={[]} alumnos={[]} />);

    expect(screen.getByText('Seguimiento de asistencia')).toBeVisible();
    expect(screen.getByText('Registra sesiones, revisa asistencias y consulta la elegibilidad para examen.')).toBeVisible();
    expect(screen.queryByText(/Control de Asistencia Activo|1 clic|Semáforo de examen/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asistencias' }).querySelector('svg')).toBeNull();
  });

  it('maneja fallos de red al cargar el resumen de asistencias sin colapsar', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.includes('/asistencias/resumen')) throw new Error('DB Timeout Connection');
      if (url.includes('/asistencias/sesiones?')) return { sesiones: [] };
      return { reglas: [] };
    });

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1' }]}
        puedeGestionar={true}
      />
    );

    // Seleccionamos un periodo para gatillar la carga
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'per-1' }
    });

    expect(await screen.findByText(/La información de elegibilidad no está disponible/i)).toBeInTheDocument();

    // La UI no debe crashear, debe mantener el título principal visible
    expect(screen.getByRole('heading', { name: /Asistencias/i })).toBeInTheDocument();
  });

  it('explica la incertidumbre al fallar la creación de sesión sin exponer el mensaje técnico', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [] });
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Network Error'));

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1', grupo: 'A' }]}
        puedeGestionar={true}
      />
    );

    // Cambiar el periodo para que se muestre el formulario de "Nueva sesión"
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.change(comboboxes[0], {
      target: { value: 'per-1' }
    });

    // Esperar a que renderice "Crear e iniciar"
    await screen.findByRole('button', { name: /Crear e iniciar/i });
    expect(screen.getByPlaceholderText('Ej. Unidad 2')).toBeVisible();
    expect(screen.queryByPlaceholderText('Ej. Unidad 2: Modelado y ETL')).not.toBeInTheDocument();

    // Cambiar el grupo en el select de la sesión nueva
    const selects = screen.getAllByRole('combobox');
    if (selects.length > 1) {
      fireEvent.change(selects[1], { target: { value: 'A' } });
    }

    // Guardar (Crear sesión)
    fireEvent.click(screen.getByRole('button', { name: /Crear e iniciar/i }));

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          title: 'No se pudo crear la sesión',
          message: 'No se confirmó la creación. Revisa la lista de sesiones antes de volver a crearla.'
        })
      );
    });
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'Network Error' }));

    expect(screen.getByRole('heading', { name: /Asistencias/i })).toBeInTheDocument();
  });

  it('ofrece cerrar la sesión cuando falla el guardado de una regla por credencial vencida', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [], reglas: [] });
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new ErrorRemoto('No autorizado', { status: 401, codigo: 'TOKEN_EXPIRADO' }));

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true }]}
        alumnos={[]}
        puedeGestionar={true}
      />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('tab', { name: /Reglas/i }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar regla/i }));

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({
        level: 'error',
        title: 'No se pudo guardar la regla',
        message: expect.stringMatching(/sesion expiro/i),
        action: expect.objectContaining({ label: 'Cerrar sesión' }),
        persistent: true
      }));
    });
  });

  it('permite configurar y guardar reglas de asistencia con conteo de retardos', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({
      resumen: [],
      sesiones: [],
      reglas: [
        { _id: 'reg-1', maxFaltas: 3, accion: 'bloquear_examen', grupo: 'A', contarRetardos: true, retardosEquivalenFalta: 3 }
      ]
    });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({ regla: { _id: 'reg-1', maxFaltas: 4, accion: 'bloquear_examen' } });

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1' }]}
        puedeGestionar={true}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });

    // Navegar a pestaña reglas
    const tabReglas = screen.getByRole('tab', { name: /Reglas/i });
    fireEvent.click(tabReglas);

    const panelReglas = screen.getByRole('tabpanel', { name: /Reglas/i });
    expect(panelReglas).toHaveTextContent('Configurar regla de asistencia y derecho a examen');
    expect(panelReglas).toHaveTextContent('Bloquear examen');
    expect(panelReglas).toHaveTextContent('Solo advertir');
    const accionRegla = within(panelReglas).getByRole('combobox', { name: /Acción al superar el límite/i });
    expect(accionRegla).toHaveAccessibleDescription(/las excepciones se autorizan desde Resumen/i);
    fireEvent.change(accionRegla, { target: { value: 'advertir' } });
    expect(accionRegla).toHaveAccessibleDescription(/muestra una advertencia sin bloquear el examen/i);
    fireEvent.change(accionRegla, { target: { value: 'bloquear_examen' } });
    ['✓', '✕', '→', '🚫', '⚠️', '⏱', 'ℹ️'].forEach((glifo) => {
      expect(panelReglas.textContent).not.toContain(glifo);
    });

    // Habilitar conteo de retardos
    const checkboxRetardo = screen.getByRole('checkbox');
    const btnGuardar = screen.getByRole('button', { name: /Guardar regla/i });
    expect(checkboxRetardo.compareDocumentPosition(btnGuardar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(checkboxRetardo);

    fireEvent.click(btnGuardar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/asistencias/reglas', expect.objectContaining({
        periodoId: 'per-1',
        contarRetardos: true
      }));
    });
  });

  it('bloquea envíos repetidos mientras guarda la regla y comunica el progreso', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [], reglas: [] });
    let resolver!: (value: unknown) => void;
    const guardadoPendiente = new Promise((resolve) => { resolver = resolve; });
    vi.mocked(clienteApi.enviar).mockReturnValueOnce(guardadoPendiente as never);

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true }]}
        alumnos={[]}
        puedeGestionar={true}
      />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('tab', { name: /Reglas/i }));

    const botonGuardar = screen.getByRole('button', { name: 'Guardar regla' });
    act(() => {
      fireEvent.click(botonGuardar);
      fireEvent.click(botonGuardar);
    });

    const botonOcupado = screen.getByRole('button', { name: 'Guardando regla…' });
    expect(botonOcupado).toBeDisabled();
    expect(botonOcupado).toHaveAttribute('aria-busy', 'true');
    expect(clienteApi.enviar).toHaveBeenCalledTimes(1);

    resolver({ regla: { _id: 'reg-1', maxFaltas: 3, accion: 'bloquear_examen' } });
    await waitFor(() => expect(botonGuardar).toBeEnabled());
    expect(emitToast).toHaveBeenCalledTimes(1);
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({ level: 'ok', title: 'Regla guardada' }));
  });

  it('permite marcar a todos presentes y guardar el pase de lista', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.includes('/asistencias/sesiones/ses-1/registros')) {
        return { registros: [] };
      }
      if (url.includes('/asistencias/sesiones')) {
        return { sesiones: [{ _id: 'ses-1', fecha: '2026-08-21T12:00:00Z', grupo: 'A' }] };
      }
      return { resumen: [], reglas: [] };
    });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({ guardados: 1 });

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1', grupo: 'A' }]}
        puedeGestionar={true}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });

    const btnSesion = await screen.findByRole('button', { name: /21 ago.*A/i });
    fireEvent.click(btnSesion);

    const btnTodosPresentes = await screen.findByRole('button', { name: /Todos Presentes/i });
    fireEvent.click(btnTodosPresentes);
    const avisoPaseRapido = screen.getByText('Se marcó a todo el grupo como Presente. Revisa cada registro antes de guardar.');
    expect(avisoPaseRapido.closest('[role="status"]')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();

    const marcarFalta = screen.getByRole('button', { name: /Marcar a Alumno 1 como Falta/i });
    fireEvent.click(marcarFalta);
    expect(marcarFalta).toHaveAttribute('aria-pressed', 'true');

    const btnGuardarLista = screen.getByRole('button', { name: /Guardar lista/i });
    fireEvent.click(btnGuardarLista);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith(
        '/asistencias/sesiones/ses-1/registros',
        expect.anything()
      );
    });
  });

  it('crea la lista solo para el grupo elegido y permite marcar Justificada directamente', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [], reglas: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({
      sesion: { _id: 'ses-2', fecha: '2026-09-22T12:00:00.000Z', grupo: 'B' }
    }).mockResolvedValueOnce({ total: 1 });

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A', 'B'] }]}
        alumnos={[
          { _id: 'alu-a', nombreCompleto: 'Alumno Grupo A', matricula: 'A1', periodoId: 'per-1', grupo: 'A' },
          { _id: 'alu-b', nombreCompleto: 'Alumno Grupo B', matricula: 'B1', periodoId: 'per-1', grupo: 'B' },
          { _id: 'alu-otro-periodo', nombreCompleto: 'Alumno Otro Periodo', matricula: 'C1', periodoId: 'per-2', grupo: 'B' }
        ]}
        puedeGestionar
      />
    );

    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'per-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[2]!, { target: { value: 'B' } });
    fireEvent.click(await screen.findByRole('button', { name: /Crear e iniciar/i }));

    expect(await screen.findByText('Alumno Grupo B')).toBeInTheDocument();
    expect(screen.getByText(/inicia con todos los alumnos como Presentes/i)).toBeInTheDocument();
    expect(screen.queryByText('Alumno Grupo A')).not.toBeInTheDocument();
    expect(screen.queryByText('Alumno Otro Periodo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Marcar a Alumno Grupo B como Justificada/i }));
    const motivo = screen.getByRole('textbox', { name: 'Motivo de justificación para Alumno Grupo B' });
    expect(motivo).toHaveAttribute('maxLength', '300');
    fireEvent.change(motivo, { target: { value: 'Cita médica' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar lista/i }));

    await waitFor(() => expect(clienteApi.enviar).toHaveBeenLastCalledWith(
      '/asistencias/sesiones/ses-2/registros',
      { registros: [{ alumnoId: 'alu-b', estado: 'J', justificacion: 'Cita médica' }] }
    ));
  });

  it('mantiene en solo lectura los controles de gestión', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [], reglas: [] });
    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1', grupo: 'A' }]}
      />
    );
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'per-1' } });
    expect(await screen.findByText(/Tienes acceso de solo lectura/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear e iniciar/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: /Reglas/i }));
    expect(screen.getByRole('button', { name: /Guardar regla/i })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: /Máximo de faltas/i })).toBeDisabled();
  });

  it('limita los conteos rápidos a alumnos activos del periodo', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [], reglas: [] });
    render(<SeccionAsistencias
      periodos={[
        { _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A', 'B'] },
        { _id: 'per-2', nombre: 'Periodo 2', activo: true, grupos: ['B'] }
      ]}
      alumnos={[
        { _id: 'a1', nombreCompleto: 'Activo A', matricula: 'A1', periodoId: 'per-1', grupo: 'A' },
        { _id: 'b1', nombreCompleto: 'Activo B', matricula: 'B1', periodoId: 'per-1', grupo: 'B' },
        { _id: 'b2', nombreCompleto: 'Inactivo B', matricula: 'B2', periodoId: 'per-1', grupo: 'B', activo: false },
        { _id: 'b3', nombreCompleto: 'Otro periodo', matricula: 'B3', periodoId: 'per-2', grupo: 'B' }
      ]}
    />);

    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'per-1' } });
    const todos = await screen.findByRole('button', { name: 'Todos (2)' });
    const grupoA = screen.getByRole('button', { name: 'A (1)' });
    const grupoB = screen.getByRole('button', { name: 'B (1)' });
    expect(todos).toHaveAttribute('aria-pressed', 'true');
    expect(grupoA).toHaveAttribute('aria-pressed', 'false');
    expect(grupoB).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(grupoB);
    expect(grupoB).toHaveAttribute('aria-pressed', 'true');
    expect(todos).toHaveAttribute('aria-pressed', 'false');
  });

  it('explica a qué periodo y grupo corresponde el KPI de alumnos', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [], reglas: [] });
    render(<SeccionAsistencias
      periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A', 'B'] }]}
      alumnos={[
        { _id: 'a1', nombreCompleto: 'Alumno A', matricula: 'A1', periodoId: 'per-1', grupo: 'A' },
        { _id: 'b1', nombreCompleto: 'Alumno B', matricula: 'B1', periodoId: 'per-1', grupo: 'B' }
      ]}
    />);

    const kpi = document.querySelector('.asistencia-mini-kpi--alumnos');
    expect(kpi).not.toBeNull();
    expect(within(kpi as HTMLElement).getByText('Alumnos')).toBeInTheDocument();
    expect(kpi).toHaveAttribute('data-tooltip', 'Selecciona un periodo para consultar el total de alumnos activos.');

    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'per-1' } });
    await screen.findByRole('button', { name: 'Todos (2)' });
    expect(within(kpi as HTMLElement).getByText('Alumnos · todos los grupos')).toBeInTheDocument();
    expect(kpi).toHaveAttribute('data-tooltip', 'Total de alumnos activos del periodo seleccionado en todos los grupos.');

    fireEvent.click(screen.getByRole('button', { name: 'A (1)' }));
    expect(within(kpi as HTMLElement).getByText('Alumnos · grupo A')).toBeInTheDocument();
    expect(kpi).toHaveAttribute('data-tooltip', 'Total de alumnos activos del grupo A en el periodo seleccionado.');
  });

  it('describe el alcance real de asistencia promedio y examen bloqueado', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [], reglas: [] });
    render(<SeccionAsistencias
      periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A', 'B'] }]}
      alumnos={[
        { _id: 'a1', nombreCompleto: 'Alumno A', matricula: 'A1', periodoId: 'per-1', grupo: 'A' },
        { _id: 'b1', nombreCompleto: 'Alumno B', matricula: 'B1', periodoId: 'per-1', grupo: 'B' }
      ]}
    />);

    const kpiPromedio = document.querySelector('.asistencia-mini-kpi--promedio');
    const kpiBloqueados = document.querySelector('.asistencia-mini-kpi--sin-derecho');
    expect(kpiPromedio).toHaveAttribute('data-tooltip', 'Selecciona un periodo para consultar el promedio de asistencia.');
    expect(kpiBloqueados).toHaveAttribute('data-tooltip', 'Selecciona un periodo para consultar los alumnos con examen bloqueado.');

    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'per-1' } });
    await screen.findByRole('button', { name: 'Todos (2)' });
    expect(kpiPromedio).toHaveAttribute('data-tooltip', 'Promedio de asistencia del periodo seleccionado en todos los grupos.');
    expect(kpiBloqueados).toHaveAttribute('data-tooltip', 'Alumnos con examen bloqueado en todos los grupos del periodo seleccionado.');

    fireEvent.click(screen.getByRole('button', { name: 'A (1)' }));
    expect(kpiPromedio).toHaveAttribute('data-tooltip', 'Promedio de asistencia del grupo A en el periodo seleccionado.');
    expect(kpiBloqueados).toHaveAttribute('data-tooltip', 'Alumnos con examen bloqueado del grupo A en el periodo seleccionado.');
  });

  it('expone error de resumen con reintento y no lo presenta como lista vacía', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.includes('/asistencias/resumen')) throw new Error('timeout');
      if (url.includes('/asistencias/sesiones?')) return { sesiones: [] };
      if (url.includes('/asistencias/reglas')) return { reglas: [] };
      return {};
    });
    render(<SeccionAsistencias
      periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] }]}
      alumnos={[{ _id: 'a1', nombreCompleto: 'Alumno', matricula: 'A1', periodoId: 'per-1', grupo: 'A' }]}
    />);
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'per-1' } });
    expect(await screen.findByText(/La información de elegibilidad no está disponible/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sin sesiones registradas aún/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar resumen' })).toBeInTheDocument();
  });

  it('recupera el resumen después de reintentar una consulta fallida', async () => {
    let intentos = 0;
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.includes('/asistencias/resumen')) {
        intentos += 1;
        if (intentos === 1) throw new Error('timeout');
        return { resumen: [{
          alumnoId: 'a1', matricula: 'A1', nombreCompleto: 'Alumno recuperado', grupo: 'A',
          presentes: 8, faltas: 2, retardos: 0, justificadas: 0, totalSesiones: 10,
          porcentajeAsistencia: 80, superaLimiteFaltas: false, tieneExcepcion: false, bloqueadoExamen: false
        }] };
      }
      if (url.includes('/asistencias/sesiones?')) return { sesiones: [] };
      return { reglas: [] };
    });
    render(<SeccionAsistencias
      periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] }]}
      alumnos={[{ _id: 'a1', nombreCompleto: 'Alumno recuperado', matricula: 'A1', periodoId: 'per-1', grupo: 'A' }]}
    />);
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'per-1' } });
    expect(await screen.findByText(/La información de elegibilidad no está disponible/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar resumen' }));
    expect(await screen.findByText('Alumno recuperado')).toBeInTheDocument();
    expect(screen.getAllByText('80%')).toHaveLength(2);
    const regionTabla = screen.getByRole('region', { name: 'Resumen de asistencia por alumno' });
    expect(regionTabla).toHaveAttribute('tabindex', '0');
    expect(regionTabla).toHaveAttribute('aria-describedby', 'asistencias-tabla-ayuda');
    expect(screen.getByText(/Con el teclado, enfoca la tabla y pulsa las flechas para desplazar sus columnas; también puedes deslizarla/i)).toBeInTheDocument();
    const tabla = screen.getByRole('table', { name: 'Resumen de asistencia del periodo seleccionado por alumno' });
    for (const encabezado of ['Alumno', 'Matrícula', 'Grupo', 'Presentes', 'Faltas', 'Retardos', 'Justificadas', 'Porcentaje de asistencia', 'Derecho a Examen', 'Acciones']) {
      expect(within(tabla).getByRole('columnheader', { name: encabezado })).toHaveAttribute('scope', 'col');
    }
  });

  it('anuncia una actualización breve sin hacer viva toda la cuadrícula KPI', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.includes('/asistencias/resumen')) return { resumen: [] };
      if (url.includes('/asistencias/sesiones?')) return { sesiones: [] };
      if (url.includes('/asistencias/reglas')) return { reglas: [] };
      return {};
    });
    render(<SeccionAsistencias
      periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] }]}
      alumnos={[{ _id: 'a1', nombreCompleto: 'Alumno', matricula: 'A1', periodoId: 'per-1', grupo: 'A' }]}
    />);
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'per-1' } });

    expect(await screen.findByRole('status', { name: 'Estado del resumen de asistencia' }))
      .toHaveTextContent('Resumen actualizado para Periodo 1, todos los grupos, 0 sesiones y 1 alumno.');
    expect(document.querySelector('.asistencias-header-kpis')).not.toHaveAttribute('aria-live');
  });

  it('expone pestañas vinculadas a paneles y navega por flechas', () => {
    render(<SeccionAsistencias periodos={[]} alumnos={[]} />);
    const resumenTab = screen.getByRole('tab', { name: /Resumen General/i });
    expect(resumenTab).toHaveAttribute('aria-controls', 'asistencias-panel-resumen');
    expect(screen.getByRole('tabpanel', { name: /Resumen General/i })).toBeInTheDocument();
    fireEvent.keyDown(resumenTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Pase de Lista/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: /Pase de Lista/i })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: /Pase de Lista/i }), { key: 'End' });
    expect(screen.getByRole('tab', { name: /Reglas/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: /Reglas/i }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: /Resumen General/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('distingue errores de sesiones y reglas de listas vacías y permite reintentar', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.includes('/asistencias/resumen')) return { resumen: [] };
      if (url.includes('/asistencias/sesiones?')) throw new Error('offline');
      if (url.includes('/asistencias/reglas')) throw new Error('offline');
      return {};
    });
    render(<SeccionAsistencias
      periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] }]}
      alumnos={[]}
    />);
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'per-1' } });
    expect(await screen.findByText(/No se pudieron cargar las sesiones registradas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Reglas/i }));
    expect(await screen.findByText(/No se pudieron cargar las reglas vigentes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar reglas' })).toBeInTheDocument();
  });

  it('descarta sesiones que responden tarde desde otro periodo', async () => {
    const pendientes: Record<string, (value: unknown) => void> = {};
    vi.mocked(clienteApi.obtener).mockImplementation((url: string) => {
      if (url.includes('/asistencias/sesiones?')) {
        const periodo = url.includes('per-1') ? 'per-1' : 'per-2';
        return new Promise((resolve) => { pendientes[periodo] = resolve; });
      }
      if (url.includes('/asistencias/resumen')) return Promise.resolve({ resumen: [] });
      return Promise.resolve({ reglas: [] });
    });
    render(<SeccionAsistencias
      periodos={[
        { _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] },
        { _id: 'per-2', nombre: 'Periodo 2', activo: true, grupos: ['A'] }
      ]}
      alumnos={[]}
    />);
    const selectorPeriodo = screen.getAllByRole('combobox')[0]!;
    fireEvent.change(selectorPeriodo, { target: { value: 'per-1' } });
    await waitFor(() => expect(pendientes['per-1']).toBeDefined());
    fireEvent.change(selectorPeriodo, { target: { value: 'per-2' } });
    await waitFor(() => expect(pendientes['per-2']).toBeDefined());
    pendientes['per-2']!({ sesiones: [{ _id: 's2', fecha: '2026-08-22T12:00:00Z', grupo: 'A', temaNombre: 'Periodo nuevo' }] });
    expect(await screen.findByText('Periodo nuevo')).toBeInTheDocument();
    pendientes['per-1']!({ sesiones: [{ _id: 's1', fecha: '2026-08-21T12:00:00Z', grupo: 'A', temaNombre: 'Periodo anterior' }] });
    await waitFor(() => expect(screen.queryByText('Periodo anterior')).not.toBeInTheDocument());
    expect(screen.getByText('Periodo nuevo')).toBeInTheDocument();
  });

  it('bloquea el guardado cuando falla la lectura de registros de una sesión', async () => {
    let intentos = 0;
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.includes('/asistencias/sesiones/ses-1/registros')) {
        intentos += 1;
        if (intentos === 1) throw new Error('offline');
        return { registros: [] };
      }
      if (url.includes('/asistencias/sesiones?')) return { sesiones: [{ _id: 'ses-1', fecha: '2026-08-21T12:00:00Z', grupo: 'A' }] };
      if (url.includes('/asistencias/resumen')) return { resumen: [] };
      return { reglas: [] };
    });
    render(<SeccionAsistencias
      periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] }]}
      alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1', grupo: 'A' }]}
      puedeGestionar
    />);
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'per-1' } });
    fireEvent.click(await screen.findByRole('button', { name: /21 ago.*A/i }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/No se pudieron cargar los registros/i);
    expect(emitToast).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Guardar lista/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga de lista' }));
    expect(await screen.findByRole('button', { name: /Guardar lista/i })).toBeEnabled();
  });
});

