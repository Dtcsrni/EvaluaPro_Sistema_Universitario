/**
 * BancoAjustePreguntas
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { Icono } from '../../../../../ui/iconos';
import { obtenerVersionPregunta } from '../../../utilidades';
import { estimarPaginasParaPreguntas, normalizarNombreTema, type TemaBanco } from '../../../SeccionBanco.helpers';
import type { Pregunta } from '../../../tipos';

export function BancoAjustePreguntas({
  tema,
  temasBanco,
  ajusteTemaId,
  ajustePaginasObjetivo,
  setAjustePaginasObjetivo,
  ajusteAccion,
  setAjusteAccion,
  ajusteTemaDestinoId,
  setAjusteTemaDestinoId,
  ajusteSeleccion,
  setAjusteSeleccion,
  preguntasPorTemaId,
  paginasPorTema,
  sugerirPreguntasARecortar,
  estimarAltoPregunta,
  cerrarAjusteTema,
  aplicarAjusteTema,
  moviendoTema,
  sinTemaDestinoId,
  setSinTemaDestinoId,
  preguntasSinTema,
  sinTemaSeleccion,
  setSinTemaSeleccion,
  moviendoSinTema,
  asignarSinTemaATema
}: {
  tema: TemaBanco;
  temasBanco: TemaBanco[];
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
  paginasPorTema: Map<string, number>;
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
}) {
  if (ajusteTemaId !== tema._id) return null;
  const preguntasTema = preguntasPorTemaId.get(tema._id) ?? [];
  const actuales = paginasPorTema.get(normalizarNombreTema(tema.nombre).toLowerCase()) ?? 0;
  const objetivo = Math.max(1, Math.floor(Number(ajustePaginasObjetivo) || 1));
  const seleccionadas = preguntasTema.filter((p) => ajusteSeleccion.has(p._id));
  const restantes = preguntasTema.filter((p) => !ajusteSeleccion.has(p._id));
  const paginasRestantes = restantes.length ? estimarPaginasParaPreguntas(restantes) : 0;
  const altoSeleccion = seleccionadas.reduce((acc, p) => acc + estimarAltoPregunta(p), 0);
  const paginasSeleccion = seleccionadas.length ? estimarPaginasParaPreguntas(seleccionadas) : 0;

  return (
    <div className="ajuste-tema">
      <div className="ayuda">Ajusta el tamano del tema segun <b>paginas estimadas</b>. Puedes <b>mover</b> preguntas o <b>dejarlas sin tema</b>.</div>
      <div className="ajuste-controles">
        <label className="campo ajuste-campo ajuste-campo--paginas">Paginas objetivo
          <input type="number" min={1} value={String(ajustePaginasObjetivo)} onChange={(event) => setAjustePaginasObjetivo(Math.max(1, Number(event.target.value || 1)))} />
        </label>
        <label className="campo ajuste-campo ajuste-campo--tema">Accion
          <select value={ajusteAccion} onChange={(event) => { const next = event.target.value === 'quitar' ? 'quitar' : 'mover'; setAjusteAccion(next); if (next === 'quitar') setAjusteTemaDestinoId(''); }}>
            <option value="mover">Mover a otro tema</option>
            <option value="quitar">Dejar sin tema</option>
          </select>
        </label>
        <label className="campo ajuste-campo ajuste-campo--tema">Tema destino
          <select value={ajusteTemaDestinoId} onChange={(event) => setAjusteTemaDestinoId(event.target.value)}>
            <option value="">Selecciona</option>
            {temasBanco.filter((x) => x._id !== tema._id).map((x) => (<option key={x._id} value={x._id}>{x.nombre}</option>))}
          </select>
        </label>
        <Boton type="button" variante="secundario" onClick={() => setAjusteSeleccion(new Set(sugerirPreguntasARecortar(preguntasTema, ajustePaginasObjetivo)))}>Sugerir</Boton>
        <Boton type="button" variante="secundario" onClick={() => setAjusteSeleccion(new Set())}>Limpiar</Boton>
        <Boton type="button" variante="secundario" onClick={cerrarAjusteTema}>Cerrar</Boton>
      </div>
      <div className="item-meta ajuste-meta"><span>Actual: {actuales} pag. | Objetivo: {objetivo} pag. | Quedaria: {paginasRestantes} pag.</span><span>Seleccionadas: {seleccionadas.length} (peso aprox: {paginasSeleccion} pag, {Math.round(altoSeleccion)}pt)</span></div>
      <div className="ajuste-scroll">
        <ul className="lista">
          {preguntasTema.length === 0 && <li>No hay preguntas en este tema.</li>}
          {preguntasTema.map((p) => {
            const version = obtenerVersionPregunta(p);
            const marcado = ajusteSeleccion.has(p._id);
            return (
              <li key={p._id}><label className="ajuste-check"><input type="checkbox" checked={marcado} onChange={() => setAjusteSeleccion((prev) => { const next = new Set(prev); if (next.has(p._id)) next.delete(p._id); else next.add(p._id); return next; })} /><span>{String(version?.enunciado ?? 'Pregunta').slice(0, 120)}</span></label></li>
            );
          })}
        </ul>
      </div>
      <div className="acciones ajuste-acciones">
        <Boton type="button" icono={<Icono nombre="ok" />} cargando={moviendoTema} disabled={(ajusteAccion === 'mover' && !ajusteTemaDestinoId) || ajusteSeleccion.size === 0} onClick={() => void aplicarAjusteTema()}>
          {moviendoTema ? (ajusteAccion === 'mover' ? 'Moviendo…' : 'Actualizando…') : (ajusteAccion === 'mover' ? 'Mover seleccionadas' : 'Quitar tema a seleccionadas')}
        </Boton>
      </div>

      <details className="colapsable mt-10" open={false}>
        <summary><b>Sin tema</b>{` (${preguntasSinTema.length})`}</summary>
        {preguntasSinTema.length === 0 ? <div className="ayuda">No hay preguntas sin tema en esta materia.</div> : (
          <>
            <div className="ajuste-controles">
              <label className="campo ajuste-campo ajuste-campo--tema">Asignar a tema
                <select value={sinTemaDestinoId} onChange={(event) => setSinTemaDestinoId(event.target.value)}>
                  <option value="">Selecciona</option>
                  {temasBanco.map((x) => (<option key={x._id} value={x._id}>{x.nombre}</option>))}
                </select>
              </label>
              <Boton type="button" variante="secundario" onClick={() => setSinTemaSeleccion(new Set(preguntasSinTema.map((p) => p._id)))}>Seleccionar todo</Boton>
              <Boton type="button" variante="secundario" onClick={() => setSinTemaSeleccion(new Set())}>Limpiar</Boton>
              <Boton type="button" icono={<Icono nombre="ok" />} cargando={moviendoSinTema} disabled={!sinTemaDestinoId || sinTemaSeleccion.size === 0} onClick={() => void asignarSinTemaATema()}>
                {moviendoSinTema ? 'Asignando…' : `Asignar (${sinTemaSeleccion.size})`}
              </Boton>
            </div>
            <div className="ajuste-scroll">
              <ul className="lista">
                {preguntasSinTema.map((p) => {
                  const v = obtenerVersionPregunta(p);
                  const marcado = sinTemaSeleccion.has(p._id);
                  return (
                    <li key={p._id}><label className="ajuste-check"><input type="checkbox" checked={marcado} onChange={() => setSinTemaSeleccion((prev) => { const next = new Set(prev); if (next.has(p._id)) next.delete(p._id); else next.add(p._id); return next; })} /><span>{String(v?.enunciado ?? 'Pregunta').slice(0, 120)}</span></label></li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </details>
    </div>
  );
}
