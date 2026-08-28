/**
 * plantillasOmrWorkflow.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlantillasOmrWorkflow } from '../src/apps/app_docente/features/plantillas/components/PlantillasOmrWorkflow';
import type { GeneratedAssessmentDetalle, OmrJobDetalle } from '../src/apps/app_docente/tipos';

describe('PlantillasOmrWorkflow', () => {
  it('renderiza mensaje informativo cuando no hay assessment cargado', () => {
    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={null}
        jobOmr={null}
        cargandoAssessmentId={null}
        procesandoOmr={false}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)}
        crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)}
        finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByRole('heading', { name: /Flujo OMR V1/i })).toBeInTheDocument();
    expect(screen.getByText(/Genera o carga un assessment V1/i)).toBeInTheDocument();
  });

  it('renderiza resumen de assessment y job OMR con hojas para revisión', () => {
    const assessmentMock: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'ass-1',
        folio: 'ASS-FOLIO-101',
        generationSeed: 'seed-xyz',
        title: 'Examen Biología Celular',
        templateId: 'plan-1',
        templateVersion: 1,
        statisticsSummary: {
          versionCount: 2,
          pageCount: 1,
          questionCount: 10,
          uniqueQuestionCount: 10
        },
        artifacts: []
      },
      jobs: []
    };

    const jobOmrMock: OmrJobDetalle = {
      jobId: 'job-101',
      assessmentId: 'ass-1',
      status: 'review_pending',
      summary: {
        total: 1,
        accepted: 0,
        needsReview: 1,
        rejected: 0,
        autoGradable: 0,
        averageScore: 0
      },
      pages: [
        {
          sheetSerial: 'SH-001',
          pageIndex: 1,
          scanStatus: 'needs_review',
          confidence: 0.85,
          autoGradable: false,
          exceptions: [{ code: 'LOW_CONFIDENCE', message: 'Revisión requerida' }],
          identityResult: { studentId: 'CUH111' },
          versionResult: { versionCode: 'A' },
          responses: [{ numeroPregunta: 1, opcion: 'A' }]
        }
      ]
    };

    const mockResolver = vi.fn().mockResolvedValue(undefined);
    const mockFinalizar = vi.fn().mockResolvedValue(undefined);

    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentMock}
        jobOmr={jobOmrMock}
        cargandoAssessmentId={null}
        procesandoOmr={false}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)}
        crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={mockResolver}
        finalizarJobOmr={mockFinalizar}
      />
    );

    expect(screen.getByText(/Folio: ASS-FOLIO-101/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SH-001 · P1 · needs_review/i })).toBeInTheDocument();

    // Seleccionar hoja para revisión
    const botonHoja = screen.getByRole('button', { name: /SH-001 · P1 · needs_review/i });
    fireEvent.click(botonHoja);

    expect(screen.getByRole('heading', { name: /Review & Fix: SH-001/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('CUH111')).toBeInTheDocument();

    const botonResolver = screen.getByRole('button', { name: /Guardar resolución/i });
    expect(botonResolver).not.toBeDisabled();
    fireEvent.click(botonResolver);

    expect(mockResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-101',
        sheetSerial: 'SH-001'
      })
    );
  });
});
