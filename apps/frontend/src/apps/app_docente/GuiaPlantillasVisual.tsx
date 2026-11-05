/**
 * GuiaPlantillasVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Maquetación y Generación de Plantillas OMR.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';
import { BookOpenText, ClipboardCheck, FileText, Lightbulb, X, IconoLucide } from '../../ui/iconosCatalogo';

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
          <IconoLucide icon={Lightbulb} size={16} /> Ver guía rápida de diseño de plantillas
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
          <IconoLucide icon={X} size={16} aria-hidden="true" /> Ocultar guía
        </button>
      </div>

      <div className="guia-materia-grid">
        {/* Paso 01: Estructura & Asignatura */}
        <div className="guia-step-card guia-step-card--rose anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={FileText} size={24} />
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
            <IconoLucide icon={BookOpenText} size={24} />
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
            <IconoLucide icon={ClipboardCheck} size={24} />
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
