/**
 * GuiaCuentaVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Centro de Cuenta y Licenciamiento.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaCuentaVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.cuenta.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.cuenta.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in" aria-label="Ayuda rápida de cuenta">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver explicación visual de tu cuenta docente y licencias"
        >
          💡 Ver guía rápida de cuenta y seguridad
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Cuenta y licencias">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Perfil Docente, Licenciamiento y Seguridad</span>
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
        {/* Paso 01: Perfil e Institución */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Perfil e Institución</h4>
            <p>Revisa tus datos de identidad académica y vinculación institucional con Google Workspace.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Cuenta Institucional</span>
              <span className="guia-chip-sample">Google OAuth</span>
            </div>
          </div>
        </div>

        {/* Paso 02: Licencia Offline */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Licencia Institucional</h4>
            <p>Gestiona tu clave de licencia institucional con vigencia offline y soporte multisede.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date">Plan Pro Multisede</span>
              <span className="guia-chip-sample">Firma RSA</span>
            </div>
          </div>
        </div>

        {/* Paso 03: Seguridad y Sesiones */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Seguridad & Criptografía</h4>
            <p>Tokens cifrados en reposo, verificación de permisos y cierre seguro de sesiones activas.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">AES-256 GCM</span>
              <span className="guia-chip-sample">Auditoría Activa</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
