/**
 * BancoFormularioPregunta
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { GuiaBancoVisual } from '../../../GuiaBancoVisual';
import type { Periodo, TemaBancoFormState } from './types';
import type { Dispatch, SetStateAction } from 'react';

type Opcion = { texto: string; esCorrecta: boolean };

const LETRAS_OPCIONES = ['A', 'B', 'C', 'D', 'E'];
const COLORES_OPCIONES = [
  'banco-opcion-card--a',
  'banco-opcion-card--b',
  'banco-opcion-card--c',
  'banco-opcion-card--d',
  'banco-opcion-card--e'
];

export function BancoFormularioPregunta({
  periodoId,
  setPeriodoId,
  periodos,
  bloqueoEdicion,
  enunciado,
  setEnunciado,
  imagenUrl,
  setImagenUrl,
  cargarImagenArchivo,
  tema,
  setTema,
  temasBanco,
  cargandoTemas,
  preguntasTemaActualCantidad,
  paginasTemaActual,
  preguntasMateriaCantidad,
  temasBancoCantidad,
  preguntasSinTemaCantidad,
  opciones,
  setOpciones,
  puedeGuardar,
  guardando,
  guardar,
  mensaje,
  esMensajeError,
  editandoId,
  editEnunciado,
  setEditEnunciado,
  editImagenUrl,
  setEditImagenUrl,
  editTema,
  setEditTema,
  editOpciones,
  setEditOpciones,
  puedeGuardarEdicion,
  editando,
  guardarEdicion,
  cancelarEdicion
}: {
  periodoId: string;
  setPeriodoId: (value: string) => void;
  periodos: Periodo[];
  bloqueoEdicion: boolean;
  enunciado: string;
  setEnunciado: (value: string) => void;
  imagenUrl: string;
  setImagenUrl: (value: string) => void;
  cargarImagenArchivo: (file: File | null, setter: (value: string) => void) => void;
  tema: string;
  setTema: (value: string) => void;
  temasBanco: TemaBancoFormState[];
  cargandoTemas: boolean;
  preguntasTemaActualCantidad: number;
  paginasTemaActual: number;
  preguntasMateriaCantidad: number;
  temasBancoCantidad: number;
  preguntasSinTemaCantidad: number;
  opciones: Opcion[];
  setOpciones: Dispatch<SetStateAction<Opcion[]>>;
  puedeGuardar: boolean;
  guardando: boolean;
  guardar: () => Promise<void>;
  mensaje: string;
  esMensajeError: (mensaje: string) => boolean;
  editandoId: string | null;
  editEnunciado: string;
  setEditEnunciado: (value: string) => void;
  editImagenUrl: string;
  setEditImagenUrl: (value: string) => void;
  editTema: string;
  setEditTema: (value: string) => void;
  editOpciones: Opcion[];
  setEditOpciones: Dispatch<SetStateAction<Opcion[]>>;
  puedeGuardarEdicion: boolean;
  editando: boolean;
  guardarEdicion: () => Promise<void>;
  cancelarEdicion: () => void;
}) {
  const nombrePeriodoActivo = periodos.find((p) => p._id === periodoId)?.nombre ?? '';

  const renderOpcionesEditor = ({
    opcionesActuales,
    setOpcionesActuales,
    radioName
  }: {
    opcionesActuales: Opcion[];
    setOpcionesActuales: Dispatch<SetStateAction<Opcion[]>>;
    radioName: string;
  }) => (
    <div className="campo banco-opciones-container">
      <div className="campo__heading">
        <div className="campo__title">Opciones de respuesta (5 reactivos)</div>
        <div className="ayuda">Marca exactamente una opción como respuesta correcta.</div>
      </div>
      <div className="banco-opciones-grid" role="group" aria-label="Opciones de respuesta">
        {opcionesActuales.map((opcion, idx) => {
          const letra = LETRAS_OPCIONES[idx] || String.fromCharCode(65 + idx);
          const claseColor = COLORES_OPCIONES[idx] || 'banco-opcion-card--a';
          const esCorrecta = opcion.esCorrecta;
          const inputId = `banco-opcion-${radioName}-${idx}`;

          return (
            <div
              key={idx}
              className={`banco-opcion-card ${claseColor} ${esCorrecta ? 'banco-opcion-card--selected' : ''}`}
            >
              <div className="banco-opcion-card__letter" aria-hidden="true">
                {letra}
              </div>
              <div className="banco-opcion-card__input-wrap">
                <input
                  id={inputId}
                  value={opcion.texto}
                  onChange={(event) => {
                    const copia = [...opcionesActuales];
                    copia[idx] = { ...copia[idx], texto: event.target.value };
                    setOpcionesActuales(copia);
                  }}
                  aria-label={`Texto opcion ${letra}`}
                  disabled={bloqueoEdicion}
                  placeholder={`Texto opcion ${letra}`}
                  className="banco-opcion-input"
                />
              </div>
              <label htmlFor={`banco-radio-${radioName}-${idx}`} className={`banco-opcion-pill ${esCorrecta ? 'banco-opcion-pill--active' : ''}`}>
                <input
                  id={`banco-radio-${radioName}-${idx}`}
                  type="radio"
                  name={radioName}
                  checked={opcion.esCorrecta}
                  onChange={() =>
                    setOpcionesActuales(opcionesActuales.map((item, index) => ({ ...item, esCorrecta: index === idx })))
                  }
                  disabled={bloqueoEdicion}
                  className="banco-opcion-radio-sr"
                />
                <span className="banco-opcion-pill__indicator" aria-hidden="true">
                  {esCorrecta ? (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </span>
                <span>{esCorrecta ? 'Correcta' : 'Opción'}</span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="banco-form anim-fade-in">
      {/* 1. Bento Hero Header */}
      <div className="banco-panel__head">
        <div className="banco-panel__lead">
          <div className="banco-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div className="banco-panel__text-block">
            <div className="banco-panel__meta-row">
              <span className="banco-status-pill">
                <span className="banco-pulse-dot" aria-hidden="true" />
                <span>Banco de Reactivos Activo</span>
              </span>
              {nombrePeriodoActivo && <span className="banco-counter-tag">{nombrePeriodoActivo}</span>}
            </div>
            <h2 className="banco-panel__title eyebrow">🗃️ Banco de preguntas</h2>
            <p className="nota">Construye, organiza y depura reactivos con una vista de trabajo más editorial y menos fragmentada.</p>
          </div>
        </div>

        {/* Header Mini-KPIs */}
        <div className="banco-header-kpis" aria-live="polite">
          <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Total de preguntas activas en la materia">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </span>
            <span className="banco-mini-kpi__num">{preguntasMateriaCantidad}</span>
            <span className="banco-mini-kpi__lbl">Preguntas</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temas anim-kpi-hover" data-tooltip="Cantidad de temas activos en la materia">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </span>
            <span className="banco-mini-kpi__num">{temasBancoCantidad}</span>
            <span className="banco-mini-kpi__lbl">Temas</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--sintema anim-kpi-hover" data-tooltip="Preguntas sin tema asignado">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </span>
            <span className="banco-mini-kpi__num">{preguntasSinTemaCantidad}</span>
            <span className="banco-mini-kpi__lbl">Sin tema</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Preguntas del tema seleccionado">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span className="banco-mini-kpi__num">{tema.trim() ? preguntasTemaActualCantidad : '-'}</span>
            <span className="banco-mini-kpi__lbl">Tema actual</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--paginas anim-kpi-hover" data-tooltip="Estimación de páginas en el examen impreso">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="16" y2="10" />
              </svg>
            </span>
            <span className="banco-mini-kpi__num">
              {tema.trim() ? `${paginasTemaActual}p` : '-'}
            </span>
            <span className="banco-mini-kpi__lbl">Páginas est.</span>
          </div>
        </div>
      </div>

      {/* 2. Bento Visual Guide */}
      <GuiaBancoVisual />

      {/* 3. Superficie del Formulario de Creación */}
      <section className="banco-form__surface banco-form__surface--main">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Redacción Editorial</span>
            </span>
            <h3>Nueva pregunta</h3>
            <p className="nota">Selecciona materia, tema y redacta el reactivo con sus cinco opciones.</p>
          </div>
        </div>

        {/* Selector de Materia y Tema */}
        <div className="banco-form__grid banco-form__grid--2">
          <div className="campo">
            <label className="campo__label-text" htmlFor="banco-select-materia">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              </svg>
              Materia
            </label>
            <div className="auth-input-box auth-input-box--animated">
              <select
                id="banco-select-materia"
                aria-label="Materia"
                value={periodoId}
                onChange={(event) => setPeriodoId(event.target.value)}
                disabled={bloqueoEdicion}
              >
                <option value="">Selecciona</option>
                {periodos.map((periodo) => (
                  <option key={periodo._id} value={periodo._id}>
                    {periodo.nombre}
                  </option>
                ))}
              </select>
            </div>
            {periodos.length === 0 && <span className="ayuda ayuda--warn">Primero crea una materia para poder agregar preguntas.</span>}
          </div>

          <div className="campo">
            <label className="campo__label-text" htmlFor="banco-select-tema">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
              </svg>
              Tema
            </label>
            <div className="auth-input-box auth-input-box--animated">
              <select
                id="banco-select-tema"
                aria-label="Tema"
                value={tema}
                onChange={(event) => setTema(event.target.value)}
                disabled={bloqueoEdicion}
              >
                <option value="">Selecciona</option>
                {temasBanco.map((t) => (
                  <option key={t._id} value={t.nombre}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            {periodoId && !cargandoTemas && temasBanco.length === 0 && (
              <span className="ayuda ayuda--info">Primero crea un tema (sección “Temas”) para poder asignarlo a preguntas.</span>
            )}
            {tema.trim() && (
              <span className="ayuda ayuda--success">
                En este tema: <b>{preguntasTemaActualCantidad}</b> pregunta(s) · <b>{paginasTemaActual}</b> página(s) estimada(s).
              </span>
            )}
          </div>
        </div>

        {/* Textarea Enunciado */}
        <div className="campo">
          <div className="campo__heading">
            <label className="campo__label-text" htmlFor="banco-textarea-enunciado">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Enunciado
            </label>
            <span className="banco-char-counter">{enunciado.trim().length} caracteres</span>
          </div>
          <div className="auth-input-box auth-input-box--textarea auth-input-box--animated">
            <textarea
              id="banco-textarea-enunciado"
              value={enunciado}
              onChange={(event) => setEnunciado(event.target.value)}
              disabled={bloqueoEdicion}
              placeholder="Redacta una pregunta clara y directa."
              rows={3}
              className="banco-textarea-enunciado"
            />
          </div>
        </div>

        {/* Imagen de Apoyo Opcional */}
        <div className="campo banco-imagen-box">
          <div className="campo__heading">
            <label className="campo__label-text" htmlFor="banco-file-input-crear">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Imagen de apoyo (opcional)
            </label>
            <span className="ayuda">Recomendado máx. 1.5MB (PNG/JPG/WEBP)</span>
          </div>

          <div className="banco-file-upload-card">
            <input
              type="file"
              accept="image/*"
              id="banco-file-input-crear"
              onChange={(event) => cargarImagenArchivo(event.currentTarget.files?.[0] ?? null, setImagenUrl)}
              disabled={bloqueoEdicion}
              className="banco-file-native-input"
            />
            <label htmlFor="banco-file-input-crear" className="banco-file-custom-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>{imagenUrl ? 'Cambiar imagen' : 'Seleccionar imagen del equipo'}</span>
            </label>
          </div>

          {imagenUrl && (
            <div className="banco-imagen-preview-card anim-scale-in">
              <img className="banco-preview-thumb" src={imagenUrl} alt="Imagen de la pregunta" />
              <div className="banco-preview-info">
                <span className="banco-preview-badge">✓ Imagen adjunta</span>
                <Boton type="button" variante="secundario" onClick={() => setImagenUrl('')}>
                  Quitar imagen
                </Boton>
              </div>
            </div>
          )}
        </div>

        {/* Opciones de Respuesta A-E */}
        {renderOpcionesEditor({ opcionesActuales: opciones, setOpcionesActuales: setOpciones, radioName: 'correcta' })}

        {/* Acciones */}
        <div className="acciones banco-form__acciones">
          <Boton
            type="button"
            variante="primario"
            icono={
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            }
            cargando={guardando}
            disabled={!puedeGuardar || bloqueoEdicion}
            onClick={() => void guardar()}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>

        {mensaje && (
          <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
            {mensaje}
          </p>
        )}
      </section>

      {/* 4. Formulario de Edición (cuando editandoId está activo) */}
      {editandoId && (
        <section className="resultado banco-form__surface banco-form__surface--edit anim-scale-in">
          <div className="banco-section-title">
            <div className="banco-section-title__wrap">
              <span className="banco-section-pill banco-section-pill--amber">
                <span className="banco-section-pill__dot" aria-hidden="true" />
                <span>Modo Edición</span>
              </span>
              <h3>Editando pregunta</h3>
              <p className="nota">Ajusta redacción, imagen, tema u opciones sin salir del flujo del banco.</p>
            </div>
          </div>

          <div className="campo">
            <label className="campo__label-text" htmlFor="banco-textarea-edit-enunciado">Enunciado</label>
            <div className="auth-input-box auth-input-box--textarea auth-input-box--animated">
              <textarea
                id="banco-textarea-edit-enunciado"
                value={editEnunciado}
                onChange={(event) => setEditEnunciado(event.target.value)}
                disabled={bloqueoEdicion}
                rows={3}
              />
            </div>
          </div>

          <div className="campo banco-imagen-box">
            <label className="campo__label-text" htmlFor="banco-file-input-editar">Imagen (opcional)</label>
            <div className="banco-file-upload-card">
              <input
                type="file"
                accept="image/*"
                id="banco-file-input-editar"
                onChange={(event) => cargarImagenArchivo(event.currentTarget.files?.[0] ?? null, setEditImagenUrl)}
                disabled={bloqueoEdicion}
                className="banco-file-native-input"
              />
              <label htmlFor="banco-file-input-editar" className="banco-file-custom-btn">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>{editImagenUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}</span>
              </label>
            </div>
            {editImagenUrl && (
              <div className="banco-imagen-preview-card anim-scale-in">
                <img className="banco-preview-thumb" src={editImagenUrl} alt="Imagen de la pregunta" />
                <div className="banco-preview-info">
                  <span className="banco-preview-badge">✓ Imagen adjunta</span>
                  <Boton type="button" variante="secundario" onClick={() => setEditImagenUrl('')}>
                    Quitar imagen
                  </Boton>
                </div>
              </div>
            )}
          </div>

          <div className="campo">
            <label className="campo__label-text" htmlFor="banco-select-edit-tema">Tema</label>
            <div className="auth-input-box auth-input-box--animated">
              <select
                id="banco-select-edit-tema"
                aria-label="Tema"
                value={editTema}
                onChange={(event) => setEditTema(event.target.value)}
                disabled={bloqueoEdicion}
              >
                <option value="">Selecciona</option>
                {editTema.trim() && !temasBanco.some((t) => t.nombre.toLowerCase() === editTema.trim().toLowerCase()) && (
                  <option value={editTema}>{editTema} (no existe)</option>
                )}
                {temasBanco.map((t) => (
                  <option key={t._id} value={t.nombre}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {renderOpcionesEditor({
            opcionesActuales: editOpciones,
            setOpcionesActuales: setEditOpciones,
            radioName: 'correctaEdit'
          })}

          <div className="acciones">
            <Boton
              type="button"
              variante="primario"
              icono={
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              }
              cargando={editando}
              disabled={!puedeGuardarEdicion || bloqueoEdicion}
              onClick={() => void guardarEdicion()}
            >
              {editando ? 'Guardando…' : 'Guardar cambios'}
            </Boton>
            <Boton type="button" variante="secundario" onClick={cancelarEdicion}>
              Cancelar
            </Boton>
          </div>
        </section>
      )}
    </div>
  );
}
