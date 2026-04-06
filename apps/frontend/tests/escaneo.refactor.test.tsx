/**
 * escaneo.refactor.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { render, screen } from '@testing-library/react';
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
});
