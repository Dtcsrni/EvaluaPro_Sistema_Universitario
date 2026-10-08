/**
 * PlantillasConsolaGeneracion
 *
 * Responsabilidad: Consola de producción OMR para generación de exámenes masivos e individuales.
 */
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { emitToast } from '../../../../../ui/toast/toastBus';
import { useEffect, useMemo, useState } from 'react';
import type { Alumno, Periodo, Plantilla } from '../../../tipos';
import { esMensajeError, idCortoMateria } from '../../../utilidades';
import { OMR_CANONICAL_DISPLAY_LABEL } from '../../../../../ui/version/versionInfo';
import { crearClaveLoteGeneracion, leerLotePendiente } from '../loteGeneracionSesion';
import type { PreviewPdfPage } from '../hooks/usePlantillasPreviewActions';

type ProgresoLoteGeneracion = {
  loteId: string;
  totalEsperado: number;
  generados: number;
  porcentaje: number;
  completado: boolean;
  estado: 'iniciando' | 'generando' | 'completado' | 'fallido' | 'archivado';
  claveRecuperacion?: string;
};

export function PlantillasConsolaGeneracion({
  plantillaId,
  setPlantillaId,
  plantillas,
  periodos,
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
  progresoLoteGeneracion,
  onPrevisualizarExtraordinario,
  paginasExtraordinarioObjetivo = 4,
  onIrAHistorial
}: {
  plantillaId: string;
  setPlantillaId: (value: string) => void;
  plantillas: Plantilla[];
  periodos: Periodo[];
  alumnos: Alumno[];
  generando: boolean;
  puedeGenerar: boolean;
  onGenerarExamen: () => Promise<void>;
  generandoLote: boolean;
  plantillaSeleccionada: Plantilla | null;
  paginasExtraordinarioObjetivo?: number;
  puedeGenerarExamenes: boolean;
  onGenerarExamenesLote: (opciones?: { tipoExamen?: 'extraordinario'; alumnoIds?: string[] }) => Promise<void>;
  mensajeGeneracion: string;
  lotePdfUrl: string | null;
  descargarPdfLote: () => Promise<void>;
  progresoLoteGeneracion: ProgresoLoteGeneracion | null;
  onPrevisualizarExtraordinario: (plantillaId: string) => Promise<{
    layoutConfirmado: boolean;
    paginas: PreviewPdfPage[];
    totalDisponibles: number;
    totalUsados: number;
    numeroPaginas: number;
    fuentesExtraordinario?: string[];
    totalPreguntasFuente?: number;
    preguntasOmitidasPorFormato?: number;
    preguntasOmitidasPorOmr?: Array<{ id: string; enunciado: string; problemas: string[] }>;
  } | null>;
  onIrAHistorial?: () => void;
}) {
  const [modoGeneracion, setModoGeneracion] = useState<'lote' | 'individual'>('lote');
  const [tipoExamen, setTipoExamen] = useState<'ordinario' | 'extraordinario'>('ordinario');
  const [alumnoIdsExtraordinario, setAlumnoIdsExtraordinario] = useState<string[]>([]);
  const [previsualizandoExtraordinario, setPrevisualizandoExtraordinario] = useState(false);
  const [previewExtraordinario, setPreviewExtraordinario] = useState<{
    layoutConfirmado: boolean;
    paginas: PreviewPdfPage[];
    totalDisponibles: number;
    totalUsados: number;
    numeroPaginas: number;
    fuentesExtraordinario?: string[];
    totalPreguntasFuente?: number;
    preguntasOmitidasPorFormato?: number;
    preguntasOmitidasPorOmr?: Array<{ id: string; enunciado: string; problemas: string[] }>;
  } | null>(null);
  const [previewExtraordinarioConfirmado, setPreviewExtraordinarioConfirmado] = useState(false);
  const listaPlantillas = Array.isArray(plantillas) ? plantillas : [];
  const listaPeriodos = Array.isArray(periodos) ? periodos : [];
  const listaAlumnos = Array.isArray(alumnos) ? alumnos : [];
  const periodoPlantilla = listaPeriodos.find((periodo) => periodo._id === plantillaSeleccionada?.periodoId);
  const esPeriodoArchivado = periodoPlantilla?.activo === false &&
    Number.isFinite(Date.parse(String(periodoPlantilla.fechaFin ?? ''))) &&
    Date.parse(String(periodoPlantilla.fechaFin)) < Date.now();

  const alumnosMateria = plantillaSeleccionada
    ? listaAlumnos.filter((a) => a.periodoId === plantillaSeleccionada.periodoId && (esPeriodoArchivado || a.activo !== false))
    : listaAlumnos;
  const alumnosMateriaPorId = useMemo(() => new Map(alumnosMateria.map((alumno) => [alumno._id, alumno])), [alumnosMateria]);
  const alumnosExtraordinariosSeleccionados = alumnoIdsExtraordinario.filter((alumnoId) => alumnosMateriaPorId.has(alumnoId));
  const esExtraordinario = esPeriodoArchivado || tipoExamen === 'extraordinario';
  const claveRecuperacionLote = crearClaveLoteGeneracion(
    plantillaId,
    esExtraordinario ? 'extraordinario' : undefined,
    alumnosExtraordinariosSeleccionados
  );
  const lotePendienteId = plantillaId ? leerLotePendiente(claveRecuperacionLote) : null;
  const hayLoteReanudable = !generandoLote && Boolean(
    lotePendienteId ||
    (progresoLoteGeneracion?.estado === 'fallido' && progresoLoteGeneracion.claveRecuperacion === claveRecuperacionLote)
  );

  useEffect(() => {
    setAlumnoIdsExtraordinario([]);
    setModoGeneracion('lote');
    setPreviewExtraordinario(null);
    setPreviewExtraordinarioConfirmado(false);
  }, [plantillaId]);

  useEffect(() => {
    if (esExtraordinario && modoGeneracion !== 'lote') setModoGeneracion('lote');
  }, [esExtraordinario, modoGeneracion]);

  useEffect(() => {
    if (esPeriodoArchivado && modoGeneracion !== 'lote') setModoGeneracion('lote');
  }, [esPeriodoArchivado, modoGeneracion]);

  const textoBotonGenerar =
    esExtraordinario
      ? generandoLote
        ? 'Generando extraordinarios…'
        : hayLoteReanudable
          ? 'Reintentar generación extraordinaria'
          : `Generar extraordinarios (${alumnosExtraordinariosSeleccionados.length} alumnos)`
      : modoGeneracion === 'individual'
      ? generando
        ? 'Generando examen…'
        : 'Generar examen individual de muestra'
      : generandoLote
        ? 'Generando paquete masivo…'
        : hayLoteReanudable
          ? 'Reintentar paquete incompleto'
        : `Generar paquete de exámenes (${alumnosMateria.length} alumnos)`;
  const progresoEnAlcance = progresoLoteGeneracion?.claveRecuperacion === claveRecuperacionLote
    ? progresoLoteGeneracion
    : null;
  const progresoVisible = progresoEnAlcance ?? (lotePendienteId && !generandoLote
    ? {
        loteId: lotePendienteId,
        totalEsperado: esExtraordinario ? alumnosExtraordinariosSeleccionados.length : alumnosMateria.length,
        generados: 0,
        porcentaje: 0,
        completado: false,
        estado: 'fallido' as const
      }
    : generandoLote
    ? {
        loteId: 'en curso',
        totalEsperado: esExtraordinario ? alumnosExtraordinariosSeleccionados.length : alumnosMateria.length,
        generados: 0,
        porcentaje: 0,
        completado: false,
        estado: 'iniciando' as const
      }
    : null);

  return (
    <section className="alumnos-form alumnos-form--glass alumnos-form--panoramico anim-form-card" aria-label="Consola de Producción OMR">
      <div className="alumnos-form__header">
        <div className="banco-section-title__wrap">
          <span className="banco-section-pill">
            <span className="banco-section-pill__dot" aria-hidden="true" />
            <span>Producción OMR</span>
          </span>
          <h3 className="alumnos-form__title">Generación de exámenes</h3>
          <p className="alumnos-form__subtitle">
            Pasa de plantilla a producción física masiva con folios institucionales, códigos QR únicos y hojas de respuestas OMR.
          </p>
        </div>
        <div className="plantillas-generacion__stats">
          <span className="version-env-badge" title="Contrato único de generación y lectura OMR activo">
            {OMR_CANONICAL_DISPLAY_LABEL}
          </span>
          <span className="banco-tag-preguntas">Plantillas: {listaPlantillas.length}</span>
          <span className="banco-tag-paginas">Alumnos en materia: {alumnosMateria.length}</span>
        </div>
      </div>

      <div className="alumnos-form__fields">
        {/* Selector de Plantilla */}
        <div className="alumnos-form__row alumnos-form__row--top">
          <label className="campo flex-1">
            <span className="campo__label-row">
              <span>Plantilla base para el examen</span>
            </span>
            <div className="auth-input-box auth-input-box--select auth-input-box--animated">
              <select
                value={plantillaId}
                onChange={(e) => setPlantillaId(e.target.value)}
                disabled={!puedeGenerarExamenes || listaPlantillas.length === 0}
                data-tooltip="Selecciona la plantilla base para generar los exámenes."
              >
                <option value="">Selecciona una plantilla de examen</option>
                {listaPlantillas.map((p) => {
                  const periodo = listaPeriodos.find((item) => item._id === p.periodoId);
                  const archivada = periodo?.activo === false;
                  return (
                  <option key={p._id} value={p._id}>
                    {periodo?.nombre ?? 'Materia no identificada'}{archivada ? ' · Periodo cerrado, solo extraordinario' : ''} · {p.titulo} (ID: {idCortoMateria(p._id)})
                  </option>
                  );
                })}
              </select>
            </div>
            <span className="ayuda">Estructura temática y banco que se usará para construir las preguntas.</span>
          </label>
        </div>

        {/* Selector de Modalidad */}
        <div className="plantillas-temas-box">
          <div className="plantillas-temas__header">
            <div>
              <h4 className="plantillas-temas__title">Modalidad de Generación</h4>
              <p className="nota">Elige el tipo de tiraje a producir.</p>
            </div>
          </div>

          <div className="plantillas-modo-toggle mt-10">
            <button
              type="button"
              className={`boton ${modoGeneracion === 'lote' ? 'boton--primario' : 'boton--secundario'}`}
              onClick={() => {
                setModoGeneracion('lote');
                emitToast({ level: 'info', title: 'Modalidad', message: 'Paquete masivo seleccionado', durationMs: 1600 });
              }}
              disabled={!puedeGenerarExamenes}
            >
              📦 Paquete Masivo por Grupo ({alumnosMateria.length} alumnos)
            </button>
            <button
              type="button"
              className={`boton ${modoGeneracion === 'individual' ? 'boton--primario' : 'boton--secundario'}`}
              onClick={() => {
                setModoGeneracion('individual');
                emitToast({ level: 'info', title: 'Modalidad', message: 'Examen individual seleccionado', durationMs: 1600 });
              }}
              disabled={!puedeGenerarExamenes || esPeriodoArchivado}
            >
              📄 Examen Individual de Muestra
            </button>
          </div>

          <label className="campo">
            <span className="campo__label-row"><span>Tipo de examen</span></span>
            <div className="auth-input-box auth-input-box--select auth-input-box--animated">
              <select
                aria-label="Tipo de examen"
                value={esPeriodoArchivado ? 'extraordinario' : tipoExamen}
                onChange={(event) => setTipoExamen(event.target.value === 'extraordinario' ? 'extraordinario' : 'ordinario')}
                disabled={!puedeGenerarExamenes}
              >
                <option value="ordinario" disabled={esPeriodoArchivado}>Ordinario · {plantillaSeleccionada?.tipo === 'global' ? 'Global' : 'Parcial'}</option>
                <option value="extraordinario">Extraordinario</option>
              </select>
            </div>
          </label>

          {esExtraordinario ? (
            <fieldset className="plantillas-seleccion-alumnos" aria-describedby="plantillas-extraordinario-ayuda">
              <legend>Alumnos que presentarán el extraordinario</legend>
              <p id="plantillas-extraordinario-ayuda" className="ayuda">
                Elige únicamente a los alumnos destinatarios. La calificación se conservará aparte de sus parciales y globales.
              </p>
              {esPeriodoArchivado && <p role="status">Periodo cerrado: el extraordinario conserva la materia y la plantilla archivadas. Objetivo: {paginasExtraordinarioObjetivo} páginas ({Math.ceil(paginasExtraordinarioObjetivo / 2)} hojas dúplex); se imprimirá el máximo de preguntas que quepa con tipografía legible.</p>}
              {alumnosMateria.length === 0 ? (
                <p role="status">No hay alumnos disponibles en la materia seleccionada.</p>
              ) : (
                <>
                  <div className="acciones">
                    <button
                      type="button"
                      className="boton boton--secundario"
                      onClick={() => setAlumnoIdsExtraordinario(alumnosMateria.map((alumno) => alumno._id))}
                    >
                      Seleccionar todos ({alumnosMateria.length})
                    </button>
                    <button
                      type="button"
                      className="boton boton--secundario"
                      onClick={() => setAlumnoIdsExtraordinario([])}
                      disabled={alumnosExtraordinariosSeleccionados.length === 0}
                    >
                      Limpiar selección
                    </button>
                  </div>
                  <ul className="lista lista-items">
                    {alumnosMateria.map((alumno) => {
                      const nombre = alumno.nombreCompleto || `${alumno.nombres} ${alumno.apellidos}`.trim();
                      return (
                        <li key={alumno._id}>
                          <label className="campo-checkbox" htmlFor={`extraordinario-${alumno._id}`}>
                            <input
                              id={`extraordinario-${alumno._id}`}
                              type="checkbox"
                              checked={alumnoIdsExtraordinario.includes(alumno._id)}
                              onChange={(event) => setAlumnoIdsExtraordinario((actuales) =>
                                event.target.checked
                                  ? [...new Set([...actuales, alumno._id])]
                                  : actuales.filter((id) => id !== alumno._id)
                              )}
                            />
                            <span>{nombre || 'Alumno sin nombre'}{alumno.matricula ? ` · ${alumno.matricula}` : ''}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <p role="status">Seleccionados: {alumnosExtraordinariosSeleccionados.length}</p>
                </>
              )}
              {esPeriodoArchivado && plantillaId && (
                <div className="plantillas-preview anim-fade-in mt-15">
                  <div className="acciones">
                    <Boton
                      type="button"
                      variante="secundario"
                      cargando={previsualizandoExtraordinario}
                      disabled={!puedeGenerarExamenes || previsualizandoExtraordinario}
                      onClick={async () => {
                        setPrevisualizandoExtraordinario(true);
                        setPreviewExtraordinarioConfirmado(false);
                        try {
                          const preview = await onPrevisualizarExtraordinario(plantillaId);
                          setPreviewExtraordinario(preview);
                        } finally {
                          setPrevisualizandoExtraordinario(false);
                        }
                      }}
                    >
                      {previewExtraordinario ? 'Actualizar vista previa PDF' : 'Previsualizar PDF antes de generar'}
                    </Boton>
                  </div>
                  {previewExtraordinario && (
                    <>
                      <p role="status">
                        {previewExtraordinario.layoutConfirmado
                          ? `Vista previa validada: ${previewExtraordinario.numeroPaginas} páginas (${Math.ceil(previewExtraordinario.numeroPaginas / 2)} hojas dúplex), ${previewExtraordinario.totalUsados} de ${previewExtraordinario.totalDisponibles} preguntas válidas impresas.${(previewExtraordinario.preguntasOmitidasPorFormato ?? 0) > 0 ? ` ${previewExtraordinario.preguntasOmitidasPorFormato} no caben con la tipografía legible mínima.` : ''} Revisa las páginas antes de confirmar.`
                          : `No se pudo validar el formato de ${previewExtraordinario.numeroPaginas} páginas; no hay páginas completas con preguntas legibles. No se puede generar.`}
                      </p>
                      {(previewExtraordinario.fuentesExtraordinario?.length ?? 0) > 0 && (
                        <p>Fuentes combinadas: global archivado y {previewExtraordinario.fuentesExtraordinario?.join(', ')}.</p>
                      )}
                      {(previewExtraordinario.preguntasOmitidasPorOmr?.length ?? 0) > 0 && (
                        <details>
                          <summary>Reactivos parciales excluidos por defectos OMR ({previewExtraordinario.preguntasOmitidasPorOmr?.length})</summary>
                          <ul>
                            {previewExtraordinario.preguntasOmitidasPorOmr?.map((reactivo) => (
                              <li key={reactivo.id}><code>{reactivo.id}</code>: {reactivo.problemas.join('; ')}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {previewExtraordinario.paginas.length > 0 && (
                        <div className="plantillas-preview__pages" aria-label="Páginas de la vista previa del extraordinario">
                          {previewExtraordinario.paginas.map((pagina) => (
                            <figure key={pagina.numero} className="plantillas-preview__pdfPage">
                              <img src={pagina.dataUrl} width={pagina.width} height={pagina.height} alt={`Página ${pagina.numero} de la vista previa del extraordinario`} />
                            </figure>
                          ))}
                        </div>
                      )}
                      <label className="campo-checkbox">
                        <input
                          type="checkbox"
                          checked={previewExtraordinarioConfirmado}
                          disabled={!previewExtraordinario.layoutConfirmado}
                          onChange={(event) => setPreviewExtraordinarioConfirmado(event.target.checked)}
                        />
                        <span>Confirmo que revisé la vista previa del examen.</span>
                      </label>
                    </>
                  )}
                </div>
              )}
            </fieldset>
          ) : null}

          {!esExtraordinario && modoGeneracion === 'lote' && (
            <div className="ayuda mt-10">
              💡 Se generará un examen con código QR personalizado y folio único para cada uno de los <b>{alumnosMateria.length} alumnos</b> inscritos en esta materia.
            </div>
          )}
        </div>

        {/* Barra de Progreso si está en curso */}
        {progresoVisible && (!progresoVisible.completado || generandoLote) && (
          <div className="progreso-lote-card anim-fade-in mt-15">
            <div className="progreso-lote-card__header">
              <span>
                {progresoVisible.estado === 'fallido'
                  ? '⚠️ Lote incompleto. Reintentará con el mismo ID y conservará los PDFs individuales válidos.'
                  : '⚡ Generando paquete masivo en el servidor...'}
              </span>
              <span><b>{progresoVisible.generados}</b> / {progresoVisible.totalEsperado} ({progresoVisible.porcentaje}%)</span>
            </div>
            <progress
              className="progreso-lote-card__progress"
              max={100}
              value={Math.max(0, Math.min(100, progresoVisible.porcentaje))}
              aria-label={`Progreso de generación: ${progresoVisible.porcentaje}%`}
            />
          </div>
        )}

        {/* Acciones de Generación */}
        <div className="alumnos-form__footer mt-20">
          <div className="acciones alumnos-form__actions">
            {!esExtraordinario && modoGeneracion === 'individual' ? (
              <Boton
                type="button"
                variante="primario"
                cargando={generando}
                disabled={!puedeGenerar || !puedeGenerarExamenes}
                onClick={onGenerarExamen}
              >
                {textoBotonGenerar}
              </Boton>
            ) : (
              <Boton
                type="button"
                variante="primario"
                cargando={generandoLote}
                disabled={!puedeGenerarExamenes || !plantillaId || (esExtraordinario ? alumnosExtraordinariosSeleccionados.length === 0 : alumnosMateria.length === 0) || (esPeriodoArchivado && !previewExtraordinarioConfirmado)}
                onClick={() => onGenerarExamenesLote(esExtraordinario ? {
                  tipoExamen: 'extraordinario',
                  alumnoIds: alumnosExtraordinariosSeleccionados
                } : undefined)}
              >
                {textoBotonGenerar}
              </Boton>
            )}

            {lotePdfUrl && (
              <Boton
                type="button"
                variante="secundario"
                onClick={descargarPdfLote}
              >
                📥 Descargar paquete PDF generado
              </Boton>
            )}

            {onIrAHistorial && (
              <Boton
                type="button"
                variante="secundario"
                onClick={() => {
                  onIrAHistorial();
                  emitToast({ level: 'info', title: 'Sección', message: 'Mostrando historial de lotes', durationMs: 1800 });
                }}
              >
                📦 Ver historial de lotes
              </Boton>
            )}
          </div>
          <div className="alumnos-form__hint">
            <span>🔒 Cada examen incluye firma criptográfica institucional y códigos de barras ópticos OMR.</span>
          </div>
        </div>

        {mensajeGeneracion && (
          <p className={esMensajeError(mensajeGeneracion) ? 'mensaje error anim-fade-in mt-15' : 'mensaje ok anim-fade-in mt-15'} role="status">
            {mensajeGeneracion}
          </p>
        )}
      </div>
    </section>
  );
}
