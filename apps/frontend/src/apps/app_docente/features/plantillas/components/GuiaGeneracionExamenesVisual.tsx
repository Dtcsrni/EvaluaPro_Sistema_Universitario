/**
 * GuiaGeneracionExamenesVisual
 *
 * Responsabilidad: Guía interactiva Bento para la pestaña 2: Generar Paquete PDF/OMR.
 */
import { useState } from 'react';
import { Boton } from '../../../../../ui/ux/componentes/Boton';

export function GuiaGeneracionExamenesVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.generacion.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.generacion.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in mb-15" aria-label="Ayuda de generación de exámenes">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver guía de generación masiva con códigos QR"
        >
          💡 Ver guía rápida de generación de exámenes
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in mb-20" role="region" aria-label="Ayuda: Generación de exámenes">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Producción OMR, Folios Únicos y Códigos QR</span>
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
            <h4>Selección de Plantilla Base</h4>
            <p>Elige la estructura de examen previamente diseñada con sus temas configurados.</p>
            <div className="guia-step-preview">
              <span className="badge badge-meta">Plantilla verificada</span>
            </div>
          </div>
        </div>

        <div className="guia-step-card">
          <div className="guia-step-num">02</div>
          <div className="guia-step-body">
            <h4>Modalidad de Impresión</h4>
            <p>Genera un <b>paquete masivo</b> por grupo con folios y QR individuales, o un <b>examen de muestra</b>.</p>
            <div className="guia-step-preview">
              <span className="badge badge-tema-chip">Paquete Masivo</span>
              <span className="badge badge-meta">QR Personalizado</span>
            </div>
          </div>
        </div>

        <div className="guia-step-card">
          <div className="guia-step-num">03</div>
          <div className="guia-step-body">
            <h4>Descarga Lista para Imprimir</h4>
            <p>Obtén el archivo ZIP o PDF consolidado con los exámenes y sus hojas de respuestas OMR.</p>
            <div className="guia-step-preview">
              <span className="badge badge-meta">PDF / ZIP Imprimible</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
