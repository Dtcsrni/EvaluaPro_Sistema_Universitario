/**
 * seccionEvaluaciones.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionEvaluaciones } from '../src/apps/app_docente/SeccionEvaluaciones';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { emitToast } from '../src/ui/toast/toastBus';
import { ErrorRemoto } from '../src/servicios_api/clienteComun';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn()
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

vi.mock('../src/apps/app_docente/CentroClassroom', () => ({
  CentroClassroom: () => <div data-testid="centro-classroom">Mock CentroClassroom</div>
}));

describe('SeccionEvaluaciones', () => {
  const periodosMock = [
    { _id: 'per-1', nombre: 'Periodo 2026-A', activo: true }
  ];

  const alumnosMock = [
    { _id: 'alu-1', nombreCompleto: 'Juan Pérez', periodoId: 'per-1', matricula: 'A100' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza correctamente y carga el contexto de políticas del periodo', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({
      politicas: [
        { codigo: 'POLICY_LISC_ENCUADRE_2026', version: 1, nombre: 'LISC Encuadre 2026' }
      ],
      configuracion: {
        politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
        politicaVersion: 1
      }
    });

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );

    expect(screen.getByText('Evaluaciones y políticas')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^política$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^evidencias$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^exámenes$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^resumen$/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(clienteApi.obtener).toHaveBeenCalledWith('/evaluaciones/v2/contexto?periodoId=per-1');
    });
    expect(await screen.findByText('1 política activa')).toBeInTheDocument();
    expect(screen.getByText('Política', { selector: '.banco-mini-kpi__lbl' })).toBeInTheDocument();
    expect(screen.getByText('Alumno', { selector: '.banco-mini-kpi__lbl' })).toBeInTheDocument();
  });

  it('sin periodos disponibles no muestra alumnos de otros contextos ni un conteo como cero', () => {
    render(<SeccionEvaluaciones periodos={[]} alumnos={alumnosMock} puedeGestionar />);

    const selectorPeriodo = screen.getByRole('combobox', { name: /^periodo$/i });
    const selectorAlumno = screen.getByRole('combobox', { name: /^alumno$/i });
    expect(selectorPeriodo).toBeDisabled();
    expect(selectorAlumno).toBeDisabled();
    expect(within(selectorPeriodo).getByRole('option', { name: 'No hay periodos disponibles' })).toBeInTheDocument();
    expect(within(selectorAlumno).getByRole('option', { name: 'No hay periodos disponibles' })).toBeInTheDocument();
    expect(within(selectorAlumno).queryByRole('option', { name: 'Juan Pérez' })).not.toBeInTheDocument();
    expect(document.querySelector('.evaluaciones-header-kpis .banco-mini-kpi--temas .banco-mini-kpi__num')).toHaveTextContent('—');
    expect(screen.getByText(/No hay periodos disponibles para configurar o consultar evaluaciones/i)).toBeInTheDocument();
  });

  it('distingue la carga de periodos de una lista vacía', () => {
    render(<SeccionEvaluaciones periodos={[]} alumnos={alumnosMock} puedeGestionar cargandoPeriodos />);

    expect(screen.getByRole('combobox', { name: /^periodo$/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /^periodo$/i })).toHaveTextContent('Cargando periodos…');
    expect(screen.getByRole('status')).toHaveTextContent('Cargando periodos para consultar o registrar evaluaciones…');
    expect(screen.queryByText('No hay periodos disponibles para configurar o consultar evaluaciones.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar carga de periodos' })).not.toBeInTheDocument();
  });

  it('ofrece reintentar cuando no se pudieron cargar los periodos', async () => {
    const reintentar = vi.fn();
    const user = userEvent.setup();
    render(
      <SeccionEvaluaciones
        periodos={[]}
        alumnos={alumnosMock}
        puedeGestionar
        errorPeriodos
        onReintentarPeriodos={reintentar}
      />
    );

    expect(screen.getByRole('combobox', { name: /^periodo$/i })).toHaveTextContent('No se pudieron cargar los periodos');
    expect(screen.getByRole('status')).toHaveTextContent('No se pudieron cargar los periodos. Reintenta para consultar o registrar evaluaciones.');
    await user.click(screen.getByRole('button', { name: 'Reintentar carga de periodos' }));
    expect(reintentar).toHaveBeenCalledOnce();
  });

  it('nombra el grupo KPI y presenta una guía alineada con las cuatro vistas', () => {
    localStorage.removeItem('ep.guia.evaluaciones.oculta');
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [] });
    const { container, rerender } = render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );

    expect(screen.getByRole('group', { name: 'Resumen de evaluaciones' })).not.toHaveAttribute('aria-live');
    expect(screen.getByRole('region', { name: 'Ayuda: Analítica de evaluaciones' })).toBeInTheDocument();
    expect(screen.getByText('2 políticas activas')).toBeInTheDocument();
    expect(screen.getByText('Políticas', { selector: '.banco-mini-kpi__lbl' })).toBeInTheDocument();
    expect(screen.getByText('Alumno', { selector: '.banco-mini-kpi__lbl' })).toBeInTheDocument();
    for (const etiqueta of ['Política', 'Evidencias', 'Exámenes', 'Resumen']) {
      expect(screen.getByRole('heading', { name: etiqueta })).toBeInTheDocument();
    }
    expect(container.querySelector('.evaluaciones-panel svg:not(.icono-lucide)')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(document.body.textContent).not.toMatch(/Campana de Gauss|Sábanas y Reportes|Excel, CSV o PDF/i);
    rerender(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={[...alumnosMock, { _id: 'alu-2', nombreCompleto: 'Ana Ruiz', periodoId: 'per-1', matricula: 'A101' }]}
        puedeGestionar
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );
    expect(screen.getByText('Alumnos', { selector: '.banco-mini-kpi__lbl' })).toBeInTheDocument();
  });

  it('pliega la guía en móvil y mantiene un disclosure accesible', () => {
    localStorage.removeItem('ep.guia.evaluaciones.oculta');
    const descriptorMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true })
    });
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [] });

    try {
      render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);

      const mostrar = screen.getByRole('button', { name: 'Ver guía rápida de Evaluaciones' });
      expect(mostrar).toHaveAttribute('aria-expanded', 'false');
      const contenidoId = mostrar.getAttribute('aria-controls');
      expect(contenidoId).toBeTruthy();
      expect(document.getElementById(contenidoId!)).toHaveAttribute('hidden');

      fireEvent.click(mostrar);
      expect(localStorage.getItem('ep.guia.evaluaciones.oculta')).toBe('false');
      const ocultar = screen.getByRole('button', { name: 'Ocultar guía rápida' });
      expect(ocultar).toHaveAttribute('aria-expanded', 'true');
      expect(ocultar).toHaveAttribute('aria-controls', contenidoId);
      expect(screen.getByRole('region', { name: 'Ayuda: Analítica de evaluaciones' })).toBeVisible();
      fireEvent.click(ocultar);
      expect(localStorage.getItem('ep.guia.evaluaciones.oculta')).toBe('true');
      expect(screen.getByRole('button', { name: 'Ver guía rápida de Evaluaciones' })).toHaveAttribute('aria-expanded', 'false');
      expect(document.getElementById(contenidoId!)).toHaveAttribute('hidden');
    } finally {
      localStorage.removeItem('ep.guia.evaluaciones.oculta');
      if (descriptorMatchMedia) Object.defineProperty(window, 'matchMedia', descriptorMatchMedia);
      else Reflect.deleteProperty(window, 'matchMedia');
    }
  });

  it('expone pestañas y paneles asociados; las flechas mueven el foco sin activar cargas', () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [] });
    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);

    const tabPolitica = screen.getByRole('tab', { name: 'Política' });
    const tabEvidencias = screen.getByRole('tab', { name: 'Evidencias' });
    expect(screen.getByText(/el alumno seleccionado se conserva para las otras vistas y no afecta esta configuración/i)).toBeInTheDocument();
    expect(tabPolitica).toHaveAttribute('aria-selected', 'true');
    expect(tabPolitica).toHaveAttribute('aria-controls', 'evaluaciones-panel-politica');
    expect(screen.getByRole('tabpanel', { name: 'Política' })).toBeVisible();
    expect(document.getElementById('evaluaciones-panel-evidencias')).toHaveAttribute('hidden');

    tabPolitica.focus();
    fireEvent.keyDown(tabPolitica, { key: 'ArrowRight' });
    expect(tabEvidencias).toHaveFocus();
    expect(tabEvidencias).toHaveAttribute('aria-selected', 'false');
    expect(clienteApi.obtener).not.toHaveBeenCalledWith(expect.stringContaining('/evaluaciones/evidencias'));

    fireEvent.click(tabEvidencias);
    expect(tabEvidencias).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Evidencias' })).toBeVisible();
  });

  it('descarta una carga de política tardía al cambiar de periodo', async () => {
    let resolverContextoAnterior: ((respuesta: unknown) => void) | undefined;
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.includes('periodoId=per-1')) {
        return await new Promise((resolve) => { resolverContextoAnterior = resolve; }) as never;
      }
      if (url.includes('periodoId=per-2')) {
        return {
          politicas: [{ codigo: 'POLICY_NUEVA', version: 2, nombre: 'Política del periodo nuevo', familia: 'lisc_encuadre' }],
          configuracion: { politicaCodigo: 'POLICY_NUEVA', politicaVersion: 2 }
        } as never;
      }
      return { politicas: [] } as never;
    });

    render(
      <SeccionEvaluaciones
        periodos={[...periodosMock, { _id: 'per-2', nombre: 'Periodo 2026-B', activo: true }]}
        alumnos={alumnosMock}
        puedeGestionar
      />
    );
    await waitFor(() => expect(resolverContextoAnterior).toBeDefined());
    fireEvent.change(screen.getByLabelText(/^periodo$/i), { target: { value: 'per-2' } });

    const politica = screen.getByRole('combobox', { name: /^política$/i });
    await waitFor(() => expect(politica).toHaveValue('POLICY_NUEVA'));
    resolverContextoAnterior?.({
      politicas: [{ codigo: 'POLICY_ANTERIOR', version: 1, nombre: 'Política del periodo anterior', familia: 'lisc_encuadre' }],
      configuracion: { politicaCodigo: 'POLICY_ANTERIOR', politicaVersion: 1 }
    });

    await waitFor(() => expect(politica).toHaveValue('POLICY_NUEVA'));
    expect(screen.queryByRole('option', { name: 'Política del periodo anterior' })).not.toBeInTheDocument();
  });

  it('limpia el alumno y la edición activa al cambiar de periodo', async () => {
    const evidencia = {
      id: 'ev-1', titulo: 'Tarea existente', calificacionDecimal: 8, ponderacion: 1,
      corte: 1, fuente: 'manual' as const, updatedAt: '2026-10-28T12:00:00.000Z'
    };
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => (
      url.includes('/evaluaciones/evidencias?')
        ? { evidencias: [evidencia] } as never
        : { politicas: [] } as never
    ));
    const periodos = [
      ...periodosMock,
      { _id: 'per-2', nombre: 'Periodo 2026-B', activo: true }
    ];
    const alumnos = [
      ...alumnosMock,
      { _id: 'alu-2', nombreCompleto: 'Ana Ruiz', periodoId: 'per-2', matricula: 'A101' }
    ];

    render(<SeccionEvaluaciones periodos={periodos} alumnos={alumnos} puedeGestionar />);
    fireEvent.change(screen.getByLabelText(/^alumno$/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: /^evidencias$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^editar$/i }));
    expect(screen.getByRole('button', { name: /guardar cambios auditados/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^periodo$/i), { target: { value: 'per-2' } });

    expect(screen.getByLabelText(/^alumno$/i)).toHaveValue('');
    expect(screen.getByLabelText(/^título de la evidencia$/i)).toHaveValue('');
    expect(screen.queryByRole('button', { name: /guardar cambios auditados/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar evidencia/i })).toBeDisabled();
    expect(clienteApi.actualizar).not.toHaveBeenCalled();
  });

  it('termina la edición de una evidencia al cambiar de alumno', async () => {
    const evidencia = {
      id: 'ev-1', titulo: 'Tarea existente', calificacionDecimal: 8, ponderacion: 1,
      corte: 1, fuente: 'manual' as const, updatedAt: '2026-10-28T12:00:00.000Z'
    };
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => (
      url.includes('/evaluaciones/evidencias?')
        ? { evidencias: [evidencia] } as never
        : { politicas: [] } as never
    ));
    const alumnos = [
      ...alumnosMock,
      { _id: 'alu-2', nombreCompleto: 'Ana Ruiz', periodoId: 'per-1', matricula: 'A101' }
    ];

    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnos} puedeGestionar />);
    fireEvent.change(screen.getByLabelText(/^alumno$/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: /^evidencias$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^editar$/i }));
    expect(screen.getByRole('button', { name: /guardar cambios auditados/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^alumno$/i), { target: { value: 'alu-2' } });

    expect(screen.getByLabelText(/^título de la evidencia$/i)).toHaveValue('');
    expect(screen.queryByRole('button', { name: /guardar cambios auditados/i })).not.toBeInTheDocument();
    expect(clienteApi.actualizar).not.toHaveBeenCalled();
  });

  it('informa y permite reintentar una carga fallida del contexto de política', async () => {
    vi.mocked(clienteApi.obtener)
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({
        politicas: [{ codigo: 'POLICY_RECUPERADA', version: 2, nombre: 'Política recuperada', familia: 'lisc_encuadre' }],
        configuracion: { politicaCodigo: 'POLICY_RECUPERADA', politicaVersion: 2 }
      } as never);

    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo cargar la configuración/i);
    expect(screen.getByRole('button', { name: /guardar política/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /reintentar cargar configuración/i }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: /^política$/i })).toHaveValue('POLICY_RECUPERADA'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(clienteApi.obtener).toHaveBeenCalledTimes(2);
  });

  it('distingue los ceros reales de valores ausentes en el resumen', async () => {
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ politicas: [] })
      .mockResolvedValueOnce({ resumen: { examenesPorCorte: { global: 0 }, finalDecimal: 0, finalRedondeada: 0 } });

    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);
    fireEvent.change(screen.getByLabelText(/alumno/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Resumen' }));
    fireEvent.click(screen.getByRole('button', { name: /consultar resumen/i }));

    const resultados = await screen.findByRole('region', { name: 'Resultados del alumno' });
    const calificacionFinal = within(resultados).getByRole('group', { name: 'Calificación final' });
    expect(within(calificacionFinal).getByText('0.0000')).toBeInTheDocument();
    expect(within(calificacionFinal).getByText('0', { exact: true })).toBeInTheDocument();
    const continua = within(resultados).getByRole('group', { name: 'Evaluación continua' });
    expect(within(continua).getAllByText('—', { exact: true })).toHaveLength(3);
    const examenes = within(resultados).getByRole('group', { name: 'Exámenes' });
    expect(within(examenes).getAllByText('—', { exact: true })).toHaveLength(2);
    expect(within(examenes).getByText('0.00')).toBeInTheDocument();
    expect(within(resultados).getByText('Sin dato')).toBeInTheDocument();
  });

  it('distingue una respuesta sin resumen de una consulta todavía no realizada', async () => {
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ politicas: [] })
      .mockResolvedValueOnce({});
    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);
    fireEvent.change(screen.getByLabelText(/alumno/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Resumen' }));
    fireEvent.click(screen.getByRole('button', { name: /consultar resumen/i }));
    const mensajeSinResumen = await screen.findByText('No hay un resumen disponible para este alumno y periodo.');
    expect(mensajeSinResumen).not.toHaveTextContent(/api/i);
  });

  it('descarta un resumen tardío al cambiar de alumno', async () => {
    let resolverResumenAnterior: ((respuesta: unknown) => void) | undefined;
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.includes('/evaluaciones/v2/alumnos/alu-1/resumen')) {
        return await new Promise((resolve) => { resolverResumenAnterior = resolve; }) as never;
      }
      if (url.includes('/evaluaciones/v2/alumnos/alu-2/resumen')) {
        return { resumen: { finalDecimal: 9, finalRedondeada: 9 } } as never;
      }
      return { politicas: [] } as never;
    });

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={[...alumnosMock, { _id: 'alu-2', nombreCompleto: 'Ana Ruiz', periodoId: 'per-1', matricula: 'A102' }]}
        puedeGestionar
      />
    );
    fireEvent.change(screen.getByLabelText(/alumno/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Resumen' }));
    fireEvent.click(screen.getByRole('button', { name: /consultar resumen/i }));
    await waitFor(() => expect(resolverResumenAnterior).toBeDefined());

    fireEvent.change(screen.getByRole('combobox', { name: 'Alumno' }), { target: { value: 'alu-2' } });
    fireEvent.click(screen.getByRole('button', { name: /consultar resumen/i }));
    const resultadoFinal = await screen.findByRole('group', { name: 'Calificación final' });
    await within(resultadoFinal).findByText('9.0000');

    resolverResumenAnterior?.({ resumen: { finalDecimal: 3, finalRedondeada: 3 } });
    await waitFor(() => expect(within(resultadoFinal).queryByText('3.0000')).not.toBeInTheDocument());
    expect(within(resultadoFinal).getByText('9.0000')).toBeInTheDocument();
  });

  it('permite guardar la configuración de política y maneja errores de guardado', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({
      politicas: [
        { codigo: 'POLICY_LISC_ENCUADRE_2026', version: 1, nombre: 'LISC Encuadre 2026' }
      ]
    });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({});

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );
    await waitFor(() => expect(screen.queryByText(/cargando configuración del periodo/i)).not.toBeInTheDocument());

    const botonGuardar = screen.getByRole('button', { name: /guardar política/i });
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/politica', {
        periodoId: 'per-1',
        politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
        politicaVersion: 1
      });
    });

    const confirmacion = await screen.findByText('Configuración guardada');
    expect(confirmacion.closest('[role="status"]')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(/cargando configuración del periodo/i)).not.toBeInTheDocument());

    // Prueba de fallo al guardar política
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Politica Save Failed'));
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo guardar la política/i);
    });
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
  });

  it('conserva el borrador de versión y solo permite asignar la versión vigente de una política propia', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({
      politicas: [{
        codigo: 'POLICY_PERSONALIZADA',
        version: 3,
        nombre: 'Política personalizada',
        familia: 'lisc_encuadre',
        activa: true
      }],
      configuracion: { politicaCodigo: 'POLICY_PERSONALIZADA', politicaVersion: 2 }
    });

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );

    await waitFor(() => expect(screen.queryByText(/cargando configuración del periodo/i)).not.toBeInTheDocument());
    const version = screen.getByLabelText(/^versión$/i) as HTMLInputElement;
    const guardar = screen.getByRole('button', { name: /guardar política/i });
    expect(version.value).toBe('2');
    expect(version).toHaveAttribute('aria-invalid', 'true');
    expect(version.getAttribute('aria-describedby')).toContain('error-version-politica');
    expect(guardar).toBeDisabled();

    fireEvent.change(version, { target: { value: '' } });
    expect(version.value).toBe('');
    expect(screen.getByRole('alert')).toHaveTextContent(/número entero de versión/i);
    expect(guardar).toBeDisabled();

    fireEvent.change(version, { target: { value: '2.5' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/número entero de versión/i);
    expect(guardar).toBeDisabled();

    fireEvent.change(version, { target: { value: '3' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(guardar).toBeEnabled();
    fireEvent.click(guardar);

    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/politica', {
      periodoId: 'per-1',
      politicaCodigo: 'POLICY_PERSONALIZADA',
      politicaVersion: 3
    }));
  });

  it('permite crear una política dinámica desde la GUI', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );
    await waitFor(() => expect(screen.queryByText(/cargando configuración del periodo/i)).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /guardar nueva versión/i }));
    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/politicas', expect.objectContaining({
      codigo: 'POLICY_PERSONALIZADA',
      familia: 'lisc_encuadre',
      nombre: 'Política personalizada',
      parametros: expect.objectContaining({ pesosGlobales: { continua: 0.5, examenes: 0.5 } }),
      clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/i)
    })));
  });

  it('muestra junto al formulario el fallo al guardar una definición sin repetirlo en toast', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [] });
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Policy definition save failed'));
    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);
    await waitFor(() => expect(screen.queryByText(/cargando configuración del periodo/i)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /guardar nueva versión/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo guardar la política/i);
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
  });

  it('asocia el error de JSON inválido al editor y permite corregirlo antes de guardar', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);
    await waitFor(() => expect(screen.queryByText(/cargando configuración del periodo/i)).not.toBeInTheDocument());

    const parametros = screen.getByLabelText(/parámetros json/i);
    fireEvent.change(parametros, { target: { value: '{"pesosGlobales":' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar nueva versión/i }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/formato json no es válido/i);
    expect(parametros).toHaveAttribute('aria-invalid', 'true');
    expect(parametros.getAttribute('aria-describedby')).toContain('ayuda-parametros-politica');
    expect(parametros.getAttribute('aria-describedby')).toContain('error-parametros-politica');
    expect(clienteApi.enviar).not.toHaveBeenCalledWith('/evaluaciones/politicas', expect.anything());

    fireEvent.change(parametros, { target: { value: '[]' } });
    expect(screen.queryByText(/formato json no es válido/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /guardar nueva versión/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/deben ser un objeto json/i);
    expect(clienteApi.enviar).not.toHaveBeenCalledWith('/evaluaciones/politicas', expect.anything());

    fireEvent.change(parametros, { target: { value: '{"umbralAprobacion":6}' } });
    expect(screen.queryByText(/deben ser un objeto json/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /guardar nueva versión/i }));
    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/politicas', expect.objectContaining({
      parametros: { umbralAprobacion: 6 }
    })));
  });

  it('explica los parámetros admitidos por familia sin modificar el objeto al cambiarla', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [] });
    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);
    await waitFor(() => expect(screen.queryByText(/cargando configuración del periodo/i)).not.toBeInTheDocument());

    const familia = screen.getByLabelText(/familia de cálculo/i);
    const parametros = screen.getByLabelText(/parámetros json/i) as HTMLTextAreaElement;
    const objetoInicial = parametros.value;

    expect(familia).toHaveAttribute('aria-describedby', 'ayuda-familia-politica');
    expect(screen.getByText(/pesosGlobales \(continua, examenes\).*cada valor de peso va de 0 a 1 y cada grupo suma 1/i)).toBeInTheDocument();
    expect(parametros.getAttribute('aria-describedby')).toContain('ayuda-parametros-politica');

    await userEvent.selectOptions(familia, 'sv_excel_contract');

    expect(screen.getByText(/pesosExamen con global y parciales.*ambos deben sumar 1/i)).toBeInTheDocument();
    expect(screen.getByText(/no se convierten ni eliminan campos/i)).toBeInTheDocument();
    expect(parametros.value).toBe(objetoInicial);
  });

  it('archiva una política por la misma ruta auditable de la API', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({
      politicas: [{
        codigo: 'POLICY_PERSONALIZADA', version: 2, nombre: 'Política personalizada',
        familia: 'lisc_encuadre', parametros: { pesosGlobales: { continua: 0.5, examenes: 0.5 } }, activa: true
      }]
    } as never);
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );

    await screen.findByRole('option', { name: 'Política personalizada' });
    fireEvent.change(screen.getByRole('combobox', { name: /^política$/i }), { target: { value: 'POLICY_PERSONALIZADA' } });
    fireEvent.click(screen.getByRole('button', { name: /archivar política seleccionada/i }));
    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith(
      '/evaluaciones/politicas/POLICY_PERSONALIZADA/archivar',
      expect.objectContaining({
        clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        motivo: 'Archivada desde la interfaz docente',
        confirmarEliminacion: true
      })
    ));
  });

  it('evita mostrar errores técnicos al archivar una política y recomienda verificar su estado', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({
      politicas: [{
        codigo: 'POLICY_PERSONALIZADA', version: 2, nombre: 'Política personalizada',
        familia: 'lisc_encuadre', parametros: { pesosGlobales: { continua: 0.5, examenes: 0.5 } }, activa: true
      }]
    } as never);
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('TypeError: SQLITE_BUSY at C:\\private\\evaluaciones.db'));
    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);

    await screen.findByRole('option', { name: 'Política personalizada' });
    fireEvent.change(screen.getByRole('combobox', { name: /^política$/i }), { target: { value: 'POLICY_PERSONALIZADA' } });
    fireEvent.click(screen.getByRole('button', { name: /archivar política seleccionada/i }));

    await waitFor(() => expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      title: 'No se pudo archivar la política',
      message: 'No se pudo confirmar si se logró archivar la política. Actualiza la vista y verifica su estado antes de volver a intentarlo.'
    })));
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('SQLITE_BUSY') }));
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('private\\evaluaciones.db') }));
  });

  it('ofrece cerrar sesión al fallar el archivado de evidencia con 401', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (String(ruta).startsWith('/evaluaciones/evidencias?')) return {
        evidencias: [{
          id: 'evidencia-1', titulo: 'Práctica', calificacionDecimal: 7, ponderacion: 1, corte: 1,
          fuente: 'manual', updatedAt: '2026-04-01T12:00:00.000Z'
        }],
        nextCursor: null
      } as never;
      return { politicas: [] } as never;
    });
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new ErrorRemoto('La sesión expiró', { status: 401 }));
    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);
    fireEvent.change(screen.getByLabelText(/alumno/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: /evidencias/i }));
    await screen.findByText('Práctica');
    fireEvent.click(screen.getByRole('button', { name: 'Archivar' }));

    await waitFor(() => expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      title: 'No se pudo archivar la evidencia',
      message: 'Tu sesión venció. Cierra sesión y vuelve a ingresar.',
      action: expect.objectContaining({ label: 'Cerrar sesión' })
    })));
  });

  it('permite editar y archivar una evidencia manual con motivo desde la GUI', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (ruta) => {
      if (String(ruta).startsWith('/evaluaciones/evidencias?')) return {
        evidencias: [{
          id: 'evidencia-1', titulo: 'Práctica', calificacionDecimal: 7, ponderacion: 1, corte: 1,
          fuente: 'manual', updatedAt: '2026-04-01T12:00:00.000Z'
        }],
        nextCursor: null
      } as never;
      return { politicas: [] } as never;
    });
    vi.mocked(clienteApi.actualizar).mockResolvedValue({});
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );
    fireEvent.change(screen.getByLabelText(/alumno/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: /evidencias/i }));
    await screen.findByText('Práctica');
    expect(screen.getByText(/Origen: Manual · Estado: Activa/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const motivo = screen.getByLabelText(/motivo del cambio/i);
    expect(motivo).toBeRequired();
    expect(motivo).toHaveAttribute('minLength', '3');
    expect(motivo).toHaveAttribute('maxLength', '400');
    expect(motivo).toHaveAttribute('aria-describedby', 'ayuda-motivo-evidencia');
    expect(screen.getByText(/describe el cambio para la auditoría/i)).toBeInTheDocument();
    fireEvent.change(motivo, { target: { value: 'x' } });
    expect(motivo).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/entre 3 y 400 caracteres/i);
    expect(screen.getByRole('button', { name: /guardar cambios auditados/i })).toBeDisabled();
    fireEvent.change(motivo, { target: { value: 'Corrección revisada' } });
    expect(motivo).toHaveAttribute('aria-invalid', 'false');
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios auditados/i }));
    await waitFor(() => expect(clienteApi.actualizar).toHaveBeenCalledWith('/evaluaciones/evidencias/evidencia-1', expect.objectContaining({
      expectedUpdatedAt: '2026-04-01T12:00:00.000Z',
      motivoCambio: 'Corrección revisada',
      confirmarEscritura: true
    })));
    fireEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/evidencias/evidencia-1/archivar', {
      motivo: 'Corrección revisada', confirmarEscritura: true
    }));
  });

  it('explica la escala de calificación y permite reintentar la carga de evidencias', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.startsWith('/evaluaciones/evidencias?')) throw new Error('Network unavailable');
      return { politicas: [] } as never;
    });
    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);
    fireEvent.change(screen.getByLabelText(/alumno/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Evidencias' }));

    expect(screen.getByLabelText(/calificación/i)).toHaveAttribute('aria-describedby', 'ayuda-evidencia-calificacion');
    expect(screen.getByText(/escala de 0 a 10/i)).toBeInTheDocument();
    await screen.findByText(/no se pudieron cargar las evidencias/i);

    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.startsWith('/evaluaciones/evidencias?')) return { evidencias: [], nextCursor: null } as never;
      return { politicas: [] } as never;
    });
    fireEvent.click(screen.getByRole('button', { name: /reintentar carga de evidencias/i }));
    await screen.findByText(/no hay evidencias para este alumno y periodo/i);
    expect(screen.getByRole('region', { name: 'Evidencias del alumno' })).toBeInTheDocument();
  });

  it('distingue los campos numéricos vacíos del cero explícito al guardar evidencias', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [], evidencias: [], nextCursor: null } as never);
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);
    fireEvent.change(screen.getByLabelText(/^alumno$/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: /^evidencias$/i }));

    const titulo = screen.getByLabelText(/título de la evidencia/i);
    expect(titulo).toHaveAttribute('maxLength', '180');
    expect(titulo).toHaveAttribute('aria-describedby', 'ayuda-evidencia-titulo');
    expect(screen.getByText(/de 3 a 180 caracteres.*si lo dejas vacío/i)).toBeInTheDocument();
    fireEvent.change(titulo, { target: { value: 'X' } });
    expect(titulo).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/al menos 3 caracteres/i);

    const calificacion = screen.getByLabelText(/calificación/i) as HTMLInputElement;
    const ponderacion = screen.getByLabelText(/ponderación/i) as HTMLInputElement;
    const guardar = screen.getByRole('button', { name: /^guardar evidencia$/i });
    expect(calificacion).toHaveValue(null);
    expect(ponderacion).toHaveValue(null);
    expect(calificacion).toBeRequired();
    expect(ponderacion).toBeRequired();
    expect(calificacion).toHaveAttribute('aria-invalid', 'false');
    expect(ponderacion).toHaveAttribute('aria-invalid', 'false');
    expect(guardar).toBeDisabled();
    fireEvent.change(titulo, { target: { value: '   ' } });
    expect(titulo).toHaveAttribute('aria-invalid', 'false');
    expect(guardar).toBeEnabled();
    fireEvent.change(calificacion, { target: { value: '' } });
    fireEvent.change(ponderacion, { target: { value: '' } });
    fireEvent.click(guardar);
    expect(calificacion).toHaveAttribute('aria-invalid', 'true');
    expect(ponderacion).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(clienteApi.enviar).not.toHaveBeenCalled();

    fireEvent.change(calificacion, { target: { value: '0' } });
    fireEvent.change(ponderacion, { target: { value: '0' } });
    expect(guardar).toBeEnabled();
    fireEvent.click(guardar);

    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/evidencias', expect.objectContaining({
      titulo: 'Evidencia',
      calificacionDecimal: 0,
      ponderacion: 0
    })));
  });

  it('ignora una respuesta de evidencias tardía cuando cambia el alumno', async () => {
    let resolverPrimera: ((value: unknown) => void) | undefined;
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.includes('alumnoId=alu-1')) {
        return await new Promise((resolve) => { resolverPrimera = resolve; }) as never;
      }
      if (url.includes('alumnoId=alu-2')) {
        return {
          evidencias: [{ id: 'actual', titulo: 'Evidencia actual', calificacionDecimal: 9, ponderacion: 1, corte: 1, fuente: 'manual', updatedAt: '2026-04-01T12:00:00Z' }],
          nextCursor: null
        } as never;
      }
      return { politicas: [] } as never;
    });
    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={[...alumnosMock, { _id: 'alu-2', nombreCompleto: 'Ana Ruiz', periodoId: 'per-1', matricula: 'A101' }]} puedeGestionar />);
    fireEvent.change(screen.getByLabelText(/alumno/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Evidencias' }));
    await waitFor(() => expect(resolverPrimera).toBeDefined());

    fireEvent.change(screen.getByRole('combobox', { name: 'Alumno' }), { target: { value: 'alu-2' } });
    await screen.findByText('Evidencia actual');
    resolverPrimera?.({ evidencias: [{ id: 'obsoleta', titulo: 'Evidencia anterior', calificacionDecimal: 5, ponderacion: 1, corte: 1, fuente: 'manual', updatedAt: '2026-04-01T12:00:00Z' }], nextCursor: null });
    await waitFor(() => expect(screen.queryByText('Evidencia anterior')).not.toBeInTheDocument());
    expect(screen.getByText('Evidencia actual')).toBeInTheDocument();
  });

  it('permite cambiar a la pestaña de evidencias, guardar y capturar error', async () => {
    const user = userEvent.setup();
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({});

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );

    const selectAlumno = screen.getByLabelText(/alumno/i);
    fireEvent.change(selectAlumno, { target: { value: 'alu-1' } });

    const tabEvidencias = screen.getByRole('tab', { name: /evidencias/i });
    fireEvent.click(tabEvidencias);

    const inputTitulo = screen.getByLabelText(/título de la evidencia/i);
    fireEvent.change(inputTitulo, { target: { value: 'Tarea 1' } });
    fireEvent.change(screen.getByLabelText(/calificación/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/ponderación/i), { target: { value: '1' } });

    const selectCorte = screen.getByLabelText(/corte/i);
    fireEvent.change(selectCorte, { target: { value: '2' } });

    const botonGuardar = screen.getByRole('button', { name: /guardar evidencia/i });
    const formularioEvidencia = screen.getByRole('form', { name: 'Registro de evidencia' });
    expect(formularioEvidencia).toHaveAttribute('novalidate');
    await user.click(inputTitulo);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/evidencias', {
        periodoId: 'per-1',
        alumnoId: 'alu-1',
        titulo: 'Tarea 1',
        calificacionDecimal: 10,
        ponderacion: 1,
        corte: 2
      });
    });

    // Error al guardar evidencia
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Evidencia Error'));
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo guardar la evidencia/i);
    });
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
    expect(inputTitulo).toHaveValue('Tarea 1');
  });

  it('permite cambiar a la pestaña de exámenes, guardar y capturar error', async () => {
    const user = userEvent.setup();
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({});

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );

    const selectAlumno = screen.getByLabelText(/alumno/i);
    fireEvent.change(selectAlumno, { target: { value: 'alu-1' } });

    const tabExamenes = screen.getByRole('tab', { name: /exámenes/i });
    fireEvent.click(tabExamenes);

    const selectCorte = screen.getByLabelText(/corte examen/i);
    fireEvent.change(selectCorte, { target: { value: 'parcial2' } });

    const botonGuardar = screen.getByRole('button', { name: /guardar examen/i });
    const teorico = screen.getByLabelText(/teórico/i);
    const practicas = screen.getByLabelText(/prácticas/i);
    expect((teorico as HTMLInputElement).value).toBe('');
    expect(teorico).toBeRequired();
    expect(teorico).toHaveAttribute('aria-describedby', 'ayuda-examen-teorico');
    expect((practicas as HTMLInputElement).value).toBe('');
    expect(botonGuardar).toBeDisabled();
    expect(screen.getByLabelText(/prácticas/i)).toHaveAttribute('aria-describedby', 'ayuda-examen-practicas');
    const formularioExamen = screen.getByRole('form', { name: 'Registro de componente de examen' });
    expect(formularioExamen).toHaveAttribute('novalidate');
    fireEvent.change(teorico, { target: { value: '10' } });
    fireEvent.change(practicas, { target: { value: '10' } });
    await user.click(teorico);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/examenes/componentes', {
        periodoId: 'per-1',
        alumnoId: 'alu-1',
        corte: 'parcial2',
        teoricoDecimal: 10,
        practicas: [10]
      });
    });

    // Error al guardar examen
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Examen Error'));
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo guardar el componente del examen/i);
    });
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
  });

  it('valida capturas teóricas y prácticas sin filtrar entradas inválidas ni convertir vacío en cero', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
    render(<SeccionEvaluaciones
      periodos={[...periodosMock, { _id: 'per-2', nombre: 'Periodo 2026-B', activo: true }]}
      alumnos={[
        ...alumnosMock,
        { _id: 'alu-2', nombreCompleto: 'Ana Ruiz', periodoId: 'per-1', matricula: 'A101' },
        { _id: 'alu-3', nombreCompleto: 'Luis Díaz', periodoId: 'per-2', matricula: 'A201' }
      ]}
      puedeGestionar
    />);
    fireEvent.change(screen.getByLabelText(/^alumno/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: /exámenes/i }));

    const teorico = screen.getByLabelText(/^teórico/i) as HTMLInputElement;
    const practicas = screen.getByLabelText(/^prácticas/i) as HTMLInputElement;
    const guardar = screen.getByRole('button', { name: /guardar examen/i });
    expect(teorico.value).toBe('');
    expect(teorico).toBeRequired();
    expect(screen.getByText(/obligatoria.*escala de 0 a 10/i)).toBeVisible();
    expect(practicas).toHaveValue('');
    expect(guardar).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.change(teorico, { target: { value: '8' } });
    fireEvent.change(practicas, { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(/^alumno/i), { target: { value: 'alu-2' } });
    await waitFor(() => {
      expect(teorico.value).toBe('');
      expect(practicas).toHaveValue('');
      expect(guardar).toBeDisabled();
    });
    fireEvent.change(screen.getByLabelText(/^alumno/i), { target: { value: 'alu-1' } });
    await waitFor(() => expect(teorico.value).toBe(''));
    fireEvent.change(teorico, { target: { value: '8' } });
    fireEvent.change(practicas, { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(/^periodo/i), { target: { value: 'per-2' } });
    await waitFor(() => {
      expect(teorico.value).toBe('');
      expect(practicas).toHaveValue('');
      expect(guardar).toBeDisabled();
    });
    fireEvent.change(screen.getByLabelText(/^periodo/i), { target: { value: 'per-1' } });
    fireEvent.change(screen.getByLabelText(/^alumno/i), { target: { value: 'alu-1' } });
    await waitFor(() => expect(teorico.value).toBe(''));
    fireEvent.blur(teorico);
    expect(teorico).toHaveAttribute('aria-invalid', 'true');
    expect(guardar).toBeDisabled();
    fireEvent.change(teorico, { target: { value: '0' } });

    fireEvent.change(practicas, { target: { value: '0, texto' } });
    expect(practicas).toHaveAttribute('aria-invalid', 'true');
    expect(guardar).toBeDisabled();
    fireEvent.change(practicas, { target: { value: '0, 10.01' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/cada práctica debe tener una calificación de 0 a 10/i);
    fireEvent.change(practicas, { target: { value: '0,' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/elimina la coma sobrante/i);
    fireEvent.change(practicas, { target: { value: Array(20).fill('1').join(',') } });
    expect(guardar).toBeEnabled();
    fireEvent.change(practicas, { target: { value: Array(21).fill('1').join(',') } });
    expect(screen.getByRole('alert')).toHaveTextContent(/hasta 20 prácticas/i);
    expect(guardar).toBeDisabled();

    fireEvent.change(practicas, { target: { value: '0, 0' } });
    expect(guardar).toBeEnabled();
    fireEvent.click(guardar);
    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/examenes/componentes', expect.objectContaining({
      teoricoDecimal: 0,
      practicas: [0, 0]
    })));

    fireEvent.change(practicas, { target: { value: '' } });
    fireEvent.click(guardar);
    await waitFor(() => expect(clienteApi.enviar).toHaveBeenLastCalledWith('/evaluaciones/v2/examenes/componentes', expect.objectContaining({
      teoricoDecimal: 0,
      practicas: []
    })));
  });

  it('busca y vincula el folio fuente al guardar el Global', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.startsWith('/examenes/generados?')) {
        return { examenes: [{ id: 'exam-global-1', periodoId: 'per-1', alumnoId: null, folio: 'GLB-001', estado: 'generado' }] };
      }
      return { politicas: [] };
    });
    vi.mocked(clienteApi.enviar).mockResolvedValue({});

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );

    fireEvent.change(screen.getByLabelText(/alumno/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: /exámenes/i }));
    fireEvent.change(screen.getByLabelText(/corte examen/i), { target: { value: 'global' } });
    fireEvent.change(screen.getByLabelText(/^teórico/i), { target: { value: '8.5' } });
    fireEvent.change(screen.getByLabelText(/^prácticas/i), { target: { value: '8.5' } });
    fireEvent.change(screen.getByLabelText(/folio del examen global fuente/i), { target: { value: 'GLB-001' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar examen fuente/i }));

    await waitFor(() => expect(screen.getByText('Vinculado: GLB-001')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /guardar examen/i }));

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/examenes/componentes', expect.objectContaining({
        periodoId: 'per-1',
        alumnoId: 'alu-1',
        corte: 'global',
        examenGeneradoId: 'exam-global-1'
      }));
    });
  });

  it('distingue un fallo de búsqueda de cero coincidencias y permite guardar Global sin vínculo', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.startsWith('/examenes/generados?')) throw new Error('Network unavailable');
      return { politicas: [] };
    });
    vi.mocked(clienteApi.enviar).mockResolvedValue({});

    render(<SeccionEvaluaciones periodos={periodosMock} alumnos={alumnosMock} puedeGestionar />);
    fireEvent.change(screen.getByLabelText(/alumno/i), { target: { value: 'alu-1' } });
    fireEvent.click(screen.getByRole('tab', { name: /exámenes/i }));
    fireEvent.change(screen.getByLabelText(/corte examen/i), { target: { value: 'global' } });
    fireEvent.change(screen.getByLabelText(/^teórico/i), { target: { value: '8' } });
    const folio = screen.getByLabelText(/folio del examen global fuente/i);
    const buscar = screen.getByRole('button', { name: /buscar examen fuente/i });
    const guardar = screen.getByRole('button', { name: /guardar examen/i });
    fireEvent.change(folio, { target: { value: 'GLB-SIN-COINCIDENCIA' } });
    fireEvent.click(buscar);

    expect(await screen.findByText(/no se pudo buscar el examen fuente/i, { selector: 'span[role="status"]' })).toBeInTheDocument();
    expect(guardar).toBeDisabled();

    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.startsWith('/examenes/generados?')) return { examenes: [] };
      return { politicas: [] };
    });
    fireEvent.click(buscar);
    expect(await screen.findByText(/no se encontró un examen fuente vigente/i, { selector: 'span[role="status"]' })).toBeInTheDocument();
    expect(guardar).toBeEnabled();
    fireEvent.click(guardar);

    await waitFor(() => expect(clienteApi.enviar).toHaveBeenCalledWith(
      '/evaluaciones/v2/examenes/componentes',
      expect.objectContaining({ corte: 'global', periodoId: 'per-1', alumnoId: 'alu-1' })
    ));
    expect(vi.mocked(clienteApi.enviar).mock.calls.at(-1)?.[1]).not.toHaveProperty('examenGeneradoId');

    fireEvent.change(folio, { target: { value: 'GLB-OTRO' } });
    expect(guardar).toBeDisabled();
    expect(screen.queryByText(/no se encontró un examen fuente vigente/i)).not.toBeInTheDocument();
  });

  it('permite consultar el resumen y navegar a classroom cuando está habilitado', async () => {
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ politicas: [] })
      .mockResolvedValueOnce({
        resumen: {
          politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
          politicaVersion: 1,
          continuaPorCorte: { c1: 9.5, c2: 8.0, c3: 10 },
          examenesPorCorte: { parcial1: 10, parcial2: 9, global: 0 },
          bloqueContinuaDecimal: 9.1666,
          bloqueExamenesDecimal: 9.5,
          finalDecimal: 9.3333,
          finalRedondeada: 9,
          faltantes: ['examen.parcial2.componente', 'continua.c1.minima', 'Evidencia 2']
        }
      });

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
      />
    );

    // Seleccionar alumno y consultar resumen
    const selectAlumno = screen.getByLabelText(/alumno/i);
    fireEvent.change(selectAlumno, { target: { value: 'alu-1' } });

    const tabResumen = screen.getByRole('tab', { name: /resumen/i });
    fireEvent.click(tabResumen);

    const botonConsultar = screen.getByRole('button', { name: /consultar resumen/i });
    fireEvent.click(botonConsultar);

    await waitFor(() => {
      expect(within(screen.getByRole('group', { name: 'Calificación final' })).getByText('9')).toBeInTheDocument();
      expect(within(screen.getByRole('group', { name: 'Calificación final' })).getByText('9.3333')).toBeInTheDocument();
    });

    const resultados = screen.getByRole('region', { name: 'Resultados del alumno' });
    expect(within(resultados).getByText('LISC Encuadre 2026 v1')).toBeInTheDocument();
    expect(within(resultados).queryByText(/POLICY_LISC_ENCUADRE_2026/i)).not.toBeInTheDocument();
    expect(screen.getByText('3 datos por completar:').closest('[role="status"]')).toBeInTheDocument();
    const faltantes = screen.getByRole('list', { name: 'Datos por completar' });
    expect(within(faltantes).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Captura los componentes del examen Parcial 2.',
      'La evaluación continua de C1 no alcanza el mínimo configurado.',
      'Evidencia 2'
    ]);

    // Error al consultar resumen
    vi.mocked(clienteApi.obtener).mockRejectedValueOnce(new Error('Resumen Fetch Error'));
    fireEvent.click(botonConsultar);

    await waitFor(() => {
      expect(screen.getByText(/no se pudo consultar el resumen/i)).toBeInTheDocument();
    });
    expect(emitToast).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
    const botonReintentar = screen.getByRole('button', { name: 'Reintentar consulta' });
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({
      resumen: { finalDecimal: 8.5, finalRedondeada: 9, estado: 'completo' }
    } as never);
    fireEvent.click(botonReintentar);
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Calificación final' })).getByText('8.5000')).toBeInTheDocument());
  });
});
