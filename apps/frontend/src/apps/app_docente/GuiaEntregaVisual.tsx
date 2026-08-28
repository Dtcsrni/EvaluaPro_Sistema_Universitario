/**
 * GuiaEntregaVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Registro y Control de Entregas.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaEntregaVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.entrega.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.entrega.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in" aria-label="Ayuda rápida de entrega">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver explicación visual de los 3 pasos para control de entregas"
        >
          💡 Ver guía rápida de recepción de exámenes
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Registro y recepción de exámenes">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Custodia y Recepción de Exámenes</span>
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
        {/* Paso 01: Selección de Lote */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Selección de Lote</h4>
            <p>Elige la plantilla y el grupo escolar correspondiente a la aplicación del examen.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Examen Parcial 1</span>
              <span className="guia-chip-sample">Grupo 3A</span>
            </div>
          </div>
        </div>

        {/* Paso 02: Recepción / Folio */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Marcación de Folios</h4>
            <p>Registra la entrega física del examen mediante escaneo o marcación individual con 1-clic.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date">✓ Entregado</span>
              <span className="guia-chip-sample">Folio #84920</span>
            </div>
          </div>
        </div>

        {/* Paso 03: Validación OMR */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Paso a Calificación</h4>
            <p>Verifica que todos los folios estén recibidos para pasar directamente a la mesa OMR.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">100% Custodia</span>
              <span className="guia-chip-sample">Listo Escaneo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
