/**
 * BancoListadoPreguntas
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { idCortoMateria, obtenerVersionPregunta, preguntaTieneCodigo } from '../../../utilidades';
import type { Pregunta } from '../../../tipos';
import { useMemo, useState } from 'react';

export function BancoListadoPreguntas({
  periodoId,
  preguntasMateria,
  bloqueoEdicion,
  archivandoPreguntaId,
  puedeArchivar,
  iniciarEdicion,
  archivarPregunta
}: {
  periodoId: string;
  preguntasMateria: Pregunta[];
  bloqueoEdicion: boolean;
  archivandoPreguntaId: string | null;
  puedeArchivar: boolean;
  iniciarEdicion: (pregunta: Pregunta) => void;
  archivarPregunta: (preguntaId: string) => Promise<void>;
}) {
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroTema, setFiltroTema] = useState('');

  const temasDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const pregunta of preguntasMateria) {
      const nombre = String(pregunta.tema ?? '').trim();
      if (nombre) set.add(nombre);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [preguntasMateria]);

  const preguntasFiltradas = useMemo(() => {
    const texto = filtroTexto.trim().toLowerCase();
    const tema = filtroTema.trim().toLowerCase();
    return preguntasMateria.filter((pregunta) => {
      const version = obtenerVersionPregunta(pregunta);
      const enunciado = String(version?.enunciado ?? '').toLowerCase();
      const temaActual = String(pregunta.tema ?? '').toLowerCase();
      const porTexto = !texto || enunciado.includes(texto);
      const porTema = !tema || temaActual === tema;
      return porTexto && porTema;
    });
  }, [filtroTexto, filtroTema, preguntasMateria]);

  const hayFiltros = Boolean(filtroTexto.trim() || filtroTema.trim());

  return (
    <section className="banco-listado">
      <div className="banco-section-title">
        <div>
          <h3>Preguntas recientes{periodoId ? ` (${preguntasFiltradas.length}/${preguntasMateria.length})` : ''}</h3>
          <p className="nota">Filtra por redacción o tema para revisar consistencia, edición y limpieza del banco activo.</p>
        </div>
      </div>
      {periodoId && (
        <div className="banco-listado__filtros" role="search" aria-label="Filtros de preguntas">
          <label className="campo">
            Buscar en enunciado
            <input
              type="search"
              value={filtroTexto}
              onChange={(event) => setFiltroTexto(event.target.value)}
              placeholder="Ej. derivada, arrays, SQL"
            />
          </label>
          <label className="campo">
            Tema
            <select value={filtroTema} onChange={(event) => setFiltroTema(event.target.value)}>
              <option value="">Todos los temas</option>
              {temasDisponibles.map((tema) => (
                <option key={tema} value={tema}>
                  {tema}
                </option>
              ))}
            </select>
          </label>
          <div className="banco-listado__filtros-acciones">
            <Boton type="button" variante="secundario" onClick={() => { setFiltroTexto(''); setFiltroTema(''); }} disabled={!hayFiltros}>
              Limpiar filtros
            </Boton>
          </div>
        </div>
      )}
      <ul className="lista lista-items banco-listado__items">
        {!periodoId && <li className="banco-empty-state">Selecciona una materia para ver sus preguntas.</li>}
        {periodoId && preguntasMateria.length === 0 && <li className="banco-empty-state">No hay preguntas en esta materia.</li>}
        {periodoId && preguntasMateria.length > 0 && preguntasFiltradas.length === 0 && (
          <li className="banco-empty-state">No hay preguntas que coincidan con los filtros actuales.</li>
        )}
        {periodoId &&
          preguntasFiltradas.map((pregunta) => {
            const version = obtenerVersionPregunta(pregunta);
            const opcionesActuales = Array.isArray(version?.opciones) ? version?.opciones : [];
            const tieneCodigo = preguntaTieneCodigo(pregunta);
            const imagenPregunta = String(version?.imagenUrl ?? '').trim();
            return (
              <li key={pregunta._id}>
                <div className="item-glass banco-listado__item">
                  <div className="item-row">
                    <div>
                      <div className="item-title">{version?.enunciado ?? 'Pregunta'}</div>
                      <div className="item-meta">
                        <span>ID: {idCortoMateria(pregunta._id)}</span>
                        <span>Tema: {pregunta.tema ? pregunta.tema : '-'}</span>
                        {tieneCodigo && (
                          <span className="badge" title="Se detecto codigo (inline/backticks, bloques o patrones tipicos)">
                            <span className="dot" /> Codigo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="item-actions revision-pills-wrap">
                      <Boton variante="secundario" type="button" onClick={() => iniciarEdicion(pregunta)} disabled={bloqueoEdicion}>
                        Editar
                      </Boton>
                      <Boton type="button" cargando={archivandoPreguntaId === pregunta._id} onClick={() => void archivarPregunta(pregunta._id)} disabled={!puedeArchivar}>
                        Eliminar
                      </Boton>
                    </div>
                  </div>
                  <div className="item-sub banco-listado__sub">
                    {opcionesActuales.filter((op) => op.texto.trim()).length} opciones cargadas
                    {imagenPregunta ? ' · con apoyo visual' : ' · sin imagen'}
                  </div>
                  {imagenPregunta && (
                    <div className="imagen-preview banco-listado__imagen">
                      <img
                        className="preview"
                        src={imagenPregunta}
                        alt={`Imagen de apoyo de la pregunta ${idCortoMateria(pregunta._id)}`}
                        loading="lazy"
                        onError={(event) => {
                          const target = event.currentTarget;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  {opcionesActuales.length === 5 && (
                    <ul className="item-options">
                      {opcionesActuales.map((op, idx) => (
                        <li key={idx} className={`item-option${op.esCorrecta ? ' item-option--correcta' : ''}`}>
                          <span className="item-option__letra">{String.fromCharCode(65 + idx)}.</span> {op.texto}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
