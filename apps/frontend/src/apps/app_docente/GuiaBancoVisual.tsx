/**
 * GuiaBancoVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Banco de Preguntas y Estimación.
 */
import { useState } from 'react';
import { BookOpenText, Calculator, Check, Lightbulb, PencilLine, IconoLucide } from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaBancoVisual() {
  const [visible, setVisible] = useState(() => {
    const viewportMovil = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches === true;
    try {
      const preferencia = localStorage.getItem('ep.guia.banco.oculta');
      if (preferencia === 'true') return false;
      if (preferencia === 'false') return true;
      return !viewportMovil;
    } catch {
      return !viewportMovil;
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

  return (
    <>
      <div className="guia-plegable-control">
        <Boton
          id="toggle-guia-banco"
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          aria-expanded={visible}
          aria-controls="guia-banco-panel"
          icono={<IconoLucide icon={Lightbulb} />}
        >
          {visible ? 'Ocultar guía rápida de Banco de reactivos' : 'Ver guía rápida de Banco de reactivos'}
        </Boton>
      </div>

      <div id="guia-banco-panel" hidden={!visible}>
        <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Banco de preguntas y estimación">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Banco de Reactivos y Estimación</span>
        </div>
      </div>

      <div className="guia-materia-grid">
        {/* Paso 01: Materia y Tema */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={BookOpenText} size={24} />
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
            <IconoLucide icon={PencilLine} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Redacción y Opciones</h4>
            <p>Escribe el enunciado, sube imagen de apoyo opcional, llena opciones A–E y marca la respuesta correcta.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">5 Opciones (A–E)</span>
              <span className="guia-chip-sample guia-chip-sample--date"><IconoLucide icon={Check} size={14} /> 1 correcta</span>
            </div>
          </div>
        </div>

        {/* Paso 03: Estimación OMR */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={Calculator} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Estimación de páginas</h4>
            <p>Consulta la estimación para el formato Carta con plantilla OMR y confirma la paginación en la vista previa del examen.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Carta · OMR</span>
              <span className="guia-chip-sample">Revisar vista previa</span>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </>
  );
}
