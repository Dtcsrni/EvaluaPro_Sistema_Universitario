/**
 * PlantillasFormulario
 *
 * Responsabilidad: Formulario panorámico Bento para diseño y edición de plantillas de examen OMR.
 */
import { Icono } from '../../../../../ui/iconos';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { esMensajeError, etiquetaMateria, idCortoMateria } from '../../../utilidades';
import type { Periodo, Plantilla } from '../../../tipos';
import type { Dispatch, SetStateAction } from 'react';

type TemaDisponible = { tema: string; total: number };

export function PlantillasFormulario({
  modoEdicion,
  plantillaEditando,
  titulo,
  setTitulo,
  periodoId,
  setPeriodoId,
  periodos,
  bloqueoEdicion,
  temasDisponibles,
  temasSeleccionados,
  setTemasSeleccionados,
  totalDisponiblePorTemas,
  creando,
  puedeCrear,
  crear,
  guardandoPlantilla,
  guardarEdicion,
  cancelarEdicion,
  mensaje
}: {
  modoEdicion: boolean;
  plantillaEditando: Plantilla | null;
  titulo: string;
  setTitulo: (value: string) => void;
  periodoId: string;
  setPeriodoId: (value: string) => void;
  periodos: Periodo[];
  bloqueoEdicion: boolean;
  temasDisponibles: TemaDisponible[];
  temasSeleccionados: string[];
  setTemasSeleccionados: Dispatch<SetStateAction<string[]>>;
  totalDisponiblePorTemas: number;
  creando: boolean;
  puedeCrear: boolean;
  crear: () => void;
  guardandoPlantilla: boolean;
  guardarEdicion: () => Promise<void>;
  cancelarEdicion: () => void;
  mensaje: string;
}) {
  return (
    <section className="alumnos-form alumnos-form--glass alumnos-form--panoramico plantillas-form--panoramico anim-form-card">
      <div className="alumnos-form__header">
        <div className="banco-section-title__wrap">
          <span className="banco-section-pill">
            <span className="banco-section-pill__dot" aria-hidden="true" />
            <span>{modoEdicion ? 'Modo Edición' : 'Maquetación OMR'}</span>
          </span>
          <h3 className="alumnos-form__title">
            {modoEdicion ? 'Edición de plantilla' : 'Diseño de plantilla'}
          </h3>
          <p className="alumnos-form__subtitle">
            Configura la estructura del examen por materia y temas antes de pasar a previsualización o generación.
          </p>
        </div>
      </div>

      <div className="ayuda plantillas-panel__hint">
        {modoEdicion && plantillaEditando ? (
          <>
            Editando: <b>{plantillaEditando.titulo}</b> (ID: {idCortoMateria(plantillaEditando._id)})
          </>
        ) : (
          'Crea plantillas por temas, o edita una existente.'
        )}
      </div>

      <div className="alumnos-form__fields">
        {/* Fila 1: Título y Materia */}
        <div className="alumnos-form__row alumnos-form__row--top">
          <label className="campo campo--titulo">
            <span className="campo__label-row">
              <span>Titulo</span>
            </span>
            <div className="auth-input-box auth-input-box--id auth-input-box--animated">
              <input
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                disabled={bloqueoEdicion}
                placeholder="Ej. Parcial 1 - Álgebra"
                data-tooltip="Nombre visible de la plantilla."
              />
            </div>
            <span className="ayuda">Nombre representativo para el examen.</span>
          </label>

          <label className="campo campo--materia">
            <span className="campo__label-row">
              <span>Materia</span>
            </span>
            <div className="auth-input-box auth-input-box--select auth-input-box--animated">
              <select
                value={periodoId}
                onChange={(event) => setPeriodoId(event.target.value)}
                disabled={bloqueoEdicion}
                data-tooltip="Materia a la que pertenece la plantilla."
              >
                <option value="">Selecciona</option>
                {periodos.map((periodo) => (
                  <option key={periodo._id} value={periodo._id} title={periodo._id}>
                    {etiquetaMateria(periodo)}
                  </option>
                ))}
              </select>
            </div>
            <span className="ayuda">Asignatura académica asociada.</span>
          </label>
        </div>

        {/* Fila 2: Matriz de Temas */}
        <div className="plantillas-temas-box">
          <div className="plantillas-temas__header">
            <div>
              <h4 className="plantillas-temas__title">Temas de la plantilla</h4>
              <p className="nota">Selecciona las unidades que alimentarán la composición del examen.</p>
            </div>
            <div className="plantillas-temas__stats">
              <span className="banco-tag-preguntas">Seleccionados: {temasSeleccionados.length}</span>
              <span className="banco-tag-paginas">Disponibles: {temasDisponibles.length}</span>
            </div>
          </div>

          {periodoId && temasDisponibles.length === 0 && (
            <div className="ayuda ayuda--warn mt-10">
              ⚠️ Esta materia no tiene temas con preguntas en el banco. Agrega preguntas en la sección “Banco”.
            </div>
          )}

          <div className="plantillas-temas__lista" role="group" aria-label="Temas disponibles">
            {temasDisponibles.map((td) => {
              const seleccionado = temasSeleccionados.includes(td.tema);
              return (
                <button
                  key={td.tema}
                  type="button"
                  className={`plantillas-tema-chip ${seleccionado ? 'plantillas-tema-chip--selected' : ''}`}
                  onClick={() => {
                    if (bloqueoEdicion) return;
                    setTemasSeleccionados((prev) =>
                      prev.includes(td.tema) ? prev.filter((t) => t !== td.tema) : [...prev, td.tema]
                    );
                  }}
                  disabled={bloqueoEdicion}
                >
                  <span className="plantillas-tema-chip__dot" aria-hidden="true" />
                  <span className="plantillas-tema-chip__nombre">{td.tema}</span>
                  <span className="plantillas-tema-chip__count">{td.total} reactivos</span>
                </button>
              );
            })}
          </div>

          {temasSeleccionados.length > 0 && (
            <div className="plantillas-temas__resumen">
              <span>Reactivos disponibles en temas seleccionados: <b>{totalDisponiblePorTemas}</b></span>
            </div>
          )}
        </div>

        {/* Footer con Botones y Ayuda */}
        <div className="alumnos-form__footer">
          <div className="acciones alumnos-form__actions">
            {modoEdicion ? (
              <>
                <Boton
                  type="button"
                  variante="primario"
                  icono={<Icono nombre="ok" />}
                  cargando={guardandoPlantilla}
                  disabled={!titulo.trim() || !periodoId || temasSeleccionados.length === 0 || bloqueoEdicion}
                  onClick={() => void guardarEdicion()}
                >
                  {guardandoPlantilla ? 'Guardando…' : 'Guardar cambios'}
                </Boton>
                <Boton type="button" variante="secundario" onClick={cancelarEdicion}>
                  Cancelar
                </Boton>
              </>
            ) : (
              <Boton
                type="button"
                variante="primario"
                icono={<Icono nombre="ok" />}
                cargando={creando}
                disabled={!puedeCrear || bloqueoEdicion}
                onClick={crear}
              >
                {creando ? 'Creando…' : 'Crear plantilla'}
              </Boton>
            )}
          </div>
          <div className="alumnos-form__hint">
            <span>💡 Las plantillas definen la composición y el formato óptico para la generación y calificación OMR.</span>
          </div>
        </div>

        {mensaje && (
          <p className={esMensajeError(mensaje) ? 'mensaje error anim-fade-in' : 'mensaje ok anim-fade-in'} role="status">
            {mensaje}
          </p>
        )}
      </div>
    </section>
  );
}
