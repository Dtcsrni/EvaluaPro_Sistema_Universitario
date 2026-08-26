/**
 * PlantillasFormulario
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
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
    <div className="subpanel plantillas-panel plantillas-panel--form anim-fade-in">
      <div className="banco-section-title">
        <div className="banco-section-title__wrap">
          <span className="banco-section-pill">
            <span className="banco-section-pill__dot" aria-hidden="true" />
            <span>{modoEdicion ? 'Modo Edición' : 'Maquetación OMR'}</span>
          </span>
          <h3>{modoEdicion ? 'Edición de plantilla' : 'Diseño de plantilla'}</h3>
          <p className="nota">Configura la estructura del examen por materia y temas antes de pasar a previsualización o generación.</p>
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

      <div className="plantillas-form-wrap">
        <div className="plantillas-form">
          <label className="campo">
            Titulo
            <input
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              disabled={bloqueoEdicion}
              placeholder="Ej. Parcial 1 - Álgebra"
              data-tooltip="Nombre visible de la plantilla."
            />
          </label>

          <label className="campo">
            Materia
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
          </label>
        </div>

        <div className="plantillas-temas">
          <div className="plantillas-temas__header">
            <div>
              <h4>Temas de la plantilla</h4>
              <p className="nota">Selecciona las unidades que alimentarán la composición del examen.</p>
            </div>
            <div className="plantillas-temas__stats">
              <span className="banco-tag-preguntas">Seleccionados: {temasSeleccionados.length}</span>
              <span className="banco-tag-paginas">Disponibles: {temasDisponibles.length}</span>
            </div>
          </div>

          {periodoId && temasDisponibles.length === 0 && (
            <span className="ayuda ayuda--warn">Esta materia no tiene temas con preguntas. Agrega preguntas en “Banco”.</span>
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
                  <span className="plantillas-tema-chip__count">{td.total}</span>
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

        <div className="acciones plantillas-form__acciones">
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

        {mensaje && (
          <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
            {mensaje}
          </p>
        )}
      </div>
    </div>
  );
}
