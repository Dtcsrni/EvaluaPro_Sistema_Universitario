import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogProvider } from '../src/ui/feedback/ConfirmDialogProvider';
import { ClassroomEnCalificaciones } from '../src/apps/app_docente/ClassroomEnCalificaciones';
import type { PermisosUI } from '../src/apps/app_docente/tipos';

const obtenerMock = vi.fn();
const enviarMock = vi.fn();
const actualizarMock = vi.fn();
vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: (...args: unknown[]) => obtenerMock(...args),
    enviar: (...args: unknown[]) => enviarMock(...args),
    actualizar: (...args: unknown[]) => actualizarMock(...args)
  }
}));

const permisos = {
  evaluaciones: { leer: true },
  classroom: { pull: true }
} as PermisosUI;

describe('ClassroomEnCalificaciones: asignación de actividades a cortes', () => {
  beforeEach(() => {
    obtenerMock.mockReset().mockImplementation(async (path: string) => {
      if (path === '/evaluaciones/evidencias?periodoId=periodo-1&limite=400') return { evidencias: [] };
      if (path === '/evaluaciones/v2/classroom/cursos') return { cursos: [{ id: 'course-1', name: 'BI 23A' }] };
      if (path.includes('/alumnos?')) return { alumnosClassroom: [] };
      if (path.includes('/actividades?')) return { actividades: [{ id: 'work-1', title: 'Proyecto', state: 'PUBLISHED', maxPoints: 100 }] };
      return {};
    });
    enviarMock.mockReset()
      .mockResolvedValueOnce({ totalActividades: 1, graded: 1, pending: 0, wouldCreate: 12, wouldUpdate: 0 })
      .mockResolvedValueOnce({ totalActividades: 1, graded: 1, importadas: 12, actualizadas: 0 });
    actualizarMock.mockReset();
  });

  it('previsualiza el corte seleccionado y solicita confirmación antes de sincronizar', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogProvider><ClassroomEnCalificaciones
      periodoId="periodo-1"
      periodos={[{ _id: 'periodo-1', nombre: 'Inteligencia de Negocios' }]}
      alumnos={[]}
      permisos={permisos}
    /></ConfirmDialogProvider>);

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Curso de Classroom' }), 'course-1');
    await screen.findByRole('option', { name: 'Tercer parcial' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Parcial destino' }), '3');
    await user.click(screen.getByRole('button', { name: 'Previsualizar evaluación continua' }));

    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/evaluaciones/v2/classroom/importaciones/preview', {
      periodoId: 'periodo-1', actividades: [{ courseId: 'course-1', courseWorkId: 'work-1', corte: 3 }]
    }));
    expect(screen.getByText(/12 nuevas/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar y sincronizar selección' }));
    expect(enviarMock).toHaveBeenCalledTimes(1);
    await user.click(await screen.findByRole('button', { name: 'Sincronizar selección' }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/evaluaciones/v2/classroom/importaciones/ejecutar', {
      periodoId: 'periodo-1', actividades: [{ courseId: 'course-1', courseWorkId: 'work-1', corte: 3 }]
    }));
  });
});
