/**
 * PlantillasGenerados
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Icono, Spinner } from '../../../../../ui/iconos';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../../../../ui/ux/componentes/InlineMensaje';
import { AyudaFormulario } from '../../../AyudaFormulario';
import type { Alumno, Plantilla } from '../../../tipos';
import { esMensajeError, idCortoMateria } from '../../../utilidades';

type ExamenGeneradoResumen = {
  _id: string;
  folio: string;
  plantillaId: string;
  alumnoId?: string | null;
  estado?: string;
  generadoEn?: string;
  descargadoEn?: string;
  paginas?: Array<{ numero: number; qrTexto?: string; preguntasDel?: number; preguntasAl?: number }>;
};

export function PlantillasGenerados({
  plantillaId,
  setPlantillaId,
  plantillas,
  alumnos,
  generando,
  puedeGenerar,
  onGenerarExamen,
  generandoLote,
  plantillaSeleccionada,
  puedeGenerarExamenes,
  onGenerarExamenesLote,
  mensajeGeneracion,
  lotePdfUrl,
  descargarPdfLote,
  ultimoGenerado,
  formatearFechaHora,
  cargandoExamenesGenerados,
  examenesGenerados,
  alumnosPorId,
  puedeRegenerarExamenes,
  descargandoExamenId,
  archivandoExamenId,
  regenerarPdfExamen,
  puedeDescargarExamenes,
  descargarPdfExamen,
  archivarExamenGenerado,
  regenerandoExamenId,
  puedeArchivarExamenes
}: {
  plantillaId: string;
  setPlantillaId: (value: string) => void;
  plantillas: Plantilla[];
  alumnos: Alumno[];
  generando: boolean;
  puedeGenerar: boolean;
  onGenerarExamen: () => Promise<void>;
  generandoLote: boolean;
  plantillaSeleccionada: Plantilla | null;
  puedeGenerarExamenes: boolean;
  onGenerarExamenesLote: () => Promise<void>;
  mensajeGeneracion: string;
  lotePdfUrl: string | null;
  descargarPdfLote: () => Promise<void>;
  ultimoGenerado: ExamenGeneradoResumen | null;
  formatearFechaHora: (value?: string) => string;
  cargandoExamenesGenerados: boolean;
  examenesGenerados: ExamenGeneradoResumen[];
  alumnosPorId: Map<string, Alumno>;
  puedeRegenerarExamenes: boolean;
  descargandoExamenId: string | null;
  archivandoExamenId: string | null;
  regenerarPdfExamen: (examen: ExamenGeneradoResumen) => Promise<void>;
  puedeDescargarExamenes: boolean;
  descargarPdfExamen: (examen: ExamenGeneradoResumen) => Promise<void>;
  archivarExamenGenerado: (examen: ExamenGeneradoResumen) => Promise<void>;
  regenerandoExamenId: string | null;
  puedeArchivarExamenes: boolean;
}) {
  // Normalización defensiva: evita condicionales repetidas en el JSX.
  const listaPlantillas = Array.isArray(plantillas) ? plantillas : [];
  const listaAlumnos = Array.isArray(alumnos) ? alumnos : [];
  const listaExamenesGenerados = Array.isArray(examenesGenerados) ? examenesGenerados : [];
  // Indicador de adopción operativa: exámenes ya descargados por docente.
  const totalDescargados = listaExamenesGenerados.filter((item) => Boolean(String(item.descargadoEn || '').trim())).length;

  return (
    <div className="plantillas-grid plantillas-grid--generacion">
      <div className="subpanel plantillas-panel plantillas-panel--generar">
        <h3>Generar examen</h3>
        <AyudaFormulario titulo="Generar examen (PDF)">
          <p>
            <b>Proposito:</b> crear un examen en PDF con <b>folio</b> y <b>QR por pagina</b>. Ese folio se usa para entrega y calificacion.
          </p>
          <ul className="lista">
            <li>
              <b>Plantilla:</b> obligatoria.
            </li>
            <li>
              <b>Vinculacion de alumno:</b> se realiza despues, en la seccion de <b>Entrega</b>, al recibir el examen fisico.
            </li>
          </ul>
          <p>
            Ejemplo: genera primero los examenes por folio y luego vincula cada folio con su alumno al entregar.
          </p>
        </AyudaFormulario>
        <div className="plantillas-generacion__stats">
          <span className="badge">Plantillas: {listaPlantillas.length}</span>
          <span className="badge">Alumnos: {listaAlumnos.length}</span>
        </div>
        <div className="plantillas-form">
          <label className="campo">
            Plantilla
            <select value={plantillaId} onChange={(event) => setPlantillaId(event.target.value)} data-tooltip="Selecciona la plantilla a generar.">
              <option value="">Selecciona</option>
              {listaPlantillas.map((plantilla) => (
                <option key={plantilla._id} value={plantilla._id}>
                  {plantilla.titulo}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="acciones acciones--mt">
          <Boton
            className="boton"
            type="button"
            icono={<Icono nombre="pdf" />}
            cargando={generando}
            disabled={!puedeGenerar}
            data-tooltip="Genera el examen PDF usando la plantilla seleccionada."
            onClick={() => void onGenerarExamen()}
          >
            {generando ? 'Generando…' : 'Generar'}
          </Boton>

          <Boton
            type="button"
            variante="secundario"
            icono={<Icono nombre="pdf" />}
            cargando={generandoLote}
            disabled={!plantillaId || !puedeGenerarExamenes}
            data-tooltip="Genera un paquete de examenes sin vincular alumnos; la entrega define la asociación."
            onClick={() => void onGenerarExamenesLote()}
          >
            {generandoLote ? 'Generando paquete…' : 'Generar paquete de examenes'}
          </Boton>
        </div>

        {mensajeGeneracion && (
          <p className={esMensajeError(mensajeGeneracion) ? 'mensaje error' : 'mensaje ok'} role="status">
            {mensajeGeneracion}
          </p>
        )}
        {lotePdfUrl && (
          <div className="acciones acciones--mt">
            <Boton
              type="button"
              variante="secundario"
              icono={<Icono nombre="pdf" />}
              onClick={() => void descargarPdfLote()}
              data-tooltip="Descarga el PDF con todos los examenes del lote."
            >
              Descargar PDF completo
            </Boton>
            <span className="ayuda">PDF del lote: {lotePdfUrl}</span>
          </div>
        )}
      </div>
      <div className="subpanel plantillas-panel plantillas-panel--generados" id="examenes-generados">
        <h3>Examenes generados</h3>
        {plantillaSeleccionada && (
          <div className="plantillas-generacion__stats">
            <span className="badge">Mostrados: {listaExamenesGenerados.length}</span>
            <span className="badge">Descargados: {totalDescargados}</span>
          </div>
        )}
        {!plantillaSeleccionada && (
          <InlineMensaje tipo="info">Selecciona una plantilla para ver los examenes generados y su historial.</InlineMensaje>
        )}
        {lotePdfUrl && (
          <InlineMensaje tipo="ok">
            <div className="acciones acciones--mt">
              <Boton
                type="button"
                variante="secundario"
                icono={<Icono nombre="pdf" />}
                onClick={() => void descargarPdfLote()}
                data-tooltip="Descarga el PDF con todos los examenes del lote."
              >
                Descargar PDF completo
              </Boton>
              <span className="ayuda">PDF del lote: {lotePdfUrl}</span>
            </div>
          </InlineMensaje>
        )}
        {ultimoGenerado && (
          <div className="resultado" aria-label="Detalle del ultimo examen generado">
            <h4>Ultimo examen generado</h4>
            <div className="item-meta">
              <span>Folio: {ultimoGenerado.folio}</span>
              <span>ID: {idCortoMateria(ultimoGenerado._id)}</span>
              <span>Generado: {formatearFechaHora(ultimoGenerado.generadoEn)}</span>
            </div>
            {(() => {
              const paginas = Array.isArray(ultimoGenerado.paginas) ? ultimoGenerado.paginas : [];
              if (paginas.length === 0) return null;
              return (
                <details>
                  <summary>Previsualizacion por pagina ({paginas.length})</summary>
                  {(() => {
                    const tieneRangos = paginas.some((p) => Number(p.preguntasDel ?? 0) > 0 && Number(p.preguntasAl ?? 0) > 0);
                    return (
                      !tieneRangos && (
                        <div className="ayuda">
                          Rango por pagina no disponible en este examen (probablemente fue generado con una version anterior). Regenera para
                          recalcular.
                        </div>
                      )
                    );
                  })()}
                  <ul className="lista">
                    {paginas.map((p) => {
                      const del = Number(p.preguntasDel ?? 0);
                      const al = Number(p.preguntasAl ?? 0);
                      const tieneRangos = paginas.some((x) => Number(x.preguntasDel ?? 0) > 0 && Number(x.preguntasAl ?? 0) > 0);
                      const rango = del && al ? `Preguntas ${del}–${al}` : tieneRangos ? 'Sin preguntas (pagina extra)' : 'Rango no disponible';
                      return (
                        <li key={p.numero}>
                          Pagina {p.numero}: {rango}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })()}
          </div>
        )}

        {plantillaSeleccionada && (
          <div className="resultado">
            <h3>Examenes generados (plantilla seleccionada)</h3>
            <div className="ayuda">Mostrando hasta 50, del mas reciente al mas antiguo. Al descargar se marca como descargado.</div>
            {cargandoExamenesGenerados && (
              <InlineMensaje tipo="info" leading={<Spinner />}>
                Cargando examenes generados…
              </InlineMensaje>
            )}
            <ul className="lista lista-items">
              {!cargandoExamenesGenerados && listaExamenesGenerados.length === 0 && <li>No hay examenes generados para esta plantilla.</li>}
              {listaExamenesGenerados.map((examen) => {
                const alumno = examen.alumnoId ? alumnosPorId.get(String(examen.alumnoId)) : null;
                const descargado = Boolean(String(examen.descargadoEn || '').trim());
                const regenerable = !examen.estado || String(examen.estado) === 'generado';
                return (
                  <li key={examen._id}>
                    <div className="item-glass">
                      <div className="item-row">
                        <div>
                          <div className="item-title">Folio: {examen.folio}</div>
                          <div className="item-meta">
                            <span>ID: {idCortoMateria(examen._id)}</span>
                            <span>Generado: {formatearFechaHora(examen.generadoEn)}</span>
                            <span>Descargado: {descargado ? formatearFechaHora(examen.descargadoEn) : 'No'}</span>
                          </div>
                          <div className="item-sub">
                            Alumno:{' '}
                            {alumno ? `${alumno.matricula} - ${alumno.nombreCompleto}` : examen.alumnoId ? `ID ${idCortoMateria(String(examen.alumnoId))}` : 'Sin alumno'}
                          </div>
                          {(() => {
                            const paginas = Array.isArray(examen.paginas) ? examen.paginas : [];
                            if (paginas.length === 0) return null;
                            return (
                              <details>
                                <summary>Previsualizacion por pagina ({paginas.length})</summary>
                                {(() => {
                                  const tieneRangos = paginas.some((p) => Number(p.preguntasDel ?? 0) > 0 && Number(p.preguntasAl ?? 0) > 0);
                                  return (
                                    !tieneRangos && (
                                      <div className="ayuda">
                                        Rango por pagina no disponible en este examen. Regenera si necesitas la previsualizacion.
                                      </div>
                                    )
                                  );
                                })()}
                                <ul className="lista">
                                  {paginas.map((p) => {
                                    const del = Number(p.preguntasDel ?? 0);
                                    const al = Number(p.preguntasAl ?? 0);
                                    const tieneRangos = paginas.some(
                                      (x) => Number(x.preguntasDel ?? 0) > 0 && Number(x.preguntasAl ?? 0) > 0
                                    );
                                    const rango = del && al ? `Preguntas ${del}–${al}` : tieneRangos ? 'Sin preguntas (pagina extra)' : 'Rango no disponible';
                                    return (
                                      <li key={p.numero}>
                                        Pagina {p.numero}: {rango}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </details>
                            );
                          })()}
                        </div>
                        <div className="item-actions">
                          {regenerable && (
                            <Boton
                              type="button"
                              variante="secundario"
                              icono={<Icono nombre="recargar" />}
                              cargando={regenerandoExamenId === examen._id}
                              disabled={!puedeRegenerarExamenes || descargandoExamenId === examen._id || archivandoExamenId === examen._id}
                              onClick={() => void regenerarPdfExamen(examen)}
                            >
                              Regenerar
                            </Boton>
                          )}
                          <Boton
                            type="button"
                            variante="secundario"
                            icono={<Icono nombre="pdf" />}
                            cargando={descargandoExamenId === examen._id}
                            disabled={!puedeDescargarExamenes || regenerandoExamenId === examen._id || archivandoExamenId === examen._id}
                            onClick={() => void descargarPdfExamen(examen)}
                          >
                            Descargar
                          </Boton>
                          {regenerable && (
                            <Boton
                              type="button"
                              variante="secundario"
                              className="peligro"
                              icono={<Icono nombre="alerta" />}
                              cargando={archivandoExamenId === examen._id}
                              disabled={!puedeArchivarExamenes || descargandoExamenId === examen._id || regenerandoExamenId === examen._id}
                              onClick={() => void archivarExamenGenerado(examen)}
                            >
                              Archivar
                            </Boton>
                          )}
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
    </div>
  );
}
