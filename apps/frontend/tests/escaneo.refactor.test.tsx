/**
 * escaneo.refactor.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QrAccesoMovil, SeccionEscaneo } from '../src/apps/app_docente/SeccionEscaneo';

describe('escaneo refactor comportamiento', () => {
  it('renderiza la mesa de escaneo con secciones principales', () => {
    render(
      <SeccionEscaneo
        alumnos={[]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ aciertos: 0, totalReactivos: 0 })}
        resultado={null}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        respuestasCombinadas={[]}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        revisionOmrConfirmada={false}
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo={null}
        paginaActiva={null}
        onSeleccionarRevision={() => {}}
        puedeAnalizar
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: /Escaneo y revisión OMR/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Captura individual/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Lote de imagenes/i })).toBeInTheDocument();
  });

  it('expone QR de acceso móvil', () => {
    expect(typeof QrAccesoMovil).toBe('function');
  });

  it('mantiene la revisión confirmada al cambiar entre páginas', async () => {
    const user = userEvent.setup();
    const onConfirmarRevisionOmr = vi.fn();
    const onSeleccionarRevision = vi.fn();

    render(
      <SeccionEscaneo
        alumnos={[]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ aciertos: 0, totalReactivos: 0 })}
        resultado={{
          estadoAnalisis: 'requiere_revision',
          calidadPagina: 0.95,
          confianzaPromedioPagina: 0.9,
          ratioAmbiguas: 0,
          templateVersionDetectada: 2,
          qrTexto: 'FOL-1:P1',
          respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }],
          advertencias: [],
          motivosRevision: []
        }}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        respuestasPaginaEditable={[{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }]}
        respuestasCombinadas={[{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }]}
        claveCorrectaPorNumero={{ 1: 'A' }}
        ordenPreguntasClave={[1]}
        revisionOmrConfirmada
        onConfirmarRevisionOmr={onConfirmarRevisionOmr}
        revisionesOmr={[
          {
            examenId: 'ex-1',
            folio: 'FOL-1',
            alumnoId: null,
            paginas: [
              {
                numeroPagina: 1,
                resultado: {
                  estadoAnalisis: 'requiere_revision',
                  calidadPagina: 0.95,
                  confianzaPromedioPagina: 0.9,
                  ratioAmbiguas: 0,
                  templateVersionDetectada: 2,
                  qrTexto: 'FOL-1:P1',
                  respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }],
                  advertencias: [],
                  motivosRevision: []
                },
                respuestas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }],
                imagenBase64: 'data:image/png;base64,AA==',
                actualizadoEn: Date.now()
              },
              {
                numeroPagina: 2,
                resultado: {
                  estadoAnalisis: 'requiere_revision',
                  calidadPagina: 0.95,
                  confianzaPromedioPagina: 0.9,
                  ratioAmbiguas: 0,
                  templateVersionDetectada: 2,
                  qrTexto: 'FOL-1:P2',
                  respuestasDetectadas: [{ numeroPregunta: 2, opcion: 'B', confianza: 0.9 }],
                  advertencias: [],
                  motivosRevision: []
                },
                respuestas: [{ numeroPregunta: 2, opcion: 'B', confianza: 0.9 }],
                actualizadoEn: Date.now()
              }
            ],
            claveCorrectaPorNumero: { 1: 'A', 2: 'B' },
            ordenPreguntas: [1, 2],
            revisionConfirmada: true,
            creadoEn: Date.now(),
            actualizadoEn: Date.now()
          }
        ]}
        examenIdActivo="ex-1"
        paginaActiva={1}
        onSeleccionarRevision={onSeleccionarRevision}
        puedeAnalizar
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    const imagen = screen.getByRole('img', { name: 'Examen ex-1 página 1' });
    await user.click(screen.getByRole('button', { name: 'Acercar imagen' }));
    expect(screen.getByText('125%')).toBeInTheDocument();
    expect(imagen).toHaveClass('omr-review-card__image--zoom-125');

    await user.click(screen.getByRole('button', { name: /Página siguiente/i }));

    expect(onSeleccionarRevision).toHaveBeenCalledWith('ex-1', 2);
    expect(onConfirmarRevisionOmr).not.toHaveBeenCalledWith(false);
  });

  it('mantiene confirmación al cambiar página con pills P1/P2', async () => {
    const user = userEvent.setup();
    const onConfirmarRevisionOmr = vi.fn();
    const onSeleccionarRevision = vi.fn();

    render(
      <SeccionEscaneo
        alumnos={[]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ aciertos: 0, totalReactivos: 0 })}
        resultado={{
          estadoAnalisis: 'requiere_revision',
          calidadPagina: 0.95,
          confianzaPromedioPagina: 0.9,
          ratioAmbiguas: 0,
          templateVersionDetectada: 2,
          qrTexto: 'FOL-1:P1',
          respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }],
          advertencias: [],
          motivosRevision: []
        }}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        respuestasPaginaEditable={[{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }]}
        respuestasCombinadas={[{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }]}
        claveCorrectaPorNumero={{ 1: 'A' }}
        ordenPreguntasClave={[1]}
        revisionOmrConfirmada
        onConfirmarRevisionOmr={onConfirmarRevisionOmr}
        revisionesOmr={[
          {
            examenId: 'ex-1',
            folio: 'FOL-1',
            alumnoId: null,
            paginas: [
              {
                numeroPagina: 1,
                resultado: {
                  estadoAnalisis: 'requiere_revision',
                  calidadPagina: 0.95,
                  confianzaPromedioPagina: 0.9,
                  ratioAmbiguas: 0,
                  templateVersionDetectada: 2,
                  qrTexto: 'FOL-1:P1',
                  respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }],
                  advertencias: [],
                  motivosRevision: []
                },
                respuestas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }],
                actualizadoEn: Date.now()
              },
              {
                numeroPagina: 2,
                resultado: {
                  estadoAnalisis: 'requiere_revision',
                  calidadPagina: 0.95,
                  confianzaPromedioPagina: 0.9,
                  ratioAmbiguas: 0,
                  templateVersionDetectada: 2,
                  qrTexto: 'FOL-1:P2',
                  respuestasDetectadas: [{ numeroPregunta: 2, opcion: 'B', confianza: 0.9 }],
                  advertencias: [],
                  motivosRevision: []
                },
                respuestas: [{ numeroPregunta: 2, opcion: 'B', confianza: 0.9 }],
                actualizadoEn: Date.now()
              }
            ],
            claveCorrectaPorNumero: { 1: 'A', 2: 'B' },
            ordenPreguntas: [1, 2],
            revisionConfirmada: true,
            creadoEn: Date.now(),
            actualizadoEn: Date.now()
          }
        ]}
        examenIdActivo="ex-1"
        paginaActiva={1}
        onSeleccionarRevision={onSeleccionarRevision}
        puedeAnalizar
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: 'P2' }));

    expect(onSeleccionarRevision).toHaveBeenCalledWith('ex-1', 2);
    expect(onConfirmarRevisionOmr).not.toHaveBeenCalledWith(false);
  });

  it('mantiene aciertos y calificación globales del examen al cambiar de página', () => {
    const propsBase = {
      alumnos: [],
      onAnalizar: async () => ({}),
      onPrevisualizar: async () => ({ aciertos: 0, totalReactivos: 0 }),
      resultado: {
        estadoAnalisis: 'requiere_revision' as const,
        calidadPagina: 0.95,
        confianzaPromedioPagina: 0.9,
        ratioAmbiguas: 0,
        templateVersionDetectada: 2 as const,
        qrTexto: 'FOL-1:P1',
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' as const, confianza: 0.9 }],
        advertencias: [],
        motivosRevision: []
      },
      onActualizar: () => {},
      onActualizarPregunta: () => {},
      respuestasCombinadas: [
        { numeroPregunta: 1, opcion: 'A' as const, confianza: 0.9 },
        { numeroPregunta: 2, opcion: 'B' as const, confianza: 0.9 }
      ],
      claveCorrectaPorNumero: { 1: 'A', 2: 'B' },
      ordenPreguntasClave: [1, 2],
      revisionOmrConfirmada: true,
      onConfirmarRevisionOmr: () => {},
      revisionesOmr: [
        {
          examenId: 'ex-1',
          folio: 'FOL-1',
          alumnoId: null,
          paginas: [
            {
              numeroPagina: 1,
              resultado: {
                estadoAnalisis: 'requiere_revision' as const,
                calidadPagina: 0.95,
                confianzaPromedioPagina: 0.9,
                ratioAmbiguas: 0,
                templateVersionDetectada: 2 as const,
                qrTexto: 'FOL-1:P1',
                respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' as const, confianza: 0.9 }],
                advertencias: [],
                motivosRevision: []
              },
              respuestas: [{ numeroPregunta: 1, opcion: null, confianza: 0.4 }],
              actualizadoEn: Date.now()
            },
            {
              numeroPagina: 2,
              resultado: {
                estadoAnalisis: 'requiere_revision' as const,
                calidadPagina: 0.95,
                confianzaPromedioPagina: 0.9,
                ratioAmbiguas: 0,
                templateVersionDetectada: 2 as const,
                qrTexto: 'FOL-1:P2',
                respuestasDetectadas: [{ numeroPregunta: 2, opcion: 'B' as const, confianza: 0.9 }],
                advertencias: [],
                motivosRevision: []
              },
              respuestas: [{ numeroPregunta: 2, opcion: null, confianza: 0.4 }],
              actualizadoEn: Date.now()
            }
          ],
          claveCorrectaPorNumero: { 1: 'A', 2: 'B' },
          ordenPreguntas: [1, 2],
          revisionConfirmada: true,
          creadoEn: Date.now(),
          actualizadoEn: Date.now()
        }
      ],
      examenIdActivo: 'ex-1',
      onSeleccionarRevision: () => {},
      puedeAnalizar: true,
      puedeCalificar: true,
      avisarSinPermiso: () => {}
    };

    const { rerender } = render(
      <SeccionEscaneo {...propsBase} paginaActiva={1} respuestasPaginaEditable={[{ numeroPregunta: 1, opcion: null, confianza: 0.4 }]} />
    );

    expect(screen.getByText(/Aciertos:\s*2\/2/i)).toBeInTheDocument();
    expect(screen.getByText(/Calificación final:\s*5\.00\s*\/\s*5\.00/i)).toBeInTheDocument();

    rerender(
      <SeccionEscaneo {...propsBase} paginaActiva={2} respuestasPaginaEditable={[{ numeroPregunta: 2, opcion: null, confianza: 0.4 }]} />
    );

    expect(screen.getByText(/Aciertos:\s*2\/2/i)).toBeInTheDocument();
    expect(screen.getByText(/Calificación final:\s*5\.00\s*\/\s*5\.00/i)).toBeInTheDocument();
  });

  it('permite modificar opciones OMR mediante atajos de teclado (A-E y Delete)', () => {
    const onActualizarPregunta = vi.fn();
    const onConfirmarRevisionOmr = vi.fn();

    render(
      <SeccionEscaneo
        alumnos={[]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ aciertos: 0, totalReactivos: 0 })}
        resultado={{
          estadoAnalisis: 'requiere_revision' as const,
          calidadPagina: 0.9,
          confianzaPromedioPagina: 0.85,
          ratioAmbiguas: 0,
          templateVersionDetectada: 2 as const,
          qrTexto: 'FOL-1:P1',
          respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' as const, confianza: 0.9 }],
          advertencias: [],
          motivosRevision: []
        }}
        onActualizar={() => {}}
        onActualizarPregunta={onActualizarPregunta}
        onConfirmarRevisionOmr={onConfirmarRevisionOmr}
        respuestasPaginaEditable={[{ numeroPregunta: 1, opcion: 'A' as const, confianza: 0.9 }]}
        claveCorrectaPorNumero={{ 1: 'A' }}
        ordenPreguntasClave={[1]}
        revisionesOmr={[]}
        puedeAnalizar
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    const select = screen.getByLabelText(/Respuesta alumno pregunta 1/i);

    // Change event
    fireEvent.change(select, { target: { value: 'C' } });
    expect(onActualizarPregunta).toHaveBeenCalledWith(1, 'C');

    // Presionar tecla 'B'
    fireEvent.keyDown(select, { key: 'b' });
    expect(onActualizarPregunta).toHaveBeenCalledWith(1, 'B');
    expect(onConfirmarRevisionOmr).toHaveBeenCalledWith(false);

    // Presionar tecla 'Delete'
    fireEvent.keyDown(select, { key: 'Delete' });
    expect(onActualizarPregunta).toHaveBeenCalledWith(1, null);
  });

  it('alinea alumno y clave, permite enfocar pendientes y controlar el zoom de la imagen', async () => {
    const user = userEvent.setup();

    render(
      <SeccionEscaneo
        alumnos={[]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ aciertos: 0, totalReactivos: 0 })}
        resultado={{
          estadoAnalisis: 'requiere_revision' as const,
          calidadPagina: 0.95,
          confianzaPromedioPagina: 0.9,
          ratioAmbiguas: 0,
          templateVersionDetectada: 2 as const,
          qrTexto: 'FOL-1:P1',
          respuestasDetectadas: [
            { numeroPregunta: 1, opcion: 'A' as const, confianza: 0.95 },
            { numeroPregunta: 2, opcion: 'B' as const, confianza: 0.95 }
          ],
          advertencias: [],
          motivosRevision: []
        }}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        respuestasPaginaEditable={[
          { numeroPregunta: 1, opcion: 'A' as const, confianza: 0.95 },
          { numeroPregunta: 2, opcion: 'B' as const, confianza: 0.95 }
        ]}
        respuestasCombinadas={[]}
        claveCorrectaPorNumero={{ 1: 'A' }}
        ordenPreguntasClave={[1, 2]}
        revisionOmrConfirmada={false}
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo={null}
        paginaActiva={1}
        onSeleccionarRevision={() => {}}
        puedeAnalizar
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Imagen del examen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Alumno vs. clave' })).toBeInTheDocument();
    expect(screen.getAllByText('Sin clave')).toHaveLength(2);
    expect(screen.getByText('Correcta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Acercar imagen' }));
    expect(screen.getByText('125%')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Mostrar solo pendientes' }));
    expect(screen.queryByLabelText('Respuesta alumno pregunta 1')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Respuesta alumno pregunta 2')).toBeInTheDocument();
  });

  it('renderiza advertencias del análisis y permite confirmar la revisión', () => {
    const onConfirmarRevisionOmr = vi.fn();

    render(
      <SeccionEscaneo
        alumnos={[]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ aciertos: 0, totalReactivos: 0 })}
        resultado={{
          estadoAnalisis: 'requiere_revision' as const,
          calidadPagina: 0.9,
          confianzaPromedioPagina: 0.85,
          ratioAmbiguas: 0,
          templateVersionDetectada: 2 as const,
          qrTexto: 'FOL-1:P1',
          respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' as const, confianza: 0.9 }],
          advertencias: ['Iluminación irregular detectada'],
          motivosRevision: ['Calidad baja']
        }}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        onConfirmarRevisionOmr={onConfirmarRevisionOmr}
        respuestasPaginaEditable={[{ numeroPregunta: 1, opcion: 'A' as const, confianza: 0.9 }]}
        claveCorrectaPorNumero={{ 1: 'A' }}
        ordenPreguntasClave={[1]}
        revisionesOmr={[]}
        puedeAnalizar
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByText('Iluminación irregular detectada')).toBeInTheDocument();
    expect(screen.queryByText('Experimental')).not.toBeInTheDocument();

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar revisión/i });
    fireEvent.click(btnConfirmar);
    expect(onConfirmarRevisionOmr).toHaveBeenCalledWith(true);
  });

  it('señala rescates experimentales y QR sin validar antes de guardar', () => {
    render(
      <SeccionEscaneo
        alumnos={[]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ aciertos: 0, totalReactivos: 0 })}
        resultado={{
          estadoAnalisis: 'requiere_revision' as const,
          calidadPagina: 0.9,
          confianzaPromedioPagina: 0.85,
          ratioAmbiguas: 0,
          templateVersionDetectada: 4 as const,
          qrTexto: 'FOL-1:P1',
          respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' as const, confianza: 0.9 }],
          advertencias: [
            'P1: rescate por búsqueda local acotada',
            'El QR no coincide con el examen esperado'
          ],
          motivosRevision: []
        }}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        onConfirmarRevisionOmr={() => {}}
        respuestasPaginaEditable={[{ numeroPregunta: 1, opcion: 'A' as const, confianza: 0.9 }]}
        claveCorrectaPorNumero={{ 1: 'A' }}
        ordenPreguntasClave={[1]}
        revisionesOmr={[]}
        puedeAnalizar
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    const etiquetaExperimental = screen.getByText('Experimental');
    expect(etiquetaExperimental).toHaveClass('omr-experimental-note__badge');
    expect(etiquetaExperimental.closest('[role="note"]')).toHaveClass('omr-experimental-note');
    expect(screen.getByText(/heurística de rescate OMR/)).toBeInTheDocument();
    expect(screen.getByText(/corrobora folio y página/)).toBeInTheDocument();
    expect(screen.getByText(/validación se limita al dataset disponible/)).toBeInTheDocument();
    expect(screen.getByText(/Compara las marcas con la imagen antes de confirmar/)).toBeInTheDocument();
  });
});


