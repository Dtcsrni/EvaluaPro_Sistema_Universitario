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
    <section className="banco-listado anim-fade-in">
      <div className="banco-section-title">
        <div className="banco-section-title__wrap">
          <span className="banco-section-pill">
            <span className="banco-section-pill__dot" aria-hidden="true" />
            <span>Reactivos Disponibles</span>
          </span>
          <h3>Preguntas recientes{periodoId ? ` (${preguntasFiltradas.length}/${preguntasMateria.length})` : ''}</h3>
          <p className="nota">Filtra por redacción o tema para revisar consistencia, edición y limpieza del banco activo.</p>
        </div>
      </div>

      {periodoId && (
        <div className="banco-listado__filtros" role="search" aria-label="Filtros de preguntas">
          <label className="campo banco-campo-buscar">
            <span className="campo__label-text">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Buscar en enunciado
            </span>
            <div className="auth-input-box auth-input-box--animated">
              <input
                type="search"
                value={filtroTexto}
                onChange={(event) => setFiltroTexto(event.target.value)}
                placeholder="Ej. derivada, arrays, SQL"
                aria-label="Buscar en enunciado"
              />
            </div>
          </label>

          <label className="campo banco-campo-tema">
            <span className="campo__label-text">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
              </svg>
              Tema
            </span>
            <div className="auth-input-box auth-input-box--animated">
              <select
                value={filtroTema}
                onChange={(event) => setFiltroTema(event.target.value)}
                aria-label="Tema"
              >
                <option value="">Todos los temas</option>
                {temasDisponibles.map((tema) => (
                  <option key={tema} value={tema}>
                    {tema}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <div className="banco-listado__filtros-acciones">
            <Boton
              type="button"
              variante="secundario"
              onClick={() => { setFiltroTexto(''); setFiltroTema(''); }}
              disabled={!hayFiltros}
            >
              Limpiar filtros
            </Boton>
          </div>
        </div>
      )}

      <ul className="lista lista-items banco-listado__items">
        {!periodoId && <li className="banco-empty-state">Selecciona una materia para ver sus preguntas.</li>}
        {periodoId && preguntasMateria.length === 0 && (
          <li className="banco-empty-state">No hay preguntas en esta materia. Redacta la primera arriba.</li>
        )}
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
                <div className="item-glass banco-listado__item anim-card-hover">
                  <div className="item-row">
                    <div className="banco-item-main">
                      <div className="item-title banco-item-enunciado">{version?.enunciado ?? 'Pregunta'}</div>
                      <div className="item-meta banco-item-meta">
                        <span className="banco-tag-id">ID: {idCortoMateria(pregunta._id)}</span>
                        <span className="banco-tag-tema">Tema: {pregunta.tema ? pregunta.tema : '-'}</span>
                        {tieneCodigo && (
                          <span className="badge banco-tag-code" title="Se detectó código (inline/backticks, bloques o patrones típicos)">
                            <span className="dot" /> Código
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="item-actions revision-pills-wrap">
                      <Boton
                        variante="secundario"
                        type="button"
                        onClick={() => iniciarEdicion(pregunta)}
                        disabled={bloqueoEdicion}
                      >
                        Editar
                      </Boton>
                      <Boton
                        type="button"
                        cargando={archivandoPreguntaId === pregunta._id}
                        onClick={() => void archivarPregunta(pregunta._id)}
                        disabled={!puedeArchivar}
                      >
                        Eliminar
                      </Boton>
                    </div>
                  </div>

                  <div className="item-sub banco-listado__sub">
                    <span className="banco-tag-opciones-count">
                      {opcionesActuales.filter((op) => op.texto.trim()).length} opciones cargadas
                    </span>
                    <span className="banco-tag-apoyo-visual">
                      {imagenPregunta ? ' · con apoyo visual 🖼️' : ' · sin imagen'}
                    </span>
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
                    <ul className="item-options banco-item-options-grid">
                      {opcionesActuales.map((op, idx) => (
                        <li
                          key={idx}
                          className={`item-option banco-mini-option ${op.esCorrecta ? 'item-option--correcta banco-mini-option--correcta' : ''}`}
                        >
                          <span className="item-option__letra banco-mini-option__letra">{String.fromCharCode(65 + idx)}.</span>{' '}
                          <span className="banco-mini-option__text">{op.texto}</span>
                          {op.esCorrecta && <span className="banco-mini-option__check" aria-label="Respuesta correcta">✓</span>}
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
