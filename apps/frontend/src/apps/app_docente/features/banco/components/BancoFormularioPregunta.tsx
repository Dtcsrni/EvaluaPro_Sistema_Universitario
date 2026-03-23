/**
 * BancoFormularioPregunta
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Icono } from '../../../../../ui/iconos';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { AyudaFormulario } from '../../../AyudaFormulario';
import type { Periodo, TemaBancoFormState } from './types';
import type { Dispatch, SetStateAction } from 'react';

type Opcion = { texto: string; esCorrecta: boolean };

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
  const renderOpcionesEditor = ({
    opcionesActuales,
    setOpcionesActuales,
    radioName
  }: {
    opcionesActuales: Opcion[];
    setOpcionesActuales: Dispatch<SetStateAction<Opcion[]>>;
    radioName: string;
  }) => (
    <div className="campo">
      <div className="campo__heading">
        <div className="campo__title">Opciones de respuesta</div>
        <div className="ayuda">Marca solo una opcion correcta.</div>
      </div>
      <div className="opciones-grid" role="group" aria-label="Opciones de respuesta">
        <div className="opciones-header">Opcion</div>
        <div className="opciones-header">Texto</div>
        <div className="opciones-header">Correcta</div>
        {opcionesActuales.map((opcion, idx) => (
          <div key={idx} className="opcion-fila">
            <div className="opcion-letra">{String.fromCharCode(65 + idx)}</div>
            <input
              value={opcion.texto}
              onChange={(event) => {
                const copia = [...opcionesActuales];
                copia[idx] = { ...copia[idx], texto: event.target.value };
                setOpcionesActuales(copia);
              }}
              aria-label={`Texto opcion ${String.fromCharCode(65 + idx)}`}
              disabled={bloqueoEdicion}
              placeholder={`Texto opcion ${String.fromCharCode(65 + idx)}`}
            />
            <label className="opcion-correcta">
              <input
                type="radio"
                name={radioName}
                checked={opcion.esCorrecta}
                onChange={() =>
                  setOpcionesActuales(opcionesActuales.map((item, index) => ({ ...item, esCorrecta: index === idx })))
                }
                disabled={bloqueoEdicion}
              />
              <span>Correcta</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="banco-form">
      <div className="banco-form__head">
        <div>
          <h2>
            <Icono nombre="banco" /> Banco de preguntas
          </h2>
          <p className="nota">Construye, organiza y depura reactivos con una vista de trabajo más editorial y menos fragmentada.</p>
        </div>
      </div>
      <AyudaFormulario titulo="Para que sirve y como llenarlo">
        <p>
          <b>Proposito:</b> construir el banco de reactivos (preguntas) que despues se usan en plantillas y examenes.
        </p>
        <ul className="lista">
          <li><b>Enunciado:</b> el texto completo de la pregunta.</li>
          <li><b>Tema:</b> unidad/categoria (sirve para organizar).</li>
          <li><b>Opciones A–E:</b> todas deben llevar texto.</li>
          <li><b>Correcta:</b> marca exactamente una.</li>
        </ul>
      </AyudaFormulario>
      <div className="banco-resumen" aria-live="polite">
        <div className="banco-resumen__item" data-tooltip="Total de preguntas activas en la materia seleccionada.">
          <span>Preguntas</span>
          <b>{preguntasMateriaCantidad}</b>
        </div>
        <div className="banco-resumen__item" data-tooltip="Cantidad de temas activos en la materia.">
          <span>Temas</span>
          <b>{temasBancoCantidad}</b>
        </div>
        <div className="banco-resumen__item" data-tooltip="Preguntas sin tema asignado.">
          <span>Sin tema</span>
          <b>{preguntasSinTemaCantidad}</b>
        </div>
        <div className="banco-resumen__item" data-tooltip="Cantidad de preguntas que pertenecen al tema seleccionado.">
          <span>Tema actual</span>
          <b>{tema.trim() ? preguntasTemaActualCantidad : '-'}</b>
        </div>
        <div className="banco-resumen__item" data-tooltip="Estimacion de paginas segun el layout real del PDF.">
          <span>Paginas est.</span>
          <b>{tema.trim() ? paginasTemaActual : '-'}</b>
        </div>
      </div>

      <section className="banco-form__surface banco-form__surface--main">
        <div className="banco-section-title">
          <div>
            <h3>Nueva pregunta</h3>
            <p className="nota">Selecciona materia, tema y redacta el reactivo con sus cinco opciones.</p>
          </div>
        </div>
        <div className="banco-form__grid banco-form__grid--2">
          <label className="campo">
            Materia
            <select value={periodoId} onChange={(event) => setPeriodoId(event.target.value)} disabled={bloqueoEdicion}>
              <option value="">Selecciona</option>
              {periodos.map((periodo) => (
                <option key={periodo._id} value={periodo._id}>
                  {periodo.nombre}
                </option>
              ))}
            </select>
            {periodos.length === 0 && <span className="ayuda">Primero crea una materia para poder agregar preguntas.</span>}
          </label>

          <label className="campo">
            Tema
            <select value={tema} onChange={(event) => setTema(event.target.value)} disabled={bloqueoEdicion}>
              <option value="">Selecciona</option>
              {temasBanco.map((t) => (
                <option key={t._id} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
            </select>
            {periodoId && !cargandoTemas && temasBanco.length === 0 && (
              <span className="ayuda">Primero crea un tema (seccion “Temas”) para poder asignarlo a preguntas.</span>
            )}
            {tema.trim() && (
              <span className="ayuda">
                En este tema: {preguntasTemaActualCantidad} pregunta(s) · {paginasTemaActual} pagina(s) estimada(s).
              </span>
            )}
          </label>
        </div>

        <label className="campo">
          Enunciado
          <textarea
            value={enunciado}
            onChange={(event) => setEnunciado(event.target.value)}
            disabled={bloqueoEdicion}
            placeholder="Redacta una pregunta clara y directa."
          />
          <span className="ayuda">{enunciado.trim().length} caracteres</span>
        </label>

        <label className="campo">
          Imagen de apoyo (opcional)
          <input
            type="file"
            accept="image/*"
            onChange={(event) => cargarImagenArchivo(event.currentTarget.files?.[0] ?? null, setImagenUrl)}
            disabled={bloqueoEdicion}
          />
          {imagenUrl && (
            <div className="imagen-preview">
              <img className="preview" src={imagenUrl} alt="Imagen de la pregunta" />
              <Boton type="button" variante="secundario" onClick={() => setImagenUrl('')}>
                Quitar imagen
              </Boton>
            </div>
          )}
        </label>

        {renderOpcionesEditor({ opcionesActuales: opciones, setOpcionesActuales: setOpciones, radioName: 'correcta' })}

        <div className="acciones banco-form__acciones">
          <Boton
            type="button"
            icono={<Icono nombre="ok" />}
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

      {editandoId && (
        <section className="resultado banco-form__surface banco-form__surface--edit">
          <div className="banco-section-title">
            <div>
              <h3>Editando pregunta</h3>
              <p className="nota">Ajusta redacción, imagen, tema u opciones sin salir del flujo del banco.</p>
            </div>
          </div>
          <label className="campo">
            Enunciado
            <textarea value={editEnunciado} onChange={(event) => setEditEnunciado(event.target.value)} disabled={bloqueoEdicion} />
          </label>
          <label className="campo">
            Imagen (opcional)
            <input
              type="file"
              accept="image/*"
              onChange={(event) => cargarImagenArchivo(event.currentTarget.files?.[0] ?? null, setEditImagenUrl)}
              disabled={bloqueoEdicion}
            />
            {editImagenUrl && (
              <div className="imagen-preview">
                <img className="preview" src={editImagenUrl} alt="Imagen de la pregunta" />
                <Boton type="button" variante="secundario" onClick={() => setEditImagenUrl('')}>
                  Quitar imagen
                </Boton>
              </div>
            )}
          </label>
          <label className="campo">
            Tema
            <select value={editTema} onChange={(event) => setEditTema(event.target.value)} disabled={bloqueoEdicion}>
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
          </label>

          {renderOpcionesEditor({
            opcionesActuales: editOpciones,
            setOpcionesActuales: setEditOpciones,
            radioName: 'correctaEdit'
          })}

          <div className="acciones">
            <Boton
              type="button"
              icono={<Icono nombre="ok" />}
              cargando={editando}
              disabled={!puedeGuardarEdicion || bloqueoEdicion}
              onClick={() => void guardarEdicion()}
            >
              {editando ? 'Guardando…' : 'Guardar cambios'}
            </Boton>
            <Boton type="button" variante="secundario" onClick={cancelarEdicion}>Cancelar</Boton>
          </div>
        </section>
      )}
    </div>
  );
}
