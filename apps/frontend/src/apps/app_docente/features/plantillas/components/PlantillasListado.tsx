/**
 * PlantillasListado
 *
 * Responsabilidad: Catálogo panorámico Bento de plantillas existentes con previsualización OMR.
 */
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import type { Periodo, Plantilla, PreviewPlantilla } from '../../../tipos';
import { etiquetaMateria, idCortoMateria } from '../../../utilidades';

type PlantillaPreviewState = Record<string, PreviewPlantilla>;
type PlantillaPreviewPdfState = Record<string, { booklet?: string; omrSheet?: string }>;

export function PlantillasListado({
  totalPlantillasTodas,
  totalPlantillas,
  filtroPlantillas,
  setFiltroPlantillas,
  plantillasFiltradas,
  periodos,
  previewPorPlantillaId,
  plantillaPreviewId,
  previewPdfUrlPorPlantillaId,
  cargandoPreviewPlantillaId,
  cargarPreviewPlantilla,
  puedePrevisualizarPlantillas,
  cargandoPreviewPdfPlantillaId,
  cargarPreviewPdfPlantilla,
  cerrarPreviewPdfPlantilla,
  abrirPdfFullscreen,
  pdfFullscreenUrl,
  cerrarPdfFullscreen,
  togglePreviewPlantilla,
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
  previewPorPlantillaId: PlantillaPreviewState;
  plantillaPreviewId: string | null;
  previewPdfUrlPorPlantillaId: PlantillaPreviewPdfState;
  cargandoPreviewPlantillaId: string | null;
  cargarPreviewPlantilla: (plantillaId: string) => Promise<void>;
  puedePrevisualizarPlantillas: boolean;
  cargandoPreviewPdfPlantillaId: string | null;
  cargarPreviewPdfPlantilla: (plantillaId: string, kind?: 'booklet' | 'omrSheet') => Promise<void>;
  cerrarPreviewPdfPlantilla: (plantillaId: string, kind?: 'booklet' | 'omrSheet') => void;
  abrirPdfFullscreen: (url: string) => void;
  pdfFullscreenUrl: string | null;
  cerrarPdfFullscreen: () => void;
  togglePreviewPlantilla: (plantillaId: string) => Promise<void>;
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
            const preview = previewPorPlantillaId[plantilla._id];
            const previewAbierta = plantillaPreviewId === plantilla._id;
            const pdfUrls = previewPdfUrlPorPlantillaId[plantilla._id] ?? {};
            const pdfUrl = pdfUrls.booklet;
            return (
              <li key={plantilla._id} className="anim-slide-up">
                <div className="item-glass plantillas-item anim-card-hover">
                  <div className="item-row">
                    <div className="flex-1">
                      <div className="item-title">{plantilla.titulo}</div>
                      <div className="item-meta">
                        <span className="badge badge-meta">ID: {idCortoMateria(plantilla._id)}</span>
                        <span className="badge badge-meta">Tipo: {plantilla.tipo}</span>
                        <span className="badge badge-meta">Páginas: {Number((plantilla as unknown as { numeroPaginas?: unknown })?.numeroPaginas ?? 0) || '-'}</span>
                        <span className="badge badge-meta">Creada: {formatearFechaHora(plantilla.createdAt)}</span>
                        <span className="badge badge-materia">Materia: {materia ? etiquetaMateria(materia) : '-'}</span>
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
                      {previewAbierta && (
                        <div className="resultado plantillas-preview anim-fade-in">
                          <div className="plantillas-preview__hero">
                            <div>
                              <h4 className="plantillas-preview__titulo">Previsualización (boceto por página)</h4>
                              <p className="nota">Valida estructura, cobertura temática y salida PDF antes de generar exámenes reales.</p>
                            </div>
                            <div className="acciones">
                              <Boton
                                type="button"
                                variante="secundario"
                                onClick={() => void togglePreviewPlantilla(plantilla._id)}
                              >
                                Ocultar boceto
                              </Boton>
                            </div>
                          </div>

                          <div className="plantillas-preview__pdf-actions">
                            <Boton
                              type="button"
                              variante="primario"
                              tamano="sm"
                              cargando={cargandoPreviewPdfPlantillaId === plantilla._id}
                              onClick={() => void cargarPreviewPdfPlantilla(plantilla._id, 'booklet')}
                              data-tooltip="Renderiza el PDF real de cuadernillo con el motor del backend."
                            >
                              {pdfUrl ? 'Actualizar PDF cuadernillo' : 'Renderizar PDF cuadernillo'}
                            </Boton>
                            {pdfUrl && (
                              <>
                                <a
                                  href={pdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="boton boton--secundario boton--pequeno"
                                  data-tooltip="Abre el PDF en una pestaña del navegador."
                                >
                                  Abrir PDF en pestaña
                                </a>
                                <Boton
                                  type="button"
                                  variante="secundario"
                                  tamano="sm"
                                  onClick={() => abrirPdfFullscreen(pdfUrl)}
                                  data-tooltip="Abre el visor en pantalla completa dentro de la app."
                                >
                                  Pantalla completa
                                </Boton>
                                <Boton
                                  type="button"
                                  variante="secundario"
                                  tamano="sm"
                                  onClick={() => cerrarPreviewPdfPlantilla(plantilla._id, 'booklet')}
                                  data-tooltip="Cierra la vista previa PDF."
                                >
                                  Cerrar PDF
                                </Boton>
                              </>
                            )}
                          </div>

                          {pdfUrl && (
                            <div className="plantillas-preview__pdfWrap">
                              <iframe
                                src={pdfUrl}
                                title={`Previsualización PDF de ${plantilla.titulo}`}
                                className="plantillas-preview__iframe"
                              />
                            </div>
                          )}

                          {preview && Array.isArray(preview.paginas) && preview.paginas.length > 0 && (
                            <ul className="lista lista-items plantillas-preview__lista mt-10">
                              {preview.paginas.map((pagina) => (
                                <li key={pagina.numero} className="plantillas-preview__page">
                                  <div className="item-title">Página {pagina.numero}</div>
                                  <div className="item-meta">
                                    <span>Preguntas: {pagina.preguntas.length}</span>
                                    <span>Desde #{pagina.preguntasDel} hasta #{pagina.preguntasAl}</span>
                                  </div>
                                  <ul className="lista">
                                    {pagina.preguntas.map((pregunta, idx) => (
                                      <li key={`${pagina.numero}-${pregunta.id}-${idx}`}>
                                        <b>#{pregunta.numero}:</b> {pregunta.enunciadoCorto}
                                      </li>
                                    ))}
                                  </ul>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="plantillas-item__actions">
                      <Boton
                        type="button"
                        variante="secundario"
                        tamano="sm"
                        cargando={cargandoPreviewPlantillaId === plantilla._id}
                        disabled={!puedePrevisualizarPlantillas}
                        onClick={() => void cargarPreviewPlantilla(plantilla._id)}
                      >
                        {previewAbierta ? 'Actualizar boceto' : 'Previsualizar'}
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
            );
          })}
        </ul>
      )}

      {pdfFullscreenUrl && (
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
          <iframe className="pdf-overlay__frame" title="PDF (pantalla completa)" src={pdfFullscreenUrl} />
        </div>
      )}
    </section>
  );
}
