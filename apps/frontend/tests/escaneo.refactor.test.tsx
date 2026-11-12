/**
 * escaneo.refactor.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QrAccesoMovil, SeccionEscaneo } from '../src/apps/app_docente/SeccionEscaneo';
import { evaluarCalidadCaptura } from '../src/apps/app_docente/QrAccesoMovil';

vi.mock('../src/apps/app_docente/QrAccesoMovil', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/apps/app_docente/QrAccesoMovil')>();
  return {
    ...original,
    evaluarCalidadCaptura: vi.fn().mockRejectedValue(new Error('No se evaluó calidad en esta prueba'))
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(evaluarCalidadCaptura).mockRejectedValue(new Error('No se evaluó calidad en esta prueba'));
});

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
    expect(screen.getByRole('heading', { name: /Lote de imágenes/i })).toBeInTheDocument();
    expect(screen.getByText('Archivo')).toBeInTheDocument();
    expect(screen.queryByText('Cámara / Archivo')).not.toBeInTheDocument();
    const analizarPagina = screen.getByRole('button', { name: 'Analizar página' });
    expect(analizarPagina).toBeDisabled();
    expect(analizarPagina).toHaveAccessibleDescription('Carga una imagen para habilitar el análisis.');
    expect(screen.getByText('Carga una imagen para habilitar el análisis.')).toBeVisible();
    const analizarLote = screen.getByRole('button', { name: 'Analizar lote (0)' });
    expect(analizarLote).toBeDisabled();
    expect(analizarLote).toHaveAccessibleDescription('Carga uno o más archivos para habilitar el análisis del lote.');
    expect(screen.getByText('Carga uno o más archivos para habilitar el análisis del lote.')).toBeVisible();
  });

  it('explica el permiso que falta y cómo solicitarlo para analizar OMR', () => {
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
        puedeAnalizar={false}
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    const descripcionPermiso = 'Tu perfil no tiene permiso para analizar exámenes. Pide a quien administra EvaluaPro que habilite el permiso de análisis OMR.';
    for (const nombre of ['Analizar página', 'Analizar lote (0)']) {
      const boton = screen.getByRole('button', { name: nombre });
      expect(boton).toBeDisabled();
      expect(boton).toHaveAccessibleDescription(descripcionPermiso);
    }
    expect(screen.getAllByText(descripcionPermiso)).toHaveLength(2);
  });

  it('explica el permiso de calificación faltante para habilitar el análisis por lote', () => {
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
        puedeCalificar={false}
        avisarSinPermiso={() => {}}
      />
    );

    const analizarLote = screen.getByRole('button', { name: 'Analizar lote (0)' });
    const descripcionPermiso = 'Tu perfil no tiene permiso para procesar calificaciones en lote. Pide a quien administra EvaluaPro que habilite el permiso de calificación.';
    expect(analizarLote).toBeDisabled();
    expect(analizarLote).toHaveAccessibleDescription(descripcionPermiso);
    expect(screen.getByText(descripcionPermiso)).toBeVisible();
  });

  it('limpia la captura anterior y comunica el error si no se puede cargar una nueva imagen', async () => {
    class LectorFallido {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('FileReader', LectorFallido);

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

    fireEvent.change(screen.getByLabelText(/Cargar imagen o foto del examen/i), {
      target: { files: [new File(['dummy'], 'captura.png', { type: 'image/png' })] }
    });

    expect(await screen.findByText(/No se pudo cargar o revisar la imagen/i)).toBeInTheDocument();
    expect(screen.getByText('Archivo seleccionado: captura.png')).toBeInTheDocument();
    expect(screen.getByText('Elegir otra imagen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analizar página' })).toBeDisabled();
  });

  it('mantiene en la cola el error de un archivo de lote que no se puede leer', async () => {
    class LectorFallido {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('FileReader', LectorFallido);

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

    fireEvent.change(screen.getByLabelText(/Cargar lote de imágenes escaneadas/i), {
      target: { files: [new File(['dummy'], 'captura.png', { type: 'image/png' })] }
    });

    expect(await screen.findByText(/No se pudo cargar el archivo/i)).toBeInTheDocument();
    expect(screen.getByText('1 de 1 archivos procesados')).toBeInTheDocument();
  });

  it('comunica el progreso mientras prepara un lote de imágenes', async () => {
    class LectorLentoFallido {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        window.setTimeout(() => this.onerror?.(), 120);
      }
    }
    vi.stubGlobal('FileReader', LectorLentoFallido);

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

    const selectorLote = screen.getByLabelText(/Cargar lote de imágenes escaneadas/i);
    fireEvent.change(selectorLote, {
      target: {
        files: [
          new File(['dummy'], 'captura-1.png', { type: 'image/png' }),
          new File(['dummy'], 'captura-2.png', { type: 'image/png' })
        ]
      }
    });

    expect(await screen.findByText('Preparando lote: 0 de 2 archivos.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Preparando lote: 0 de 2 archivos.' })).toHaveAttribute('max', '2');
    expect(selectorLote).toBeDisabled();
    expect(await screen.findByText('Preparando lote: 1 de 2 archivos.')).toBeInTheDocument();
    expect(await screen.findByText('Preparación terminada: 2 archivos procesados; revisa los estados del lote.')).toBeInTheDocument();
    expect(selectorLote).toBeEnabled();
  });

  it('explica el resultado del control de calidad sin mostrar métricas técnicas sin contexto', async () => {
    class ImagenPrueba {
      width = 100;
      height = 100;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_valor: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', ImagenPrueba);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.mocked(evaluarCalidadCaptura).mockResolvedValue({
      blurVar: 180,
      brilloMedio: 125,
      areaHojaRatio: 0.88,
      aprobada: true,
      motivos: []
    });

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

    fireEvent.change(screen.getByLabelText(/Cargar imagen o foto del examen/i), {
      target: { files: [new File(['dummy'], 'captura.png', { type: 'image/png' })] }
    });

    expect(await screen.findByText('La imagen está lista para analizar.')).toBeInTheDocument();
    expect(screen.queryByText(/nitidez 180|brillo 125/i)).not.toBeInTheDocument();
  });

  it('expone un nombre accesible para el progreso del lote', async () => {
    const imagenNativa = globalThis.Image;
    class ImagenPrueba {
      width = 100;
      height = 100;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_valor: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', ImagenPrueba);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    try {
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
          puedeCalificar={false}
          avisarSinPermiso={() => {}}
        />
      );
      fireEvent.change(screen.getByLabelText(/Cargar lote de imágenes escaneadas/i), {
        target: { files: [new File(['dummy'], 'hoja.png', { type: 'image/png' })] }
      });

      expect(await screen.findByRole('progressbar', { name: '0 de 1 archivos procesados' })).toBeInTheDocument();
      expect(screen.getByText('0 de 1 archivos procesados')).toHaveAttribute('role', 'status');
    } finally {
      vi.stubGlobal('Image', imagenNativa);
      vi.restoreAllMocks();
    }
  });

  it('expone QR de acceso móvil', () => {
    expect(typeof QrAccesoMovil).toBe('function');
  });

  it('presenta folio e identidad legible en la cola OMR sin exponer IDs internos', () => {
    const pagina = {
      numeroPagina: 1,
      resultado: {
        estadoAnalisis: 'requiere_revision' as const,
        calidadPagina: 0.95,
        confianzaPromedioPagina: 0.9,
        ratioAmbiguas: 0,
        templateVersionDetectada: 2 as const,
        qrTexto: 'FOL-42:P1',
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' as const, confianza: 0.9 }],
        advertencias: [],
        motivosRevision: []
      },
      respuestas: [{ numeroPregunta: 1, opcion: 'A' as const, confianza: 0.9 }],
      actualizadoEn: Date.now()
    };

    render(
      <SeccionEscaneo
        alumnos={[{
          _id: 'alumno-interno-1', periodoId: 'per-1', matricula: 'CUH123456789',
          nombres: 'Valeria', apellidos: 'García', nombreCompleto: 'Valeria García',
          correo: '', grupo: '2A'
        }]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ aciertos: 0, totalReactivos: 0 })}
        resultado={pagina.resultado}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        respuestasPaginaEditable={pagina.respuestas}
        respuestasCombinadas={pagina.respuestas}
        claveCorrectaPorNumero={{ 1: 'A' }}
        ordenPreguntasClave={[1]}
        revisionOmrConfirmada
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[
          {
            examenId: 'examen-interno-1', folio: 'FOL-42', alumnoId: 'alumno-interno-1',
            paginas: [pagina], claveCorrectaPorNumero: { 1: 'A' }, ordenPreguntas: [1],
            revisionConfirmada: true, actualizadoEn: Date.now(), creadoEn: Date.now()
          },
          {
            examenId: 'examen-interno-2', folio: 'FOL-43', alumnoId: 'alumno-no-cargado',
            paginas: [pagina], claveCorrectaPorNumero: { 1: 'A' }, ordenPreguntas: [1],
            revisionConfirmada: false, actualizadoEn: Date.now() - 1, creadoEn: Date.now() - 1
          }
        ]}
        examenIdActivo="examen-interno-1"
        paginaActiva={1}
        onSeleccionarRevision={() => {}}
        puedeAnalizar
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByText('FOL-42')).toBeInTheDocument();
    expect(screen.getByText('Valeria García · CUH123456789')).toBeInTheDocument();
    expect(screen.getByText('Alumno no disponible')).toBeInTheDocument();
    expect(screen.queryByText(/examen-interno|alumno-interno|alumno-no-cargado/)).not.toBeInTheDocument();
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
    expect(screen.getByRole('group', { name: 'Herramientas de revisión visual' })).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: 'Folio FOL-1, página 1, requiere revisión' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Folio FOL-1, página 2, requiere revisión' }));

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

  it('distingue una confianza histórica ausente de una lectura medida en 0%', () => {
    const { rerender } = render(
      <SeccionEscaneo
        alumnos={[]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ aciertos: 0, totalReactivos: 0 })}
        resultado={{
          estadoAnalisis: 'requiere_revision',
          calidadPagina: 1,
          confianzaPromedioPagina: 0,
          confianzaPromedioDisponible: false,
          ratioAmbiguas: 0,
          templateVersionDetectada: 4,
          respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'D', confianza: 0, confianzaDisponible: false }],
          advertencias: [],
          motivosRevision: []
        }}
        respuestasPaginaEditable={[{ numeroPregunta: 1, opcion: 'D', confianza: 0, confianzaDisponible: false }]}
        respuestasCombinadas={[{ numeroPregunta: 1, opcion: 'D', confianza: 0, confianzaDisponible: false }]}
        claveCorrectaPorNumero={{ 1: 'D' }}
        ordenPreguntasClave={[1]}
        revisionesOmr={[]}
        puedeAnalizar
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByText('Sin dato de confianza')).toBeInTheDocument();
    expect(screen.getByText('Verificar lectura: confianza no registrada')).toBeInTheDocument();
    expect(screen.getByText(/Confianza media examen Sin dato/i)).toBeInTheDocument();
    expect(screen.queryByText('0% confianza')).not.toBeInTheDocument();

    rerender(
      <SeccionEscaneo
        alumnos={[]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ aciertos: 0, totalReactivos: 0 })}
        resultado={{
          estadoAnalisis: 'requiere_revision',
          calidadPagina: 1,
          confianzaPromedioPagina: 0,
          confianzaPromedioDisponible: true,
          ratioAmbiguas: 0,
          templateVersionDetectada: 4,
          respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'D', confianza: 0 }],
          advertencias: [],
          motivosRevision: []
        }}
        respuestasPaginaEditable={[{ numeroPregunta: 1, opcion: 'D', confianza: 0 }]}
        respuestasCombinadas={[{ numeroPregunta: 1, opcion: 'D', confianza: 0 }]}
        claveCorrectaPorNumero={{ 1: 'D' }}
        ordenPreguntasClave={[1]}
        revisionesOmr={[]}
        puedeAnalizar
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByText('0% confianza')).toBeInTheDocument();
    expect(screen.getByText(/Confianza media examen 0%/i)).toBeInTheDocument();
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
        claveCorrectaPorNumero={{ 1: 'A', 2: 'A' }}
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
    expect(screen.queryAllByText('Sin clave')).toHaveLength(0);
    expect(screen.getByText('Correcta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Acercar imagen' }));
    expect(screen.getByText('125%')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Mostrar solo pendientes' }));
    expect(screen.queryByLabelText('Respuesta alumno pregunta 1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Respuesta alumno pregunta 2')).not.toBeInTheDocument();
    expect(screen.getByText('No hay pendientes en esta página.')).toBeInTheDocument();
  });

  it('muestra una marca múltiple como incorrecta automática, no como página pendiente', async () => {
    const user = userEvent.setup();
    render(
      <SeccionEscaneo
        alumnos={[]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ aciertos: 0, totalReactivos: 0 })}
        resultado={{
          estadoAnalisis: 'ok', calidadPagina: 0.95, confianzaPromedioPagina: 0.2,
          ratioAmbiguas: 1, templateVersionDetectada: 2,
          respuestasDetectadas: [{ numeroPregunta: 1, opcion: null, confianza: 0.2, estadoRespuesta: 'doble_marca' }],
          advertencias: [], motivosRevision: []
        }}
        respuestasPaginaEditable={[{ numeroPregunta: 1, opcion: null, confianza: 0.2, estadoRespuesta: 'doble_marca' }]}
        respuestasCombinadas={[]}
        claveCorrectaPorNumero={{ 1: 'B' }}
        ordenPreguntasClave={[1]}
        revisionOmrConfirmada
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo={null}
        paginaActiva={1}
        onSeleccionarRevision={() => {}}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        puedeAnalizar
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByText('Incorrecta: doble marca')).toBeInTheDocument();
    expect(screen.getByText('Incorrecta automáticamente')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Mostrar solo pendientes' }));
    expect(screen.getByText('No hay pendientes en esta página.')).toBeInTheDocument();
  });

  it('renderiza advertencias del análisis y permite confirmar la revisión', () => {
    const onConfirmarRevisionOmr = vi.fn();

    const { container } = render(
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
    const comparacionVisual = container.querySelector('.omr-review-grid--visual');
    expect(comparacionVisual).not.toBeNull();
    expect(Boolean(comparacionVisual!.compareDocumentPosition(btnConfirmar) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getAllByRole('button', { name: /Confirmar revisión/i })).toHaveLength(1);
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


