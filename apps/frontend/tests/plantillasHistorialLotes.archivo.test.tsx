import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlantillasHistorialLotes } from '../src/apps/app_docente/features/plantillas/components/PlantillasHistorialLotes';
import { PlantillasConsolaGeneracion } from '../src/apps/app_docente/features/plantillas/components/PlantillasConsolaGeneracion';

describe('historial de paquetes archivados', () => {
  it('muestra el formato en curso y bloquea cambios o solicitudes duplicadas', async () => {
    let finalizarDescarga!: () => void;
    const descargarPdfLote = vi.fn(() => new Promise<void>((resolve) => { finalizarDescarga = resolve; }));
    const descargarZipLote = vi.fn().mockResolvedValue(undefined);
    render(
      <PlantillasConsolaGeneracion
        plantillaId="PLANTILLA-1"
        setPlantillaId={vi.fn()}
        plantillas={[]}
        periodos={[]}
        alumnos={[]}
        generando={false}
        puedeGenerar
        onGenerarExamen={async () => {}}
        generandoLote={false}
        plantillaSeleccionada={null}
        puedeGenerarExamenes
        onGenerarExamenesLote={async () => {}}
        mensajeGeneracion=""
        lotePdfUrl="/examenes/generados/lote/LOTE-1/pdf"
        descargarPdfLote={descargarPdfLote}
        descargarZipLote={descargarZipLote}
        progresoLoteGeneracion={null}
        onPrevisualizarExtraordinario={async () => null}
      />
    );

    const pdf = screen.getByRole('button', { name: /Descargar PDF consolidado/i });
    fireEvent.click(pdf);
    expect(pdf).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: /Descargar ZIP de individuales/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /ZIP · PDFs individuales/i })).toBeDisabled();
    expect(descargarPdfLote).toHaveBeenCalledOnce();
    expect(descargarZipLote).not.toHaveBeenCalled();

    finalizarDescarga();
    await waitFor(() => expect(pdf).not.toHaveAttribute('aria-busy', 'true'));
  });

  it('identifica los formatos de descarga y explica el conteo del lote', () => {
    render(
      <PlantillasHistorialLotes
        cargandoExamenesGenerados={false}
        examenesGenerados={[
          { _id: 'EX-1', folio: 'FOLIO-1', loteId: 'LOTE-1', plantillaId: 'PLANTILLA-1', generadoEn: '2026-10-23T10:00:00Z' }
        ]}
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
        descargandoLoteId="LOTE-1:pdf"
        regenerandoLoteId={null}
        eliminandoLoteId={null}
        onDescargarPaquete={async () => {}}
        onDescargarZipPaquete={async () => {}}
        onRegenerarPaquete={async () => {}}
        onEliminarPaquete={async () => {}}
        lotesArchivados={[]}
        cantidadLotesOmrArchivados={0}
        cargandoLotesArchivados={false}
        hayMasLotesArchivados={false}
        onCargarMasLotesArchivados={async () => {}}
        restaurandoLoteId={null}
        onRestaurarPaquete={async () => {}}
      />
    );

    expect(screen.getByText('Exámenes con descarga registrada: 0/1').getAttribute('title')).toMatch(/no confirma/);
    expect(screen.getByRole('button', { name: /Descargar PDF consolidado/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Descargar ZIP de individuales/i })).toBeDisabled();
  });

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
