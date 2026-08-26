/**
 * GuiaHistorialLotesVisual
 *
 * Responsabilidad: Guía interactiva Bento para la pestaña 3: Historial de Lotes.
 */
import { useState } from 'react';
import { Boton } from '../../../../../ui/ux/componentes/Boton';

export function GuiaHistorialLotesVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.historial.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.historial.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in mb-15" aria-label="Ayuda de historial de lotes">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver guía de custodia y descargas"
        >
          💡 Ver guía rápida de historial y custodia
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in mb-20" role="region" aria-label="Ayuda: Historial de lotes">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Custodia, Descargas y Trazabilidad OMR</span>
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
            <h4>Paquetes Generados</h4>
            <p>Revisa la lista histórica de lotes emitidos con sus fechas y total de folios.</p>
            <div className="guia-step-preview">
              <span className="badge badge-meta">Registro por Lote</span>
            </div>
          </div>
        </div>

        <div className="guia-step-card">
          <div className="guia-step-num">02</div>
          <div className="guia-step-body">
            <h4>Reimpresión y Descarga</h4>
            <p>Vuelve a descargar cualquier paquete PDF o regenera exámenes individuales si se extravían.</p>
            <div className="guia-step-preview">
              <span className="badge badge-tema-chip">Descarga 1-clic</span>
            </div>
          </div>
        </div>

        <div className="guia-step-card">
          <div className="guia-step-num">03</div>
          <div className="guia-step-body">
            <h4>Calificación y Flujo OMR</h4>
            <p>Una vez aplicados los exámenes, pasa a la sección “Calificaciones” para procesar las hojas ópticas.</p>
            <div className="guia-step-preview">
              <span className="badge badge-meta">Escaneo OMR</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
