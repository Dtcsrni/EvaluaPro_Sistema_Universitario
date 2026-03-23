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
import { useState } from 'react';
import type { Alumno, Plantilla } from '../../../tipos';
import { esMensajeError, idCortoMateria } from '../../../utilidades';

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

type ProgresoLoteGeneracion = {
  loteId: string;
  totalEsperado: number;
  generados: number;
  porcentaje: number;
  completado: boolean;
  estado: 'iniciando' | 'generando' | 'completado';
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
  eliminarExamenGenerado,
  regenerandoExamenId,
  puedeArchivarExamenes,
  descargandoLoteId,
  regenerandoLoteId,
  eliminandoLoteId,
  onDescargarPaquete,
  onRegenerarPaquete,
  onEliminarPaquete,
  progresoLoteGeneracion
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
  eliminarExamenGenerado: (examen: ExamenGeneradoResumen) => Promise<void>;
  regenerandoExamenId: string | null;
  puedeArchivarExamenes: boolean;
  descargandoLoteId: string | null;
  regenerandoLoteId: string | null;
  eliminandoLoteId: string | null;
  onDescargarPaquete: (loteId: string) => Promise<void>;
  onRegenerarPaquete: (loteId: string, examenesLote: ExamenGeneradoResumen[]) => Promise<void>;
  onEliminarPaquete: (loteId: string, examenesLote: ExamenGeneradoResumen[]) => Promise<void>;
  progresoLoteGeneracion: ProgresoLoteGeneracion | null;
}) {
  const [modoGeneracion, setModoGeneracion] = useState<'individual' | 'paquete'>('paquete');

  // Normalización defensiva: evita condicionales repetidas en el JSX.
  const listaPlantillas = Array.isArray(plantillas) ? plantillas : [];
  const listaAlumnos = Array.isArray(alumnos) ? alumnos : [];
  const listaExamenesGenerados = Array.isArray(examenesGenerados) ? examenesGenerados : [];
  const generandoActivo = modoGeneracion === 'individual' ? generando : generandoLote;
  const puedeGenerarActivo =
    modoGeneracion === 'individual' ? puedeGenerar : Boolean(plantillaId) && puedeGenerarExamenes;
  const tooltipGeneracion =
    modoGeneracion === 'individual'
      ? 'Genera un único examen PDF usando la plantilla seleccionada.'
      : 'Genera un paquete de examenes para alumnos activos de la plantilla seleccionada.';
  const etiquetaGeneracion = generandoActivo
    ? modoGeneracion === 'individual'
      ? 'Generando…'
      : 'Generando paquete…'
    : modoGeneracion === 'individual'
      ? 'Generar examen individual'
      : 'Generar paquete de examenes';
  const examenesPorLote = listaExamenesGenerados.reduce<Record<string, ExamenGeneradoResumen[]>>((acumulado, examen) => {
    const key = String(examen.loteId || '').trim() || `sin-lote-${examen._id}`;
    if (!Array.isArray(acumulado[key])) acumulado[key] = [];
    acumulado[key].push(examen);
    return acumulado;
  }, {});
  const lotesOrdenados = Object.entries(examenesPorLote);
  // Indicador de adopción operativa: exámenes ya descargados por docente.
  const totalDescargados = listaExamenesGenerados.filter((item) => Boolean(String(item.descargadoEn || '').trim())).length;

  return (
    <div className="plantillas-grid plantillas-grid--generacion">
      <div className="subpanel plantillas-panel plantillas-panel--generar">
        <div className="plantillas-panel__hero">
          <div>
            <h3>Generación de exámenes</h3>
            <p className="nota">Pasa de plantilla a producción individual o masiva con trazabilidad por folio y paquete.</p>
          </div>
        </div>
        <AyudaFormulario titulo="Generación de exámenes (PDF)">
          <p>
            <b>Proposito:</b> crear un examen en PDF con <b>folio</b>, <b>QR por pagina</b> y marcas de referencia para lectura OMR.
          </p>
          <ul className="lista">
            <li>
              <b>Plantilla:</b> obligatoria.
            </li>
            <li>
              <b>Aleatoriedad controlada:</b> el sistema varía orden de preguntas/opciones para reducir copia, manteniendo consistencia por examen.
            </li>
            <li>
              <b>QR y folio:</b> cada página incluye QR y folio para trazabilidad de impresión, entrega y calificación.
            </li>
            <li>
              <b>Fiduciales OMR:</b> se imprimen marcas guía para alineación/corrección geométrica durante escaneo.
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
            type="button"
            variante={modoGeneracion === 'individual' ? 'primario' : 'secundario'}
            onClick={() => setModoGeneracion('individual')}
            disabled={generando || generandoLote}
            data-tooltip="Modo individual: genera un solo examen."
          >
            Individual
          </Boton>
          <Boton
            type="button"
            variante={modoGeneracion === 'paquete' ? 'primario' : 'secundario'}
            onClick={() => setModoGeneracion('paquete')}
            disabled={generando || generandoLote}
            data-tooltip="Modo paquete: genera examenes para todos los alumnos activos."
          >
            Paquete
          </Boton>
        </div>

        <div className="acciones acciones--mt">
          <Boton
            className="boton"
            type="button"
            icono={<Icono nombre="pdf" />}
            cargando={generandoActivo}
            disabled={!puedeGenerarActivo}
            data-tooltip={tooltipGeneracion}
            onClick={() => {
              if (modoGeneracion === 'individual') {
                void onGenerarExamen();
                return;
              }
              void onGenerarExamenesLote();
            }}
          >
            {etiquetaGeneracion}
          </Boton>
        </div>

        {modoGeneracion === 'paquete' && progresoLoteGeneracion && (
          <div className="resultado" aria-live="polite">
            <h4>Progreso de generación del paquete {progresoLoteGeneracion.loteId}</h4>
            <progress
              className="plantillas-progreso-barra"
              max={Math.max(1, progresoLoteGeneracion.totalEsperado || 100)}
              value={
                progresoLoteGeneracion.totalEsperado > 0
                  ? Math.min(progresoLoteGeneracion.generados, progresoLoteGeneracion.totalEsperado)
                  : Math.min(100, progresoLoteGeneracion.porcentaje)
              }
            />
            <div className="item-meta">
              <span>
                Estado:{' '}
                {progresoLoteGeneracion.estado === 'completado'
                  ? 'Completado'
                  : progresoLoteGeneracion.estado === 'generando'
                    ? 'Generando'
                    : 'Iniciando'}
              </span>
              <span>
                Avance: {progresoLoteGeneracion.generados}
                {progresoLoteGeneracion.totalEsperado > 0 ? ` / ${progresoLoteGeneracion.totalEsperado}` : ''}
              </span>
              <span>{Math.max(0, Math.min(100, progresoLoteGeneracion.porcentaje))}%</span>
            </div>
          </div>
        )}

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
        <div className="plantillas-panel__hero">
          <div>
            <h3>Examenes generados</h3>
            <p className="nota">Consulta historial, paquetes, descargas y regeneraciones desde una sola mesa operativa.</p>
          </div>
        </div>
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
              {lotesOrdenados.map(([loteId, examenesLote]) => {
                const esPaquete = !String(loteId || '').startsWith('sin-lote-');
                const tituloLote = esPaquete ? `Paquete ${loteId}` : 'Examen individual';
                const fechaPaquete = examenesLote.reduce<string | undefined>((fecha, examen) => {
                  const actual = String(examen.generadoEn || '').trim();
                  if (!actual) return fecha;
                  if (!fecha) return actual;
                  const tsActual = new Date(actual).getTime();
                  const tsFecha = new Date(fecha).getTime();
                  if (!Number.isFinite(tsActual)) return fecha;
                  if (!Number.isFinite(tsFecha)) return actual;
                  return tsActual > tsFecha ? actual : fecha;
                }, undefined);
                return (
                  <li key={loteId}>
                    <details>
                      <summary>
                        {tituloLote} ({examenesLote.length}) · Generado: {formatearFechaHora(fechaPaquete)}
                      </summary>
                      {esPaquete && (
                        <div className="acciones acciones--mt">
                          <Boton
                            type="button"
                            variante="secundario"
                            icono={<Icono nombre="recargar" />}
                            cargando={regenerandoLoteId === loteId}
                            disabled={!puedeRegenerarExamenes || eliminandoLoteId === loteId || descargandoLoteId === loteId}
                            onClick={() => void onRegenerarPaquete(loteId, examenesLote)}
                          >
                            Regenerar paquete
                          </Boton>
                          <Boton
                            type="button"
                            variante="secundario"
                            icono={<Icono nombre="pdf" />}
                            cargando={descargandoLoteId === loteId}
                            disabled={!puedeDescargarExamenes || regenerandoLoteId === loteId || eliminandoLoteId === loteId}
                            onClick={() => void onDescargarPaquete(loteId)}
                          >
                            Descargar paquete
                          </Boton>
                          <Boton
                            type="button"
                            variante="secundario"
                            className="peligro"
                            icono={<Icono nombre="alerta" />}
                            cargando={eliminandoLoteId === loteId}
                            disabled={!puedeArchivarExamenes || regenerandoLoteId === loteId || descargandoLoteId === loteId}
                            onClick={() => void onEliminarPaquete(loteId, examenesLote)}
                          >
                            Eliminar paquete
                          </Boton>
                        </div>
                      )}
                      <ul className="lista lista-items">
                        {examenesLote.map((examen) => {
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
                                      {alumno
                                        ? `${alumno.matricula} - ${alumno.nombreCompleto}`
                                        : examen.alumnoId
                                          ? `ID ${idCortoMateria(String(examen.alumnoId))}`
                                          : 'Sin alumno'}
                                    </div>
                                    {(() => {
                                      const paginas = Array.isArray(examen.paginas) ? examen.paginas : [];
                                      if (paginas.length === 0) return null;
                                      return (
                                        <details>
                                          <summary>Previsualizacion por pagina ({paginas.length})</summary>
                                          {(() => {
                                            const tieneRangos = paginas.some(
                                              (p) => Number(p.preguntasDel ?? 0) > 0 && Number(p.preguntasAl ?? 0) > 0
                                            );
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
                                              const rango = del && al
                                                ? `Preguntas ${del}–${al}`
                                                : tieneRangos
                                                  ? 'Sin preguntas (pagina extra)'
                                                  : 'Rango no disponible';
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
                                        onClick={() => void eliminarExamenGenerado(examen)}
                                      >
                                        Eliminar
                                      </Boton>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
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
