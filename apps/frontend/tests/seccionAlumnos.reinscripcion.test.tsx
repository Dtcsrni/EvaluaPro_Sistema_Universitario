import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionAlumnos } from '../src/apps/app_docente/SeccionAlumnos';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { ConfirmDialogProvider } from '../src/ui/feedback/ConfirmDialogProvider';
import type { Alumno, Periodo, PermisosUI } from '../src/apps/app_docente/tipos';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: { obtener: vi.fn(), enviar: vi.fn(), eliminar: vi.fn(), registrarEventosUso: vi.fn().mockResolvedValue({}) }
}));
vi.mock('../src/ui/toast/toastBus', () => ({ emitToast: vi.fn() }));

const permisos: PermisosUI = {
  periodos: { leer: true, gestionar: true, archivar: true },
  alumnos: { leer: true, gestionar: true },
  banco: { leer: true, gestionar: true, archivar: true },
  plantillas: { leer: true, gestionar: true, archivar: true, previsualizar: true },
  examenes: { leer: true, generar: true, archivar: true, regenerar: true, descargar: true },
  entregas: { gestionar: true }, omr: { analizar: true }, calificaciones: { calificar: true },
  publicar: { publicar: true },
  sincronizacion: { listar: true, exportar: true, importar: true, push: true, pull: true },
  cuenta: { leer: true, actualizar: true }
};

const periodos: Periodo[] = [
  { _id: 'materia-vieja', nombre: 'Materia anterior', activo: false, grupos: ['G1', 'G2'] },
  { _id: 'materia-nueva', nombre: 'Materia nueva', activo: true, grupos: ['G2'] }
];

const alumnos: Alumno[] = [
  { _id: 'a1', periodoId: 'materia-vieja', matricula: 'CUH111111111', nombreCompleto: 'Ana Ejemplo', nombres: 'Ana', apellidos: 'Ejemplo', correo: 'ana@cuh.mx', grupo: 'G1', activo: false },
  { _id: 'a2', periodoId: 'materia-vieja', matricula: 'CUH222222222', nombreCompleto: 'Luis Ejemplo', nombres: 'Luis', apellidos: 'Ejemplo', correo: 'luis@cuh.mx', grupo: 'G1', activo: false },
  { _id: 'a3', periodoId: 'materia-vieja', matricula: 'CUH333333333', nombreCompleto: 'Eva Otra', nombres: 'Eva', apellidos: 'Otra', correo: 'eva@cuh.mx', grupo: 'G2', activo: false }
];

describe('SeccionAlumnos: reinscripción por grupo archivado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [] });
  });

  it('envía el grupo seleccionado a la materia activa y actualiza la vista', async () => {
    const enviarConPermiso = vi.fn().mockResolvedValue({ reinscritos: 2, yaInscritos: 0 });
    const onRefrescar = vi.fn();
    render(
      <ConfirmDialogProvider>
        <SeccionAlumnos
          alumnos={alumnos}
          periodosActivos={[periodos[1]]}
          periodosTodos={periodos}
          onRefrescar={onRefrescar}
          permisos={permisos}
          puedeEliminarAlumnoDev={false}
          enviarConPermiso={enviarConPermiso}
          avisarSinPermiso={vi.fn()}
        />
      </ConfirmDialogProvider>
    );

    fireEvent.change(screen.getByLabelText('Grupo archivado'), { target: { value: '["materia-vieja","g1"]' } });
    fireEvent.change(screen.getByLabelText('Materia activa de destino'), { target: { value: 'materia-nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reinscribir grupo' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reinscribir grupo' }));

    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledWith(
      'alumnos:gestionar',
      '/alumnos/reinscribir-grupo-archivado',
      { periodoOrigenId: 'materia-vieja', periodoDestinoId: 'materia-nueva', grupo: 'G1' },
      'No tienes permiso para reinscribir alumnos.'
    ));
    expect(await screen.findByRole('status')).toHaveTextContent(/2 alumnos nuevos/);
    expect(onRefrescar).toHaveBeenCalledTimes(1);
  });

  it('oculta la reinscripción cuando no hay alumnos archivados con grupo', () => {
    render(
      <ConfirmDialogProvider>
        <SeccionAlumnos
          alumnos={[]}
          periodosActivos={[periodos[1]]}
          periodosTodos={periodos}
          onRefrescar={vi.fn()}
          permisos={permisos}
          puedeEliminarAlumnoDev={false}
          enviarConPermiso={vi.fn()}
          avisarSinPermiso={vi.fn()}
        />
      </ConfirmDialogProvider>
    );
    expect(screen.queryByRole('heading', { name: 'Reinscribir grupo de una materia archivada' })).not.toBeInTheDocument();
  });
});
