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

  it('calcula la nota base sobre 5.00 y deja el bono sujeto al OCR del examen', async () => {
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
    expect(screen.getByText(/Nota base \(bono OCR pendiente\): 4.00 \/ 5.00/i)).toBeInTheDocument();
    expect(screen.getByText(/solo agrega \+0\.25 si el OCR local confirma ese texto/i)).toBeInTheDocument();

    const botonGuardar = screen.getByRole('button', { name: /Guardar calificación/i });
    expect(botonGuardar).not.toBeDisabled();

    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(mockCalificar).toHaveBeenCalledWith(
        expect.objectContaining({
          examenGeneradoId: 'ex-101',
          alumnoId: 'alu-202',
          aciertos: 4,
          totalReactivos: 5
        })
      );
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Calificacion' })
    );
  });

  it('bloquea el guardado si una doble marca sigue sin resolverse aunque la revisión general esté confirmada', async () => {
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

    expect(screen.getByText(/calificación bloqueada: resuelve visualmente 1 pregunta/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar calificación/i })).toBeDisabled();
    expect(mockCalificar).not.toHaveBeenCalled();
  });

  it('muestra captura y clave, y solo permite guardar tras resolver cada pregunta', async () => {
    const actualizarRespuesta = vi.fn();
    const mockCalificar = vi.fn().mockResolvedValue({});
    const props = {
      examenId: 'ex-manual',
      alumnoId: 'alu-manual',
      resultadoOmr: omrResultadoMock,
      revisionOmrConfirmada: true,
      modoManual: true,
      paginasCapturaManual: [{ numeroPagina: 1, imagenBase64: 'data:image/png;base64,AQ==', preguntas: [1] }],
      onActualizarRespuestaManual: actualizarRespuesta,
      claveCorrectaPorNumero: { 1: 'C' },
      ordenPreguntasClave: [1],
      onCalificar: mockCalificar,
      puedeCalificar: true,
      avisarSinPermiso: vi.fn()
    };
    const { rerender } = render(
      <SeccionCalificar
        {...props}
        respuestasDetectadas={[{ numeroPregunta: 1, opcion: null, confianza: 0, estadoRespuesta: 'manual_review' }]}
      />
    );

    const captura = screen.getByRole('img', { name: /captura original del examen, página 1/i });
    expect(captura).toBeInTheDocument();
    expect(screen.getByText('Clave correcta')).toBeInTheDocument();
    expect(screen.getByText('C', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar calificación/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Aumentar zoom de la captura/i }));
    expect(captura).toHaveClass('omr-review-card__image--zoom-125');
    fireEvent.click(screen.getByRole('button', { name: /Ajustar captura al ancho/i }));
    expect(captura).toHaveClass('omr-review-card__image--zoom-100');
    fireEvent.click(screen.getByRole('button', { name: /Reducir zoom de la captura/i }));
    fireEvent.click(screen.getByRole('button', { name: /Reducir zoom de la captura/i }));
    expect(captura).toHaveClass('omr-review-card__image--zoom-50');

    expect(screen.getByRole('region', { name: /revisión manual con captura y clave/i })).toBeInTheDocument();
    expect(screen.getByText('Marca observada')).toBeInTheDocument();
    expect(screen.getByText('Clave correcta')).toBeInTheDocument();
    const respuesta = screen.getByRole('combobox', { name: /marca observada en la captura, pregunta 1/i });
    fireEvent.change(respuesta, { target: { value: '' } });
    expect(actualizarRespuesta).toHaveBeenLastCalledWith(1, undefined);
    fireEvent.change(respuesta, { target: { value: '__BLANCO__' } });
    expect(actualizarRespuesta).toHaveBeenLastCalledWith(1, null);
    expect(screen.getByRole('button', { name: /Guardar calificación/i })).toBeDisabled();

    fireEvent.change(respuesta, { target: { value: 'C' } });
    expect(actualizarRespuesta).toHaveBeenLastCalledWith(1, 'C');
    fireEvent.change(respuesta, { target: { value: 'B' } });
    rerender(
      <SeccionCalificar
        {...props}
        respuestasDetectadas={[{ numeroPregunta: 1, opcion: 'B', confianza: 0, estadoRespuesta: 'respondida' }]}
      />
    );
    expect(screen.getByText('Incorrecta')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: /marca observada en la captura, pregunta 1/i }), { target: { value: 'C' } });
    rerender(
      <SeccionCalificar
        {...props}
        respuestasDetectadas={[{ numeroPregunta: 1, opcion: 'C', confianza: 0, estadoRespuesta: 'respondida' }]}
      />
    );
    expect(screen.getByText('Correcta')).toBeInTheDocument();

    rerender(
      <SeccionCalificar
        {...props}
        respuestasDetectadas={[{ numeroPregunta: 1, opcion: 'C', confianza: 0, estadoRespuesta: 'respondida' }]}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: /no aparece/i }));
    const botonGuardar = screen.getByRole('button', { name: /Guardar calificación/i });
    expect(botonGuardar).toBeEnabled();
    fireEvent.click(botonGuardar);
    await waitFor(() => expect(mockCalificar).toHaveBeenCalledWith(expect.objectContaining({ aciertos: 1, totalReactivos: 1 })));
    expect(mockCalificar).toHaveBeenCalledWith(expect.objectContaining({
      respuestasDetectadas: [expect.objectContaining({ numeroPregunta: 1, opcion: 'C', estadoRespuesta: 'respondida' })],
      paginasCaptura: [{ numeroPagina: 1, imagenBase64: 'data:image/png;base64,AQ==' }],
      omrAnalisis: expect.objectContaining({ qrTexto: omrResultadoMock.qrTexto, revisionConfirmada: true, bonoVisibleConfirmado: false })
    }));
  });

  it('bloquea el guardado manual si falta el QR analizado necesario para validar la captura', () => {
    render(
      <SeccionCalificar
        examenId="ex-manual"
        alumnoId="alu-manual"
        resultadoOmr={null}
        revisionOmrConfirmada={true}
        respuestasDetectadas={[{ numeroPregunta: 1, opcion: 'C', confianza: 0.9, estadoRespuesta: 'respondida' }]}
        modoManual={true}
        paginasCapturaManual={[{ numeroPagina: 1, imagenBase64: 'data:image/png;base64,AQ==', preguntas: [1] }]}
        claveCorrectaPorNumero={{ 1: 'C' }}
        ordenPreguntasClave={[1]}
        onCalificar={vi.fn()}
        puedeCalificar={true}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Guardar calificación/i })).toBeDisabled();
    expect(screen.getByText(/falta una captura original, el vínculo de alguna pregunta con su página o el QR/i)).toBeInTheDocument();
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
