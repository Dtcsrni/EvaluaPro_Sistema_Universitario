/**
 * GuiaAsistenciasVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para el pase de lista y control de asistencias.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaAsistenciasVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.asistencias.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.asistencias.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-asistencias-compact anim-fade-in" aria-label="Ayuda rápida de asistencias">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver explicación visual de los 3 pasos para el control de asistencia"
        >
          💡 Ver guía rápida de pase de lista
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Control de asistencias y pase de lista">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Pase de Lista y Control de Asistencias</span>
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
        {/* Paso 1: Seleccionar Materia y Grupo */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10M6 10h10" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Selecciona Materia y Grupo</h4>
            <p>Elige el curso lectivo y el grupo para cargar la lista oficial de estudiantes inscritos.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Cálculo Integral</span>
              <span className="guia-chip-sample">Grupo 3A</span>
            </div>
          </div>
        </div>

        {/* Paso 2: Fast-Check 1-Click */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Fast-Check con 1 Clic</h4>
            <p>Cicla el estado de cada estudiante con un clic o presiona <strong>Todos Presentes</strong> para acelerar.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date">🟢 Presente</span>
              <span className="guia-chip-sample">🔴 Falta</span>
              <span className="guia-chip-sample">🟡 Retardo</span>
            </div>
          </div>
        </div>

        {/* Paso 3: Semáforo y Derecho a Examen */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Semáforo y Derecho a Examen</h4>
            <p>El sistema calcula el porcentaje de asistencia en tiempo real y alerta alumnos sin derecho.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">✅ Con Derecho</span>
              <span className="guia-chip-sample">🚫 Sin Derecho</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
