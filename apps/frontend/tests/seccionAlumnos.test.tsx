/**
 * seccionAlumnos.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionAlumnos } from '../src/apps/app_docente/SeccionAlumnos';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { ErrorRemoto } from '../src/servicios_api/clienteApi';
import { emitToast } from '../src/ui/toast/toastBus';
import type { Alumno, Periodo, PermisosUI } from '../src/apps/app_docente/tipos';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    eliminar: vi.fn(),
    registrarEventosUso: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

const permisosCompletos: PermisosUI = {
  periodos: { leer: true, gestionar: true, archivar: true },
  alumnos: { leer: true, gestionar: true },
  banco: { leer: true, gestionar: true, archivar: true },
  plantillas: { leer: true, gestionar: true, archivar: true, previsualizar: true },
  examenes: { leer: true, generar: true, archivar: true, regenerar: true, descargar: true },
  entregas: { gestionar: true },
  omr: { analizar: true },
  calificaciones: { calificar: true },
  publicar: { publicar: true },
  sincronizacion: { listar: true, exportar: true, importar: true, push: true, pull: true },
  cuenta: { leer: true, actualizar: true }
};

describe('SeccionAlumnos', () => {
  const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  const periodosMock: Periodo[] = [
    { _id: 'per-1', nombre: 'Cálculo Diferencial', activo: true, grupos: ['3A', '3B'] }
  ];

  const alumnosMock: Alumno[] = [
    {
      _id: 'alu-1',
      periodoId: 'per-1',
      matricula: 'CUH123456789',
      nombres: 'Ana María',
      apellidos: 'Gómez Ruiz',
      nombreCompleto: 'Ana María Gómez Ruiz',
      correo: 'CUH123456789@cuh.mx',
      grupo: '3A'
    },
    {
      _id: 'alu-2',
      periodoId: 'per-1',
      matricula: 'CUH987654321',
      nombres: 'Carlos',
      apellidos: 'López Hernández',
      nombreCompleto: 'Carlos López Hernández',
      correo: 'CUH987654321@cuh.mx',
      grupo: '3B'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [] });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    if (scrollIntoViewDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  it('renderiza la lista de alumnos y el formulario de registro', () => {
    const { container } = render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: /^Alumnos$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Alumnos de la materia/i })).toBeInTheDocument();
    expect(screen.getByText(/Ana María Gómez Ruiz/i)).toBeInTheDocument();
    expect(screen.getByText(/Carlos López Hernández/i)).toBeInTheDocument();
    expect(screen.getByText('Padrón general: 2')).toBeInTheDocument();
    expect(container.querySelector('.alumnos-status-pill')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.alumnos-pulse-dot')).toHaveLength(0);
    expect(screen.getByText('Correo (opcional)')).toBeInTheDocument();
    expect(screen.getByText('AR')).toBeInTheDocument();
    expect(screen.getByText('CH')).toBeInTheDocument();
    expect(container.querySelector('.materia-mini-kpi--groups .materia-mini-kpi__lbl')).toHaveTextContent(/^grupos$/);
  });

  it('prioriza el padrón en móvil y abre el alta con teclado, vacío confirmado y edición', async () => {
    const descriptorAncho = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    try {
      const user = userEvent.setup();
      const props = {
        periodosActivos: periodosMock,
        periodosTodos: periodosMock,
        onRefrescar: () => {},
        permisos: permisosCompletos,
        puedeEliminarAlumnoDev: false,
        enviarConPermiso: async () => ({}),
        avisarSinPermiso: () => {}
      };

      const { unmount } = render(<SeccionAlumnos {...props} alumnos={alumnosMock} />);
      const mostrarFormulario = screen.getByRole('button', { name: 'Mostrar formulario' });
      expect(mostrarFormulario).toHaveAttribute('aria-expanded', 'false');
      expect(mostrarFormulario).toHaveAttribute('aria-controls', 'alumnos-form-body');
      expect(document.getElementById('alumnos-form-body')).toHaveAttribute('hidden');
      expect(screen.getByRole('heading', { name: 'Alumnos de la materia' })).toBeVisible();

      mostrarFormulario.focus();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('button', { name: 'Ocultar formulario' })).toHaveAttribute('aria-expanded', 'true');
      expect(document.getElementById('alumnos-form-body')).not.toHaveAttribute('hidden');
      await user.keyboard(' ');
      expect(screen.getByRole('button', { name: 'Mostrar formulario' })).toHaveAttribute('aria-expanded', 'false');

      await user.click(screen.getAllByRole('button', { name: /Editar/i })[0]!);
      expect(screen.getByRole('heading', { name: 'Modificar alumno seleccionado' })).toBeVisible();
      expect(document.getElementById('alumnos-form-body')).not.toHaveAttribute('hidden');
      expect(screen.queryByRole('button', { name: /Ocultar formulario/i })).not.toBeInTheDocument();

      unmount();
      render(<SeccionAlumnos {...props} alumnos={[]} />);
      expect(screen.getByRole('button', { name: 'Ocultar formulario' })).toHaveAttribute('aria-expanded', 'true');
      expect(document.getElementById('alumnos-form-body')).not.toHaveAttribute('hidden');
    } finally {
      if (descriptorAncho) Object.defineProperty(window, 'innerWidth', descriptorAncho);
    }
  });

  it('actualiza el plegado automático al cambiar el viewport y conserva la preferencia manual', () => {
    const descriptorAncho = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    try {
      render(
        <SeccionAlumnos
          alumnos={alumnosMock}
          periodosActivos={periodosMock}
          periodosTodos={periodosMock}
          onRefrescar={() => {}}
          permisos={permisosCompletos}
          puedeEliminarAlumnoDev={false}
          enviarConPermiso={async () => ({})}
          avisarSinPermiso={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: 'Ocultar formulario' })).toHaveAttribute('aria-expanded', 'true');

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
      fireEvent(window, new Event('resize'));
      expect(screen.getByRole('button', { name: 'Mostrar formulario' })).toHaveAttribute('aria-expanded', 'false');

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      fireEvent(window, new Event('resize'));
      expect(screen.getByRole('button', { name: 'Ocultar formulario' })).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(screen.getByRole('button', { name: 'Ocultar formulario' }));
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
      fireEvent(window, new Event('resize'));
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      fireEvent(window, new Event('resize'));
      expect(screen.getByRole('button', { name: 'Mostrar formulario' })).toHaveAttribute('aria-expanded', 'false');
    } finally {
      if (descriptorAncho) Object.defineProperty(window, 'innerWidth', descriptorAncho);
    }
  });

  it('conjuga el resumen en singular cuando la materia tiene un solo grupo', () => {
    const { container } = render(
      <SeccionAlumnos
        alumnos={alumnosMock.slice(0, 1)}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(container.querySelector('.materia-mini-kpi--groups .materia-mini-kpi__num')).toHaveTextContent('1');
    expect(container.querySelector('.materia-mini-kpi--groups .materia-mini-kpi__lbl')).toHaveTextContent(/^grupo$/);
  });

  it('muestra la matrícula una sola vez en cada tarjeta, junto a su etiqueta', () => {
    const { container } = render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    const nombre = Array.from(container.querySelectorAll('.alumno-nombre'))
      .map((elemento) => elemento.textContent?.trim());
    expect(nombre).toContain('Ana María Gómez Ruiz');
    expect(nombre).not.toContain('CUH123456789 - Ana María Gómez Ruiz');
    expect(screen.getAllByText('CUH123456789')).toHaveLength(1);
  });

  it('expone el propósito de nombres, apellidos y correo para autocompletado', () => {
    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByLabelText(/^Nombres/i, { selector: 'input' })).toHaveAttribute('autocomplete', 'given-name');
    expect(screen.getByLabelText(/^Apellidos/i, { selector: 'input' })).toHaveAttribute('autocomplete', 'family-name');
    expect(screen.getByLabelText(/^Matrícula/i, { selector: 'input' })).toBeRequired();
    expect(screen.getByLabelText(/^Nombres/i, { selector: 'input' })).toBeRequired();
    expect(screen.getByLabelText(/^Apellidos/i, { selector: 'input' })).toBeRequired();
    expect(screen.getByLabelText('Materia del alumno', { selector: 'select' })).toBeRequired();
    expect(screen.getByText('Obligatorios: matrícula, nombres, apellidos y materia. Correo y grupo son opcionales.')).toBeInTheDocument();
    const correo = screen.getByLabelText(/^Correo \(opcional\)/i, { selector: 'input' });
    expect(correo).toHaveAttribute('type', 'email');
    expect(correo).toHaveAttribute('autocomplete', 'email');
    expect(correo).not.toBeRequired();
    expect(screen.getByLabelText(/^Grupo/i, { selector: 'input' })).not.toBeRequired();
  });

  it('asocia la sugerencia automática de correo y la retira cuando se edita manualmente', () => {
    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    const matricula = screen.getByLabelText(/^Matrícula/i, { selector: 'input' });
    const correo = screen.getByLabelText(/^Correo \(opcional\)/i, { selector: 'input' });
    fireEvent.change(matricula, { target: { value: 'CUH555444333' } });

    expect(correo).toHaveAttribute('aria-describedby', 'alumnos-correo-sugerido');
    expect(document.getElementById('alumnos-correo-sugerido')).toHaveTextContent('Sugerido automáticamente: CUH555444333@cuh.mx');

    fireEvent.change(correo, { target: { value: 'alumna@example.test' } });
    expect(correo).not.toHaveAttribute('aria-describedby');
    expect(document.getElementById('alumnos-correo-sugerido')).not.toBeInTheDocument();
  });

  it('identifica materias por nombre y fecha legible sin mostrar IDs internos', () => {
    const periodo = { ...periodosMock[0]!, _id: 'periodo-interno-12345678', fechaInicio: '2026-09-27' };
    render(
      <SeccionAlumnos
        alumnos={alumnosMock.map((alumno) => ({ ...alumno, periodoId: periodo._id }))}
        periodosActivos={[periodo]}
        periodosTodos={[periodo]}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    const opcionesMateria = screen.getAllByRole('option', { name: /Cálculo Diferencial/ });
    expect(opcionesMateria.length).toBeGreaterThan(0);
    for (const opcion of opcionesMateria) {
      expect(opcion).toHaveTextContent('Cálculo Diferencial · inicia 27/09/2026');
      expect(opcion).not.toHaveTextContent('periodo-interno-12345678');
      expect(opcion).not.toHaveAttribute('title');
      expect(opcion).toHaveAttribute('value', periodo._id);
    }
  });

  it('describe el umbral de inasistencias sin presentar una decisión de elegibilidad', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [{ alumnoId: 'alu-1', faltas: 4 }] });

    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(await screen.findAllByText('4+ inasistencias')).toHaveLength(2);
    expect(screen.getByText('4+ inasistencias', { selector: '.badge-alerta-inasistencias' })).toHaveAccessibleName('Alumno con cuatro o más inasistencias');
    expect(screen.queryByText(/sin derecho/i)).not.toBeInTheDocument();
  });

  it('explica y permite reintentar el resumen de inasistencias cuando falla', async () => {
    const user = userEvent.setup();
    vi.mocked(clienteApi.obtener)
      .mockRejectedValueOnce(new Error('Servicio no disponible'))
      .mockResolvedValueOnce({ resumen: [{ alumnoId: 'alu-1', faltas: 4 }] });

    const { container } = render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cargar el resumen de inasistencias. El indicador no está disponible.'
    );
    expect(container.querySelector('.materia-mini-kpi--closing')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reintentar resumen' }));

    expect(await screen.findAllByText('4+ inasistencias')).toHaveLength(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('usa títulos y acciones sin emoji decorativo', () => {
    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Registrar alumno' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear alumno' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(document.body.textContent).not.toContain('➔');
  });

  it('usa el catálogo compartido para los pasos vacíos sin materias', () => {
    const { container } = render(
      <SeccionAlumnos
        alumnos={[]}
        periodosActivos={[]}
        periodosTodos={[]}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Comienza seleccionando una materia' })).toBeInTheDocument();
    expect(screen.getByText('Elige una asignatura activa para consultar su lista. La conexión con Google Classroom se administra en la sección Classroom.')).toBeInTheDocument();
    expect(container.querySelectorAll('.empty-step__arrow svg')).toHaveLength(2);
    expect(document.body.textContent).not.toContain('➔');
  });

  it('no presenta el catálogo como vacío mientras carga materias', () => {
    const { container } = render(
      <SeccionAlumnos
        alumnos={[]}
        cargandoMaterias
        periodosActivos={[]}
        periodosTodos={[]}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando materias disponibles…');
    expect(screen.queryByRole('heading', { name: 'Comienza seleccionando una materia' })).not.toBeInTheDocument();
    expect(container.querySelector('.materia-mini-kpi--active .materia-mini-kpi__num')).toHaveTextContent('—');
  });

  it('explica el fallo inicial del catálogo y permite reintentar su consulta', async () => {
    const onReintentarMaterias = vi.fn();
    render(
      <SeccionAlumnos
        alumnos={[]}
        errorMaterias
        onReintentarMaterias={onReintentarMaterias}
        periodosActivos={[]}
        periodosTodos={[]}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el catálogo de materias.');
    expect(screen.queryByRole('heading', { name: 'Comienza seleccionando una materia' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar carga de materias' }));
    expect(onReintentarMaterias).toHaveBeenCalledOnce();
  });

  it('conserva la materia disponible y comunica que el catálogo puede estar desactualizado', async () => {
    const onReintentarMaterias = vi.fn();
    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        errorMaterias
        onReintentarMaterias={onReintentarMaterias}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(await screen.findByText(/Se conserva la lista anterior; puede estar desactualizada\./)).toBeInTheDocument();
    expect(screen.getByText('Ana María Gómez Ruiz')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar carga de materias' }));
    expect(onReintentarMaterias).toHaveBeenCalledOnce();
  });

  it('explica el alta individual y la administración de Classroom cuando no hay alumnos', async () => {
    render(
      <SeccionAlumnos
        alumnos={[]}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(await screen.findByRole('heading', { name: 'No hay alumnos registrados en esta materia' })).toBeInTheDocument();
    expect(screen.getByText('Registra alumnos con el formulario superior. La conexión con Google Classroom se administra en la sección Classroom.')).toBeInTheDocument();
  });

  it('no presenta el padrón vacío como lista confirmada mientras carga', async () => {
    const { container } = render(
      <SeccionAlumnos
        alumnos={[]}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        cargandoAlumnos
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(await screen.findByText('Cargando lista de alumnos…')).toBeInTheDocument();
    expect(screen.getByText('Cargando lista de alumnos…').closest('[role="status"]')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No hay alumnos registrados en esta materia' })).not.toBeInTheDocument();
    expect(container.querySelector('.alumnos-counter-tag')).toHaveTextContent('Padrón general: —');
    expect(container.querySelector('.materia-mini-kpi--active .materia-mini-kpi__num')).toHaveTextContent('—');
  });

  it('distingue un fallo al cargar alumnos del catálogo vacío y reintenta la consulta', async () => {
    const reintentar = vi.fn();
    const user = userEvent.setup();
    render(
      <SeccionAlumnos
        alumnos={[]}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        errorCargaAlumnos
        onReintentarCargaAlumnos={reintentar}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar la lista de alumnos. Reintenta la consulta.');
    expect(screen.queryByRole('heading', { name: 'No hay alumnos registrados en esta materia' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar carga de alumnos' }));
    expect(reintentar).toHaveBeenCalledOnce();
  });

  it('conserva y marca la lista anterior si falla una actualización del padrón', () => {
    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        errorCargaAlumnos
        onReintentarCargaAlumnos={() => {}}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Se conserva la información cargada; puede estar desactualizada/i);
    expect(screen.getByText('Ana María Gómez Ruiz')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No hay alumnos registrados en esta materia' })).not.toBeInTheDocument();
  });

  it('aplica la materia y el grupo recibidos desde una tarjeta', async () => {
    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        destinoInicial={{ periodoId: 'per-1', grupo: '3B' }}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Materia de la lista' })).toHaveValue('per-1');
      expect(screen.getByRole('button', { name: /3B\s*\(1\)/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('combobox', { name: /^Grupo$/i })).not.toBeInTheDocument();
    });
  });

  it('muestra y asocia el nombre completo de la materia actual al filtro de la lista', () => {
    const materiaLarga = 'Evaluación de datos y análisis longitudinal de laboratorio — Grupo 2A';
    const periodos: Periodo[] = [{ _id: 'per-larga', nombre: materiaLarga, activo: true, grupos: ['2A'] }];
    render(
      <SeccionAlumnos
        alumnos={[]}
        periodosActivos={periodos}
        periodosTodos={periodos}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    const selector = screen.getByRole('combobox', { name: 'Materia de la lista' });
    expect(selector).toHaveValue('per-larga');
    expect(selector).toHaveAccessibleDescription(
      `Lista actual: ${materiaLarga}. Cambia solo la lista de abajo; no cambia el formulario.`
    );
    expect(screen.getByText(
      `Lista actual: ${materiaLarga}. Cambia solo la lista de abajo; no cambia el formulario.`
    )).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Materia del alumno' })).toHaveValue('per-larga');
  });

  it('permite registrar un nuevo alumno con matrícula CUH válida y autollenado de correo', async () => {
    const user = userEvent.setup();
    const mockEnviar = vi.fn().mockResolvedValue({});
    const mockRefrescar = vi.fn();

    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={mockRefrescar}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={mockEnviar}
        avisarSinPermiso={() => {}}
      />
    );

    const inputMatricula = screen.getByLabelText(/^Matrícula/i, { selector: 'input' });
    fireEvent.change(inputMatricula, { target: { value: 'CUH555444333' } });

    const inputNombres = screen.getByLabelText(/^Nombres/i, { selector: 'input' });
    fireEvent.change(inputNombres, { target: { value: 'Roberto' } });

    const inputApellidos = screen.getByLabelText(/^Apellidos/i, { selector: 'input' });
    fireEvent.change(inputApellidos, { target: { value: 'Martínez Soto' } });

    const inputGrupo = screen.getByRole('textbox', { name: /^Grupo \(opcional\)$/i });
    fireEvent.change(inputGrupo, { target: { value: '3A' } });

    const botonCrear = screen.getByRole('button', { name: /Crear alumno/i });
    expect(botonCrear).not.toBeDisabled();
    const formulario = screen.getByRole('form', { name: 'Registrar alumno' });
    expect(formulario).toHaveAttribute('novalidate');

    await user.click(inputGrupo);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockEnviar).toHaveBeenCalledWith(
        'alumnos:gestionar',
        '/alumnos',
        expect.objectContaining({
          matricula: 'CUH555444333',
          nombres: 'Roberto',
          apellidos: 'Martínez Soto',
          periodoId: 'per-1'
        }),
        expect.any(String)
      );
    });
    expect(mockEnviar).toHaveBeenCalledTimes(1);

    const confirmacion = await screen.findByText('Se registró a «Roberto Martínez Soto».');
    expect(confirmacion.closest('[role="status"]')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('muestra un error de alta en contexto sin duplicarlo como toast urgente', async () => {
    const user = userEvent.setup();
    const mockEnviar = vi.fn().mockRejectedValue(new Error('No se pudo registrar el alumno.'));

    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={mockEnviar}
        avisarSinPermiso={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Matrícula/i, { selector: 'input' }), { target: { value: 'CUH555444333' } });
    fireEvent.change(screen.getByLabelText(/^Nombres/i, { selector: 'input' }), { target: { value: 'Roberto' } });
    fireEvent.change(screen.getByLabelText(/^Apellidos/i, { selector: 'input' }), { target: { value: 'Martínez Soto' } });
    await user.click(screen.getByRole('button', { name: 'Crear alumno' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo registrar el alumno.');
    expect(screen.queryByRole('group', { name: 'No se pudo registrar' })).not.toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('ofrece una recuperación de sesión distinta cuando el alta falla con 401', async () => {
    const user = userEvent.setup();
    const mockEnviar = vi.fn().mockRejectedValue(new ErrorRemoto('Sesión vencida.', { status: 401 }));

    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={mockEnviar}
        avisarSinPermiso={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Matrícula/i, { selector: 'input' }), { target: { value: 'CUH555444333' } });
    fireEvent.change(screen.getByLabelText(/^Nombres/i, { selector: 'input' }), { target: { value: 'Roberto' } });
    fireEvent.change(screen.getByLabelText(/^Apellidos/i, { selector: 'input' }), { target: { value: 'Martínez Soto' } });
    await user.click(screen.getByRole('button', { name: 'Crear alumno' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo autenticar. Verifica tus datos e intenta de nuevo.');
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      title: 'Renueva tu sesión docente',
      message: 'El detalle está en la sección Alumnos. Cierra sesión y vuelve a entrar para renovar el acceso.',
      action: expect.objectContaining({ label: 'Cerrar sesión' })
    }));
    const toast = vi.mocked(emitToast).mock.calls[0]?.[0];
    expect(toast?.message).not.toContain('No se pudo autenticar');
  });

  it('explica el formato requerido por el servidor y evita enviar una matrícula inválida', () => {
    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={vi.fn()}
        avisarSinPermiso={() => {}}
      />
    );

    const inputMatricula = screen.getByLabelText(/^Matrícula/i, { selector: 'input' });
    fireEvent.change(inputMatricula, { target: { value: 'CUH12345678' } });

    expect(inputMatricula).toHaveAttribute('aria-invalid', 'true');
    expect(inputMatricula).toHaveAttribute('aria-describedby', 'alumnos-matricula-ayuda alumnos-matricula-error');
    expect(document.getElementById('alumnos-matricula-error')).toBeInTheDocument();
    const errorFormato = screen.getByText(/La matrícula debe tener el formato CUH seguido de exactamente 9 dígitos/i).closest('[role="status"]');
    expect(errorFormato).not.toBeNull();
    expect(errorFormato).toHaveTextContent(/CUH seguido de exactamente 9 dígitos/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear alumno/i })).toBeDisabled();

    fireEvent.change(inputMatricula, { target: { value: 'CUH123456789' } });
    expect(inputMatricula).toHaveAttribute('aria-invalid', 'false');
    expect(inputMatricula).toHaveAttribute('aria-describedby', 'alumnos-matricula-ayuda');
    expect(screen.queryByText(/La matrícula debe tener el formato CUH seguido de exactamente 9 dígitos/i)).not.toBeInTheDocument();
    const estadoValido = screen.getByText('Válida');
    expect(estadoValido.closest('.badge-matricula-live')).toHaveClass('badge-matricula-live--ok');
    expect(estadoValido.parentElement?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('permite iniciar y cancelar la edición y devuelve el foco al alumno invocador', async () => {
    const user = userEvent.setup();
    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    const botonEditarAna = screen.getByRole('button', { name: 'Editar Ana María Gómez Ruiz' });
    expect(screen.getByRole('button', { name: 'Editar Carlos López Hernández' })).toBeInTheDocument();
    await user.click(botonEditarAna);

    expect(screen.getByText(/Editas este expediente/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar cambios/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument();

    const inputNombres = screen.getByLabelText(/^Nombres/i, { selector: 'input' }) as HTMLInputElement;
    expect(inputNombres.value).toBe('Ana María');

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(screen.getByRole('button', { name: /Crear alumno/i })).toBeInTheDocument();
    await waitFor(() => expect(botonEditarAna).toHaveFocus());
  });

  it('usa el encabezado de la lista como foco de respaldo si desaparece el alumno invocador', async () => {
    const user = userEvent.setup();
    const props = {
      alumnos: alumnosMock,
      periodosActivos: periodosMock,
      periodosTodos: periodosMock,
      onRefrescar: () => {},
      permisos: permisosCompletos,
      puedeEliminarAlumnoDev: false,
      enviarConPermiso: async () => ({}),
      avisarSinPermiso: () => {}
    };
    const { rerender } = render(<SeccionAlumnos {...props} />);
    await user.click(screen.getByRole('button', { name: 'Editar Ana María Gómez Ruiz' }));

    rerender(<SeccionAlumnos {...props} alumnos={alumnosMock.filter((alumno) => alumno._id !== 'alu-1')} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Alumnos de la materia' })).toHaveFocus());
  });

  it('conserva la confirmación contextual al guardar una edición sin toast duplicado', async () => {
    const user = userEvent.setup();
    const mockEnviar = vi.fn().mockResolvedValue({});

    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={mockEnviar}
        avisarSinPermiso={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Editar Ana María Gómez Ruiz' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(mockEnviar).toHaveBeenCalledWith(
      'alumnos:gestionar',
      '/alumnos/alu-1/actualizar',
      expect.objectContaining({ matricula: 'CUH123456789', periodoId: 'per-1' }),
      expect.any(String)
    );
    const confirmacion = await screen.findByText('Cambios guardados para «Ana María Gómez Ruiz».');
    expect(confirmacion.closest('[role="status"]')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar Ana María Gómez Ruiz' })).toHaveFocus());
    expect(emitToast).not.toHaveBeenCalled();
  });


  it('permite filtrar alumnos por texto y por grupo', async () => {
    const { container } = render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    const inputBuscar = screen.getByLabelText(/Buscar alumno/i);
    const conteo = await screen.findByText('Se muestran 2 de 2 alumnos.');
    expect(inputBuscar).toHaveAttribute('placeholder', 'Nombre');
    expect(inputBuscar).toHaveAttribute('aria-describedby', 'alumnos-busqueda-ayuda');
    expect(screen.getByText('Busca por nombre, matrícula o correo.')).toBeInTheDocument();
    expect(conteo).toHaveAttribute('role', 'status');
    expect(container.querySelector('.alumnos-header-kpis')).not.toHaveAttribute('aria-live');
    fireEvent.change(inputBuscar, { target: { value: 'Maria Gomez' } });
    expect(screen.getByText(/Ana María Gómez Ruiz/i)).toBeInTheDocument();
    expect(screen.queryByText(/Carlos López Hernández/i)).not.toBeInTheDocument();

    fireEvent.change(inputBuscar, { target: { value: 'lopez' } });
    expect(screen.getByText(/Carlos López Hernández/i)).toBeInTheDocument();
    expect(screen.queryByText(/Ana María Gómez Ruiz/i)).not.toBeInTheDocument();

    fireEvent.change(inputBuscar, { target: { value: '' } });
    fireEvent.change(inputBuscar, { target: { value: 'Carlos' } });

    expect(screen.getByText(/Carlos López Hernández/i)).toBeInTheDocument();
    expect(screen.queryByText(/Ana María Gómez Ruiz/i)).not.toBeInTheDocument();
    expect(conteo).toHaveTextContent('Se muestran 1 de 2 alumnos.');

    // Limpiar búsqueda y filtrar por grupo
    fireEvent.change(inputBuscar, { target: { value: '' } });
    expect(conteo).toHaveTextContent('Se muestran 2 de 2 alumnos.');
    expect(screen.queryByRole('combobox', { name: /^Grupo$/i })).not.toBeInTheDocument();
    const filtroGrupo3A = screen.getByRole('button', { name: /3A\s*\(1\)/i });
    fireEvent.click(filtroGrupo3A);

    expect(screen.getByText(/Ana María Gómez Ruiz/i)).toBeInTheDocument();
    expect(screen.queryByText(/Carlos López Hernández/i)).not.toBeInTheDocument();
    expect(conteo).toHaveTextContent('Se muestran 1 de 2 alumnos.');

    fireEvent.change(inputBuscar, { target: { value: 'sin coincidencias' } });
    expect(conteo).toHaveTextContent('Se muestran 0 de 2 alumnos.');
    expect(screen.getByRole('heading', { name: 'Sin coincidencias' })).toBeInTheDocument();
    expect(screen.getByText('No hay alumnos para «sin coincidencias» en el grupo «3A».')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(inputBuscar).toHaveValue('');
    expect(screen.getByRole('button', { name: /Todos \(2\)/i })).toHaveAttribute('aria-pressed', 'true');
    expect(conteo).toHaveTextContent('Se muestran 2 de 2 alumnos.');
    expect(screen.getByText(/Ana María Gómez Ruiz/i)).toBeInTheDocument();
    expect(screen.getByText(/Carlos López Hernández/i)).toBeInTheDocument();
  });

  it('expone el filtro rápido de grupo como grupo etiquetado y comunica la opción activa', () => {
    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    const filtro = screen.getByRole('group', { name: 'Filtrar por grupo:' });
    const todos = screen.getByRole('button', { name: /Todos \(2\)/i });
    const grupo3A = screen.getByRole('button', { name: /3A\s*\(1\)/i });

    expect(filtro).toContainElement(todos);
    expect(todos).toHaveAttribute('aria-pressed', 'true');
    expect(grupo3A).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(grupo3A);

    expect(grupo3A).toHaveAttribute('aria-pressed', 'true');
    expect(todos).toHaveAttribute('aria-pressed', 'false');
  });

  it('usa solo el selector nativo cuando hay cuatro o más grupos', () => {
    const alumnosCuatroGrupos = ['1A', '1B', '1C', '1D'].map((grupo, indice) => ({
      ...alumnosMock[0]!,
      _id: `alumno-grupo-${indice}`,
      matricula: `CUH12345678${indice}`,
      nombres: `Alumno ${indice}`,
      apellidos: 'Dummy',
      nombreCompleto: `Alumno ${indice} Dummy`,
      correo: `alumno${indice}@example.invalid`,
      grupo
    }));

    render(
      <SeccionAlumnos
        alumnos={alumnosCuatroGrupos}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByRole('combobox', { name: /^Grupo$/i })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filtrar por grupo:' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: /^Grupo$/i }), { target: { value: '1D' } });
    expect(screen.getByText('Se muestran 1 de 4 alumnos.')).toBeInTheDocument();
    expect(screen.getByText('Alumno 3 Dummy')).toBeInTheDocument();
  });

  it('omite el filtro de grupo cuando los expedientes no tienen grupo', () => {
    render(
      <SeccionAlumnos
        alumnos={[{ ...alumnosMock[0]!, grupo: '  ' }]}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.queryByRole('combobox', { name: /^Grupo$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filtrar por grupo:' })).not.toBeInTheDocument();
  });

  it('permite cambiar y limpiar el filtro rápido de grupo con Enter y Espacio', async () => {
    const user = userEvent.setup();
    render(
      <SeccionAlumnos
        alumnos={alumnosMock}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    const grupo3A = screen.getByRole('button', { name: /3A\s*\(1\)/i });
    grupo3A.focus();
    expect(grupo3A).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(grupo3A).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Ana María Gómez Ruiz/i)).toBeInTheDocument();
    expect(screen.queryByText(/Carlos López Hernández/i)).not.toBeInTheDocument();

    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: /Todos \(2\)/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Carlos López Hernández/i)).toBeInTheDocument();
  });

  it('unifica mayúsculas de grupo y cuenta todos los alumnos que comparten el filtro', () => {
    const alumnosConMayusculasMixtas: Alumno[] = [
      ...alumnosMock,
      {
        ...alumnosMock[0]!,
        _id: 'alu-3',
        matricula: 'CUH111222333',
        nombres: 'Lucía',
        apellidos: 'Pérez',
        nombreCompleto: 'Lucía Pérez',
        correo: 'CUH111222333@cuh.mx',
        grupo: '3a'
      }
    ];
    render(
      <SeccionAlumnos
        alumnos={alumnosConMayusculasMixtas}
        periodosActivos={periodosMock}
        periodosTodos={periodosMock}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    const chipGrupo = screen.getByRole('button', { name: /^3a\(2\)$/i });
    expect(chipGrupo).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^3A\(1\)$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /^Grupo$/i })).not.toBeInTheDocument();
    fireEvent.click(chipGrupo);

    expect(screen.getByText('Ana María Gómez Ruiz')).toBeInTheDocument();
    expect(screen.getByText('Lucía Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Carlos López Hernández')).not.toBeInTheDocument();
  });

  it('limpia búsqueda y grupo al cambiar la materia desde el explorador', async () => {
    const periodos = [
      ...periodosMock,
      { _id: 'per-2', nombre: 'Álgebra', activo: true, grupos: ['1C'] }
    ];
    const alumnos = [
      ...alumnosMock,
      {
        _id: 'alu-3',
        periodoId: 'per-2',
        matricula: 'CUH112233445',
        nombres: 'Lucía',
        apellidos: 'Pérez',
        nombreCompleto: 'Lucía Pérez',
        correo: 'CUH112233445@cuh.mx',
        grupo: '1C'
      }
    ];

    render(
      <SeccionAlumnos
        alumnos={alumnos}
        periodosActivos={periodos}
        periodosTodos={periodos}
        onRefrescar={() => {}}
        permisos={permisosCompletos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar alumno' }), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: /3A\s*\(1\)/i }));
    expect(screen.getByText(/Ana María Gómez Ruiz/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Materia de la lista' }), { target: { value: 'per-2' } });

    expect(screen.getByText(/Lucía Pérez/i)).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar alumno' })).toHaveValue('');
    expect(screen.getByRole('button', { name: /Todos \(1\)/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Todos \(1\)/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Se muestran 1 de 1 alumnos.')).toBeInTheDocument();
  });
});
