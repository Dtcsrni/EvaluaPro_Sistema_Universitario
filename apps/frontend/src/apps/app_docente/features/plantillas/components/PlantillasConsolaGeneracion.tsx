/**
 * PlantillasConsolaGeneracion
 *
 * Responsabilidad: Consola de producción OMR para generación de exámenes masivos e individuales.
 */
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { useState } from 'react';
import type { Alumno, Plantilla } from '../../../tipos';
import { esMensajeError, idCortoMateria } from '../../../utilidades';

type ProgresoLoteGeneracion = {
  loteId: string;
  totalEsperado: number;
  generados: number;
  porcentaje: number;
  completado: boolean;
  estado: 'iniciando' | 'generando' | 'completado';
};

export function PlantillasConsolaGeneracion({
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
  progresoLoteGeneracion,
  onIrAHistorial
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
  progresoLoteGeneracion: ProgresoLoteGeneracion | null;
  onIrAHistorial?: () => void;
}) {
  const [modoGeneracion, setModoGeneracion] = useState<'lote' | 'individual'>('lote');
  const listaPlantillas = Array.isArray(plantillas) ? plantillas : [];
  const listaAlumnos = Array.isArray(alumnos) ? alumnos : [];

  const alumnosMateria = plantillaSeleccionada
    ? listaAlumnos.filter((a) => a.periodoId === plantillaSeleccionada.periodoId)
    : listaAlumnos;

  const textoBotonGenerar =
    modoGeneracion === 'individual'
      ? generando
        ? 'Generando examen…'
        : 'Generar examen individual de muestra'
      : generandoLote
        ? 'Generando paquete masivo…'
        : `Generar paquete de exámenes (${alumnosMateria.length} alumnos)`;

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
                {listaPlantillas.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.titulo} (ID: {idCortoMateria(p._id)})
                  </option>
                ))}
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
              onClick={() => setModoGeneracion('lote')}
              disabled={!puedeGenerarExamenes}
            >
              📦 Paquete Masivo por Grupo ({alumnosMateria.length} alumnos)
            </button>
            <button
              type="button"
              className={`boton ${modoGeneracion === 'individual' ? 'boton--primario' : 'boton--secundario'}`}
              onClick={() => setModoGeneracion('individual')}
              disabled={!puedeGenerarExamenes}
            >
              📄 Examen Individual de Muestra
            </button>
          </div>

          {modoGeneracion === 'lote' && (
            <div className="ayuda mt-10">
              💡 Se generará un examen con código QR personalizado y folio único para cada uno de los <b>{alumnosMateria.length} alumnos</b> inscritos en esta materia.
            </div>
          )}
        </div>

        {/* Barra de Progreso si está en curso */}
        {progresoLoteGeneracion && !progresoLoteGeneracion.completado && (
          <div className="progreso-lote-card anim-fade-in mt-15">
            <div className="progreso-lote-card__header">
              <span>⚡ Generando paquete masivo en el servidor...</span>
              <span><b>{progresoLoteGeneracion.generados}</b> / {progresoLoteGeneracion.totalEsperado} ({progresoLoteGeneracion.porcentaje}%)</span>
            </div>
            <div className="progreso-lote-card__track">
              <div
                className="progreso-lote-card__bar"
                data-pct={progresoLoteGeneracion.porcentaje}
              />
            </div>
          </div>
        )}

        {/* Acciones de Generación */}
        <div className="alumnos-form__footer mt-20">
          <div className="acciones alumnos-form__actions">
            {modoGeneracion === 'individual' ? (
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
                disabled={!puedeGenerarExamenes || !plantillaId || alumnosMateria.length === 0}
                onClick={onGenerarExamenesLote}
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
                onClick={onIrAHistorial}
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
