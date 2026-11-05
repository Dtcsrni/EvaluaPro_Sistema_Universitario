/**
 * GuiaClassroomVisual
 *
 * Responsabilidad: Guia interactiva Bento Step Cards para Google Classroom.
 */
import { useState } from 'react';
import { Icono } from '../../ui/iconos';
import { ClipboardList, LogIn, UsersRound, IconoLucide, X } from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaClassroomVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.classroom.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.classroom.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in" aria-label="Ayuda rápida de Google Classroom">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver explicación visual de los 3 pasos para sincronizar con Google Classroom"
        >
          <Icono nombre="info" size={16} />
          Ver guía rápida de sincronización con Google Classroom
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Sincronización con Google Classroom">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Flujo Oficial de Sincronización Google Classroom</span>
        </div>
        <button
          type="button"
          className="guia-materia-close-btn"
          onClick={toggleGuia}
          title="Ocultar guía"
          aria-label="Ocultar guía rápida"
        >
          <IconoLucide icon={X} size={16} aria-hidden="true" />
          Ocultar guía
        </button>
      </div>

      <div className="guia-materia-grid">
        {/* Paso 1 */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={LogIn} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Conexión con Google</h4>
            <p>
              Autoriza a EvaluaPro a consultar los cursos, temas, listas de alumnos y actividades de Classroom que necesitas revisar.
            </p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Autorización de Google</span>
              <span className="guia-chip-sample">Consulta de datos</span>
            </div>
          </div>
        </div>

        {/* Paso 2 */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={UsersRound} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Vinculación de estudiantes</h4>
            <p>
              Selecciona el curso y asigna cada estudiante a su registro de EvaluaPro; después guarda las vinculaciones del periodo.
            </p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date">Matrícula</span>
              <span className="guia-chip-sample">Asignación manual</span>
            </div>
          </div>
        </div>

        {/* Paso 3 */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={ClipboardList} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Importación de Actividades</h4>
            <p>
              Elige las tareas y cuestionarios de Classroom para consolidar sus calificaciones en la evaluación continua del corte activo.
            </p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Cortes C1 / C2 / C3</span>
              <span className="guia-chip-sample">Preview Seguro</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
