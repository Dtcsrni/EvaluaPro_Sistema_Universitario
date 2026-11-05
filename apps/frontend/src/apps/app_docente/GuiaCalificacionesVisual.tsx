/**
 * GuiaCalificacionesVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Calificación y Escrutinio OMR.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';
import {
  ChartNoAxesColumnIncreasing,
  Keyboard,
  Lightbulb,
  ScanLine,
  X,
  IconoLucide
} from '../../ui/iconosCatalogo';

export function GuiaCalificacionesVisual() {
  const [visible, setVisible] = useState(() => {
    let preferencia: string | null = null;
    try {
      preferencia = localStorage.getItem('ep.guia.calificaciones.oculta');
    } catch {
      // Si el navegador bloquea el almacenamiento, se decide con el viewport.
    }

    if (preferencia === 'true') return false;
    if (preferencia === 'false') return true;
    return !(typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 700px)').matches);
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.calificaciones.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  return (
    <div
      className={`${visible ? 'guia-materia-card' : 'guia-temarios-compact'} anim-fade-in`}
      role={visible ? 'region' : undefined}
      aria-label={visible ? 'Ayuda: Captura, revisión y calificación' : undefined}
    >
      <div className="guia-materia-header">
        <div className="guia-materia-badge" hidden={!visible}>
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Captura y revisión de calificaciones</span>
        </div>
        <Boton
          variante="secundario"
          type="button"
          className={visible ? 'guia-materia-close-btn' : undefined}
          onClick={toggleGuia}
          title={visible ? 'Ocultar guía' : undefined}
          aria-label={visible ? 'Ocultar guía rápida' : 'Ver guía rápida de calificaciones'}
          aria-expanded={visible}
          data-tooltip={visible ? undefined : 'Ver explicación visual de los 3 pasos para calificación OMR'}
          icono={<IconoLucide icon={visible ? X : Lightbulb} size={16} />}
        >
          {visible ? 'Ocultar guía' : 'Ver guía rápida de calificaciones'}
        </Boton>
      </div>

      {visible && <div className="guia-materia-grid">
        {/* Paso 01: Lectura de exámenes */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={ScanLine} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Leer exámenes</h4>
            <p>Carga imágenes de exámenes individuales o en lote y revisa la lectura detectada.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Captura individual o lote</span>
              <span className="guia-chip-sample">Lectura de marcas OMR</span>
            </div>
          </div>
        </div>

        {/* Paso 02: Revisión de respuestas */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={Keyboard} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Revisar respuestas dudosas</h4>
            <p>Corrige cada respuesta detectada: usa A–E para asignar una opción y 0, Supr o Retroceso para dejarla sin respuesta.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">A–E asigna respuesta</span>
              <span className="guia-chip-sample">0 borra respuesta</span>
            </div>
          </div>
        </div>

        {/* Paso 03: Calificación y exportación */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={ChartNoAxesColumnIncreasing} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Calificar y exportar resultados</h4>
            <p>Consulta las calificaciones calculadas y descarga los resultados en CSV o XLSX.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">CSV</span>
              <span className="guia-chip-sample">XLSX</span>
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}
