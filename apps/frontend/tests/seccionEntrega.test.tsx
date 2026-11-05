/**
 * seccionEntrega.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionEntrega } from '../src/apps/app_docente/SeccionEntregaInterna';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import type { Alumno, Periodo, PermisosUI, Plantilla } from '../src/apps/app_docente/tipos';

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

describe('SeccionEntrega', () => {
  const periodosMock: Periodo[] = [
    { _id: 'per-1', nombre: 'Química Orgánica', activo: true }
  ];

  const alumnosMock: Alumno[] = [
    {
      _id: 'alu-1',
      periodoId: 'per-1',
      matricula: 'CUH111222333',
      nombres: 'Valeria',
      apellidos: 'García',
      nombreCompleto: 'Valeria García',
      correo: 'CUH111222333@cuh.mx',
      grupo: '2A'
    }
  ];

  const plantillasMock: Plantilla[] = [
    {
      _id: 'plan-1',
      periodoId: 'per-1',
      titulo: 'Parcial Química',
      preguntas: []
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockResolvedValue({
      examenes: [
        {
          _id: 'ex-1',
          folio: 'FOL-001',
          alumnoId: 'alu-1',
          periodoId: 'per-1',
          plantillaId: 'plan-1',
          estado: 'entregado',
          generadoEn: '2026-08-20T10:00:00.000Z',
          entregadoEn: '2026-08-20T11:00:00.000Z'
        },
        {
          _id: 'ex-2',
          folio: 'FOL-002',
          alumnoId: null,
          periodoId: 'per-1',
          plantillaId: 'plan-1',
          estado: 'generado',
          generadoEn: '2026-08-20T10:00:00.000Z'
        }
      ]
    });
  });

  it('renderiza la lista de exámenes generados y vinculados por folio', async () => {
    const { container } = render(
      <SeccionEntrega
        alumnos={alumnosMock}
        plantillas={plantillasMock}
        periodos={periodosMock}
        onVincular={vi.fn()}
        permisos={permisosCompletos}
        avisarSinPermiso={vi.fn()}
        enviarConPermiso={vi.fn()}
      />
    );

    const heading = screen.getByRole('heading', { name: 'Entrega de exámenes' });
    expect(heading.querySelector('svg')).toBeNull();
    expect(container.querySelector('.entrega-panel__icon-orb svg')).toBeInTheDocument();
    expect(screen.getByText('En lista')).toBeInTheDocument();
    expect(screen.queryByText('2 exámenes')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/FOL-001/i)).toBeInTheDocument();
      expect(screen.getByText(/FOL-002/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Valeria García/i).length).toBeGreaterThanOrEqual(1);
  });

  it('distingue un alumno sin asignar de una identidad asignada que no está disponible', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({
      examenes: [
        {
          _id: 'ex-orphan-delivered', folio: 'FOL-ORPHAN-D', alumnoId: 'alumno-no-disponible-001',
          periodoId: 'per-1', plantillaId: 'plan-1', estado: 'entregado'
        },
        {
          _id: 'ex-orphan-pending', folio: 'FOL-ORPHAN-P', alumnoId: 'alumno-no-disponible-002',
          periodoId: 'per-1', plantillaId: 'plan-1', estado: 'generado'
        },
        {
          _id: 'ex-no-student', folio: 'FOL-NO-STUDENT', alumnoId: null,
          periodoId: 'per-1', plantillaId: 'plan-1', estado: 'generado'
        }
      ]
    });

    render(
      <SeccionEntrega
        alumnos={alumnosMock}
        plantillas={plantillasMock}
        periodos={periodosMock}
        onVincular={vi.fn()}
        permisos={permisosCompletos}
        avisarSinPermiso={vi.fn()}
        enviarConPermiso={vi.fn()}
      />
    );

    expect(await screen.findByText(/FOL-ORPHAN-D/)).toBeInTheDocument();
    expect(screen.getAllByText('Alumno no disponible')).toHaveLength(2);
    expect(screen.getByText('Sin alumno asignado')).toBeInTheDocument();
    expect(screen.queryByText(/alumno-no-disponible-/i)).not.toBeInTheDocument();
  });

  it('permite filtrar exámenes por folio o texto de búsqueda', async () => {
    render(
      <SeccionEntrega
        alumnos={alumnosMock}
        plantillas={plantillasMock}
        periodos={periodosMock}
        onVincular={vi.fn()}
        permisos={permisosCompletos}
        avisarSinPermiso={vi.fn()}
        enviarConPermiso={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/FOL-001/i)).toBeInTheDocument();
    });

    const inputBuscar = screen.getByPlaceholderText(/Folio, matrícula o nombre/i);
    fireEvent.change(inputBuscar, { target: { value: 'FOL-002' } });

    expect(screen.getByText(/FOL-002/i)).toBeInTheDocument();
    expect(screen.queryByText(/FOL-001/i)).not.toBeInTheDocument();
  });

  it('ofrece limpiar la búsqueda cuando no hay coincidencias', async () => {
    render(
      <SeccionEntrega
        alumnos={alumnosMock}
        plantillas={plantillasMock}
        periodos={periodosMock}
        onVincular={vi.fn()}
        permisos={permisosCompletos}
        avisarSinPermiso={vi.fn()}
        enviarConPermiso={vi.fn()}
      />
    );

    await screen.findByText(/FOL-001/i);
    fireEvent.change(screen.getByPlaceholderText(/Folio, matrícula o nombre/i), { target: { value: 'sin-coincidencias' } });
    expect(screen.getByText(/No se encontraron exámenes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /limpiar búsqueda/i }));
    expect(await screen.findByText(/FOL-001/i)).toBeInTheDocument();
  });

  it('no presenta estados vacíos engañosos cuando falla la consulta inicial', async () => {
    vi.mocked(clienteApi.obtener).mockRejectedValueOnce(new Error('Sin conexión'));
    render(
      <SeccionEntrega
        alumnos={alumnosMock}
        plantillas={plantillasMock}
        periodos={periodosMock}
        onVincular={vi.fn()}
        permisos={permisosCompletos}
        avisarSinPermiso={vi.fn()}
        enviarConPermiso={vi.fn()}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/Sin conexión/);
    expect(screen.queryByText(/Todos los exámenes del lote han sido entregados/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No hay exámenes generados para esta materia/)).not.toBeInTheDocument();
  });

  it('conserva y marca la última consulta si falla el refresco, y bloquea reintentos simultáneos', async () => {
    let rechazarConsulta: (error: Error) => void = () => {};
    const consultaPendiente = new Promise<never>((_resolve, reject) => {
      rechazarConsulta = reject;
    });
    vi.mocked(clienteApi.obtener)
      .mockImplementationOnce(async () => ({
        examenes: [{
          _id: 'ex-refresh',
          folio: 'FOL-REFRESH',
          alumnoId: 'alu-1',
          periodoId: 'per-1',
          plantillaId: 'plan-1',
          estado: 'entregado'
        }]
      }))
      .mockReturnValueOnce(consultaPendiente);

    render(
      <SeccionEntrega
        alumnos={alumnosMock}
        plantillas={plantillasMock}
        periodos={periodosMock}
        onVincular={vi.fn()}
        permisos={permisosCompletos}
        avisarSinPermiso={vi.fn()}
        enviarConPermiso={vi.fn()}
      />
    );

    expect(await screen.findByText(/FOL-REFRESH/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refrescar' }));

    const refreshInProgress = screen.getByRole('button', { name: 'Consultando…' });
    expect(refreshInProgress).toBeDisabled();
    expect(refreshInProgress).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(/resultados cargados siguen visibles/i).closest('[role="status"]')).not.toBeNull();
    expect(screen.getByText(/FOL-REFRESH/i)).toBeInTheDocument();
    expect(clienteApi.obtener).toHaveBeenCalledTimes(2);

    await act(async () => {
      rechazarConsulta(new Error('Sin conexión'));
      await consultaPendiente.catch(() => undefined);
    });

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/Sin conexión/i);
    expect(error).toHaveTextContent(/última consulta exitosa/i);
    expect(screen.getByText(/FOL-REFRESH/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refrescar' })).toBeEnabled();
  });

  it('no expone el grupo de indicadores como una región viva amplia', async () => {
    const { container } = render(
      <SeccionEntrega
        alumnos={alumnosMock}
        plantillas={plantillasMock}
        periodos={periodosMock}
        onVincular={vi.fn()}
        permisos={permisosCompletos}
        avisarSinPermiso={vi.fn()}
        enviarConPermiso={vi.fn()}
      />
    );

    await screen.findByText(/FOL-001/i);
    expect(container.querySelector('.banco-header-kpis')).toHaveAttribute('role', 'group');
    expect(container.querySelector('.banco-header-kpis')).not.toHaveAttribute('aria-live');
  });

  it('limpia los exámenes anteriores al cambiar de materia', async () => {
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ examenes: [{ _id: 'ex-1', folio: 'FOL-001', periodoId: 'per-1', estado: 'generado' }] })
      .mockResolvedValueOnce({ examenes: [{ _id: 'ex-2', folio: 'FOL-202', periodoId: 'per-2', estado: 'generado' }] });
    render(
      <SeccionEntrega
        alumnos={alumnosMock}
        plantillas={plantillasMock}
        periodos={[...periodosMock, { _id: 'per-2', nombre: 'Física', activo: true }]}
        onVincular={vi.fn()}
        permisos={permisosCompletos}
        avisarSinPermiso={vi.fn()}
        enviarConPermiso={vi.fn()}
      />
    );

    await screen.findByText(/FOL-001/i);
    const selectorMateria = screen.getByLabelText(/Materia activa/i);
    expect(selectorMateria).toHaveAccessibleDescription('Define los folios y alumnos que se consultan y vinculan en esta vista.');
    const panelRegistro = document.querySelector('.entregas-panel--registro');
    expect(panelRegistro).not.toBeNull();
    expect(selectorMateria.compareDocumentPosition(panelRegistro!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const inputBuscar = screen.getByPlaceholderText(/Folio, matrícula o nombre/i);
    fireEvent.change(inputBuscar, { target: { value: 'FOL-001' } });
    fireEvent.change(screen.getByLabelText(/Materia activa/i), { target: { value: 'per-2' } });
    expect(await screen.findByText(/FOL-202/i)).toBeInTheDocument();
    expect(inputBuscar).toHaveValue('');
    expect(screen.queryByText(/FOL-001/i)).not.toBeInTheDocument();
  });

  it('permite cargar la página siguiente de exámenes de la materia', async () => {
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({
        examenes: [{ _id: 'ex-3', folio: 'FOL-003', alumnoId: null, periodoId: 'per-1', plantillaId: 'plan-1', estado: 'generado' }],
        nextCursor: 'cursor-next'
      })
      .mockResolvedValueOnce({
        examenes: [{ _id: 'ex-4', folio: 'FOL-004', alumnoId: null, periodoId: 'per-1', plantillaId: 'plan-1', estado: 'generado' }],
        nextCursor: null
      });

    render(
      <SeccionEntrega
        alumnos={alumnosMock}
        plantillas={plantillasMock}
        periodos={periodosMock}
        onVincular={vi.fn()}
        permisos={permisosCompletos}
        avisarSinPermiso={vi.fn()}
        enviarConPermiso={vi.fn()}
      />
    );

    await screen.findByText(/FOL-003/i);
    expect(screen.getByText(/Conteos calculados sobre 1 resultado visible/)).toHaveTextContent('Conteos calculados sobre 1 resultado visible, de 1 examen cargado; la materia puede tener más registros.');
    fireEvent.click(screen.getByRole('button', { name: /cargar más exámenes/i }));
    await screen.findByText(/FOL-004/i);
    const rutaSegundaPagina = vi.mocked(clienteApi.obtener).mock.calls[1]?.[0];
    expect(rutaSegundaPagina).toContain('cursor=cursor-next');
  });
});
