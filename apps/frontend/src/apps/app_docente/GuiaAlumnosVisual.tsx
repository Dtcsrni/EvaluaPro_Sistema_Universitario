/**
 * GuiaAlumnosVisual
 *
 * Responsabilidad: Guía interactiva moderna con Bento Step Cards para gestión de alumnos y matrículas.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaAlumnosVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.alumnos.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.alumnos.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-materia-compact anim-fade-in">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver guía de 3 pasos para matrícula y expedientes de alumnos"
        >
          💡 Ver guía rápida de gestión de alumnos
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Guía rápida de gestión de alumnos">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA DE GESTIÓN DE ALUMNOS</span>
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
        {/* Paso 1: Matrícula Oficial */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="14" x="3" y="5" rx="2" />
              <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
              <circle cx="12" cy="3" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Matrícula Institucional</h4>
            <p>Ingresa la matrícula oficial con formato <code>CUH#########</code> (9 dígitos numéricos).</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">CUH512410168</span>
              <span className="guia-chip-sample">CUH512410199</span>
            </div>
          </div>
        </div>

        {/* Paso 2: Nombres y Correo */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
              <path d="m19 8 3 3-3 3" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Nombres y Correo</h4>
            <p>Escribe nombres completos. El correo institucional <code>@cuh.mx</code> se sugerirá solo.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date">✉️ alumno@cuh.mx</span>
            </div>
          </div>
        </div>

        {/* Paso 3: Asignación y Materia */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10M6 10h10" />
              <polyline points="9 18 12 15 15 18" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Materia y Grupo</h4>
            <p>Asigna el grupo correspondiente y la materia activa para habilitar listas y OMR.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">3A</span>
              <span className="guia-chip-sample">3B</span>
              <span className="guia-chip-sample">101</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
