/**
 * GuiaSincronizacionVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Sincronización Híbrida y Respaldos.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaSincronizacionVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.sincronizacion.oculta') !== 'true';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.sincronizacion.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-temarios-compact anim-fade-in" aria-label="Ayuda rápida de sincronización">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          data-tooltip="Ver explicación visual de sincronización y paquetes de respaldo"
        >
          💡 Ver guía rápida de sincronización
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Sincronización y respaldos">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Sincronización Local, P2P y Nube</span>
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
        {/* Paso 01: Detección P2P */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Emparejamiento de Equipos</h4>
            <p>Conecta laptops en la misma red local mediante PIN seguro sin necesidad de internet.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Red Local WiFi</span>
              <span className="guia-chip-sample">PIN Cifrado</span>
            </div>
          </div>
        </div>

        {/* Paso 02: Paquetes de Respaldo */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Paquetes de Respaldo</h4>
            <p>Genera archivos zip cifrados con preguntas, exámenes y calificaciones para portar en USB.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date">Respaldo .epbak</span>
              <span className="guia-chip-sample">Cifrado AES-256</span>
            </div>
          </div>
        </div>

        {/* Paso 03: Fusión Sin Conflictos */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Fusión No Destructiva</h4>
            <p>Importa datos fusionando calificaciones y asistencias sin sobreescribir datos recientes.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Merge Inteligente</span>
              <span className="guia-chip-sample">Cero Pérdida</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
