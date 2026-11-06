/**
 * seccionCalificar.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionCalificar } from '../src/apps/app_docente/SeccionCalificar';
import { ErrorRemoto } from '../src/servicios_api/clienteApi';
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
    expect(screen.queryByText('Tu perfil no tiene permiso para guardar esta calificación.')).not.toBeInTheDocument();
  });

  it('no muestra la instrucción OMR cuando la calificación es manual y no hay resultado OMR', () => {
    render(
      <SeccionCalificar
        examenId="ex-manual"
        alumnoId="alu-manual"
        resultadoOmr={null}
        revisionOmrConfirmada={true}
        respuestasDetectadas={[]}
        claveCorrectaPorNumero={{ 1: 'A' }}
        ordenPreguntasClave={[1]}
        onCalificar={vi.fn()}
        puedeCalificar={true}
        avisarSinPermiso={vi.fn()}
      />
    );

    expect(screen.getByText(/La calificación final se recalcula automáticamente/i)).toBeInTheDocument();
    expect(screen.getByText('Revisa las respuestas cargadas y el cálculo antes de guardar.')).toBeInTheDocument();
    expect(screen.getByText('La calificación se calcula según las respuestas cargadas y la clave del examen.')).toBeInTheDocument();
    expect(screen.queryByText('La calificación se calcula automáticamente a partir de resultados OMR confirmados.')).not.toBeInTheDocument();
    expect(screen.queryByText('Si se requiere revisión OMR, confirma las respuestas detectadas antes de guardar.')).not.toBeInTheDocument();
  });

  it('permite capturar aciertos manuales sin respuestas OMR y conserva el payload soportado', async () => {
    const mockCalificar = vi.fn().mockResolvedValue({});
    render(
      <SeccionCalificar
        examenId="ex-captura-manual"
        alumnoId="alu-captura-manual"
        resultadoOmr={null}
        revisionOmrConfirmada={true}
        respuestasDetectadas={[1, 2, 3, 4, 5].map((numeroPregunta) => ({ numeroPregunta, opcion: null, confianza: 0 }))}
        claveCorrectaPorNumero={{ 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' }}
        ordenPreguntasClave={[1, 2, 3, 4, 5]}
        capturaManualAciertos={true}
        onCalificar={mockCalificar}
        puedeCalificar={true}
        avisarSinPermiso={vi.fn()}
      />
    );

    const campoAciertos = screen.getByRole('spinbutton', { name: /Aciertos obtenidos/i });
    expect(campoAciertos).toHaveAttribute('min', '0');
    expect(campoAciertos).toHaveAttribute('max', '5');
    expect(campoAciertos).toHaveValue(null);
    expect(screen.getByText(/Aciertos: pendiente\/5/i)).toBeInTheDocument();
    expect(screen.getByText(/Calificación final: pendiente/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar calificación/i })).toBeDisabled();

    fireEvent.change(campoAciertos, { target: { value: '3' } });
    expect(screen.getByText(/Aciertos: 3\/5/i)).toBeInTheDocument();
    expect(screen.getByText(/Calificación final: 3\.00 \/ 5\.00/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar calificación/i })).toBeEnabled();
    fireEvent.change(campoAciertos, { target: { value: '6' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Captura un número entero entre 0 y 5.');
    expect(screen.getByRole('button', { name: /Guardar calificación/i })).toBeDisabled();

    fireEvent.change(campoAciertos, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar calificación/i }));
    await waitFor(() => expect(mockCalificar).toHaveBeenCalledWith(expect.objectContaining({
      examenGeneradoId: 'ex-captura-manual',
      alumnoId: 'alu-captura-manual',
      aciertos: 3,
      totalReactivos: 5,
      bonoSolicitado: 0
    })));
    const payload = mockCalificar.mock.calls[0]?.[0];
    expect(payload).not.toHaveProperty('respuestasDetectadas');
    expect(payload?.omrAnalisis).toBeUndefined();
  });

  it('pide confirmación solo cuando se registran cero aciertos manuales', () => {
    render(
      <SeccionCalificar
        examenId="ex-manual-cero"
        alumnoId="alu-manual-cero"
        resultadoOmr={null}
        revisionOmrConfirmada={true}
        respuestasDetectadas={[{ numeroPregunta: 1, opcion: null, confianza: 0 }]}
        claveCorrectaPorNumero={{ 1: 'A' }}
        ordenPreguntasClave={[1]}
        capturaManualAciertos={true}
        onCalificar={vi.fn()}
        puedeCalificar={true}
        avisarSinPermiso={vi.fn()}
      />
    );

    const campoAciertos = screen.getByRole('spinbutton', { name: /Aciertos obtenidos/i });
    fireEvent.change(campoAciertos, { target: { value: '0' } });
    expect(screen.getByText(/Registraste 0 aciertos\. Se guardará 0\.00 \/ 5\.00/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar calificación/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo guardar 0 aciertos/i }));
    expect(screen.getByRole('button', { name: /Guardar calificación/i })).toBeEnabled();
    fireEvent.change(campoAciertos, { target: { value: '1' } });
    expect(screen.getByRole('button', { name: /Guardar calificación/i })).toBeEnabled();
    expect(screen.queryByRole('checkbox', { name: /Confirmo guardar 0 aciertos/i })).not.toBeInTheDocument();
  });

  it('limpia los aciertos manuales al cambiar el examen seleccionado', () => {
    const props = {
      examenId: 'ex-cambio-a',
      alumnoId: 'alu-cambio',
      resultadoOmr: null,
      revisionOmrConfirmada: true,
      respuestasDetectadas: [{ numeroPregunta: 1, opcion: null, confianza: 0 }],
      claveCorrectaPorNumero: { 1: 'A' },
      ordenPreguntasClave: [1],
      capturaManualAciertos: true,
      onCalificar: vi.fn(),
      puedeCalificar: true,
      avisarSinPermiso: vi.fn()
    };
    const view = render(<SeccionCalificar {...props} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: /Aciertos obtenidos/i }), { target: { value: '1' } });
    expect(screen.getByText(/Aciertos: 1\/1/i)).toBeInTheDocument();

    view.rerender(<SeccionCalificar {...props} examenId="ex-cambio-b" />);
    expect(screen.getByRole('spinbutton', { name: /Aciertos obtenidos/i })).toHaveValue(null);
    expect(screen.getByText(/Aciertos: pendiente\/1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar calificación/i })).toBeDisabled();
  });

  it('exige confirmar el resultado cuando se intenta guardar sin respuestas OMR', async () => {
    const mockCalificar = vi.fn().mockResolvedValue({});
    render(
      <SeccionCalificar
        examenId="ex-manual-vacio"
        alumnoId="alu-manual-vacio"
        resultadoOmr={null}
        revisionOmrConfirmada={true}
        respuestasDetectadas={[{ numeroPregunta: 1, opcion: null, confianza: 0 }, { numeroPregunta: 2, opcion: null, confianza: 0 }]}
        claveCorrectaPorNumero={{ 1: 'A', 2: 'B' }}
        ordenPreguntasClave={[1, 2]}
        onCalificar={mockCalificar}
        puedeCalificar={true}
        avisarSinPermiso={vi.fn()}
      />
    );

    const botonGuardar = screen.getByRole('button', { name: /Guardar calificación/i });
    expect(screen.getByText(/No hay respuestas cargadas\. Se guardará 0\.00 \/ 5\.00/i)).toBeInTheDocument();
    expect(botonGuardar).toBeDisabled();
    expect(botonGuardar).toHaveAttribute('aria-describedby', 'calificacion-sin-respuestas-ayuda');

    const confirmacion = screen.getByRole('checkbox', { name: /Confirmo guardar la calificación calculada sin respuestas/i });
    fireEvent.click(confirmacion);
    expect(botonGuardar).toBeEnabled();
    const bono = screen.getByRole('checkbox', { name: /Bono por guía de estudio/i });
    fireEvent.click(bono);
    expect(screen.getByText(/No hay respuestas cargadas\. Se guardará 0\.25 \/ 5\.00/i)).toBeInTheDocument();
    expect(confirmacion).not.toBeChecked();
    expect(botonGuardar).toBeDisabled();
    fireEvent.click(confirmacion);
    expect(botonGuardar).toBeEnabled();
    fireEvent.click(botonGuardar);

    await waitFor(() => expect(mockCalificar).toHaveBeenCalledWith(expect.objectContaining({
      examenGeneradoId: 'ex-manual-vacio',
      alumnoId: 'alu-manual-vacio',
      aciertos: 0,
      totalReactivos: 2,
      bonoSolicitado: 0.25
    })));
    const payload = mockCalificar.mock.calls[0]?.[0];
    expect(payload).not.toHaveProperty('respuestasDetectadas');
    expect(payload?.omrAnalisis).toBeUndefined();
  });

  it('explica y asocia el permiso faltante al botón de calificación deshabilitado', () => {
    render(
      <SeccionCalificar
        examenId="ex-permiso"
        alumnoId="alu-permiso"
        resultadoOmr={omrResultadoMock}
        revisionOmrConfirmada={true}
        respuestasDetectadas={[{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }]}
        claveCorrectaPorNumero={{ 1: 'A' }}
        ordenPreguntasClave={[1]}
        onCalificar={vi.fn()}
        puedeCalificar={false}
        avisarSinPermiso={vi.fn()}
      />
    );

    const botonGuardar = screen.getByRole('button', { name: /Guardar calificación/i });
    const ayuda = screen.getByText('Tu perfil no tiene permiso para guardar esta calificación.');

    expect(botonGuardar).toBeDisabled();
    expect(botonGuardar).toHaveAttribute('aria-describedby', 'calificar-permiso-ayuda');
    expect(ayuda.closest('#calificar-permiso-ayuda')).toContainElement(ayuda);
    expect(ayuda.closest('[role="status"]')).toContainElement(ayuda);
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
    expect(screen.queryByRole('spinbutton', { name: /Aciertos obtenidos/i })).not.toBeInTheDocument();

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

    expect(screen.getByText('Calificación guardada')).toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('mantiene el error de calificación en contexto sin repetirlo en un toast', async () => {
    const mockCalificar = vi.fn().mockRejectedValue(new Error('No se pudo guardar la calificación por un error de red.'));

    render(
      <SeccionCalificar
        examenId="ex-error"
        alumnoId="alu-error"
        resultadoOmr={omrResultadoMock}
        revisionOmrConfirmada={true}
        respuestasDetectadas={[]}
        claveCorrectaPorNumero={{ 1: 'A' }}
        ordenPreguntasClave={[1]}
        onCalificar={mockCalificar}
        puedeCalificar={true}
        avisarSinPermiso={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Guardar calificación/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la calificación por un error de red.');
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('ofrece renovar la sesión con un toast complementario cuando la calificación falla por 401', async () => {
    const mockCalificar = vi.fn().mockRejectedValue(new ErrorRemoto('La sesión expiró.', { status: 401 }));

    render(
      <SeccionCalificar
        examenId="ex-session"
        alumnoId="alu-session"
        resultadoOmr={omrResultadoMock}
        revisionOmrConfirmada={true}
        respuestasDetectadas={[]}
        claveCorrectaPorNumero={{ 1: 'A' }}
        ordenPreguntasClave={[1]}
        onCalificar={mockCalificar}
        puedeCalificar={true}
        avisarSinPermiso={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Guardar calificación/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      title: 'Renueva tu sesión docente',
      message: 'El detalle está en «Revisión y calificación». Cierra sesión y vuelve a entrar para renovar el acceso.',
      action: expect.objectContaining({ label: 'Cerrar sesión' })
    }));
    const aviso = vi.mocked(emitToast).mock.calls[0]?.[0];
    expect(aviso?.message).not.toMatch(/sesión expiró|no se pudo calificar/i);
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
    expect(screen.getByText('Revisión y calificación')).toBeInTheDocument();
    expect(screen.getByText('Examen: Examen sin folio disponible')).toBeInTheDocument();
    expect(screen.getByText('Alumno: Alumno no disponible')).toBeInTheDocument();
    expect(screen.queryByText('ex-omr-review')).not.toBeInTheDocument();
    expect(screen.queryByText('alu-omr-review')).not.toBeInTheDocument();

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
    expect(screen.getByText('Si se requiere revisión OMR, confirma las respuestas detectadas antes de guardar.')).toBeInTheDocument();
    expect(screen.queryByText('requiere_revision')).not.toBeInTheDocument();
  });
});
