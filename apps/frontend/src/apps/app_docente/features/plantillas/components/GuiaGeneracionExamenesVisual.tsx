/**
 * GuiaGeneracionExamenesVisual
 *
 * Responsabilidad: Guía interactiva Bento para la pestaña 2: Generar Paquete PDF/OMR.
 */
import { useGuiaContextual } from '../hooks/useGuiaContextual';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { Lightbulb, X, IconoLucide } from '../../../../../ui/iconosCatalogo';

export function GuiaGeneracionExamenesVisual() {
  const { visible, toggleGuia } = useGuiaContextual('ep.guia.generacion.oculta', 'guia-generacion-toggle');

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in mb-15" aria-label="Ayuda de generación de exámenes">
        <Boton
          id="guia-generacion-toggle"
          variante="secundario"
          type="button"
          aria-expanded={visible}
          onClick={toggleGuia}
          data-tooltip="Ver guía de generación masiva con códigos QR"
        >
          <IconoLucide icon={Lightbulb} size={16} /> Ver guía rápida de generación de exámenes
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
          id="guia-generacion-toggle"
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
