/**
 * seccionCalificar.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionCalificar } from '../src/apps/app_docente/SeccionCalificar';
import { emitToast } from '../src/ui/toast/toastBus';
import type { ResultadoOmr } from '../src/apps/app_docente/tipos';

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionCalificar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const omrResultadoMock: ResultadoOmr = {
    estadoAnalisis: 'ok',
    calidadPagina: 0.95,
    confianzaPromedioPagina: 0.92,
    ratioAmbiguas: 0.0,
    templateVersionDetectada: 4,
    motivosRevision: [],
    qrTexto: 'EX-GEN-001'
  };

  it('bloquea calificación y avisa cuando falta examen o alumno', () => {
    render(
      <SeccionCalificar
        examenId={null}
        alumnoId={null}
        resultadoOmr={null}
        revisionOmrConfirmada={false}
        respuestasDetectadas={[]}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        onCalificar={vi.fn()}
        puedeCalificar={true}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Calificar examen/i })).toBeInTheDocument();
    expect(screen.getByText(/selecciona primero examen y alumno/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar calificación/i })).toBeDisabled();
  });

  it('calcula aciertos sobre 5.00 y aplica exactamente +0.25 por guía al seleccionarlo', async () => {
    const mockCalificar = vi.fn().mockResolvedValue({});

    const respuestas = [
      { numeroPregunta: 1, opcion: 'A', confianza: 0.9 },
      { numeroPregunta: 2, opcion: 'B', confianza: 0.9 },
      { numeroPregunta: 3, opcion: 'C', confianza: 0.9 },
      { numeroPregunta: 4, opcion: 'D', confianza: 0.9 },
      { numeroPregunta: 5, opcion: 'A', confianza: 0.9 } // Incorrecta (clave es E)
    ];

    const clave = {
      1: 'A',
      2: 'B',
      3: 'C',
      4: 'D',
      5: 'E'
    };

    render(
      <SeccionCalificar
        examenId="ex-101"
        alumnoId="alu-202"
        examenEtiqueta="FOL-000101"
        alumnoNombre="María Elena Morales"
        resultadoOmr={omrResultadoMock}
        revisionOmrConfirmada={true}
        respuestasDetectadas={respuestas}
        claveCorrectaPorNumero={clave}
        ordenPreguntasClave={[1, 2, 3, 4, 5]}
        onCalificar={mockCalificar}
        puedeCalificar={true}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.getByText(/Aciertos: 4\/5/i)).toBeInTheDocument();
    expect(screen.getByText(/Calificación final: 4.00 \/ 5.00/i)).toBeInTheDocument();

    const checkboxBonus = screen.getByRole('checkbox', { name: /Bono por guía de estudio \(\+0\.25\)/i });
    fireEvent.click(checkboxBonus);

    expect(screen.getByText(/Calificación final: 4.25 \/ 5.00/i)).toBeInTheDocument();

    const botonGuardar = screen.getByRole('button', { name: /Guardar calificación/i });
    expect(botonGuardar).not.toBeDisabled();

    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(mockCalificar).toHaveBeenCalledWith(
        expect.objectContaining({
          examenGeneradoId: 'ex-101',
          alumnoId: 'alu-202',
          aciertos: 4,
          totalReactivos: 5,
          bonoSolicitado: 0.25
        })
      );
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Calificacion' })
    );
  });

  it('cuenta blancos y dobles marcas no resueltas como incorrectas y conserva sus estados al guardar', async () => {
    const mockCalificar = vi.fn().mockResolvedValue({});
    const respuestas = [
      { numeroPregunta: 1, opcion: 'A', confianza: 0.95, estadoRespuesta: 'respondida' as const },
      { numeroPregunta: 2, opcion: null, confianza: 0.92, estadoRespuesta: 'sin_marca' as const },
      {
        numeroPregunta: 3,
        opcion: null,
        confianza: 0.55,
        estadoRespuesta: 'doble_marca' as const,
        flags: ['doble_marca' as const]
      }
    ];

    render(
      <SeccionCalificar
        examenId="ex-omr-review"
        alumnoId="alu-omr-review"
        resultadoOmr={omrResultadoMock}
        revisionOmrConfirmada={true}
        respuestasDetectadas={respuestas}
        claveCorrectaPorNumero={{ 1: 'A', 2: 'B', 3: 'C' }}
        ordenPreguntasClave={[1, 2, 3]}
        onCalificar={mockCalificar}
        puedeCalificar={true}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.getByText(/Aciertos: 1\/3/i)).toBeInTheDocument();
    expect(screen.getByText(/Calificación final: 1\.67 \/ 5\.00/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Guardar calificación/i }));

    await waitFor(() => {
      expect(mockCalificar).toHaveBeenCalledWith(
        expect.objectContaining({
          aciertos: 1,
          totalReactivos: 3,
          respuestasDetectadas: [
            expect.objectContaining({ numeroPregunta: 1, opcion: 'A', estadoRespuesta: 'respondida' }),
            expect.objectContaining({ numeroPregunta: 2, opcion: null, estadoRespuesta: 'sin_marca' }),
            expect.objectContaining({
              numeroPregunta: 3,
              opcion: null,
              estadoRespuesta: 'doble_marca',
              flags: ['doble_marca']
            })
          ]
        })
      );
    });
  });

  it('renderiza en modo solo lectura para exámenes ya calificados', () => {
    render(
      <SeccionCalificar
        examenId="ex-101"
        alumnoId="alu-202"
        examenEtiqueta="FOL-000101"
        alumnoNombre="María Elena Morales"
        resultadoOmr={omrResultadoMock}
        revisionOmrConfirmada={true}
        respuestasDetectadas={[]}
        claveCorrectaPorNumero={{ 1: 'A', 2: 'B' }}
        ordenPreguntasClave={[1, 2]}
        soloLectura={true}
        resumenPersistido={{
          aciertos: 2,
          totalReactivos: 2,
          calificacionFinalSobre5: 5.0
        }}
        onCalificar={vi.fn()}
        puedeCalificar={true}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.getByText(/Examen calificado cargado en modo solo lectura/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Calificación registrada \(solo lectura\)/i })).toBeDisabled();
  });
});
