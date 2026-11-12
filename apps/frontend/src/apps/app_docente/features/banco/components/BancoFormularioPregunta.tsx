/**
 * BancoFormularioPregunta
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../../../../ui/ux/componentes/InlineMensaje';
import { BookOpenText, Calculator, Check, CircleAlert, FileText, Image, ListTree, Package, Save, Upload, IconoLucide } from '../../../../../ui/iconosCatalogo';
import { GuiaBancoVisual } from '../../../GuiaBancoVisual';
import { RichTextEditor, textoPlanoRico } from './RichTextEditor';
import type { Periodo, TemaBancoFormState } from './types';
import { useRef } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

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
  navegacionTareas,
  periodoId,
  setPeriodoId,
  periodos,
  bloqueoEdicion,
  mostrarAvisoPermisoGestion,
  enunciado,
  setEnunciado,
  imagenUrl,
  setImagenUrl,
  cargarImagenArchivo,
  tema,
  setTema,
  temaId,
  setTemaId,
  temasBanco,
  cargandoTemas,
  errorCargaTemas,
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
  mensajeEsError,
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
  navegacionTareas?: ReactNode;
  periodoId: string;
  setPeriodoId: (value: string) => void;
  periodos: Periodo[];
  bloqueoEdicion: boolean;
  mostrarAvisoPermisoGestion: boolean;
  enunciado: string;
  setEnunciado: (value: string) => void;
  imagenUrl: string;
  setImagenUrl: (value: string) => void;
  cargarImagenArchivo: (file: File | null, setter: (value: string) => void) => void;
  tema: string;
  setTema: (value: string) => void;
  temaId: string;
  setTemaId: (value: string) => void;
  temasBanco: TemaBancoFormState[];
  cargandoTemas: boolean;
  errorCargaTemas: string;
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
  mensajeEsError: boolean;
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
  const inputImagenCrearRef = useRef<HTMLInputElement>(null);
  const inputImagenEditarRef = useRef<HTMLInputElement>(null);
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
    <fieldset className="campo banco-opciones-container">
      <legend className="campo__title">Opciones de respuesta (A–E)</legend>
      <p className="ayuda">Escribe cinco opciones y marca exactamente una como correcta.</p>
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
                <RichTextEditor
                  id={inputId}
                  value={opcion.texto}
                  onChange={(value) => {
                    const copia = [...opcionesActuales];
                    copia[idx] = { ...copia[idx], texto: value };
                    setOpcionesActuales(copia);
                  }}
                  ariaLabel={`Texto de la opción ${letra}`}
                  disabled={bloqueoEdicion}
                  placeholder={`Texto de la opción ${letra}`}
                  minHeight={54}
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
                  {esCorrecta ? <IconoLucide icon={Check} size={12} /> : null}
                </span>
                <span>{esCorrecta ? 'Correcta' : 'Opción'}</span>
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <div className="banco-form anim-fade-in">
      {/* 1. Bento Hero Header */}
      <div className="banco-panel__head">
        <div className="banco-panel__lead">
          <div className="icono-seccion-orb banco-panel__icon-orb anim-icon-pulse" aria-hidden="true">
            <IconoLucide icon={Package} size={28} />
          </div>
          <div className="banco-panel__text-block">
            <div className="banco-panel__meta-row">
              <span className="banco-status-pill">
                <span className="banco-pulse-dot" aria-hidden="true" />
                <span>Banco de Reactivos Activo</span>
              </span>
              {nombrePeriodoActivo && <span className="banco-counter-tag">{nombrePeriodoActivo}</span>}
            </div>
            <h2 className="banco-panel__title eyebrow">Banco de preguntas</h2>
            <p className="nota">Construye, organiza y depura reactivos con una vista de trabajo más editorial y menos fragmentada.</p>
          </div>
        </div>

        {/* Header Mini-KPIs */}
        <div className="banco-header-kpis">
          <div className="banco-mini-kpi banco-mini-kpi--preguntas anim-kpi-hover" data-tooltip="Total de preguntas activas en la materia">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={FileText} size={16} />
            </span>
            <span className="banco-mini-kpi__num">{preguntasMateriaCantidad}</span>
            <span className="banco-mini-kpi__lbl">Preguntas</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temas anim-kpi-hover" data-tooltip="Cantidad de temas activos en la materia">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={ListTree} size={16} />
            </span>
            <span className="banco-mini-kpi__num">{temasBancoCantidad}</span>
            <span className="banco-mini-kpi__lbl">Temas</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--sintema anim-kpi-hover" data-tooltip="Preguntas sin tema asignado">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={CircleAlert} size={16} />
            </span>
            <span className="banco-mini-kpi__num">{preguntasSinTemaCantidad}</span>
            <span className="banco-mini-kpi__lbl">Sin tema</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--temaactual anim-kpi-hover" data-tooltip="Preguntas del tema seleccionado">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={Check} size={16} />
            </span>
            <span className="banco-mini-kpi__num">{tema.trim() ? preguntasTemaActualCantidad : '-'}</span>
            <span className="banco-mini-kpi__lbl">Tema actual</span>
          </div>

          <div className="banco-mini-kpi banco-mini-kpi--paginas anim-kpi-hover" data-tooltip="Estimación de páginas en el examen impreso">
            <span className="banco-mini-kpi__icon" aria-hidden="true">
              <IconoLucide icon={Calculator} size={16} />
            </span>
            <span className="banco-mini-kpi__num">
              {tema.trim() ? paginasTemaActual : '-'}
            </span>
            <span className="banco-mini-kpi__lbl">Páginas estimadas</span>
          </div>
        </div>
      </div>

      {navegacionTareas}
      {mostrarAvisoPermisoGestion && (
        <InlineMensaje tipo="warning">
          Tu perfil no tiene permiso de gestión para crear o editar preguntas o temas. Solicita ese acceso a quien administra EvaluaPro.
        </InlineMensaje>
      )}

      {/* 2. Bento Visual Guide */}
      <GuiaBancoVisual />

      {/* 3. Superficie del Formulario de Creación */}
      <section id="banco-captura" tabIndex={-1} className="banco-form__surface banco-form__surface--main" aria-labelledby="banco-captura-title">
        <div className="banco-section-title">
          <div className="banco-section-title__wrap">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Captura canónica</span>
            </span>
            <h3 id="banco-captura-title">Nueva pregunta</h3>
            <p className="nota">Captura un reactivo OMR. Se valida, versiona y publica por el mismo flujo seguro que una importación IA.</p>
          </div>
        </div>

        {/* Selector de Materia y Tema */}
        <div className="banco-form__grid banco-form__grid--2">
          <div className="campo">
            <label className="campo__label-text" htmlFor="banco-select-materia">
              <IconoLucide icon={BookOpenText} size={14} />
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
              <IconoLucide icon={ListTree} size={14} />
              Asignar tema al reactivo
            </label>
            <div className="auth-input-box auth-input-box--animated">
              <select
                id="banco-select-tema"
                aria-label="Asignar tema al reactivo"
                value={temaId}
                onChange={(event) => {
                  const nuevoTema = temasBanco.find((item) => item._id === event.target.value);
                  setTemaId(event.target.value);
                  setTema(nuevoTema?.nombre ?? '');
                }}
                disabled={bloqueoEdicion}
              >
                <option value="">Selecciona</option>
                {temasBanco.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            {periodoId && !cargandoTemas && errorCargaTemas && (
              <div>
                <p className="ayuda ayuda--info">No se pudo comprobar la lista de temas.</p>
                <a className="boton secundario" href="#banco-temas">Ir a Temas para reintentar</a>
              </div>
            )}
            {periodoId && !cargandoTemas && !errorCargaTemas && temasBanco.length === 0 && (
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
              <IconoLucide icon={FileText} size={14} />
              Enunciado
            </label>
            <span className="banco-char-counter">{textoPlanoRico(enunciado).length} caracteres · formato enriquecido</span>
          </div>
          <RichTextEditor
              id="banco-textarea-enunciado"
              value={enunciado}
              onChange={setEnunciado}
              disabled={bloqueoEdicion}
              placeholder="Redacta una pregunta clara y directa."
              ariaLabel="Enunciado de la pregunta"
              minHeight={104}
          />
        </div>

        {/* Imagen de Apoyo Opcional */}
        <div className="campo banco-imagen-box">
          <div className="campo__heading">
            <span className="campo__label-text">
              <IconoLucide icon={Image} size={14} />
              Imagen de apoyo (opcional)
            </span>
            <span className="ayuda">Recomendado máx. 1.5MB (PNG/JPG/WEBP)</span>
          </div>

          <div className="banco-file-upload-card">
            <input
              ref={inputImagenCrearRef}
              type="file"
              accept="image/*"
              id="banco-file-input-crear"
              onChange={(event) => cargarImagenArchivo(event.currentTarget.files?.[0] ?? null, setImagenUrl)}
              disabled={bloqueoEdicion}
              className="banco-file-native-input"
              aria-hidden="true"
              tabIndex={-1}
            />
            <Boton
              type="button"
              variante="secundario"
              className="banco-file-custom-btn"
              icono={<IconoLucide icon={Upload} size={16} />}
              aria-label={imagenUrl ? 'Cambiar imagen de apoyo' : 'Seleccionar imagen de apoyo'}
              disabled={bloqueoEdicion}
              onClick={() => inputImagenCrearRef.current?.click()}
            >
              {imagenUrl ? 'Cambiar imagen' : 'Seleccionar imagen del equipo'}
            </Boton>
          </div>

          {imagenUrl && (
            <div className="banco-imagen-preview-card anim-scale-in">
              <img className="banco-preview-thumb" src={imagenUrl} alt="Imagen de la pregunta" />
              <div className="banco-preview-info">
                <span className="banco-preview-badge"><IconoLucide icon={Check} size={14} /> Imagen adjunta</span>
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
              <IconoLucide icon={Save} size={16} />
            }
            cargando={guardando}
            disabled={!puedeGuardar || bloqueoEdicion}
            onClick={() => void guardar()}
          >
            {guardando ? 'Validando…' : 'Validar y guardar borrador'}
          </Boton>
        </div>

        {mensaje && !editandoId && (
          <p className={mensajeEsError ? 'mensaje error' : 'mensaje ok'} role={mensajeEsError ? 'alert' : 'status'}>
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
            <RichTextEditor
                id="banco-textarea-edit-enunciado"
                value={editEnunciado}
                onChange={setEditEnunciado}
                disabled={bloqueoEdicion}
                placeholder="Edita el enunciado de la pregunta."
                ariaLabel="Enunciado de la pregunta en edición"
                minHeight={104}
            />
          </div>

          <div className="campo banco-imagen-box">
            <span className="campo__label-text">Imagen (opcional)</span>
            <div className="banco-file-upload-card">
              <input
                ref={inputImagenEditarRef}
                type="file"
                accept="image/*"
                id="banco-file-input-editar"
                onChange={(event) => cargarImagenArchivo(event.currentTarget.files?.[0] ?? null, setEditImagenUrl)}
                disabled={bloqueoEdicion}
                className="banco-file-native-input"
                aria-hidden="true"
                tabIndex={-1}
              />
              <Boton
                type="button"
                variante="secundario"
                className="banco-file-custom-btn"
                icono={<IconoLucide icon={Upload} size={16} />}
                aria-label={editImagenUrl ? 'Cambiar imagen de la pregunta' : 'Seleccionar imagen de la pregunta'}
                disabled={bloqueoEdicion}
                onClick={() => inputImagenEditarRef.current?.click()}
              >
                {editImagenUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}
              </Boton>
            </div>
            {editImagenUrl && (
              <div className="banco-imagen-preview-card anim-scale-in">
                <img className="banco-preview-thumb" src={editImagenUrl} alt="Imagen de la pregunta" />
                <div className="banco-preview-info">
                  <span className="banco-preview-badge"><IconoLucide icon={Check} size={14} /> Imagen adjunta</span>
                  <Boton type="button" variante="secundario" onClick={() => setEditImagenUrl('')}>
                    Quitar imagen
                  </Boton>
                </div>
              </div>
            )}
          </div>

          <div className="campo">
            <label className="campo__label-text" htmlFor="banco-select-edit-tema">Tema asignado</label>
            <div className="auth-input-box auth-input-box--animated">
              <select
                id="banco-select-edit-tema"
                aria-label="Tema asignado"
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
                <IconoLucide icon={Save} size={16} />
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
          {mensaje && editandoId && (
            <p className={mensajeEsError ? 'mensaje error' : 'mensaje ok'} role={mensajeEsError ? 'alert' : 'status'}>
              {mensaje}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
