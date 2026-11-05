/**
 * GuiaTemariosVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para estructuración y avance de temarios.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';
import {
  BookOpenText,
  ChartNoAxesColumnIncreasing,
  Circle,
  CircleCheck,
  Clock3,
  FileText,
  Lightbulb,
  Upload,
  IconoLucide
} from '../../ui/iconosCatalogo';

export function GuiaTemariosVisual() {
  const [visible, setVisible] = useState(() => {
    const viewportMovil = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches === true;
    try {
      const preferencia = localStorage.getItem('ep.guia.temarios.oculta');
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
        localStorage.setItem('ep.guia.temarios.oculta', next ? 'false' : 'true');
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
          id="toggle-guia-temarios"
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          aria-expanded={visible}
          aria-controls="guia-temarios-panel"
        >
          <IconoLucide icon={Lightbulb} size={16} /> {visible ? 'Ocultar guía rápida de temarios' : 'Ver guía rápida de temarios'}
        </Boton>
      </div>

      <div id="guia-temarios-panel" hidden={!visible}>
        <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Estructura y seguimiento de temarios">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Estructura Curricular y Temarios</span>
        </div>
      </div>

      <div className="guia-materia-grid">
        {/* Paso 1: Selecciona la Asignatura */}
        <div className="guia-step-card guia-step-card--amber anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={BookOpenText} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Selecciona la Asignatura</h4>
            <p>Elige el curso lectivo para cargar o crear el plan de estudios y árbol de unidades temáticas.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Cálculo Integral</span>
              <span className="guia-chip-sample">Estructuras</span>
            </div>
          </div>
        </div>

        {/* Paso 2: Carga en PDF o Texto */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={Upload} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Carga Inteligente o Jerárquica</h4>
            <p>Arrastra tu programa oficial en PDF o escribe el árbol con numeración jerárquica.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date"><IconoLucide icon={FileText} size={14} /> Programa.pdf</span>
              <span className="guia-chip-sample">1.1 Subtema</span>
            </div>
          </div>
        </div>

        {/* Paso 3: Seguimiento y Avance */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={ChartNoAxesColumnIncreasing} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Seguimiento y Avance de Clase</h4>
            <p>Haz clic en los temas para actualizar su estatus en tiempo real y calcular el avance del curso.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample"><IconoLucide icon={Circle} size={14} /> Pendiente</span>
              <span className="guia-chip-sample"><IconoLucide icon={Clock3} size={14} /> En progreso</span>
              <span className="guia-chip-sample"><IconoLucide icon={CircleCheck} size={14} /> Cubierto</span>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </>
  );
}
