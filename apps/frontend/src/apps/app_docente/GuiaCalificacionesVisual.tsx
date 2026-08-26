/**
 * GuiaCalificacionesVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Calificación y Escrutinio OMR.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaCalificacionesVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.calificaciones.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.calificaciones.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in" aria-label="Ayuda rápida de calificaciones">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver explicación visual de los 3 pasos para calificación OMR"
        >
          💡 Ver guía rápida de calificación OMR y actas
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Calificación y escrutinio OMR">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Mesa de Calificación y Escrutinio OMR</span>
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
        {/* Paso 01: Lectura Óptica OMR */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M4 7V4h3" />
              <path d="M20 7V4h-3" />
              <path d="M4 17v3h3" />
              <path d="M20 17v3h-3" />
              <line x1="9" y1="12" x2="15" y2="12" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Lectura Óptica OMR</h4>
            <p>Procesa fotos o escaneos individuales o en lote con alineación milimétrica por esquinas.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Visión Artificial</span>
              <span className="guia-chip-sample">Confianza &gt; 98%</span>
            </div>
          </div>
        </div>

        {/* Paso 02: Resolución Rápida */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Resolución Rápida</h4>
            <p>Atiende marcas dudosas o dobles con atajos ultra rápidos (A–E o 0 para anular).</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Atajos de Teclado</span>
              <span className="guia-chip-sample">Resolución Instantánea</span>
            </div>
          </div>
        </div>

        {/* Paso 03: Cálculo y Publicación */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Cálculo y Publicación</h4>
            <p>Aplica bonos, calcula notas sobre escala oficial y exporta actas en CSV y XLSX.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Escala 0–10</span>
              <span className="guia-chip-sample">Acta Oficial</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
