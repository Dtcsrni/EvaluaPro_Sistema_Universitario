/**
 * PlantillasFormulario
 *
 * Responsabilidad: Formulario panorámico Bento para diseño y edición de plantillas de examen OMR.
 */
import { Icono } from '../../../../../ui/iconos';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { emitToast } from '../../../../../ui/toast/toastBus';
import { esMensajeError, etiquetaMateria, idCortoMateria } from '../../../utilidades';
import type { Periodo, Plantilla } from '../../../tipos';
import type { Dispatch, SetStateAction } from 'react';
import {
  calcularEstimacionDensidadPlantilla,
  MIN_FONT_SCALE_LEGIBLE,
  textoEstimacionDensidadPlantilla
} from '../hooks/estimadorDensidadPlantilla';
import { OMR_CANONICAL_DISPLAY_LABEL } from '../../../../../ui/version/versionInfo';

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
  numeroPaginas,
  setNumeroPaginas,
  reactivosObjetivo,
  setReactivosObjetivo,
  logoIzquierda,
  logoDerecha,
  seleccionarLogo,
  fontScale,
  setFontScale,
  lineSpacing,
  setLineSpacing,
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
  numeroPaginas: number;
  setNumeroPaginas: (value: number) => void;
  reactivosObjetivo: number;
  setReactivosObjetivo: (value: number) => void;
  logoIzquierda: string;
  logoDerecha: string;
  seleccionarLogo: (lado: 'izquierda' | 'derecha', archivo: File | undefined) => void;
  fontScale: number;
  setFontScale: (value: number) => void;
  lineSpacing: number;
  setLineSpacing: (value: number) => void;
  creando: boolean;
  puedeCrear: boolean;
  crear: () => void;
  guardandoPlantilla: boolean;
  guardarEdicion: () => Promise<void>;
  cancelarEdicion: () => void;
  mensaje: string;
}) {
  const totalReactivosEstimados = totalDisponiblePorTemas > 0
    ? Math.min(Math.max(1, Math.floor(reactivosObjetivo || 0)), totalDisponiblePorTemas)
    : 0;
  const estimacionDensidad = calcularEstimacionDensidadPlantilla({
    totalReactivos: totalReactivosEstimados,
    paginasConfiguradas: numeroPaginas,
    temasSeleccionados: temasSeleccionados.length,
    fontScale,
    lineSpacing
  });
  const maxReactivos = Math.min(200, Math.max(1, totalDisponiblePorTemas));
  const reactivosSugeridos = totalDisponiblePorTemas > 0
    ? Math.min(maxReactivos, Math.max(1, numeroPaginas * estimacionDensidad.capacidadBasePorPagina))
    : 0;
  const reactivosConfigurados = totalDisponiblePorTemas > 0
    ? Math.min(maxReactivos, Math.max(1, Math.floor(reactivosObjetivo || 1)))
    : 0;
  const ajustarReactivos = (delta: number) => {
    if (bloqueoEdicion || totalDisponiblePorTemas <= 0) return;
    const siguiente = Math.min(maxReactivos, Math.max(1, reactivosConfigurados + delta));
    setReactivosObjetivo(siguiente);
    emitToast({
      level: 'info',
      title: 'Preguntas',
      message: `Cantidad ajustada a ${siguiente} reactivos`,
      durationMs: 1400
    });
  };

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
        <div className="plantillas-panel__meta" aria-label="Contrato OMR activo">
          <span className="version-env-badge">{OMR_CANONICAL_DISPLAY_LABEL}</span>
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
                onChange={(event) => {
                  setPeriodoId(event.target.value);
                  setTemasSeleccionados([]);
                }}
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
        <div className={`plantillas-temas-box ${temasDisponibles.length === 0 ? 'plantillas-temas-box--empty' : ''}`}>
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
                    const estabaSeleccionado = temasSeleccionados.includes(td.tema);
                    setTemasSeleccionados((prev) =>
                      prev.includes(td.tema) ? prev.filter((t) => t !== td.tema) : [...prev, td.tema]
                    );
                    emitToast({
                      level: 'info',
                      title: 'Temas',
                      message: estabaSeleccionado ? `Tema retirado: ${td.tema}` : `Tema agregado: ${td.tema}`,
                      durationMs: 1600
                    });
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

          {temasDisponibles.length === 0 && (
            <div className="plantillas-temas-empty" role="status">
              <span className="plantillas-temas-empty__icon" aria-hidden="true">{periodoId ? '!' : '2'}</span>
              <div>
                <b>{periodoId ? 'Aún no hay temas disponibles' : 'Selecciona una materia para comenzar'}</b>
                <p>{periodoId
                  ? 'Agrega preguntas clasificadas en Banco para habilitar la selección.'
                  : 'Los temas se cargarán aquí y podrás elegir cuáles alimentan el examen.'}</p>
              </div>
            </div>
          )}

          {temasSeleccionados.length > 0 && (
            <div className="plantillas-temas__resumen">
              <span>Reactivos disponibles en temas seleccionados: <b>{totalDisponiblePorTemas}</b></span>
            </div>
          )}
        </div>

        <div className="plantillas-formato-box" aria-label="Formato de impresión">
          <div className="plantillas-formato-box__heading">
            <div>
              <span className="plantillas-formato-box__eyebrow">Formato de impresión</span>
              <h4 className="plantillas-temas__title">Legibilidad y densidad</h4>
              <p className="nota">Ajusta la lectura sin perder el orden de preguntas ni la precisión OMR.</p>
            </div>
            <span className="plantillas-formato-box__badge">
              {textoEstimacionDensidadPlantilla(estimacionDensidad)}
            </span>
          </div>
          <div className="plantillas-formato-box__controls">
            <label className="campo plantillas-formato-control">
              <span className="campo__label-row"><span>Páginas configuradas</span><b>{numeroPaginas}</b></span>
              <input
                type="number"
                min={1}
                max={50}
                step={1}
                value={numeroPaginas}
                onChange={(event) => {
                  const valor = Number(event.target.value);
                  if (Number.isFinite(valor)) setNumeroPaginas(Math.min(50, Math.max(1, Math.floor(valor))));
                }}
                disabled={bloqueoEdicion}
                aria-label="Cantidad de páginas"
              />
              <span className="ayuda">Define cuántas páginas debe ocupar aproximadamente el cuadernillo.</span>
            </label>
            <div className="campo plantillas-formato-control" aria-label="Cantidad de preguntas">
              <span className="campo__label-row"><span>Preguntas del examen</span><b>{reactivosConfigurados}</b></span>
              <div className="plantillas-stepper">
                <button type="button" className="plantillas-stepper__button" onClick={() => ajustarReactivos(-1)} disabled={bloqueoEdicion || totalDisponiblePorTemas <= 0 || reactivosConfigurados <= 1} aria-label="Quitar una pregunta">−</button>
                <input
                  type="number"
                  min={1}
                  max={maxReactivos}
                  step={1}
                  value={totalDisponiblePorTemas > 0 ? reactivosObjetivo : ''}
                  onChange={(event) => {
                    const valor = Number(event.target.value);
                    if (Number.isFinite(valor)) setReactivosObjetivo(Math.min(maxReactivos, Math.max(1, Math.floor(valor))));
                  }}
                  disabled={bloqueoEdicion || totalDisponiblePorTemas <= 0}
                  aria-label="Preguntas del examen"
                />
                <button type="button" className="plantillas-stepper__button" onClick={() => ajustarReactivos(1)} disabled={bloqueoEdicion || totalDisponiblePorTemas <= 0 || reactivosConfigurados >= maxReactivos} aria-label="Agregar una pregunta">+</button>
              </div>
              <span className="ayuda">{totalDisponiblePorTemas > 0 ? `Agrega o quita reactivos. Disponibles: ${totalDisponiblePorTemas}. Sugerido: ${reactivosSugeridos}.` : 'Selecciona al menos un tema para habilitar este control.'}</span>
            </div>
            <label className="campo plantillas-formato-control">
              <span className="campo__label-row"><span>Tamaño de fuente</span><b>{Math.round(fontScale * 100)}%</b></span>
              <select
                value={fontScale}
                onChange={(event) => setFontScale(Number(event.target.value))}
                disabled={bloqueoEdicion}
                aria-label="Tamaño de fuente"
              >
                <option value={String(MIN_FONT_SCALE_LEGIBLE)}>Compacta legible (90%)</option>
                <option value="1">Normal (100%)</option>
                <option value="1.1">Grande (110%)</option>
                <option value="1.2">Muy grande (120%)</option>
              </select>
              <span className="ayuda">Se aplica al encabezado, preguntas y opciones.</span>
            </label>
            <label className="campo plantillas-formato-control">
              <span className="campo__label-row"><span>Espaciado de línea</span><b>{lineSpacing.toFixed(1)}×</b></span>
              <select
                value={lineSpacing}
                onChange={(event) => setLineSpacing(Number(event.target.value))}
                disabled={bloqueoEdicion}
                aria-label="Espaciado de línea"
              >
                <option value="1">Compacto (1.0×)</option>
                <option value="1.1">Equilibrado (1.1×)</option>
                <option value="1.2">Amplio (1.2×)</option>
              </select>
              <span className="ayuda">El motor revalida cada bloque antes de dibujarlo.</span>
            </label>
          </div>
          <div className="plantillas-formato-box__footer">
            <span>Estimación orientativa según reactivos, temas, páginas y densidad; el PDF se vuelve a validar al renderizar.</span>
            <span className="plantillas-formato-box__omr">✓ Panel OMR reservado</span>
          </div>
          <div className="plantillas-formato-box__logos" aria-label="Imágenes del encabezado">
            <div>
              <span className="plantillas-formato-box__eyebrow">Identidad visual</span>
              <p className="nota">Carga dos logos o imágenes ilustrativas. Se conservarán en los espacios laterales del encabezado.</p>
            </div>
            <label className="campo plantillas-formato-control">
              <span className="campo__label-row"><span>Imagen izquierda</span><b>{logoIzquierda ? 'Cargada' : 'Ilustrativa'}</b></span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => seleccionarLogo('izquierda', event.target.files?.[0])} disabled={bloqueoEdicion} aria-label="Cargar imagen izquierda" />
              <span className="ayuda">PNG, JPG o WebP · máximo 2 MB.</span>
            </label>
            <label className="campo plantillas-formato-control">
              <span className="campo__label-row"><span>Imagen derecha</span><b>{logoDerecha ? 'Cargada' : 'Ilustrativa'}</b></span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => seleccionarLogo('derecha', event.target.files?.[0])} disabled={bloqueoEdicion} aria-label="Cargar imagen derecha" />
              <span className="ayuda">PNG, JPG o WebP · máximo 2 MB.</span>
            </label>
          </div>
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
