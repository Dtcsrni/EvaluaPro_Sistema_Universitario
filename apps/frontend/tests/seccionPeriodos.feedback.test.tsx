import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeccionPeriodos } from '../src/apps/app_docente/SeccionPeriodos';
import type { Periodo, PermisosUI } from '../src/apps/app_docente/tipos';

vi.mock('../src/ui/feedback/ConfirmDialogProvider', () => ({
  useConfirmDialog: () => vi.fn(async () => true)
}));

const permisos: PermisosUI = {
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

const periodo = {
  _id: 'per-feedback',
  nombre: 'Materia ficticia',
  fechaInicio: '2026-02-01',
  fechaFin: '2026-03-01',
  grupos: ['3A']
} as unknown as Periodo;

describe('SeccionPeriodos feedback contextual', () => {
  const avisos: unknown[] = [];
  const recibirAviso = (event: Event) => avisos.push((event as CustomEvent).detail);

  beforeEach(() => {
    avisos.length = 0;
    window.addEventListener('app:toast', recibirAviso);
  });

  afterEach(() => window.removeEventListener('app:toast', recibirAviso));

  function renderMaterias(enviarConPermiso: (permiso: string, ruta: string) => Promise<unknown>, permitirBorradoDev = false) {
    return render(
      <SeccionPeriodos
        periodos={[periodo]}
        onRefrescar={vi.fn()}
        onVerArchivadas={vi.fn()}
        permisos={permisos}
        puedeEliminarMateriaDev={permitirBorradoDev}
        enviarConPermiso={enviarConPermiso as never}
        avisarSinPermiso={vi.fn()}
      />
    );
  }

  it('confirma el archivado en Materias sin duplicarlo en un toast', async () => {
    const enviarConPermiso = vi.fn(async () => ({}));
    renderMaterias(enviarConPermiso);
    fireEvent.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Archivar materia/ }));

    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledWith(
      'periodos:archivar', '/periodos/per-feedback/archivar', {}, 'No tienes permiso para archivar materias.'
    ));
    const confirmacion = await screen.findByText('Materia archivada');
    expect(confirmacion.closest('[role="status"]')).toBeInTheDocument();
    expect(avisos).toHaveLength(0);
  });

  it('confirma la eliminación de desarrollo en contexto sin duplicar el aviso', async () => {
    const enviarConPermiso = vi.fn(async () => ({}));
    renderMaterias(enviarConPermiso, true);
    fireEvent.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Eliminar materia .* \(DEV\)$/ }));

    await waitFor(() => expect(enviarConPermiso).toHaveBeenCalledWith(
      'periodos:eliminar_dev', '/periodos/per-feedback/eliminar', {}, 'No tienes permiso para eliminar materias en desarrollo.'
    ));
    const confirmacion = await screen.findByText('Materia eliminada');
    expect(confirmacion.closest('[role="status"]')).toBeInTheDocument();
    expect(avisos).toHaveLength(0);
  });

  it('muestra el error genérico de archivado como alerta local sin toast repetido', async () => {
    renderMaterias(vi.fn().mockRejectedValue(new Error('No se pudo archivar la materia.')));
    fireEvent.click(screen.getByRole('button', { name: /Mostrar acciones/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Archivar materia/ }));

    const detalle = await screen.findByText('No se pudo archivar la materia.');
    expect(detalle.closest('[role="alert"]')).toBeInTheDocument();
    expect(avisos).toHaveLength(0);
  });
});
