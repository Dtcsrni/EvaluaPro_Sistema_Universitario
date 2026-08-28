/**
 * PlantillasHistorialLotes
 *
 * Responsabilidad: Mesa de custodia y descarga de paquetes de exámenes generados.
 */
import { Spinner } from '../../../../../ui/iconos';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import type { Alumno } from '../../../tipos';
import { idCortoMateria } from '../../../utilidades';

type ExamenGeneradoResumen = {
  _id: string;
  folio: string;
  loteId?: string;
  plantillaId: string;
  alumnoId?: string | null;
  estado?: string;
  generadoEn?: string;
  descargadoEn?: string;
  paginas?: Array<{ numero: number; qrTexto?: string; preguntasDel?: number; preguntasAl?: number }>;
};

export function PlantillasHistorialLotes({
  cargandoExamenesGenerados,
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
  onRegenerarPaquete,
  onEliminarPaquete
}: {
  cargandoExamenesGenerados: boolean;
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
  onRegenerarPaquete: (loteId: string, items: ExamenGeneradoResumen[]) => Promise<void>;
  onEliminarPaquete: (loteId: string, items: ExamenGeneradoResumen[]) => Promise<void>;
}) {
  const listaExamenesGenerados = Array.isArray(examenesGenerados) ? examenesGenerados : [];
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
    <section className="alumnos-explorador anim-fade-in plantillas-catalogo--panoramico" aria-label="Custodia de Exámenes Generados">
      <div className="alumnos-explorador__header">
        <div className="alumnos-explorador__title-box">
          <span className="banco-section-pill">
            <span className="banco-section-pill__dot" aria-hidden="true" />
            <span>Custodia y Descargas</span>
          </span>
          <h3>Exámenes generados</h3>
          <p className="nota">Consulta historial, descarga paquetes completos en PDF o reimprime folios individuales.</p>
        </div>
        <div className="plantillas-panel__meta">
          <span className="banco-tag-preguntas">Paquetes: {paquetes.length}</span>
          <span className="banco-tag-paginas">Individuales: {examenesIndividuales.length}</span>
        </div>
      </div>

      {cargandoExamenesGenerados ? (
        <div className="ayuda anim-fade-in">
          <Spinner /> Cargando historial de exámenes generados…
        </div>
      ) : paquetes.length === 0 && examenesIndividuales.length === 0 ? (
        <div className="empty-state-card anim-fade-in">
          <div className="empty-state-card__icon anim-icon-pulse">
            📦
          </div>
          <h4>No hay exámenes generados aún</h4>
          <p>Ve a la pestaña “Generar Paquete PDF/OMR” para producir tu primer paquete de exámenes para el grupo.</p>
          <div className="empty-state-steps">
            <div className="empty-step">
              <span className="empty-step__num">1</span> Selecciona la plantilla
            </div>
            <span className="empty-step__arrow">→</span>
            <div className="empty-step">
              <span className="empty-step__num">2</span> Elige el modo por lote
            </div>
            <span className="empty-step__arrow">→</span>
            <div className="empty-step">
              <span className="empty-step__num">3</span> Descarga el paquete PDF / ZIP
            </div>
          </div>
        </div>
      ) : (
        <div className="plantillas-historial-wrap">
          {paquetes.length > 0 && (
            <div className="mb-20">
              <h4 className="mb-10">Paquetes por Lote ({paquetes.length})</h4>
              <ul className="lista lista-items plantillas-lista">
                {paquetes.map((p) => (
                  <li key={p.loteId} className="anim-slide-up">
                    <div className="item-glass plantillas-item anim-card-hover">
                      <div className="item-row">
                        <div className="flex-1">
                          <div className="item-title">Paquete: {p.loteId}</div>
                          <div className="item-meta">
                            <span className="badge badge-meta">Exámenes: {p.total}</span>
                            <span className="badge badge-meta">Descargas: {p.descargados}</span>
                            <span className="badge badge-meta">Generado: {formatearFechaHora(p.generadoEn)}</span>
                          </div>
                        </div>
                        <div className="plantillas-item__actions">
                          <Boton
                            type="button"
                            variante="primario"
                            tamano="sm"
                            cargando={descargandoLoteId === p.loteId}
                            disabled={!puedeDescargarExamenes}
                            onClick={() => void onDescargarPaquete(p.loteId)}
                          >
                            📥 Descargar ZIP / PDF
                          </Boton>
                          <Boton
                            type="button"
                            variante="secundario"
                            tamano="sm"
                            cargando={regenerandoLoteId === p.loteId}
                            disabled={!puedeRegenerarExamenes}
                            onClick={() => void onRegenerarPaquete(p.loteId, p.items)}
                          >
                            🔄 Regenerar
                          </Boton>
                          <Boton
                            type="button"
                            variante="secundario"
                            tamano="sm"
                            cargando={eliminandoLoteId === p.loteId}
                            disabled={!puedeArchivarExamenes}
                            onClick={() => void onEliminarPaquete(p.loteId, p.items)}
                          >
                            🗑️ Eliminar
                          </Boton>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {examenesIndividuales.length > 0 && (
            <div>
              <h4 className="mb-10">Exámenes Individuales ({examenesIndividuales.length})</h4>
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
                              <span className="badge badge-meta">Alumno: {alumno ? `${alumno.nombres} ${alumno.apellidos}` : 'Muestra individual'}</span>
                              <span className="badge badge-meta">ID: {idCortoMateria(ex._id)}</span>
                              <span className="badge badge-meta">Generado: {formatearFechaHora(ex.generadoEn)}</span>
                            </div>
                          </div>
                          <div className="plantillas-item__actions">
                            <Boton
                              type="button"
                              variante="secundario"
                              tamano="sm"
                              cargando={descargandoExamenId === ex._id}
                              disabled={!puedeDescargarExamenes}
                              onClick={() => void descargarPdfExamen(ex)}
                            >
                              📥 PDF
                            </Boton>
                            <Boton
                              type="button"
                              variante="secundario"
                              tamano="sm"
                              cargando={regenerandoExamenId === ex._id}
                              disabled={!puedeRegenerarExamenes}
                              onClick={() => void regenerarPdfExamen(ex)}
                            >
                              🔄 Regenerar
                            </Boton>
                            <Boton
                              type="button"
                              variante="secundario"
                              tamano="sm"
                              cargando={archivandoExamenId === ex._id}
                              disabled={!puedeArchivarExamenes}
                              onClick={() => void eliminarExamenGenerado(ex)}
                            >
                              🗑️ Eliminar
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
        </div>
      )}
    </section>
  );
}
