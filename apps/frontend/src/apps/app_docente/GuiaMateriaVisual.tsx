/**
 * GuiaMateriaVisual
 *
 * Responsabilidad: Guía interactiva moderna con Bento Step Cards para materias.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaMateriaVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.materias.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.materias.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-materia-compact anim-fade-in" aria-label="Ayuda rapida de materias">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver explicación visual de los 3 pasos para configurar una materia"
        >
          💡 Ver guía rápida de configuración
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Para que sirve y como llenarlo">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA: Para que sirve y como llenarlo</span>
        </div>
        <button
          type="button"
          className="guia-materia-close-btn"
          onClick={toggleGuia}
          title="Ocultar guía"
          aria-label="Ocultar guía rápida"
        >
          ✕ Ocultar guía
        </button>
      </div>

      <div className="guia-materia-grid">
        {/* Paso 1: Nombre de la Asignatura */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10M6 10h10" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Nombre de la Materia</h4>
            <p>Escribe el nombre oficial de la asignatura que impartirás este periodo.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Álgebra Lineal</span>
              <span className="guia-chip-sample">Física Aplicada</span>
            </div>
          </div>
        </div>

        {/* Paso 2: Rango de Fechas */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" strokeWidth="2.8" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Rango de Fechas</h4>
            <p>Fija el inicio y fin del curso lectivo para habilitar la entrega de calificaciones.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date">📅 Inicio ➔ Fin</span>
            </div>
          </div>
        </div>

        {/* Paso 3: Grupos Asignados */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Grupos Asignados</h4>
            <p>Ingresa las aulas o secciones separadas por coma para organizar las listas de alumnos.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">1A</span>
              <span className="guia-chip-sample">1B</span>
              <span className="guia-chip-sample">2C</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
