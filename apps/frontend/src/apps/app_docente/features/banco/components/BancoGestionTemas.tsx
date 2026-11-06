/**
 * BancoGestionTemas
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Spinner } from '../../../../../ui/iconos';
import { ListTree, IconoLucide } from '../../../../../ui/iconosCatalogo';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../../../../ui/ux/componentes/InlineMensaje';
import { normalizarNombreTema, type TemaBanco } from '../../../SeccionBanco.helpers';
import { BancoAjustePreguntas } from './BancoAjustePreguntas';
import type { Pregunta } from '../../../tipos';

export function BancoGestionTemas({
  periodoId,
  temasAbierto,
  setTemasAbierto,
  temasBanco,
  temaNuevo,
  setTemaNuevo,
  creandoTema,
  bloqueoEdicion,
  crearTemaBanco,
  cargandoTemas,
  errorCargaTemas,
  onReintentarCargaTemas,
  conteoPorTema,
  paginasPorTema,
  paginasEstimadasBackendPorTema,
  temaEditandoId,
  temaEditandoNombre,
  setTemaEditandoNombre,
  guardandoTema,
  iniciarEdicionTema,
  guardarEdicionTema,
  cancelarEdicionTema,
  abrirAjusteTema,
  temaEditando,
  archivandoTemaId,
  archivarTemaBanco,
  ajusteProps,
  cargandoPreguntas = false,
  errorCargaPreguntas = false,
  hayPreguntasPrevias = false
}: {
  periodoId: string;
  temasAbierto: boolean;
  setTemasAbierto: (value: boolean) => void;
  temasBanco: TemaBanco[];
  temaNuevo: string;
  setTemaNuevo: (value: string) => void;
  creandoTema: boolean;
  bloqueoEdicion: boolean;
  crearTemaBanco: () => Promise<void>;
  cargandoTemas: boolean;
  errorCargaTemas: string;
  onReintentarCargaTemas: () => void;
  conteoPorTema: Map<string, number>;
  paginasPorTema: Map<string, number>;
  paginasEstimadasBackendPorTema: Map<string, number>;
  temaEditandoId: string | null;
  temaEditandoNombre: string;
  setTemaEditandoNombre: (value: string) => void;
  guardandoTema: boolean;
  iniciarEdicionTema: (item: TemaBanco) => void;
  guardarEdicionTema: () => Promise<void>;
  cancelarEdicionTema: () => void;
  abrirAjusteTema: (tema: TemaBanco) => void;
  temaEditando: boolean;
  archivandoTemaId: string | null;
  archivarTemaBanco: (item: TemaBanco) => Promise<void>;
  cargandoPreguntas?: boolean;
  errorCargaPreguntas?: boolean;
  hayPreguntasPrevias?: boolean;
  ajusteProps: {
    ajusteTemaId: string | null;
    ajustePaginasObjetivo: number;
    setAjustePaginasObjetivo: (value: number) => void;
    ajusteAccion: 'mover' | 'quitar';
    setAjusteAccion: (value: 'mover' | 'quitar') => void;
    ajusteTemaDestinoId: string;
    setAjusteTemaDestinoId: (value: string) => void;
    ajusteSeleccion: Set<string>;
    setAjusteSeleccion: (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
    preguntasPorTemaId: Map<string, Pregunta[]>;
    sugerirPreguntasARecortar: (preguntasTema: Pregunta[], paginasObjetivo: number) => string[];
    estimarAltoPregunta: (pregunta: Pregunta) => number;
    cerrarAjusteTema: () => void;
    aplicarAjusteTema: () => Promise<void>;
    moviendoTema: boolean;
    sinTemaDestinoId: string;
    setSinTemaDestinoId: (value: string) => void;
    preguntasSinTema: Pregunta[];
    sinTemaSeleccion: Set<string>;
    setSinTemaSeleccion: (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
    moviendoSinTema: boolean;
    asignarSinTemaATema: () => Promise<void>;
  };
}) {
  const etiquetaConteoPreguntas = (tema: string) => {
    const total = conteoPorTema.get(tema) ?? 0;
    if (cargandoPreguntas) {
      return hayPreguntasPrevias ? `Preguntas (última carga): ${total}` : 'Preguntas: Cargando…';
    }
    if (errorCargaPreguntas) {
      return hayPreguntasPrevias ? `Preguntas (última carga): ${total}` : 'Preguntas: No disponible';
    }
    return `Preguntas: ${total}`;
  };

  return (
    <details
      id="banco-temas"
      tabIndex={-1}
      className="colapsable banco-colapsable banco-colapsable--temas"
      open={temasAbierto}
      onToggle={(event) => setTemasAbierto((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="banco-temas-summary">
        <div className="banco-temas-summary__left">
          <span className="banco-temas-summary__icon" aria-hidden="true">
            <IconoLucide icon={ListTree} size={16} />
          </span>
          <b>Temas</b>
          {periodoId ? <span className="banco-badge-count">({temasBanco.length})</span> : ''}
        </div>
      </summary>
      <div className="banco-colapsable__intro">
        <p className="nota">Agrupa preguntas por unidad temática y corrige densidad antes de generar plantillas o PDFs.</p>
      </div>

      <div className="campo-inline banco-temas__crear">
        <label className="campo banco-temas__campo" htmlFor="banco-tema-nuevo">
          <span className="campo__label-text">Nombre del tema nuevo</span>
          <input
            id="banco-tema-nuevo"
            value={temaNuevo}
            onChange={(event) => setTemaNuevo(event.target.value)}
            placeholder="Ejemplo: Funciones"
            disabled={bloqueoEdicion}
            className="banco-tema-input-nuevo"
          />
        </label>
        <Boton
          type="button"
          variante="secundario"
          cargando={creandoTema}
          disabled={!periodoId || !temaNuevo.trim() || bloqueoEdicion}
          onClick={() => void crearTemaBanco()}
        >
          Agregar tema
        </Boton>
      </div>

      {cargandoTemas && <InlineMensaje tipo="info" leading={<Spinner />}>Cargando temas…</InlineMensaje>}
      {!cargandoTemas && errorCargaTemas && (
        <div className="banco-temas__error-recuperable">
          <InlineMensaje tipo="error">No se pudieron cargar los temas: {errorCargaTemas}</InlineMensaje>
          {temasBanco.length > 0 && (
            <p className="nota" role="note">Se conservan los temas de la última consulta de esta materia; no fue posible comprobar si siguen actualizados.</p>
          )}
          <Boton type="button" variante="secundario" onClick={onReintentarCargaTemas}>Reintentar carga de temas</Boton>
        </div>
      )}

      <ul className="lista lista-items banco-temas__lista">
        {periodoId && !cargandoTemas && !errorCargaTemas && temasBanco.length === 0 && (
          <li className="banco-empty-state">No hay temas. Crea el primero arriba.</li>
        )}
        {temasBanco.map((t) => (
          <li key={t._id}>
            <div className="item-glass banco-temas__item anim-card-hover">
              <div className="item-row">
                <div className="banco-tema-info">
                  <div className="item-title">{t.nombre}</div>
                  <div className="item-meta banco-tema-meta">
                    <span className="banco-tag-preguntas">{etiquetaConteoPreguntas(t.nombre)}</span>
                    <span className="banco-tag-paginas">
                      Páginas estimadas: {paginasPorTema.get(normalizarNombreTema(t.nombre).toLowerCase()) ?? 0}
                      {paginasEstimadasBackendPorTema.has(normalizarNombreTema(t.nombre).toLowerCase()) ? ' · cálculo del servidor' : ''}
                    </span>
                  </div>
                </div>
                <div className="item-actions banco-tema-actions">
                  {temaEditandoId === t._id ? (
                    <div className="banco-tema-edit-inline">
                      <input
                        value={temaEditandoNombre}
                        onChange={(event) => setTemaEditandoNombre(event.target.value)}
                        aria-label="Nombre del tema"
                        className="banco-tema-edit-input"
                      />
                      <Boton
                        type="button"
                        variante="secundario"
                        cargando={guardandoTema}
                        disabled={!temaEditandoNombre.trim()}
                        onClick={() => void guardarEdicionTema()}
                      >
                        Guardar
                      </Boton>
                      <Boton type="button" variante="secundario" onClick={cancelarEdicionTema}>
                        Cancelar
                      </Boton>
                    </div>
                  ) : (
                    <>
                      <Boton type="button" variante="secundario" onClick={() => abrirAjusteTema(t)} disabled={!temaEditando}>
                        Ajustar páginas
                      </Boton>
                      <Boton type="button" variante="secundario" onClick={() => iniciarEdicionTema(t)} disabled={!temaEditando}>
                        Renombrar
                      </Boton>
                      <Boton
                        type="button"
                        cargando={archivandoTemaId === t._id}
                        onClick={() => void archivarTemaBanco(t)}
                        disabled={!temaEditando}
                      >
                        Archivar
                      </Boton>
                    </>
                  )}
                </div>
              </div>
              <BancoAjustePreguntas
                tema={t}
                temasBanco={temasBanco}
                ajusteTemaId={ajusteProps.ajusteTemaId}
                ajustePaginasObjetivo={ajusteProps.ajustePaginasObjetivo}
                setAjustePaginasObjetivo={ajusteProps.setAjustePaginasObjetivo}
                ajusteAccion={ajusteProps.ajusteAccion}
                setAjusteAccion={ajusteProps.setAjusteAccion}
                ajusteTemaDestinoId={ajusteProps.ajusteTemaDestinoId}
                setAjusteTemaDestinoId={ajusteProps.setAjusteTemaDestinoId}
                ajusteSeleccion={ajusteProps.ajusteSeleccion}
                setAjusteSeleccion={ajusteProps.setAjusteSeleccion}
                preguntasPorTemaId={ajusteProps.preguntasPorTemaId}
                paginasPorTema={paginasPorTema}
                sugerirPreguntasARecortar={ajusteProps.sugerirPreguntasARecortar}
                estimarAltoPregunta={ajusteProps.estimarAltoPregunta}
                cerrarAjusteTema={ajusteProps.cerrarAjusteTema}
                aplicarAjusteTema={ajusteProps.aplicarAjusteTema}
                moviendoTema={ajusteProps.moviendoTema}
                sinTemaDestinoId={ajusteProps.sinTemaDestinoId}
                setSinTemaDestinoId={ajusteProps.setSinTemaDestinoId}
                preguntasSinTema={ajusteProps.preguntasSinTema}
                sinTemaSeleccion={ajusteProps.sinTemaSeleccion}
                setSinTemaSeleccion={ajusteProps.setSinTemaSeleccion}
                moviendoSinTema={ajusteProps.moviendoSinTema}
                asignarSinTemaATema={ajusteProps.asignarSinTemaATema}
              />
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
