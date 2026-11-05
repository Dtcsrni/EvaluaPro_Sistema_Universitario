/**
 * GuiaHistorialLotesVisual
 *
 * Responsabilidad: Guía interactiva Bento para la pestaña 3: Historial de Lotes.
 */
import { useGuiaContextual } from '../hooks/useGuiaContextual';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { Lightbulb, X, IconoLucide } from '../../../../../ui/iconosCatalogo';

export function GuiaHistorialLotesVisual() {
  const { visible, toggleGuia } = useGuiaContextual('ep.guia.historial.oculta', 'guia-historial-toggle');

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in mb-15" aria-label="Ayuda de historial de lotes">
        <Boton
          id="guia-historial-toggle"
          variante="secundario"
          type="button"
          aria-expanded={visible}
          onClick={toggleGuia}
          data-tooltip="Ver guía de custodia y descargas"
        >
          <IconoLucide icon={Lightbulb} size={16} /> Ver guía rápida de historial y custodia
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
          id="guia-historial-toggle"
          type="button"
          className="guia-materia-close-btn"
          onClick={toggleGuia}
          title="Ocultar guía"
          aria-label="Ocultar guía rápida"
          aria-expanded={visible}
        >
          <IconoLucide icon={X} size={16} aria-hidden="true" /> Ocultar guía
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
