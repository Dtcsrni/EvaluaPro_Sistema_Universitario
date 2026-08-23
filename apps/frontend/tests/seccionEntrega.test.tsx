import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    expect(screen.getByRole('heading', { name: /Entrega de examenes/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/FOL-001/i)).toBeInTheDocument();
      expect(screen.getByText(/FOL-002/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Valeria García/i).length).toBeGreaterThanOrEqual(1);
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

    const inputBuscar = screen.getByPlaceholderText(/FOLIO-000123 o 2024-001/i);
    fireEvent.change(inputBuscar, { target: { value: 'FOL-002' } });

    expect(screen.getByText(/FOL-002/i)).toBeInTheDocument();
    expect(screen.queryByText(/FOL-001/i)).not.toBeInTheDocument();
  });
});
