/**
 * GuiaAsistenciasVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para el pase de lista y control de asistencias.
 */
import { useState } from 'react';
import { BookOpenText, CircleCheck, CircleX, ClipboardCheck, Clock3, FileCheck2, Lightbulb, ShieldCheck, IconoLucide } from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaAsistenciasVisual() {
  const [visible, setVisible] = useState(() => {
    const viewportMovil = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches === true;
    try {
      const preferencia = localStorage.getItem('ep.guia.asistencias.oculta');
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
        localStorage.setItem('ep.guia.asistencias.oculta', next ? 'false' : 'true');
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
          id="toggle-guia-asistencias"
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          aria-expanded={visible}
          aria-controls="guia-asistencias-panel"
          icono={<IconoLucide icon={Lightbulb} size={16} />}
        >
          {visible ? 'Ocultar guía rápida de asistencias' : 'Ver guía rápida de asistencias'}
        </Boton>
      </div>

    <div id="guia-asistencias-panel" hidden={!visible}>
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Control de asistencias y pase de lista">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Pase de Lista y Control de Asistencias</span>
        </div>
      </div>

      <div className="guia-materia-grid">
        {/* Paso 1: Seleccionar Materia y Grupo */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={BookOpenText} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Selecciona materia y grupo</h4>
            <p>Elige el curso lectivo y el grupo para cargar la lista oficial de estudiantes inscritos.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Cálculo Integral</span>
              <span className="guia-chip-sample">Grupo 3A</span>
            </div>
          </div>
        </div>

        {/* Paso 2: Registro de estados */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={ClipboardCheck} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Marca la asistencia</h4>
            <p>Elige uno de los cuatro estados en cada fila. <strong>Todos presentes</strong> marca a toda la lista como presente; revisa después ausencias, retardos y justificantes.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date"><IconoLucide icon={CircleCheck} size={14} /> Presente</span>
              <span className="guia-chip-sample"><IconoLucide icon={CircleX} size={14} /> Falta</span>
              <span className="guia-chip-sample"><IconoLucide icon={Clock3} size={14} /> Retardo</span>
              <span className="guia-chip-sample"><IconoLucide icon={FileCheck2} size={14} /> Justificado</span>
            </div>
          </div>
        </div>

        {/* Paso 3: Semáforo y Derecho a Examen */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={ShieldCheck} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Revisa el derecho a examen</h4>
            <p>Consulta el porcentaje de asistencia y el estado de derecho a examen calculados para cada alumno.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample"><IconoLucide icon={CircleCheck} size={14} /> Sin bloqueo</span>
              <span className="guia-chip-sample"><IconoLucide icon={CircleX} size={14} /> Examen bloqueado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
    </>
  );
}
