/**
 * GuiaBancoVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Banco de Preguntas y Estimación.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaBancoVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.banco.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.banco.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in" aria-label="Ayuda rápida de banco de preguntas">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver explicación visual de los 3 pasos para la gestión de reactivos"
        >
          💡 Ver guía rápida de banco de preguntas
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Banco de preguntas y estimación">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Banco de Reactivos y Estimación</span>
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
        {/* Paso 01: Materia y Tema */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Materia y Tema</h4>
            <p>Selecciona la asignatura activa y su tema curricular para clasificar cada reactivo de forma estructurada.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Cálculo Integral</span>
              <span className="guia-chip-sample">Integrales Definidas</span>
            </div>
          </div>
        </div>

        {/* Paso 02: Redacción y Opciones */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Redacción y Opciones</h4>
            <p>Escribe el enunciado, sube imagen de apoyo opcional, llena opciones A–E y marca la respuesta correcta.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">5 Opciones (A–E)</span>
              <span className="guia-chip-sample guia-chip-sample--date">✓ 1 Correcta</span>
            </div>
          </div>
        </div>

        {/* Paso 03: Estimación OMR */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Estimación de Páginas</h4>
            <p>El motor tipográfico calcula en tiempo real la altura en puntos y las páginas requeridas en plantillas impresas.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Layout OMR</span>
              <span className="guia-chip-sample">Paginación Real</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
