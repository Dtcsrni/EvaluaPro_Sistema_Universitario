import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlantillasHistorialLotes } from '../src/apps/app_docente/features/plantillas/components/PlantillasHistorialLotes';

describe('historial de paquetes archivados', () => {
  it('muestra lotes archivados, restaura y pagina el historial', () => {
    const restaurar = vi.fn(async () => {});
    const cargarMas = vi.fn(async () => {});
    render(
      <PlantillasHistorialLotes
        cargandoExamenesGenerados={false}
        examenesGenerados={[]}
        alumnosPorId={new Map()}
        formatearFechaHora={(value) => value ?? '-'}
        puedeRegenerarExamenes
        descargandoExamenId={null}
        archivandoExamenId={null}
        regenerarPdfExamen={async () => {}}
        puedeDescargarExamenes
        descargarPdfExamen={async () => {}}
        eliminarExamenGenerado={async () => {}}
        regenerandoExamenId={null}
        puedeArchivarExamenes
        descargandoLoteId={null}
        regenerandoLoteId={null}
        eliminandoLoteId={null}
        onDescargarPaquete={async () => {}}
        onRegenerarPaquete={async () => {}}
        onEliminarPaquete={async () => {}}
        lotesArchivados={[{
          loteId: 'LOT_ARCHIVADO',
          plantillaId: 'PLANTILLA_1',
          totalExamenes: 2,
          totalPaginas: 4,
          archivado: true,
          archivadoEn: '2026-09-28T00:00:00.000Z'
        }]}
        cantidadLotesOmrArchivados={0}
        cargandoLotesArchivados={false}
        hayMasLotesArchivados
        onCargarMasLotesArchivados={cargarMas}
        restaurandoLoteId={null}
        onRestaurarPaquete={restaurar}
      />
    );

    expect(screen.getByText('Paquete archivado: LOT_ARCHIVADO')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar paquete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más paquetes archivados' }));
    expect(restaurar).toHaveBeenCalledWith('LOT_ARCHIVADO');
    expect(cargarMas).toHaveBeenCalledOnce();
  });

  it('distingue la ausencia de paquetes activos cuando hay lotes archivados disponibles para OMR', () => {
    render(
      <PlantillasHistorialLotes
        cargandoExamenesGenerados={false}
        examenesGenerados={[]}
        alumnosPorId={new Map()}
        formatearFechaHora={(value) => value ?? '-'}
        puedeRegenerarExamenes
        descargandoExamenId={null}
        archivandoExamenId={null}
        regenerarPdfExamen={async () => {}}
        puedeDescargarExamenes
        descargarPdfExamen={async () => {}}
        eliminarExamenGenerado={async () => {}}
        regenerandoExamenId={null}
        puedeArchivarExamenes
        descargandoLoteId={null}
        regenerandoLoteId={null}
        eliminandoLoteId={null}
        onDescargarPaquete={async () => {}}
        onRegenerarPaquete={async () => {}}
        onEliminarPaquete={async () => {}}
        lotesArchivados={[]}
        cantidadLotesOmrArchivados={12}
        cargandoLotesArchivados={false}
        hayMasLotesArchivados={false}
        onCargarMasLotesArchivados={async () => {}}
        restaurandoLoteId={null}
        onRestaurarPaquete={async () => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'No hay paquetes activos' })).toBeInTheDocument();
    expect(screen.getByText(/Hay 12 lotes archivados disponibles en el panel OMR inferior/i)).toBeInTheDocument();
  });
});
