/**
 * GuiaEntregaVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Registro y Control de Entregas.
 */
import { useId, useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';
import { Check, CircleCheck, Lightbulb, PackageCheck, IconoLucide } from '../../ui/iconosCatalogo';

export function GuiaEntregaVisual() {
  const contenidoId = `guia-entrega-${useId()}`;
  const [visible, setVisible] = useState(() => {
    const viewportMovil = typeof window !== 'undefined'
      && window.matchMedia?.('(max-width: 767px)').matches === true;
    try {
      const preferencia = localStorage.getItem('ep.guia.entrega.oculta');
      if (preferencia === 'true') return false;
      if (preferencia === 'false') return true;
    } catch {
      return !viewportMovil;
    }
    return !viewportMovil;
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

  return (
    <>
      <div className="guia-plegable-control">
        <Boton
          id="toggle-guia-entrega"
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          aria-expanded={visible}
          aria-controls={contenidoId}
          icono={<IconoLucide icon={Lightbulb} />}
        >
          {visible ? 'Ocultar guía rápida de recepción de exámenes' : 'Ver guía rápida de recepción de exámenes'}
        </Boton>
      </div>

      <div id={contenidoId} role="region" aria-label="Ayuda: Registro y recepción de exámenes" hidden={!visible}>
        <div className="guia-materia-card anim-fade-in">
          <div className="guia-materia-header">
            <div className="guia-materia-badge">
              <span className="guia-pulse-dot" aria-hidden="true" />
              <span>GUÍA RÁPIDA · Custodia y Recepción de Exámenes</span>
            </div>
          </div>

          <div className="guia-materia-grid">
        {/* Paso 01: Selección de Lote */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={PackageCheck} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Selección de Lote</h4>
            <p>Elige la plantilla y el grupo que corresponden a la aplicación del examen.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Plantilla: Examen Parcial 1</span>
              <span className="guia-chip-sample">Grupo: 3A</span>
            </div>
          </div>
        </div>

        {/* Paso 02: Recepción / Folio */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={Check} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Marcación de Folios</h4>
            <p>Registra la entrega física con el lector QR o la acción manual de cada folio.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date"><IconoLucide icon={Check} size={13} /> Recibido</span>
              <span className="guia-chip-sample">Folio de ejemplo: 84920</span>
            </div>
          </div>
        </div>

        {/* Paso 03: Validación OMR */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={CircleCheck} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Preparar revisión OMR</h4>
            <p>Comprueba el estado de los folios recibidos antes de procesar las respuestas con OMR.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Estado de recepción</span>
              <span className="guia-chip-sample">Siguiente paso: lectura OMR</span>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>
    </>
  );
}
