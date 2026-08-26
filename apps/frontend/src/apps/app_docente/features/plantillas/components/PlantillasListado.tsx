/**
 * PlantillasListado
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../../../../ui/ux/componentes/InlineMensaje';
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
    <div className="subpanel plantillas-panel plantillas-panel--lista anim-fade-in">
      <div className="banco-section-title">
        <div className="banco-section-title__wrap">
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

      <div className="plantillas-filtro">
        <label className="campo plantillas-filtro__campo">
          Buscar
          <input
            value={filtroPlantillas}
            onChange={(e) => setFiltroPlantillas(e.target.value)}
            placeholder="Titulo, tema o ID…"
            data-tooltip="Filtra por titulo, tema o ID."
          />
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
              : 'Crea tu primera plantilla a la izquierda para definir materias, temas y generar exámenes con hoja OMR.'}
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
              <li key={plantilla._id}>
                <div className="item-glass plantillas-item">
                  <div className="item-row">
                    <div>
                      <div className="item-title">{plantilla.titulo}</div>
                      <div className="item-meta">
                        <span>ID: {idCortoMateria(plantilla._id)}</span>
                        <span>Tipo: {plantilla.tipo}</span>
                        <span>Paginas: {Number((plantilla as unknown as { numeroPaginas?: unknown })?.numeroPaginas ?? 0) || '-'}</span>
                        <span>Creada: {formatearFechaHora(plantilla.createdAt)}</span>
                        <span>Materia: {materia ? etiquetaMateria(materia) : '-'}</span>
                      </div>
                      <div className="item-sub plantillas-item__sub">{modo}</div>
                      {temas.length > 0 && (
                        <div className="plantillas-item__temas">
                          {temas.map((tema) => (
                            <span key={`${plantilla._id}-${tema}`} className="badge plantillas-item__tema-badge">
                              {tema}
                            </span>
                          ))}
                        </div>
                      )}
                      {previewAbierta && (
                        <div className="resultado plantillas-preview">
                          <div className="plantillas-preview__hero">
                            <div>
                              <h4 className="plantillas-preview__titulo">Previsualizacion (boceto por pagina)</h4>
                              <p className="nota">Valida estructura, cobertura temática y salida PDF antes de generar exámenes reales.</p>
                            </div>
                          </div>
                          {!preview && (
                            <div className="ayuda">
                              Esta previsualizacion usa una seleccion determinista de preguntas (para que no cambie cada vez) y bosqueja el
                              contenido por pagina.
                            </div>
                          )}
                          {!preview && (
                            <Boton
                              type="button"
                              variante="secundario"
                              cargando={cargandoPreviewPlantillaId === plantilla._id}
                              onClick={() => void cargarPreviewPlantilla(plantilla._id)}
                              disabled={!puedePrevisualizarPlantillas}
                              data-tooltip="Genera el boceto de preguntas por pagina."
                            >
                              {cargandoPreviewPlantillaId === plantilla._id ? 'Generando…' : 'Generar previsualizacion'}
                            </Boton>
                          )}
                          {preview && (
                            <>
                              {Array.isArray(preview.advertencias) && preview.advertencias.length > 0 && (
                                <InlineMensaje tipo="info">{preview.advertencias.join(' ')}</InlineMensaje>
                              )}
                              {Array.isArray(preview.conteoPorTema) && preview.conteoPorTema.length > 0 && (
                                <div className="resultado plantillas-preview__bloque">
                                  <h4 className="plantillas-preview__subtitulo">Disponibles por tema</h4>
                                  <ul className="lista">
                                    {preview.conteoPorTema.map((t) => (
                                      <li key={t.tema}>
                                        <b>{t.tema}:</b> {t.disponibles}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {Array.isArray(preview.temasDisponiblesEnMateria) && preview.temasDisponiblesEnMateria.length > 0 && (
                                <div className="resultado plantillas-preview__bloque">
                                  <h4 className="plantillas-preview__subtitulo">Temas con preguntas en la materia (top)</h4>
                                  <div className="ayuda">Sirve para detectar temas mal escritos o con 0 reactivos.</div>
                                  <ul className="lista">
                                    {preview.temasDisponiblesEnMateria.map((t) => (
                                      <li key={`${t.tema}-${t.disponibles}`}>
                                        <b>{t.tema}:</b> {t.disponibles}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <div className="acciones acciones--mt">
                                {!pdfUrl ? (
                                  <Boton
                                    type="button"
                                    variante="secundario"
                                    cargando={cargandoPreviewPdfPlantillaId === plantilla._id}
                                    onClick={() => void cargarPreviewPdfPlantilla(plantilla._id)}
                                    disabled={!puedePrevisualizarPlantillas}
                                    data-tooltip="Genera el PDF final para revisarlo."
                                  >
                                    {cargandoPreviewPdfPlantillaId === plantilla._id ? 'Generando PDF…' : 'Ver PDF exacto'}
                                  </Boton>
                                ) : (
                                  <>
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={() => cerrarPreviewPdfPlantilla(plantilla._id)}
                                      data-tooltip="Oculta el PDF incrustado."
                                    >
                                      Ocultar PDF
                                    </Boton>
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={() => abrirPdfFullscreen(pdfUrl)}
                                      data-tooltip="Abre el PDF en pantalla completa."
                                    >
                                      Ver grande
                                    </Boton>
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={() => {
                                        const u = String(pdfUrl || '').trim();
                                        if (!u) return;
                                        window.open(u, '_blank', 'noopener,noreferrer');
                                      }}
                                      data-tooltip="Abre el PDF en una pestaña nueva."
                                    >
                                      Abrir en pestaña
                                    </Boton>
                                  </>
                                )}
                              </div>
                              {pdfUrl && (
                                <div className="plantillas-preview__pdfWrap">
                                  <iframe className="plantillas-preview__pdf" title="Previsualizacion PDF" src={pdfUrl} />
                                </div>
                              )}
                              {pdfFullscreenUrl && (
                                <div className="pdf-overlay" role="dialog" aria-modal="true">
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
                              <ul className="lista lista-items plantillas-preview__lista">
                                {(preview.paginas ?? []).map((pagina) => (
                                  <li key={pagina.numero} className="plantillas-preview__page">
                                    <div className="item-title">Pagina {pagina.numero}</div>
                                    <div className="item-meta">
                                      <span>Preguntas: {pagina.preguntas.length}</span>
                                    </div>
                                    <div className="ayuda">
                                      Desde #{pagina.preguntasDel} hasta #{pagina.preguntasAl}
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
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="acciones">
                      <Boton
                        type="button"
                        variante="secundario"
                        onClick={() => void togglePreviewPlantilla(plantilla._id)}
                        data-tooltip={previewAbierta ? 'Cierra la previsualizacion de la plantilla.' : 'Abre la previsualizacion de la plantilla.'}
                      >
                        {previewAbierta ? 'Cerrar preview' : 'Previsualizar'}
                      </Boton>
                      <Boton
                        type="button"
                        variante="secundario"
                        onClick={() => iniciarEdicion(plantilla)}
                        disabled={!puedeGestionarPlantillas}
                        data-tooltip="Carga los datos de la plantilla en el formulario para editarlos."
                      >
                        Editar
                      </Boton>
                      <Boton
                        type="button"
                        variante="secundario"
                        className="boton--peligro"
                        cargando={archivandoPlantillaId === plantilla._id}
                        disabled={!puedeArchivarPlantillas}
                        onClick={() => void archivarPlantilla(plantilla)}
                        data-tooltip="Archiva la plantilla para que no aparezca en la lista activa."
                      >
                        Archivar
                      </Boton>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
