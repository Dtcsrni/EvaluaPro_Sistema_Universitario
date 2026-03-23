/**
 * BancoGestionTemas
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Spinner } from '../../../../../ui/iconos';
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
  ajusteProps
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
  return (
    <details
      className="colapsable banco-colapsable banco-colapsable--temas"
      open={temasAbierto}
      onToggle={(event) => setTemasAbierto((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <b>Temas</b>
        {periodoId ? ` (${temasBanco.length})` : ''}
      </summary>
      <div className="banco-colapsable__intro">
        <p className="nota">Agrupa preguntas por unidad temática y corrige densidad antes de generar plantillas o PDFs.</p>
      </div>
      <div className="campo-inline banco-temas__crear">
        <input value={temaNuevo} onChange={(event) => setTemaNuevo(event.target.value)} placeholder="Nuevo tema (ej. Funciones)" aria-label="Nuevo tema" disabled={bloqueoEdicion} />
        <Boton type="button" variante="secundario" cargando={creandoTema} disabled={!periodoId || !temaNuevo.trim() || bloqueoEdicion} onClick={() => void crearTemaBanco()}>Agregar</Boton>
      </div>
      {cargandoTemas && <InlineMensaje tipo="info" leading={<Spinner />}>Cargando temas…</InlineMensaje>}
      <ul className="lista lista-items banco-temas__lista">
        {periodoId && !cargandoTemas && temasBanco.length === 0 && <li>No hay temas. Crea el primero arriba.</li>}
        {temasBanco.map((t) => (
          <li key={t._id}>
            <div className="item-glass banco-temas__item">
              <div className="item-row">
                <div>
                  <div className="item-title">{t.nombre}</div>
                  <div className="item-meta">
                    <span>Preguntas: {conteoPorTema.get(t.nombre) ?? 0}</span>
                    <span>
                      Paginas (estimadas): {paginasPorTema.get(normalizarNombreTema(t.nombre).toLowerCase()) ?? 0}
                      {paginasEstimadasBackendPorTema.has(normalizarNombreTema(t.nombre).toLowerCase()) ? ' (preview)' : ''}
                    </span>
                  </div>
                </div>
                <div className="item-actions">
                  {temaEditandoId === t._id ? (
                    <>
                      <input value={temaEditandoNombre} onChange={(event) => setTemaEditandoNombre(event.target.value)} aria-label="Nombre del tema" />
                      <Boton type="button" variante="secundario" cargando={guardandoTema} disabled={!temaEditandoNombre.trim()} onClick={() => void guardarEdicionTema()}>Guardar</Boton>
                      <Boton type="button" variante="secundario" onClick={cancelarEdicionTema}>Cancelar</Boton>
                    </>
                  ) : (
                    <>
                      <Boton type="button" variante="secundario" onClick={() => abrirAjusteTema(t)} disabled={!temaEditando}>Ajustar paginas</Boton>
                      <Boton type="button" variante="secundario" onClick={() => iniciarEdicionTema(t)} disabled={!temaEditando}>Renombrar</Boton>
                      <Boton type="button" cargando={archivandoTemaId === t._id} onClick={() => void archivarTemaBanco(t)} disabled={!temaEditando}>Archivar</Boton>
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
