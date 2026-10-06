import { useState } from 'react';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';

const UMBRAL_AUTO_CONFIABLE_UI = 0.82;

type PreguntaRevisionVisual = {
  numeroPregunta: number;
  opcion: string | null;
  confianza: number;
  correcta: string | null;
  tieneClave: boolean;
  esDudosa: boolean;
  esCorrecta: boolean;
};

export function PanelRevisionVisualOmr({
  imagenRevisionBase64,
  paginaSeleccionada,
  imagenCaptura,
  examenId,
  numeroPagina,
  preguntas,
  totalPreguntas,
  soloPendientes,
  onActualizarPregunta,
  onConfirmarRevisionOmr
}: {
  imagenRevisionBase64?: string | null;
  paginaSeleccionada: boolean;
  imagenCaptura: string;
  examenId: string | null;
  numeroPagina: number | null;
  preguntas: PreguntaRevisionVisual[];
  totalPreguntas: number;
  soloPendientes: boolean;
  onActualizarPregunta: (numeroPregunta: number, opcion: string | null) => void;
  onConfirmarRevisionOmr: (confirmada: boolean) => void;
}) {
  const [zoomImagen, setZoomImagen] = useState(1);
  const claseZoomImagen = `omr-review-card__image--zoom-${Math.round(zoomImagen * 100)}`;

  return (
            <div className="omr-review-grid omr-review-grid--visual">
              <section className="item-glass omr-review-card omr-review-card--imagen" aria-labelledby="omr-imagen-title">
                <div className="omr-review-card__heading">
                  <div>
                    <span className="omr-review-card__eyebrow">Documento escaneado</span>
                    <h4 id="omr-imagen-title">Imagen del examen</h4>
                  </div>
                  <div className="omr-image-controls" role="group" aria-label="Controles de imagen">
                    <button type="button" className="omr-image-control" onClick={() => setZoomImagen((actual) => Math.max(0.75, Number((actual - 0.25).toFixed(2))))} aria-label="Alejar imagen" title="Alejar">
                      −
                    </button>
                    <output className="omr-image-zoom" aria-live="polite">{Math.round(zoomImagen * 100)}%</output>
                    <button type="button" className="omr-image-control" onClick={() => setZoomImagen((actual) => Math.min(2.5, Number((actual + 0.25).toFixed(2))))} aria-label="Acercar imagen" title="Acercar">
                      +
                    </button>
                    <button type="button" className="omr-image-reset" onClick={() => setZoomImagen(1)}>
                      Restablecer
                    </button>
                  </div>
                </div>
                <div className="omr-review-card__image-wrap omr-review-card__image-viewport">
                  {imagenRevisionBase64 ? (
                    <img
                      className={`preview omr-review-card__image omr-review-card__image--zoomable ${claseZoomImagen}`}
                      src={imagenRevisionBase64}
                      alt={`Examen ${examenId ?? ''} página ${numeroPagina ?? ''}`}
                    />
                  ) : imagenCaptura ? (
                    <img
                      className={`preview omr-review-card__image omr-review-card__image--zoomable ${claseZoomImagen}`}
                      src={imagenCaptura}
                      alt="Imagen cargada para análisis OMR"
                    />
                  ) : (
                    <InlineMensaje tipo="info">
                      {paginaSeleccionada ? 'No hay imagen archivada para esta página.'
                        : 'Selecciona una página de la revisión para ver su imagen.'}
                    </InlineMensaje>
                  )}
                </div>
                <p className="omr-review-card__hint">Usa el zoom para leer marcas o anotaciones sin perder la referencia del folio.</p>
              </section>
              <section className="item-glass omr-review-card omr-review-card--panel omr-review-card--comparador" aria-labelledby="omr-comparador-title">
                <div className="omr-review-card__heading">
                  <div>
                    <span className="omr-review-card__eyebrow">Clave oficial por pregunta</span>
                    <h4 id="omr-comparador-title">Alumno vs. clave</h4>
                  </div>
                  <span className="badge">{preguntas.length}/{totalPreguntas}</span>
                </div>
                {preguntas.length === 0 ? (
                  <InlineMensaje tipo="info">
                    {soloPendientes && totalPreguntas > 0 ? 'No hay pendientes en esta página.' : 'Aún no hay respuestas para revisar.'}
                  </InlineMensaje>
                ) : (
                  <div className="omr-answer-table" role="table" aria-label="Comparación de respuestas y clave">
                    <div className="omr-answer-table__head" role="row">
                      <span role="columnheader">Pregunta</span>
                      <span role="columnheader">Alumno</span>
                      <span role="columnheader">Clave</span>
                      <span role="columnheader">Estado</span>
                    </div>
                    <ol className="omr-respuesta-lista" role="rowgroup">
                      {preguntas.map((fila) => {
                        const confianzaPct = Math.round(fila.confianza * 100);
                        const claseConfianza = fila.confianza >= 0.75 ? 'ok' : fila.confianza >= 0.5 ? 'warning' : 'error';
                        const estado = !fila.tieneClave ? 'sin-clave' : fila.esCorrecta ? 'ok' : fila.opcion ? 'error' : 'warning';
                        const estadoTexto = !fila.tieneClave ? 'Sin clave' : fila.esCorrecta ? 'Correcta' : fila.opcion ? 'Incorrecta' : 'Sin respuesta';
                        return (
                          <li key={`det-${fila.numeroPregunta}`} className={`omr-answer-row omr-answer-row--${estado}${fila.esDudosa ? ' es-dudosa' : ''}`} role="row">
                            <div className="omr-answer-row__question" role="cell">
                              <strong>Pregunta {fila.numeroPregunta}</strong>
                              <span className={`badge ${claseConfianza}`}>{confianzaPct}% confianza</span>
                            </div>
                            <div className="omr-answer-row__choice" role="cell">
                              <span className="omr-answer-row__label">Detectada</span>
                              <select
                                aria-label={`Respuesta alumno pregunta ${fila.numeroPregunta}`}
                                value={fila.opcion ?? ''}
                                onChange={(event) => {
                                  onActualizarPregunta(fila.numeroPregunta, event.target.value || null);
                                  onConfirmarRevisionOmr(false);
                                }}
                                onKeyDown={(event) => {
                                  const key = event.key.toUpperCase();
                                  if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
                                    event.preventDefault();
                                    onActualizarPregunta(fila.numeroPregunta, key);
                                    onConfirmarRevisionOmr(false);
                                  } else if (key === 'DELETE' || key === 'BACKSPACE' || key === '0' || key === '-') {
                                    event.preventDefault();
                                    onActualizarPregunta(fila.numeroPregunta, null);
                                    onConfirmarRevisionOmr(false);
                                  }
                                }}
                              >
                                <option value="">Sin respuesta</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                                <option value="E">E</option>
                              </select>
                            </div>
                            <div className="omr-answer-row__choice omr-answer-row__key" role="cell">
                              <span className="omr-answer-row__label">Clave oficial</span>
                              <strong>{fila.correcta ?? 'Sin clave'}</strong>
                            </div>
                            <div className="omr-answer-row__status" role="cell">
                              <span className={`badge ${estado}`}>{estadoTexto}</span>
                              <span className="omr-answer-row__auto">
                                {fila.opcion ? (fila.confianza >= UMBRAL_AUTO_CONFIABLE_UI ? 'Lectura alta' : 'Revisar lectura') : 'Captura vacía'}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </section>
            </div>
  );
}
