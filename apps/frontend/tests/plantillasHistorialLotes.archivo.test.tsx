import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlantillasHistorialLotes } from '../src/apps/app_docente/features/plantillas/components/PlantillasHistorialLotes';
import { PlantillasConsolaGeneracion } from '../src/apps/app_docente/features/plantillas/components/PlantillasConsolaGeneracion';
import type { Alumno } from '../src/apps/app_docente/tipos';

describe('historial de paquetes archivados', () => {
  it('anuncia la carga del historial como estado accesible', () => {
    render(
      <PlantillasHistorialLotes
        cargandoExamenesGenerados
        examenesGenerados={[]}
        alumnosPorId={new Map()}
        formatearFechaHora={(value) => value ?? '-'}
        puedeRegenerarExamenes={false}
        descargandoExamenId={null}
        archivandoExamenId={null}
        regenerarPdfExamen={async () => {}}
        puedeDescargarExamenes={false}
        descargarPdfExamen={async () => {}}
        eliminarExamenGenerado={async () => {}}
        regenerandoExamenId={null}
        puedeArchivarExamenes={false}
        descargandoLoteId={null}
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

    expect(screen.getByRole('status')).toHaveTextContent('Cargando historial de exámenes generados');
  });

  it('anuncia la carga incremental de paquetes archivados como estado accesible', () => {
    render(
      <PlantillasHistorialLotes
        cargandoExamenesGenerados={false}
        examenesGenerados={[{ _id: 'EX-1', folio: 'FOLIO-1', plantillaId: 'PLANTILLA-1' }]}
        alumnosPorId={new Map()}
        formatearFechaHora={(value) => value ?? '-'}
        puedeRegenerarExamenes={false}
        descargandoExamenId={null}
        archivandoExamenId={null}
        regenerarPdfExamen={async () => {}}
        puedeDescargarExamenes={false}
        descargarPdfExamen={async () => {}}
        eliminarExamenGenerado={async () => {}}
        regenerandoExamenId={null}
        puedeArchivarExamenes={false}
        descargandoLoteId={null}
        regenerandoLoteId={null}
        eliminandoLoteId={null}
        onDescargarPaquete={async () => {}}
        onDescargarZipPaquete={async () => {}}
        onRegenerarPaquete={async () => {}}
        onEliminarPaquete={async () => {}}
        lotesArchivados={[]}
        cantidadLotesOmrArchivados={0}
        cargandoLotesArchivados
        hayMasLotesArchivados={false}
        onCargarMasLotesArchivados={async () => {}}
        restaurandoLoteId={null}
        onRestaurarPaquete={async () => {}}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando paquetes archivados');
  });

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
        mensajeGeneracionEsError={false}
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
          { _id: 'EX-1', folio: 'FOLIO-1', loteId: 'LOTE-1', plantillaId: 'PLANTILLA-1', generadoEn: '2026-10-23T10:00:00Z' },
          { _id: 'EX-2', folio: 'FOLIO-INDIVIDUAL', plantillaId: 'PLANTILLA-1', alumnoId: 'ALUMNO-1', generadoEn: '2026-10-23T10:00:00Z' },
          { _id: 'EX-3', folio: 'FOLIO-SIN-ALUMNO', plantillaId: 'PLANTILLA-1', alumnoId: 'ALUMNO-2', generadoEn: '2026-10-23T10:00:00Z' }
        ]}
        alumnosPorId={new Map([['ALUMNO-1', { _id: 'ALUMNO-1', matricula: 'A001', nombreCompleto: 'Ana Dummy', nombres: 'Ana', apellidos: 'Dummy' } as Alumno]])}
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

    expect(screen.getByText('Descarga registrada en folios visibles: 0/1').getAttribute('title')).toMatch(/no confirma/);
    expect(screen.getByRole('button', { name: /Descargar PDF consolidado/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Descargar ZIP de exámenes individuales/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descargar PDF del folio FOLIO-INDIVIDUAL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerar PDF del folio FOLIO-INDIVIDUAL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archivar folio FOLIO-INDIVIDUAL' })).toHaveTextContent('Archivar');
    const examenIndividual = screen.getByText('Folio: FOLIO-INDIVIDUAL').closest('li');
    expect(examenIndividual).toHaveTextContent('Alumno: Ana Dummy');
    expect(examenIndividual).not.toHaveTextContent('ID:');
    expect(screen.getByText('Folio: FOLIO-SIN-ALUMNO').closest('li')).toHaveTextContent('Alumno: Alumno no disponible');
    expect(screen.getByRole('button', { name: /Regenerar todos los exámenes, lote con folios visibles FOLIO-1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Archivar paquete completo tras cierre de materia o verificación de calificaciones, lote con folios visibles FOLIO-1/i })).toHaveTextContent('Archivar');
    expect(screen.queryByText(/LOTE-1/)).not.toBeInTheDocument();
    expect(screen.getByText(/Se muestran hasta 50 exámenes recientes/)).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: 'Paquetes archivados visibles (1)' })).toBeInTheDocument();
    expect(screen.getByText('Paquete archivado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar paquete de 2 exámenes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más paquetes archivados' }));
    expect(restaurar).toHaveBeenCalledWith('LOT_ARCHIVADO', 'paquete archivado de 2 exámenes y 4 páginas');
    expect(screen.queryByText(/LOT_ARCHIVADO/)).not.toBeInTheDocument();
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
    expect(screen.getByText(/Hay 12 lotes activos o archivados disponibles para cotejo OMR/i)).toBeInTheDocument();
  });

  it('anuncia fallos separados del historial, permite reintentar y no presenta un vacío falso', () => {
    const reintentar = vi.fn();
    render(
      <PlantillasHistorialLotes
        cargandoExamenesGenerados={false}
        errorExamenesGenerados="No se pudo cargar el historial de exámenes"
        errorLotesArchivados="No se pudo cargar el archivo de paquetes"
        onReintentarCarga={reintentar}
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

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.queryByRole('heading', { name: 'No hay exámenes generados aún' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar historial de exámenes generados' }));
    expect(reintentar).toHaveBeenCalledOnce();
  });
});
