/**
 * GuiaEvaluacionesVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Analítica y Métricas de Rendimiento.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaEvaluacionesVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.evaluaciones.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.evaluaciones.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in" aria-label="Ayuda rápida de evaluaciones">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver explicación visual de analítica y métricas de desempeño"
        >
          💡 Ver guía rápida de métricas y analítica
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Analítica de evaluaciones">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Analítica y Curvas de Rendimiento</span>
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
        {/* Paso 01: Consolidación */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Consolidación de Notas</h4>
            <p>Agrupa evaluaciones por parcial o ciclo lectivo para contrastar medias grupales.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Promedio 8.4</span>
              <span className="guia-chip-sample">Campana de Gauss</span>
            </div>
          </div>
        </div>

        {/* Paso 02: Reactivos Críticos */}
        <div className="guia-step-card guia-step-card--amber anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Reactivos Críticos</h4>
            <p>Detecta preguntas con alto índice de error o distractores con sesgo estadístico.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date">Discriminación Ítem</span>
              <span className="guia-chip-sample">Distractor Anómalo</span>
            </div>
          </div>
        </div>

        {/* Paso 03: Reportes Ejecutivos */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Sábanas y Reportes</h4>
            <p>Exporta sábanas integrales en Excel, CSV o PDF con ponderaciones oficiales.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Exportación Excel</span>
              <span className="guia-chip-sample">Resumen PDF</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
