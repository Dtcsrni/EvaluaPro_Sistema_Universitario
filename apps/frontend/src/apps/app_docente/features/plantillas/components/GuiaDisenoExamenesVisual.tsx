/**
 * GuiaDisenoExamenesVisual
 *
 * Responsabilidad: Guía interactiva Bento para la pestaña 1: Diseñar Exámenes.
 */
import { useState } from 'react';
import { Boton } from '../../../../../ui/ux/componentes/Boton';

export function GuiaDisenoExamenesVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.diseno.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.diseno.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in mb-15" aria-label="Ayuda de diseño de exámenes">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver guía de maquetación y estructura de exámenes"
        >
          💡 Ver guía rápida de diseño de exámenes
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in mb-20" role="region" aria-label="Ayuda: Diseño de exámenes">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Maquetación OMR y Estructura Temática</span>
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
        <div className="guia-step-card">
          <div className="guia-step-num">01</div>
          <div className="guia-step-body">
            <h4>Título y Materia Activa</h4>
            <p>Define el nombre del examen y asócialo a la asignatura correspondiente.</p>
            <div className="guia-step-preview">
              <span className="badge badge-meta">Ej. 1er Parcial Cálculo</span>
            </div>
          </div>
        </div>

        <div className="guia-step-card">
          <div className="guia-step-num">02</div>
          <div className="guia-step-body">
            <h4>Composición por Temas</h4>
            <p>Selecciona las unidades temáticas del banco para alimentar las preguntas aleatorias.</p>
            <div className="guia-step-preview">
              <span className="badge badge-tema-chip">Álgebra</span>
              <span className="badge badge-tema-chip">Matrices</span>
            </div>
          </div>
        </div>

        <div className="guia-step-card">
          <div className="guia-step-num">03</div>
          <div className="guia-step-body">
            <h4>Previsualización del Boceto</h4>
            <p>Valida la distribución por página y renderiza el PDF de muestra antes de producir lotes.</p>
            <div className="guia-step-preview">
              <span className="badge badge-meta">Boceto OMR listo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
