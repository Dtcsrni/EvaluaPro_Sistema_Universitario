/**
 * GuiaClassroomVisual
 *
 * Responsabilidad: Guia interactiva Bento Step Cards para Google Classroom.
 */
import { useState } from 'react';
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

      <div className="guia-materia-grid">
        {/* Paso 1 */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Conexión OAuth Segura</h4>
            <p>
              Autoriza a EvaluaPro para consultar tus asignaturas y alumnos directamente desde Google Workspace con cifrado AES-256.
            </p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Google SSO</span>
              <span className="guia-chip-sample">Token Cifrado</span>
            </div>
          </div>
        </div>

        {/* Paso 2 */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Mapeo de Alumnos & Roster</h4>
            <p>
              Selecciona tu curso en Classroom y asocia cada estudiante con su matrícula en EvaluaPro con autovinculación instantánea.
            </p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date">Matrícula CUH</span>
              <span className="guia-chip-sample">Auto-match 1 Clic</span>
            </div>
          </div>
        </div>

        {/* Paso 3 */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
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
