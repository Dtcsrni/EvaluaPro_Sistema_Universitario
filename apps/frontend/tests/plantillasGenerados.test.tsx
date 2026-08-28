/**
 * plantillasGenerados.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlantillasGenerados } from '../src/apps/app_docente/features/plantillas/components/PlantillasGenerados';
import type { Alumno, Plantilla } from '../src/apps/app_docente/tipos';

describe('PlantillasGenerados', () => {
  const plantillasMock: Plantilla[] = [
    { _id: 'plan-1', periodoId: 'per-1', titulo: 'Parcial Álgebra Lineal', preguntas: [] }
  ];

  const alumnosMock: Alumno[] = [
    {
      _id: 'alu-1',
      periodoId: 'per-1',
      matricula: 'CUH123456789',
      nombres: 'Estudiante',
      apellidos: 'Prueba',
      nombreCompleto: 'Estudiante Prueba'
    }
  ];

  it('permite alternar entre generación individual y por paquete y disparar la acción', () => {
    const mockGenerarExamen = vi.fn().mockResolvedValue(undefined);
    const mockGenerarExamenesLote = vi.fn().mockResolvedValue(undefined);

    render(
      <PlantillasGenerados
        plantillaId="plan-1"
        setPlantillaId={vi.fn()}
        plantillas={plantillasMock}
        alumnos={alumnosMock}
        generando={false}
        puedeGenerar={true}
        onGenerarExamen={mockGenerarExamen}
        generandoLote={false}
        plantillaSeleccionada={plantillasMock[0]!}
        puedeGenerarExamenes={true}
        onGenerarExamenesLote={mockGenerarExamenesLote}
        mensajeGeneracion=""
        lotePdfUrl={null}
        descargarPdfLote={vi.fn().mockResolvedValue(undefined)}
        ultimoGenerado={null}
        formatearFechaHora={vi.fn().mockReturnValue('2026-08-20')}
        cargandoExamenesGenerados={false}
        examenesGenerados={[]}
        alumnosPorId={new Map()}
        puedeRegenerarExamenes={true}
        descargandoExamenId={null}
        archivandoExamenId={null}
        regenerarPdfExamen={vi.fn().mockResolvedValue(undefined)}
        puedeDescargarExamenes={true}
        descargarPdfExamen={vi.fn().mockResolvedValue(undefined)}
        eliminarExamenGenerado={vi.fn().mockResolvedValue(undefined)}
        regenerandoExamenId={null}
        puedeArchivarExamenes={true}
        descargandoLoteId={null}
        regenerandoLoteId={null}
        eliminandoLoteId={null}
        onDescargarPaquete={vi.fn().mockResolvedValue(undefined)}
        onRegenerarPaquete={vi.fn().mockResolvedValue(undefined)}
        onEliminarPaquete={vi.fn().mockResolvedValue(undefined)}
        progresoLoteGeneracion={null}
      />
    );

    expect(screen.getByRole('heading', { name: /^Generación de exámenes$/i })).toBeInTheDocument();

    // En modo paquete inicial
    const botonGenerarPaquete = screen.getByRole('button', { name: /Generar paquete de examenes/i });
    expect(botonGenerarPaquete).not.toBeDisabled();
    fireEvent.click(botonGenerarPaquete);
    expect(mockGenerarExamenesLote).toHaveBeenCalledTimes(1);

    // Alternar a individual
    const botonModoIndividual = screen.getByRole('button', { name: /^Individual$/i });
    fireEvent.click(botonModoIndividual);

    const botonGenerarIndividual = screen.getByRole('button', { name: /Generar examen individual/i });
    expect(botonGenerarIndividual).not.toBeDisabled();
    fireEvent.click(botonGenerarIndividual);
    expect(mockGenerarExamen).toHaveBeenCalledTimes(1);
  });
});
