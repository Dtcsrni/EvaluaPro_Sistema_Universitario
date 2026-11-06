/**
 * BancoListadoPreguntas
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { Check, ListTree, Search, IconoLucide } from '../../../../../ui/iconosCatalogo';
import { idCortoMateria, obtenerVersionPregunta, preguntaTieneCodigo } from '../../../utilidades';
import type { Pregunta } from '../../../tipos';
import { textoPlanoRico } from './RichTextEditor';
import { useEffect, useId, useMemo, useState } from 'react';

export function BancoListadoPreguntas({
  periodoId,
  preguntasMateria,
  cargandoPreguntas = false,
  errorCargaPreguntas = false,
  onReintentarCargaPreguntas,
  bloqueoEdicion,
  archivandoPreguntaId,
  puedeArchivar,
  puedeRetirar,
  iniciarEdicion,
  archivarPregunta,
  verVersiones
}: {
  periodoId: string;
  preguntasMateria: Pregunta[];
  cargandoPreguntas?: boolean;
  errorCargaPreguntas?: boolean;
  onReintentarCargaPreguntas?: () => void;
  bloqueoEdicion: boolean;
  archivandoPreguntaId: string | null;
  puedeArchivar: boolean;
  puedeRetirar: boolean;
  iniciarEdicion: (pregunta: Pregunta) => void;
  archivarPregunta: (preguntaId: string) => Promise<void>;
  verVersiones: (pregunta: Pregunta) => Promise<void>;
}) {
  const idPermisos = useId();
  const ayudaRetirarId = `${idPermisos}-retirar`;
  const ayudaEliminarId = `${idPermisos}-eliminar`;
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

  useEffect(() => {
    const temaSeleccionado = filtroTema.trim().toLowerCase();
    if (!temaSeleccionado) return;

    const temaActual = temasDisponibles.find(
      (tema) => tema.trim().toLowerCase() === temaSeleccionado
    );
    if (!temaActual) setFiltroTema('');
    else if (temaActual !== filtroTema) setFiltroTema(temaActual);
  }, [filtroTema, temasDisponibles]);

  const preguntasFiltradas = useMemo(() => {
    const texto = filtroTexto.trim().toLowerCase();
    const tema = filtroTema.trim().toLowerCase();
    return preguntasMateria.filter((pregunta) => {
      const version = obtenerVersionPregunta(pregunta);
      const enunciado = textoPlanoRico(String(version?.enunciado ?? '')).toLowerCase();
      const temaActual = String(pregunta.tema ?? '').trim().toLowerCase();
      const porTexto = !texto || enunciado.includes(texto);
      const porTema = !tema || temaActual === tema;
      return porTexto && porTema;
    });
  }, [filtroTexto, filtroTema, preguntasMateria]);

  const mostrarAyudaPermisoRetirar = !puedeRetirar && preguntasFiltradas.some((pregunta) => Boolean(pregunta.reactivoId));
  const mostrarAyudaPermisoEliminar = !puedeArchivar && preguntasFiltradas.some((pregunta) => !pregunta.reactivoId);

  const hayFiltros = Boolean(filtroTexto.trim() || filtroTema.trim());

  return (
    <section id="banco-listado" tabIndex={-1} className="banco-listado anim-fade-in" aria-labelledby="banco-listado-title" aria-busy={cargandoPreguntas || undefined}>
      <div className="banco-section-title">
        <div className="banco-section-title__wrap">
          <span className="banco-section-pill">
            <span className="banco-section-pill__dot" aria-hidden="true" />
            <span>Reactivos Disponibles</span>
          </span>
          <h3 id="banco-listado-title">Preguntas recientes{periodoId && !cargandoPreguntas && !errorCargaPreguntas ? ` (${preguntasFiltradas.length}/${preguntasMateria.length})` : ''}</h3>
          <p className="nota">Filtra por redacción o tema para revisar consistencia, edición y limpieza del banco activo.</p>
        </div>
      </div>

      {periodoId && cargandoPreguntas && <p className="nota" role="status">Cargando preguntas de esta materia…</p>}
      {periodoId && errorCargaPreguntas && (
        <div className="banco-listado__load-error">
          <p className="mensaje error" role="alert">No se pudo actualizar la lista de preguntas. Si ya había preguntas cargadas, se conservaron; vuelve a intentar la consulta.</p>
          {onReintentarCargaPreguntas && (
            <Boton type="button" variante="secundario" onClick={onReintentarCargaPreguntas}>
              Reintentar carga de preguntas
            </Boton>
          )}
        </div>
      )}

      {periodoId && (
        <div className="banco-listado__filtros" role="search" aria-label="Filtros de preguntas">
          <label className="campo banco-campo-buscar">
            <span className="campo__label-text">
              <IconoLucide icon={Search} size={14} />
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
              <IconoLucide icon={ListTree} size={14} />
              Filtrar por tema
            </span>
            <div className="auth-input-box auth-input-box--animated">
              <select
                value={filtroTema}
                onChange={(event) => setFiltroTema(event.target.value)}
                aria-label="Filtrar por tema"
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

      {(mostrarAyudaPermisoRetirar || mostrarAyudaPermisoEliminar) && (
        <div className="banco-listado__permiso-ayuda">
          {mostrarAyudaPermisoRetirar && (
            <p className="mensaje warning" id={ayudaRetirarId} role="status">
              Retirar reactivos requiere permiso de publicación. Solicítalo a quien administra EvaluaPro.
            </p>
          )}
          {mostrarAyudaPermisoEliminar && (
            <p className="mensaje warning" id={ayudaEliminarId} role="status">
              Eliminar preguntas heredadas requiere permiso de archivo. Solicítalo a quien administra EvaluaPro.
            </p>
          )}
        </div>
      )}

      <ul className="lista lista-items banco-listado__items">
        {!periodoId && <li className="banco-empty-state">Selecciona una materia para ver sus preguntas.</li>}
        {periodoId && !cargandoPreguntas && !errorCargaPreguntas && preguntasMateria.length === 0 && (
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
            const enunciadoAccion = textoPlanoRico(String(version?.enunciado ?? 'Pregunta'))
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 100) || 'Pregunta sin enunciado';
            const temaAccion = String(pregunta.tema ?? '').trim() || 'sin tema';
            const contextoAccion = `«${enunciadoAccion}», tema ${temaAccion}, ID ${idCortoMateria(pregunta._id)}`;
            return (
              <li key={pregunta._id}>
                <div className="item-glass banco-listado__item anim-card-hover">
                  <div className="item-row">
                    <div className="banco-item-main">
                      <div className="item-title banco-item-enunciado">{textoPlanoRico(String(version?.enunciado ?? 'Pregunta'))}</div>
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
                      {pregunta.reactivoId ? (
                        <Boton
                          variante="secundario"
                          type="button"
                          onClick={() => iniciarEdicion(pregunta)}
                          disabled={bloqueoEdicion}
                          aria-label={`Editar pregunta: ${contextoAccion}`}
                        >
                          Editar
                        </Boton>
                      ) : (
                        <Boton
                          variante="secundario"
                          type="button"
                          disabled
                          title="Este registro heredado requiere resolución canónica antes de editarse."
                          aria-label={`Pendiente de migración: ${contextoAccion}`}
                        >
                          Pendiente de migración
                        </Boton>
                      )}
                      {pregunta.reactivoId && (
                        <Boton variante="secundario" type="button" onClick={() => void verVersiones(pregunta)} disabled={bloqueoEdicion} aria-label={`Versiones del reactivo: ${contextoAccion}`}>
                          Versiones
                        </Boton>
                      )}
                      <Boton
                        type="button"
                        cargando={archivandoPreguntaId === pregunta._id}
                        onClick={() => void archivarPregunta(pregunta._id)}
                        disabled={pregunta.reactivoId ? !puedeRetirar : !puedeArchivar}
                        aria-describedby={pregunta.reactivoId
                          ? (!puedeRetirar ? ayudaRetirarId : undefined)
                          : (!puedeArchivar ? ayudaEliminarId : undefined)}
                        aria-label={`${pregunta.reactivoId ? 'Retirar reactivo' : 'Eliminar pregunta'}: ${contextoAccion}`}
                      >
                        {pregunta.reactivoId ? 'Retirar' : 'Eliminar'}
                      </Boton>
                    </div>
                  </div>

                  <div className="item-sub banco-listado__sub">
                    <span className="banco-tag-opciones-count">
                      {opcionesActuales.filter((op) => op.texto.trim()).length} opciones cargadas
                    </span>{' · '}
                    <span className="banco-tag-apoyo-visual">
                      {imagenPregunta ? 'Con imagen de apoyo' : 'Sin imagen de apoyo'}
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
                          {op.esCorrecta && (
                            <span className="banco-mini-option__check">
                              <IconoLucide icon={Check} size={14} decorative={false} label="Respuesta correcta" />
                            </span>
                          )}
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
