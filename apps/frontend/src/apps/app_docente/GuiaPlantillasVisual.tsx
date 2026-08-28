/**
 * GuiaPlantillasVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Maquetación y Generación de Plantillas OMR.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaPlantillasVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.plantillas.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.plantillas.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in" aria-label="Ayuda rápida de plantillas">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver explicación visual de los 3 pasos para maquetar y generar exámenes"
        >
          💡 Ver guía rápida de diseño de plantillas
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Diseño y generación de plantillas">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Maquetación OMR y Generación Masiva</span>
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
        {/* Paso 01: Estructura & Asignatura */}
        <div className="guia-step-card guia-step-card--rose anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Estructura y Materia</h4>
            <p>Define título de evaluación, materia activa y modalidad (Parcial o Examen Global).</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">1er Parcial Cálculo</span>
              <span className="guia-chip-sample">Modo Parcial</span>
            </div>
          </div>
        </div>

        {/* Paso 02: Composición Temática */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10M6 10h10" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Composición Temática</h4>
            <p>Selecciona las unidades temáticas para distribuir y balancear reactivos del banco activo.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Integrales Definidas</span>
              <span className="guia-chip-sample guia-chip-sample--date">30 Reactivos</span>
            </div>
          </div>
        </div>

        {/* Paso 03: Generación Masiva OMR */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Generación & Folios</h4>
            <p>Previsualiza el PDF y genera el paquete completo con código QR y hoja OMR por cada alumno.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Lote ZIP / PDF</span>
              <span className="guia-chip-sample">Folio Único</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
