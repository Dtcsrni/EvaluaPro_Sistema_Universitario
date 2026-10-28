/**
 * seccionAlumnos.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionAlumnos } from '../src/apps/app_docente/SeccionAlumnos';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
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
  });

  it('renderiza la lista de alumnos y el formulario de registro', () => {
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

    expect(screen.getByRole('heading', { name: /^Alumnos$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Alumnos de la materia/i })).toBeInTheDocument();
    expect(screen.getByText(/Ana María Gómez Ruiz/i)).toBeInTheDocument();
    expect(screen.getByText(/Carlos López Hernández/i)).toBeInTheDocument();
    expect(screen.getByText('Total de alumnos: 2')).toBeInTheDocument();
    expect(screen.getByText('Correo (opcional)')).toBeInTheDocument();
    expect(screen.getByText('AMGR')).toBeInTheDocument();
    expect(screen.getByText('CLH')).toBeInTheDocument();
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
    expect(screen.getByLabelText('Materia', { selector: 'select' })).toBeRequired();
    expect(screen.getByText('Obligatorios: matrícula, nombres, apellidos y materia. Correo y grupo son opcionales.')).toBeInTheDocument();
    const correo = screen.getByLabelText(/^Correo \(opcional\)/i, { selector: 'input' });
    expect(correo).toHaveAttribute('type', 'email');
    expect(correo).toHaveAttribute('autocomplete', 'email');
    expect(correo).not.toBeRequired();
    expect(screen.getByLabelText(/^Grupo/i, { selector: 'input' })).not.toBeRequired();
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
    expect(document.body.textContent).not.toContain('💡');
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
      const selects = screen.getAllByRole('combobox');
      expect(selects[1]).toHaveValue('per-1');
      expect(selects[2]).toHaveValue('3B');
    });
  });

  it('permite registrar un nuevo alumno con matrícula CUH válida y autollenado de correo', async () => {
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

    fireEvent.click(botonCrear);

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

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Alumnos' })
    );
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
    expect(inputMatricula).toHaveAttribute('aria-describedby', 'alumnos-matricula-ayuda');
    expect(screen.getByRole('alert')).toHaveTextContent(/CUH seguido de exactamente 9 dígitos/i);
    expect(screen.getByRole('button', { name: /Crear alumno/i })).toBeDisabled();
  });

  it('permite iniciar y cancelar la edición de un alumno', () => {
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

    const botonesEditar = screen.getAllByRole('button', { name: /Editar/i });
    fireEvent.click(botonesEditar[0]!);

    expect(screen.getByText(/Editas este expediente/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar cambios/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument();

    const inputNombres = screen.getByLabelText(/^Nombres/i, { selector: 'input' }) as HTMLInputElement;
    expect(inputNombres.value).toBe('Carlos');

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(screen.getByRole('button', { name: /Crear alumno/i })).toBeInTheDocument();
  });

  it('permite filtrar alumnos por texto y por grupo', () => {
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

    const inputBuscar = screen.getByLabelText(/Buscar alumno/i);
    fireEvent.change(inputBuscar, { target: { value: 'Carlos' } });

    expect(screen.getByText(/Carlos López Hernández/i)).toBeInTheDocument();
    expect(screen.queryByText(/Ana María Gómez Ruiz/i)).not.toBeInTheDocument();

    // Limpiar búsqueda y filtrar por grupo
    fireEvent.change(inputBuscar, { target: { value: '' } });
    const selectGrupo = screen.getByRole('combobox', { name: /^Grupo$/i });
    fireEvent.change(selectGrupo, { target: { value: '3A' } });

    expect(screen.getByText(/Ana María Gómez Ruiz/i)).toBeInTheDocument();
    expect(screen.queryByText(/Carlos López Hernández/i)).not.toBeInTheDocument();
  });
});
