/**
 * PlantillasListado
 *
 * Responsabilidad: Catálogo panorámico Bento de plantillas existentes con previsualización OMR.
 */
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { emitToast } from '../../../../../ui/toast/toastBus';
import { Fragment, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Periodo, Plantilla } from '../../../tipos';
import { etiquetaMateria, idCortoMateria } from '../../../utilidades';
import { OMR_CANONICAL_DISPLAY_LABEL } from '../../../../../ui/version/versionInfo';
import {
  calcularEstimacionDensidadPlantilla,
  textoEstimacionDensidadPlantilla
} from '../hooks/estimadorDensidadPlantilla';
import type { PreviewPdfPage } from '../hooks/usePlantillasPreviewActions';

type PlantillaPreviewPdfState = Record<string, { booklet?: string; omrSheet?: string; bookletPages?: PreviewPdfPage[]; omrSheetPages?: PreviewPdfPage[] }>;

export function PlantillasListado({
  totalPlantillasTodas,
  totalPlantillas,
  filtroPlantillas,
  setFiltroPlantillas,
  plantillasFiltradas,
  periodos,
  plantillaEditandoId,
  editorInline,
  previewPdfUrlPorPlantillaId,
  puedePrevisualizarPlantillas,
  cargandoPreviewPdfPlantillaId,
  cargarPreviewPdfPlantilla,
  cerrarPreviewPdfPlantilla,
  abrirPdfFullscreen,
  pdfFullscreenUrl,
  pdfFullscreenPages = [],
  cerrarPdfFullscreen,
  iniciarEdicion,
  puedeGestionarPlantillas,
  archivandoPlantillaId,
  archivarPlantilla,
  puedeArchivarPlantillas,
  formatearFechaHora
}: {
  totalPlantillasTodas: number;
  totalPlantillas: number;
  filtroPlantillas: string;
  setFiltroPlantillas: (value: string) => void;
  plantillasFiltradas: Plantilla[];
  periodos: Periodo[];
  plantillaEditandoId?: string | null;
  editorInline?: ReactNode;
  previewPdfUrlPorPlantillaId: PlantillaPreviewPdfState;
  puedePrevisualizarPlantillas: boolean;
  cargandoPreviewPdfPlantillaId: string | null;
  cargarPreviewPdfPlantilla: (plantillaId: string, kind?: 'booklet' | 'omrSheet') => Promise<void>;
  cerrarPreviewPdfPlantilla: (plantillaId: string, kind?: 'booklet' | 'omrSheet') => void;
  abrirPdfFullscreen: (url: string, pages?: PreviewPdfPage[]) => void;
  pdfFullscreenUrl: string | null;
  pdfFullscreenPages?: PreviewPdfPage[];
  cerrarPdfFullscreen: () => void;
  iniciarEdicion: (plantilla: Plantilla) => void;
  puedeGestionarPlantillas: boolean;
  archivandoPlantillaId: string | null;
  archivarPlantilla: (plantilla: Plantilla) => Promise<void>;
  puedeArchivarPlantillas: boolean;
  formatearFechaHora: (valor?: string) => string;
}) {
  return (
    <section className="alumnos-explorador anim-fade-in plantillas-catalogo--panoramico" aria-label="Catálogo de Plantillas">
      <div className="alumnos-explorador__header">
        <div className="alumnos-explorador__title-box">
          <span className="banco-section-pill">
            <span className="banco-section-pill__dot" aria-hidden="true" />
            <span>Catálogo OMR</span>
          </span>
          <h3>Plantillas existentes</h3>
          <p className="nota">Revisa catálogo, temas, previsualizaciones y fechas sin salir del flujo editorial.</p>
        </div>
        <div className="plantillas-panel__meta">
          <span className="version-env-badge" title="Contrato único de generación y lectura OMR activo">
            {OMR_CANONICAL_DISPLAY_LABEL}
          </span>
          <span className="banco-tag-preguntas">Total: {totalPlantillasTodas}</span>
          <span className="banco-tag-paginas">Mostradas: {totalPlantillas}</span>
        </div>
      </div>

      <div className="alumnos-filtros alumnos-filtros--glass mb-15">
        <label className="campo campo--search flex-1">
          <span>Buscar</span>
          <div className="auth-input-box auth-input-box--search auth-input-box--animated">
            <input
              value={filtroPlantillas}
              onChange={(e) => setFiltroPlantillas(e.target.value)}
              placeholder="Titulo, tema o ID…"
              data-tooltip="Filtra por titulo, tema o ID."
            />
          </div>
        </label>
        <div className="plantillas-filtro__resultado">
          {filtroPlantillas.trim() ? `Filtro: "${filtroPlantillas.trim()}"` : 'Sin filtros aplicados'}
        </div>
      </div>

      {plantillasFiltradas.length === 0 ? (
        <div className="empty-state-card anim-fade-in">
          <div className="empty-state-card__icon anim-icon-pulse">
            🎓
          </div>
          <h4>Comienza configurando tu primera plantilla</h4>
          <p>
            {filtroPlantillas.trim()
              ? 'No hay plantillas que coincidan con la búsqueda. Intenta con otro término.'
              : 'Crea tu primera plantilla arriba para definir materias, temas y generar exámenes con hoja OMR.'}
          </p>
          <div className="empty-state-steps">
            <div className="empty-step">
              <span className="empty-step__num">1</span> Define título y materia
            </div>
            <span className="empty-step__arrow">→</span>
            <div className="empty-step">
              <span className="empty-step__num">2</span> Selecciona temas del banco
            </div>
            <span className="empty-step__arrow">→</span>
            <div className="empty-step">
              <span className="empty-step__num">3</span> Previsualiza y genera exámenes
            </div>
          </div>
        </div>
      ) : (
        <ul className="lista lista-items plantillas-lista">
          {plantillasFiltradas.map((plantilla) => {
            const materia = periodos.find((p) => p._id === plantilla.periodoId);
            const temas = Array.isArray(plantilla.temas) ? plantilla.temas : [];
            const modo = temas.length > 0 ? `Temas: ${temas.join(', ')}` : 'Modo preguntasIds';
            const pdfUrls = previewPdfUrlPorPlantillaId[plantilla._id] ?? {};
            const pdfUrl = pdfUrls.booklet;
            const pdfPages = pdfUrls.bookletPages ?? [];
            const totalReactivos = Number(
              plantilla.reactivosObjetivo
              ?? plantilla.preguntasIds?.length
              ?? 0
            );
            const estimacionDensidad = calcularEstimacionDensidadPlantilla({
              totalReactivos,
              paginasConfiguradas: Number(plantilla.numeroPaginas ?? plantilla.bookletConfig?.targetPages ?? 1),
              temasSeleccionados: temas.length,
              fontScale: plantilla.bookletConfig?.fontScale,
              lineSpacing: plantilla.bookletConfig?.lineSpacing
            });
            return (
              <Fragment key={plantilla._id}>
              <li className="anim-slide-up">
                <div className={`item-glass plantillas-item anim-card-hover ${pdfUrl ? 'plantillas-item--preview-abierto' : ''}`}>
                  <div className="item-row">
                    <div className="plantillas-item__content">
                      <div className="item-title">{plantilla.titulo}</div>
                      <div className="item-meta">
                        <span className="badge badge-meta">ID: {idCortoMateria(plantilla._id)}</span>
                        <span className="badge badge-meta">Tipo: {plantilla.tipo}</span>
                        <span className="badge badge-meta">Páginas: {Number((plantilla as unknown as { numeroPaginas?: unknown })?.numeroPaginas ?? 0) || '-'}</span>
                        <span className="badge badge-meta">Creada: {formatearFechaHora(plantilla.createdAt)}</span>
                        <span className="badge badge-materia">Materia: {materia ? etiquetaMateria(materia) : '-'}</span>
                        <span className="badge badge-densidad">{textoEstimacionDensidadPlantilla(estimacionDensidad)}</span>
                      </div>
                      <div className="item-sub plantillas-item__sub">{modo}</div>
                      {temas.length > 0 && (
                        <div className="plantillas-item__temas">
                          {temas.map((tema) => (
                            <span key={`${plantilla._id}-${tema}`} className="badge badge-tema-chip">
                              {tema}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {pdfUrl && (
                      <div className="resultado plantillas-preview anim-fade-in">
                        <div className="plantillas-preview__hero">
                          <div>
                            <span className="plantillas-preview__eyebrow">REVISIÓN DEL RESULTADO</span>
                            <h4 className="plantillas-preview__titulo">Vista previa PDF</h4>
                            <p className="nota">Revisa el PDF real generado por el motor antes de descargar o imprimir.</p>
                          </div>
                        </div>

                        <div className="plantillas-preview__pdf-actions">
                          <a href={pdfUrl} target="_blank" rel="noreferrer" className="boton boton--secundario boton--pequeno" onClick={() => emitToast({ level: 'info', title: 'Vista previa', message: 'Abriendo PDF en una pestaña nueva', durationMs: 1600 })}>
                            Abrir en pestaña
                          </a>
                          <Boton type="button" variante="secundario" tamano="sm" onClick={() => abrirPdfFullscreen(pdfUrl, pdfPages)}>
                            Pantalla completa
                          </Boton>
                          <Boton type="button" variante="secundario" tamano="sm" onClick={() => {
                            cerrarPreviewPdfPlantilla(plantilla._id, 'booklet');
                          }}>
                            Cerrar PDF
                          </Boton>
                        </div>

                        {pdfUrl && pdfPages.length > 0 && (
                          <div className="plantillas-preview__pdfWrap">
                            <div className="plantillas-preview__pages" aria-label={`Páginas renderizadas de ${plantilla.titulo}`}>
                              {pdfPages.map((pagina) => (
                                <figure key={pagina.numero} className="plantillas-preview__pdfPage">
                                  <img
                                    src={pagina.dataUrl}
                                    width={pagina.width}
                                    height={pagina.height}
                                    alt={`Página ${pagina.numero} de la previsualización del examen`}
                                    loading={pagina.numero === 1 ? 'eager' : 'lazy'}
                                  />
                                  <figcaption>Página {pagina.numero}</figcaption>
                                </figure>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                    <div className="plantillas-item__actions">
                      <Boton
                        type="button"
                        variante="secundario"
                        tamano="sm"
                        cargando={cargandoPreviewPdfPlantillaId === plantilla._id}
                        disabled={!puedePrevisualizarPlantillas}
                        onClick={() => {
                          void cargarPreviewPdfPlantilla(plantilla._id, 'booklet');
                        }}
                      >
                        {pdfUrl ? 'Actualizar PDF' : 'Previsualizar PDF'}
                      </Boton>
                      <Boton
                        type="button"
                        variante="secundario"
                        tamano="sm"
                        disabled={!puedeGestionarPlantillas}
                        onClick={() => iniciarEdicion(plantilla)}
                      >
                        Editar
                      </Boton>
                      <Boton
                        type="button"
                        variante="secundario"
                        tamano="sm"
                        cargando={archivandoPlantillaId === plantilla._id}
                        disabled={!puedeArchivarPlantillas}
                        onClick={() => void archivarPlantilla(plantilla)}
                      >
                        {archivandoPlantillaId === plantilla._id ? 'Archivando…' : 'Archivar'}
                      </Boton>
                    </div>
                  </div>
                </div>
              </li>
              {plantillaEditandoId === plantilla._id && editorInline && (
                <li className="plantillas-item-editor anim-fade-in" data-testid="plantillas-editor-inline">
                  {editorInline}
                </li>
              )}
              </Fragment>
            );
          })}
        </ul>
      )}

      {pdfFullscreenUrl && pdfFullscreenPages.length > 0 && typeof document !== 'undefined' && createPortal(
        <div className="pdf-overlay anim-fade-in" role="dialog" aria-modal="true">
          <div className="pdf-overlay__bar">
            <Boton
              type="button"
              variante="secundario"
              onClick={cerrarPdfFullscreen}
              data-tooltip="Cierra la vista de PDF a pantalla completa."
            >
              Cerrar
            </Boton>
          </div>
          <div className="pdf-overlay__pages" aria-label="Páginas de la previsualización a pantalla completa">
            {pdfFullscreenPages.map((pagina) => (
              <figure key={pagina.numero} className="pdf-overlay__page">
                <img
                  src={pagina.dataUrl}
                  width={pagina.width}
                  height={pagina.height}
                  alt={`Página ${pagina.numero} de la previsualización a pantalla completa`}
                />
                <figcaption>Página {pagina.numero}</figcaption>
              </figure>
            ))}
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
