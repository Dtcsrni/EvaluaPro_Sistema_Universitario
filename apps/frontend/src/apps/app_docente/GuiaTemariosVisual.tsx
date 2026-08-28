/**
 * GuiaTemariosVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para estructuración y avance de temarios.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaTemariosVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.temarios.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.temarios.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in" aria-label="Ayuda rápida de temarios">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver explicación visual de los 3 pasos para la gestión de temarios"
        >
          💡 Ver guía rápida de temarios
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Estructura y seguimiento de temarios">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Estructura Curricular y Temarios</span>
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
        {/* Paso 1: Selecciona la Asignatura */}
        <div className="guia-step-card guia-step-card--amber anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10M6 10h10" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Selecciona la Asignatura</h4>
            <p>Elige el curso lectivo para cargar o crear el plan de estudios y árbol de unidades temáticas.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Cálculo Integral</span>
              <span className="guia-chip-sample">Estructuras</span>
            </div>
          </div>
        </div>

        {/* Paso 2: Carga en PDF o Texto */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Carga Inteligente o Jerárquica</h4>
            <p>Arrastra tu programa oficial en PDF o escribe el árbol con numeración jerárquica.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date">📄 Programa.pdf</span>
              <span className="guia-chip-sample">1.1 Subtema</span>
            </div>
          </div>
        </div>

        {/* Paso 3: Seguimiento y Avance */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Seguimiento y Avance de Clase</h4>
            <p>Haz clic en los temas para actualizar su estatus en tiempo real y calcular el avance del curso.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">○ Pendiente</span>
              <span className="guia-chip-sample">🔄 En progreso</span>
              <span className="guia-chip-sample">✅ Cubierto</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
