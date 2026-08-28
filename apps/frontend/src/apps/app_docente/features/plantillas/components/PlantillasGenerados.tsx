/**
 * PlantillasGenerados
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Icono, Spinner } from '../../../../../ui/iconos';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../../../../ui/ux/componentes/InlineMensaje';
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
  onDescargarPaquete: (loteId: string, examenesLote: ExamenGeneradoResumen[]) => Promise<void>;
  onRegenerarPaquete: (loteId: string, examenesLote: ExamenGeneradoResumen[]) => Promise<void>;
  onEliminarPaquete: (loteId: string, examenesLote: ExamenGeneradoResumen[]) => Promise<void>;
  progresoLoteGeneracion: ProgresoLoteGeneracion | null;
}) {
  const [modoGeneracion, setModoGeneracion] = useState<'individual' | 'paquete'>('paquete');
  const listaPlantillas = Array.isArray(plantillas) ? plantillas : [];
  const listaAlumnos = Array.isArray(alumnos) ? alumnos : [];
  const listaExamenesGenerados = Array.isArray(examenesGenerados) ? examenesGenerados : [];
  const totalDescargados = listaExamenesGenerados.filter((ex) => Boolean(ex.descargadoEn)).length;
  const generandoActivo = modoGeneracion === 'individual' ? generando : generandoLote;
  const puedeGenerarActivo =
    Boolean(plantillaId) && (modoGeneracion === 'individual' ? puedeGenerar : puedeGenerarExamenes && listaAlumnos.length > 0);
  const etiquetaGeneracion =
    modoGeneracion === 'individual'
      ? generando
        ? 'Generando examen…'
        : 'Generar examen individual'
      : generandoLote
        ? 'Generando paquete…'
        : 'Generar paquete de examenes';
  const tooltipGeneracion =
    modoGeneracion === 'individual'
      ? 'Genera un unico examen para la plantilla seleccionada.'
      : 'Genera un paquete de examenes para los alumnos de la materia.';

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
    <div className="plantillas-grid plantillas-grid--generacion anim-fade-in">
      <div className="subpanel plantillas-panel plantillas-panel--generar">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Producción OMR</span>
            </span>
            <h3>Generación de exámenes</h3>
            <p className="nota">Pasa de plantilla a producción individual o masiva con trazabilidad por folio y paquete.</p>
          </div>
          <div className="plantillas-generacion__stats">
            <span className="banco-tag-preguntas">Plantillas: {listaPlantillas.length}</span>
            <span className="banco-tag-paginas">Alumnos: {listaAlumnos.length}</span>
          </div>
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

        <div className="plantillas-modo-toggle" role="group" aria-label="Modo de generación">
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

        <div className="acciones plantillas-generar__cta">
          <Boton
            className="boton boton--glow"
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
          <div className="resultado plantillas-progreso-card" aria-live="polite">
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
          <div className="acciones plantillas-lote-download">
            <Boton
              type="button"
              variante="secundario"
              icono={<Icono nombre="pdf" />}
              onClick={() => void descargarPdfLote()}
              data-tooltip="Descarga el PDF con todos los examenes del lote."
            >
              Descargar PDF completo
            </Boton>
            <span className="ayuda">PDF del lote listo para imprimir</span>
          </div>
        )}
      </div>

      <div className="subpanel plantillas-panel plantillas-panel--generados" id="examenes-generados">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Custodia y Descargas</span>
            </span>
            <h3>Examenes generados</h3>
            <p className="nota">Consulta historial, paquetes, descargas y regeneraciones desde una sola mesa operativa.</p>
          </div>
          {plantillaSeleccionada && (
            <div className="plantillas-generacion__stats">
              <span className="banco-tag-preguntas">Mostrados: {listaExamenesGenerados.length}</span>
              <span className="banco-tag-paginas">Descargados: {totalDescargados}</span>
            </div>
          )}
        </div>

        {!plantillaSeleccionada && (
          <InlineMensaje tipo="info">Selecciona una plantilla para ver los examenes generados y su historial.</InlineMensaje>
        )}

        {lotePdfUrl && (
          <InlineMensaje tipo="ok">
            <div className="acciones plantillas-lote-download">
              <Boton
                type="button"
                variante="secundario"
                icono={<Icono nombre="pdf" />}
                onClick={() => void descargarPdfLote()}
                data-tooltip="Descarga el PDF con todos los examenes del lote."
              >
                Descargar PDF completo
              </Boton>
              <span className="ayuda">PDF del paquete listo</span>
            </div>
          </InlineMensaje>
        )}

        {ultimoGenerado && (
          <div className="resultado plantillas-ultimo-card" aria-label="Detalle del ultimo examen generado">
            <h4>Ultimo examen generado</h4>
            <div className="item-meta">
              <span>Folio: <b>{ultimoGenerado.folio}</b></span>
              <span>ID: {idCortoMateria(ultimoGenerado._id)}</span>
              <span>Generado: {formatearFechaHora(ultimoGenerado.generadoEn)}</span>
            </div>
            {(() => {
              const paginas = Array.isArray(ultimoGenerado.paginas) ? ultimoGenerado.paginas : [];
              if (paginas.length === 0) return null;
              return (
                <div className="plantillas-paginas-grid">
                  {paginas.map((p) => (
                    <div key={p.numero} className="plantillas-pagina-chip">
                      <span className="plantillas-pagina-chip__num">Pág. {p.numero}</span>
                      <span className="plantillas-pagina-chip__rango">
                        {p.preguntasDel !== undefined && p.preguntasAl !== undefined
                          ? `Reactivos ${p.preguntasDel}-${p.preguntasAl}`
                          : 'Carátula/Instrucciones'}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {cargandoExamenesGenerados && (
          <div className="cargando cargando--bloque">
            <Spinner /> Cargando historial de exámenes…
          </div>
        )}

        {plantillaSeleccionada && !cargandoExamenesGenerados && listaExamenesGenerados.length === 0 && (
          <InlineMensaje tipo="info">Esta plantilla aún no tiene exámenes generados.</InlineMensaje>
        )}

        {paquetes.length > 0 && (
          <div className="plantillas-paquetes-sec">
            <h4>Paquetes masivos por grupo</h4>
            <ul className="lista lista-items plantillas-lista">
              {paquetes.map((pkg) => (
                <li key={pkg.loteId}>
                  <div className="item-glass plantillas-item plantillas-item--paquete">
                    <div className="item-row">
                      <div>
                        <div className="item-title">Paquete: {pkg.loteId}</div>
                        <div className="item-meta">
                          <span>Total: {pkg.total} folios</span>
                          <span>Descargados: {pkg.descargados}</span>
                          <span>Fecha: {formatearFechaHora(pkg.generadoEn)}</span>
                        </div>
                      </div>
                      <div className="acciones">
                        <Boton
                          type="button"
                          variante="secundario"
                          icono={<Icono nombre="pdf" />}
                          cargando={descargandoLoteId === pkg.loteId}
                          disabled={!puedeDescargarExamenes}
                          onClick={() => void onDescargarPaquete(pkg.loteId, pkg.items)}
                          data-tooltip="Descarga el PDF consolidado del paquete."
                        >
                          Descargar ZIP / PDF
                        </Boton>
                        <Boton
                          type="button"
                          variante="secundario"
                          cargando={regenerandoLoteId === pkg.loteId}
                          disabled={!puedeRegenerarExamenes}
                          onClick={() => void onRegenerarPaquete(pkg.loteId, pkg.items)}
                          data-tooltip="Regenera los PDFs del paquete."
                        >
                          Regenerar
                        </Boton>
                        <Boton
                          type="button"
                          variante="secundario"
                          className="boton--peligro"
                          cargando={eliminandoLoteId === pkg.loteId}
                          disabled={!puedeArchivarExamenes}
                          onClick={() => void onEliminarPaquete(pkg.loteId, pkg.items)}
                          data-tooltip="Elimina todos los folios de este paquete."
                        >
                          Eliminar
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
          <div className="plantillas-individuales-sec">
            <h4>Exámenes individuales</h4>
            <ul className="lista lista-items plantillas-lista">
              {examenesIndividuales.map((ex) => {
                const alumno = ex.alumnoId ? alumnosPorId.get(ex.alumnoId) : null;
                const nombreAlumno = alumno?.nombreCompleto || (alumno ? `${alumno.nombres} ${alumno.apellidos}` : 'Sin alumno asignado');
                return (
                  <li key={ex._id}>
                    <div className="item-glass plantillas-item">
                      <div className="item-row">
                        <div>
                          <div className="item-title">Folio: {ex.folio}</div>
                          <div className="item-meta">
                            <span>Alumno: {nombreAlumno}</span>
                            <span>Generado: {formatearFechaHora(ex.generadoEn)}</span>
                            {ex.descargadoEn && <span>Descargado: {formatearFechaHora(ex.descargadoEn)}</span>}
                          </div>
                        </div>
                        <div className="acciones">
                          <Boton
                            type="button"
                            variante="secundario"
                            icono={<Icono nombre="pdf" />}
                            cargando={descargandoExamenId === ex._id}
                            disabled={!puedeDescargarExamenes}
                            onClick={() => void descargarPdfExamen(ex)}
                            data-tooltip="Descarga el PDF de este examen individual."
                          >
                            PDF
                          </Boton>
                          <Boton
                            type="button"
                            variante="secundario"
                            cargando={regenerandoExamenId === ex._id}
                            disabled={!puedeRegenerarExamenes}
                            onClick={() => void regenerarPdfExamen(ex)}
                            data-tooltip="Regenera el PDF de este examen."
                          >
                            Regenerar
                          </Boton>
                          <Boton
                            type="button"
                            variante="secundario"
                            className="boton--peligro"
                            cargando={archivandoExamenId === ex._id}
                            disabled={!puedeArchivarExamenes}
                            onClick={() => void eliminarExamenGenerado(ex)}
                            data-tooltip="Elimina este folio."
                          >
                            Eliminar
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
    </div>
  );
}
