/**
 * GuiaEvaluacionesVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Analítica y Métricas de Rendimiento.
 */
import { useId, useState } from 'react';
import {
  BookOpenCheck,
  ClipboardList,
  FileCheck2,
  Lightbulb,
  Scale,
  X,
  IconoLucide
} from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaEvaluacionesVisual() {
  const contenidoId = `guia-evaluaciones-${useId()}`;
  const [visible, setVisible] = useState(() => {
    try {
      const preferencia = localStorage.getItem('ep.guia.evaluaciones.oculta');
      if (preferencia === 'true') return false;
      if (preferencia === 'false') return true;
    } catch {
      return true;
    }
    return typeof window === 'undefined'
      || typeof window.matchMedia !== 'function'
      || !window.matchMedia('(max-width: 767px)').matches;
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.evaluaciones.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  const contenido = (
    <div
      id={contenidoId}
      role="region"
      aria-label="Ayuda: Analítica de evaluaciones"
      hidden={!visible}
    >
      <div className="guia-materia-grid evaluaciones-guide-grid">
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={Scale} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">VISTA 01</span>
            <h4>Política</h4>
            <p>Consulta o configura la política de evaluación y las ponderaciones del periodo seleccionado.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Componentes</span>
              <span className="guia-chip-sample">Ponderaciones</span>
            </div>
          </div>
        </div>

        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={ClipboardList} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">VISTA 02</span>
            <h4>Evidencias</h4>
            <p>Consulta y registra evidencias de evaluación continua para el alumno y periodo seleccionados.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Origen</span>
              <span className="guia-chip-sample">Estado</span>
            </div>
          </div>
        </div>

        <div className="guia-step-card guia-step-card--amber anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={FileCheck2} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">VISTA 03</span>
            <h4>Exámenes</h4>
            <p>Registra calificaciones teóricas y prácticas y consulta el corte al que pertenecen.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Teoría</span>
              <span className="guia-chip-sample">Prácticas</span>
            </div>
          </div>
        </div>

        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={BookOpenCheck} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">VISTA 04</span>
            <h4>Resumen</h4>
            <p>Revisa el resultado del alumno, los componentes recibidos y los datos que aún faltan.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Resultado</span>
              <span className="guia-chip-sample">Datos faltantes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in" aria-label="Ayuda rápida de evaluaciones">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          aria-controls={contenidoId}
          aria-expanded={visible}
          data-tooltip="Ver explicación visual de analítica y métricas de desempeño"
          icono={<IconoLucide icon={Lightbulb} />}
        >
          Ver guía rápida de Evaluaciones
        </Boton>
        {contenido}
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Analítica y Curvas de Rendimiento</span>
        </div>
        <button
          type="button"
          className="guia-materia-close-btn"
          onClick={toggleGuia}
          title="Ocultar guía"
          aria-label="Ocultar guía rápida"
          aria-controls={contenidoId}
          aria-expanded={visible}
        >
          <IconoLucide icon={X} size={16} /> Ocultar guía
        </button>
      </div>
      {contenido}
    </div>
  );
}
