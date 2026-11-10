/**
 * PlantillasHistorialLotes
 *
 * Responsabilidad: Mesa de custodia y descarga de paquetes de exámenes generados.
 */
import { Spinner } from '../../../../../ui/iconos';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import type { Alumno } from '../../../tipos';
import { OMR_CANONICAL_DISPLAY_LABEL } from '../../../../../ui/version/versionInfo';
import { ArrowRight, Download, FileText, Package, RefreshCw, Trash2, IconoLucide } from '../../../../../ui/iconosCatalogo';
import { describirLoteVisible } from '../historialLotes';

type ExamenGeneradoResumen = {
  _id: string;
  folio: string;
  loteId?: string;
  plantillaId: string;
  alumnoId?: string | null;
  tipoExamen?: string | null;
  estado?: string;
  generadoEn?: string;
  descargadoEn?: string;
  paginas?: Array<{ numero: number; qrTexto?: string; preguntasDel?: number; preguntasAl?: number }>;
};

type LoteArchivadoResumen = {
  loteId: string;
  plantillaId: string;
  totalExamenes: number;
  totalPaginas: number;
  archivado: true;
  archivadoEn: string;
};

export function PlantillasHistorialLotes({
  cargandoExamenesGenerados,
  errorExamenesGenerados = '',
  errorLotesArchivados = '',
  onReintentarCarga,
  examenesGenerados,
  alumnosPorId,
  formatearFechaHora,
  puedeRegenerarExamenes,
  descargandoExamenId,
  archivandoExamenId,
  regenerarPdfExamen,
  puedeDescargarExamenes,
  descargarPdfExamen,
  eliminarExamenGenerado,
  regenerandoExamenId,
  puedeArchivarExamenes,
  descargandoLoteId,
  regenerandoLoteId,
  eliminandoLoteId,
  onDescargarPaquete,
  onDescargarZipPaquete,
  onRegenerarPaquete,
  onEliminarPaquete,
  lotesArchivados,
  cantidadLotesOmrArchivados,
  cargandoLotesArchivados,
  hayMasLotesArchivados,
  onCargarMasLotesArchivados,
  restaurandoLoteId,
  onRestaurarPaquete
}: {
  cargandoExamenesGenerados: boolean;
  errorExamenesGenerados?: string;
  errorLotesArchivados?: string;
  onReintentarCarga?: () => void;
  examenesGenerados: ExamenGeneradoResumen[];
  alumnosPorId: Map<string, Alumno>;
  formatearFechaHora: (value?: string) => string;
  puedeRegenerarExamenes: boolean;
  descargandoExamenId: string | null;
  archivandoExamenId: string | null;
  regenerarPdfExamen: (examen: ExamenGeneradoResumen) => Promise<void>;
  puedeDescargarExamenes: boolean;
  descargarPdfExamen: (examen: ExamenGeneradoResumen) => Promise<void>;
  eliminarExamenGenerado: (examen: ExamenGeneradoResumen) => Promise<void>;
  regenerandoExamenId: string | null;
  puedeArchivarExamenes: boolean;
  descargandoLoteId: string | null;
  regenerandoLoteId: string | null;
  eliminandoLoteId: string | null;
  onDescargarPaquete: (loteId: string) => Promise<void>;
  onDescargarZipPaquete: (loteId: string) => Promise<void>;
  onRegenerarPaquete: (loteId: string) => Promise<void>;
  onEliminarPaquete: (loteId: string, items: ExamenGeneradoResumen[]) => Promise<void>;
  lotesArchivados: LoteArchivadoResumen[];
  cantidadLotesOmrArchivados: number;
  cargandoLotesArchivados: boolean;
  hayMasLotesArchivados: boolean;
  onCargarMasLotesArchivados: () => Promise<void>;
  restaurandoLoteId: string | null;
  onRestaurarPaquete: (loteId: string, descripcion?: string) => Promise<void>;
}) {
  const listaExamenesGenerados = Array.isArray(examenesGenerados) ? examenesGenerados : [];
  const listaLotesArchivados = Array.isArray(lotesArchivados) ? lotesArchivados : [];
  const examenesPorLote = new Map<string, ExamenGeneradoResumen[]>();
  const examenesIndividuales: ExamenGeneradoResumen[] = [];

  for (const ex of listaExamenesGenerados) {
    const loteId = String(ex.loteId || '').trim();
    if (loteId) {
      const lote = examenesPorLote.get(loteId) || [];
      lote.push(ex);
      examenesPorLote.set(loteId, lote);
    } else {
      examenesIndividuales.push(ex);
    }
  }

  const paquetes = Array.from(examenesPorLote.entries()).map(([loteId, items]) => {
    const fechas = items
      .map((i) => i.generadoEn)
      .filter(Boolean)
      .map((f) => new Date(String(f)).getTime())
      .filter((n) => Number.isFinite(n));
    const fechaMasReciente = fechas.length > 0 ? new Date(Math.max(...fechas)).toISOString() : undefined;
    const descargados = items.filter((i) => Boolean(i.descargadoEn)).length;
    return {
      loteId,
      items,
      total: items.length,
      descargados,
      generadoEn: fechaMasReciente
    };
  });

  return (
    <section className="alumnos-explorador anim-fade-in plantillas-catalogo--panoramico" aria-label="Custodia de exámenes generados">
      <div className="alumnos-explorador__header">
        <div className="alumnos-explorador__title-box">
          <span className="banco-section-pill">
            <span className="banco-section-pill__dot" aria-hidden="true" />
            <span>Custodia y Descargas</span>
          </span>
          <h3>Exámenes generados</h3>
          <p className="nota">Consulta el historial y descarga paquetes completos en PDF o folios individuales. Se muestran hasta 50 exámenes recientes; las acciones de paquete aplican al lote completo.</p>
        </div>
        <div className="plantillas-panel__meta">
          <span className="version-env-badge" title="Contrato único de generación y lectura OMR activo">
            {OMR_CANONICAL_DISPLAY_LABEL}
          </span>
          <span className="banco-tag-preguntas">Paquetes: {paquetes.length}</span>
          <span className="banco-tag-paginas">Individuales: {examenesIndividuales.length}</span>
        </div>
      </div>

      {errorExamenesGenerados && (
        <div className="mensaje error mt-15" role="alert">
          <p>{errorExamenesGenerados}</p>
          {onReintentarCarga && (
            <Boton type="button" variante="secundario" tamano="sm" disabled={cargandoExamenesGenerados} cargando={cargandoExamenesGenerados} onClick={onReintentarCarga}>
              Reintentar historial de exámenes generados
            </Boton>
          )}
        </div>
      )}

      {cargandoExamenesGenerados ? (
        <div className="ayuda anim-fade-in" role="status">
          <Spinner /> Cargando historial de exámenes generados…
        </div>
      ) : !errorExamenesGenerados && !errorLotesArchivados && paquetes.length === 0 && examenesIndividuales.length === 0 && listaLotesArchivados.length === 0 && cantidadLotesOmrArchivados === 0 ? (
        <div className="empty-state-card anim-fade-in">
          <div className="empty-state-card__icon anim-icon-pulse" aria-hidden="true">
            <IconoLucide icon={Package} size={26} />
          </div>
          <h4>No hay exámenes generados aún</h4>
          <p>Ve a la pestaña “Generar Paquete PDF/OMR” para producir tu primer paquete de exámenes para el grupo.</p>
          <div className="empty-state-steps">
            <div className="empty-step">
              <span className="empty-step__num">1</span> Selecciona la plantilla
            </div>
            <span className="empty-step__arrow" aria-hidden="true"><IconoLucide icon={ArrowRight} size={16} /></span>
            <div className="empty-step">
              <span className="empty-step__num">2</span> Elige el modo por lote
            </div>
            <span className="empty-step__arrow" aria-hidden="true"><IconoLucide icon={ArrowRight} size={16} /></span>
            <div className="empty-step">
              <span className="empty-step__num">3</span> Descarga el paquete PDF / ZIP
            </div>
          </div>
        </div>
      ) : !errorExamenesGenerados && !errorLotesArchivados && paquetes.length === 0 && examenesIndividuales.length === 0 && listaLotesArchivados.length === 0 ? (
        <div className="empty-state-card anim-fade-in">
          <div className="empty-state-card__icon" aria-hidden="true"><IconoLucide icon={Package} size={26} /></div>
          <h4>No hay paquetes activos</h4>
          <p>Hay {cantidadLotesOmrArchivados} lotes activos o archivados disponibles para cotejo OMR. La consulta conserva el estado del lote.</p>
        </div>
      ) : (
        <div className="plantillas-historial-wrap">
          {paquetes.length > 0 && (
            <div className="mb-20">
              <h4 className="mb-10">Paquetes visibles ({paquetes.length})</h4>
              <p className="nota">Los paquetes permanecen activos hasta que termine la materia o todas las calificaciones del lote queden registradas y verificadas.</p>
              <ul className="lista lista-items plantillas-lista">
                {paquetes.map((p) => {
                  const referenciaPaquete = describirLoteVisible(p.items);
                  return (
                  <li key={p.loteId} className="anim-slide-up">
                    <div className="item-glass plantillas-item anim-card-hover">
                      <div className="item-row">
                        <div className="flex-1">
                          <div className="item-title">Paquete de exámenes</div>
                          <div className="item-meta">{referenciaPaquete}</div>
                          <div className="item-meta">
                            <span className="badge badge-meta">Exámenes visibles: {p.total}</span>
                            <span
                              className="badge badge-meta"
                              title="Cuenta exámenes incluidos en PDF o ZIP respondidos por EvaluaPro; no confirma que el navegador guardó el archivo."
                            >
                              Descarga registrada en folios visibles: {p.descargados}/{p.total}
                            </span>
                            <span className="badge badge-meta">Generado: {formatearFechaHora(p.generadoEn)}</span>
                          </div>
                        </div>
                        <div className="plantillas-item__actions">
                          <Boton type="button" variante="primario" tamano="sm" aria-label={`Descargar ZIP de exámenes individuales, ${referenciaPaquete}`} cargando={descargandoLoteId === `${p.loteId}:zip`} disabled={!puedeDescargarExamenes || Boolean(descargandoLoteId && descargandoLoteId !== `${p.loteId}:zip`)} onClick={() => void onDescargarZipPaquete(p.loteId)}>
                            <><IconoLucide icon={Package} size={15} /> Descargar ZIP de individuales</>
                          </Boton>
                          <Boton type="button" variante="secundario" tamano="sm" aria-label={`Descargar PDF consolidado, ${referenciaPaquete}`} cargando={descargandoLoteId === `${p.loteId}:pdf`} disabled={!puedeDescargarExamenes || Boolean(descargandoLoteId && descargandoLoteId !== `${p.loteId}:pdf`)} onClick={() => void onDescargarPaquete(p.loteId)}>
                            <><IconoLucide icon={FileText} size={15} /> Descargar PDF consolidado</>
                          </Boton>
                          <Boton
                            type="button"
                            variante="secundario"
                            tamano="sm"
                            aria-label={`Regenerar todos los exámenes, ${referenciaPaquete}`}
                            cargando={regenerandoLoteId === p.loteId}
                            disabled={!puedeRegenerarExamenes}
                            onClick={() => void onRegenerarPaquete(p.loteId)}
                          >
                            <><IconoLucide icon={RefreshCw} size={15} /> Regenerar</>
                          </Boton>
                          <Boton
                            type="button"
                            variante="secundario"
                            tamano="sm"
                            aria-label={`Archivar paquete completo tras cierre de materia o verificación de calificaciones, ${referenciaPaquete}`}
                            cargando={eliminandoLoteId === p.loteId}
                            disabled={!puedeArchivarExamenes}
                            onClick={() => void onEliminarPaquete(p.loteId, p.items)}
                          >
                            <><IconoLucide icon={Trash2} size={15} /> Archivar</>
                          </Boton>
                        </div>
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ul>
            </div>
          )}

          {examenesIndividuales.length > 0 && (
            <div>
              <h4 className="mb-10">Exámenes individuales ({examenesIndividuales.length})</h4>
              <ul className="lista lista-items plantillas-lista">
                {examenesIndividuales.map((ex) => {
                  const alumno = ex.alumnoId ? alumnosPorId.get(ex.alumnoId) : null;
                  return (
                    <li key={ex._id} className="anim-slide-up">
                      <div className="item-glass plantillas-item anim-card-hover">
                        <div className="item-row">
                          <div className="flex-1">
                            <div className="item-title">Folio: {ex.folio}</div>
                            <div className="item-meta">
                              <span className="badge badge-meta">Alumno: {alumno ? `${alumno.nombres} ${alumno.apellidos}` : ex.alumnoId ? 'Alumno no disponible' : 'Muestra individual'}</span>
                              {ex.tipoExamen === 'extraordinario' && <span className="badge badge-meta">Tipo: Extraordinario</span>}
                              <span className="badge badge-meta">Generado: {formatearFechaHora(ex.generadoEn)}</span>
                            </div>
                          </div>
                          <div className="plantillas-item__actions">
                            <Boton
                              type="button"
                              variante="secundario"
                              tamano="sm"
                              aria-label={`Descargar PDF del folio ${ex.folio}`}
                              cargando={descargandoExamenId === ex._id}
                              disabled={!puedeDescargarExamenes}
                              onClick={() => void descargarPdfExamen(ex)}
                            >
                              <><IconoLucide icon={Download} size={15} /> PDF</>
                            </Boton>
                            <Boton
                              type="button"
                              variante="secundario"
                              tamano="sm"
                              aria-label={`Regenerar PDF del folio ${ex.folio}`}
                              cargando={regenerandoExamenId === ex._id}
                              disabled={!puedeRegenerarExamenes}
                              onClick={() => void regenerarPdfExamen(ex)}
                            >
                              <><IconoLucide icon={RefreshCw} size={15} /> Regenerar</>
                            </Boton>
                            <Boton
                              type="button"
                              variante="secundario"
                              tamano="sm"
                              aria-label={`Archivar folio ${ex.folio}`}
                              cargando={archivandoExamenId === ex._id}
                              disabled={!puedeArchivarExamenes}
                              onClick={() => void eliminarExamenGenerado(ex)}
                            >
                              <><IconoLucide icon={Trash2} size={15} /> Archivar</>
                            </Boton>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {(listaLotesArchivados.length > 0 || cargandoLotesArchivados || Boolean(errorLotesArchivados)) && (
            <div className="mt-20">
              <h4 className="mb-10">Paquetes archivados visibles ({listaLotesArchivados.length})</h4>
              {errorLotesArchivados && (
                <div className="mensaje error" role="alert">
                  <p>{errorLotesArchivados}</p>
                  {onReintentarCarga && (
                    <Boton type="button" variante="secundario" tamano="sm" disabled={cargandoLotesArchivados} cargando={cargandoLotesArchivados} onClick={onReintentarCarga}>
              Reintentar carga de paquetes archivados
                    </Boton>
                  )}
                </div>
              )}
              {cargandoLotesArchivados ? (
                <div className="ayuda" role="status"><Spinner /> Cargando paquetes archivados…</div>
              ) : (
                <ul className="lista lista-items plantillas-lista">
                  {listaLotesArchivados.map((lote) => (
                    <li key={lote.loteId} className="anim-slide-up">
                      <div className="item-glass plantillas-item anim-card-hover">
                        <div className="item-row">
                          <div className="flex-1">
                            <div className="item-title">Paquete archivado</div>
                            <div className="item-meta">
                              <span className="badge badge-meta">Exámenes: {lote.totalExamenes}</span>
                              <span className="badge badge-meta">Páginas: {lote.totalPaginas}</span>
                              <span className="badge badge-meta">Archivado: {formatearFechaHora(lote.archivadoEn)}</span>
                            </div>
                          </div>
                          <div className="plantillas-item__actions">
                            <Boton
                              type="button"
                              variante="secundario"
                              tamano="sm"
                              aria-label={`Restaurar paquete de ${lote.totalExamenes} exámenes`}
                              cargando={restaurandoLoteId === lote.loteId}
                              disabled={!puedeArchivarExamenes}
                              onClick={() => void onRestaurarPaquete(
                                lote.loteId,
                                `paquete archivado de ${lote.totalExamenes} ${lote.totalExamenes === 1 ? 'examen' : 'exámenes'} y ${lote.totalPaginas} ${lote.totalPaginas === 1 ? 'página' : 'páginas'}`
                              )}
                            >
                              Restaurar paquete
                            </Boton>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {hayMasLotesArchivados && (
                <div className="mt-10">
                  <Boton
                    type="button"
                    variante="secundario"
                    tamano="sm"
                    cargando={cargandoLotesArchivados}
                    disabled={cargandoLotesArchivados}
                    onClick={() => void onCargarMasLotesArchivados()}
                  >
                    Cargar más paquetes archivados
                  </Boton>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
