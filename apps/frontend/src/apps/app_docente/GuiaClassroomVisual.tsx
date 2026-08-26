/**
 * GuiaClassroomVisual
 *
 * Responsabilidad: Guia interactiva Bento Step Cards para Google Classroom.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';
import { Icono } from '../../ui/iconos';

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
          💡 Ver guía rápida de sincronización con Google Classroom
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
          ✕ Ocultar guía
        </button>
      </div>

      <div className="guia-materia-steps-grid">
        {/* Paso 1 */}
        <div className="guia-step-card">
          <div className="guia-step-badge">
            <span className="guia-step-icon guia-step-icon--blue">
              <Icono nombre="entrar" />
            </span>
            <span className="guia-step-num">PASO 01</span>
          </div>
          <h4 className="guia-step-title">Conexión OAuth Segura</h4>
          <p className="guia-step-desc">
            Autoriza a EvaluaPro para consultar tus asignaturas y alumnos directamente desde Google Workspace con cifrado AES-256.
          </p>
          <div className="guia-step-tags">
            <span className="guia-step-tag">Google SSO</span>
            <span className="guia-step-tag">Token Cifrado</span>
          </div>
        </div>

        {/* Paso 2 */}
        <div className="guia-step-card">
          <div className="guia-step-badge">
            <span className="guia-step-icon guia-step-icon--emerald">
              <Icono nombre="alumnos" />
            </span>
            <span className="guia-step-num">PASO 02</span>
          </div>
          <h4 className="guia-step-title">Mapeo de Alumnos & Roster</h4>
          <p className="guia-step-desc">
            Selecciona tu curso en Classroom y asocia cada estudiante con su matrícula en EvaluaPro con autovinculación instantánea.
          </p>
          <div className="guia-step-tags">
            <span className="guia-step-tag">Auto-match</span>
            <span className="guia-step-tag">1 Clic</span>
          </div>
        </div>

        {/* Paso 3 */}
        <div className="guia-step-card">
          <div className="guia-step-badge">
            <span className="guia-step-icon guia-step-icon--violet">
              <Icono nombre="evaluaciones" />
            </span>
            <span className="guia-step-num">PASO 03</span>
          </div>
          <h4 className="guia-step-title">Importación de Actividades</h4>
          <p className="guia-step-desc">
            Elige las tareas y cuestionarios de Classroom para consolidar sus calificaciones en la evaluación continua del corte activo.
          </p>
          <div className="guia-step-tags">
            <span className="guia-step-tag">Cortes C1/C2/C3</span>
            <span className="guia-step-tag">Preview Seguro</span>
          </div>
        </div>
      </div>
    </div>
  );
}
