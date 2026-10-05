import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlantillasConsolaGeneracion } from '../src/apps/app_docente/features/plantillas/components/PlantillasConsolaGeneracion';
import type { Alumno, Periodo, Plantilla } from '../src/apps/app_docente/tipos';

describe('generación extraordinaria desde periodo archivado', () => {
  it('ofrece solo extraordinario y permite seleccionar a un alumno conservado en el archivo', async () => {
    const plantilla: Plantilla = {
      _id: 'pla-cerrada',
      titulo: 'Global Diseño Web',
      tipo: 'global',
      numeroPaginas: 2,
      periodoId: 'per-cerrado',
      archivadoEn: '2026-10-01T00:00:00.000Z'
    };
    const periodo: Periodo = {
      _id: 'per-cerrado',
      nombre: 'Agosto-Septiembre 2026',
      fechaFin: '2026-09-30',
      activo: false
    };
    const carlos: Alumno = {
      _id: 'al-carlos',
      matricula: 'CUH512419101',
      nombreCompleto: 'Carlos Anwar',
      periodoId: periodo._id,
      activo: false
    };
    const ajeno: Alumno = {
      _id: 'al-ajeno',
      matricula: 'CUH512419102',
      nombreCompleto: 'Alumno de otra materia',
      periodoId: 'per-vigente',
      activo: true
    };
    const generarLote = vi.fn(async () => {});
    const previsualizarExtraordinario = vi.fn(async () => ({
      layoutConfirmado: true,
      paginas: Array.from({ length: 4 }, (_, indice) => ({
        numero: indice + 1,
        dataUrl: 'data:image/png;base64,AA==',
        width: 1,
        height: 1
      })),
      totalDisponibles: 24,
      totalUsados: 24,
      numeroPaginas: 4
    }));

    render(
      <PlantillasConsolaGeneracion
        plantillaId={plantilla._id}
        setPlantillaId={() => {}}
        plantillas={[plantilla]}
        periodos={[periodo]}
        alumnos={[carlos, ajeno]}
        generando={false}
        puedeGenerar
        onGenerarExamen={async () => {}}
        generandoLote={false}
        plantillaSeleccionada={plantilla}
        puedeGenerarExamenes
        onGenerarExamenesLote={generarLote}
        mensajeGeneracion=""
        lotePdfUrl={null}
        descargarPdfLote={async () => {}}
        progresoLoteGeneracion={null}
        onPrevisualizarExtraordinario={previsualizarExtraordinario}
      />
    );

    const modalidad = screen.getByRole('combobox', { name: 'Tipo de examen' });
    expect(modalidad).toHaveValue('extraordinario');
    expect(within(modalidad).getByRole('option', { name: /Ordinario · Global/i })).toBeDisabled();
    expect(screen.getByText(/Periodo cerrado: el extraordinario conserva la materia y la plantilla archivadas/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Alumno de otra materia/i })).not.toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', { name: /Carlos Anwar · CUH512419101/i });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /Previsualizar PDF antes de generar/i }));
    await screen.findByText(/24 de 24 preguntas del global/i);
    fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo que revisé la vista previa del examen/i }));
    fireEvent.click(screen.getByRole('button', { name: /Generar extraordinarios \(1 alumnos\)/i }));

    await waitFor(() => expect(generarLote).toHaveBeenCalledWith({
      tipoExamen: 'extraordinario',
      alumnoIds: [carlos._id]
    }));
  });
});
