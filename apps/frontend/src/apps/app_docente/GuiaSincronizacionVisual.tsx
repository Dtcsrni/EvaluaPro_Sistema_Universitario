/**
 * GuiaSincronizacionVisual
 *
 * Responsabilidad: Guía interactiva Bento Step Cards para Sincronización Híbrida y Respaldos.
 */
import { useState } from 'react';
import { Boton } from '../../ui/ux/componentes/Boton';
import { Icono } from '../../ui/iconos';

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
          icono={<Icono nombre="info" />}
        >
          Ver guía rápida de sincronización
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Sincronización y respaldos">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Sincronización local, entre equipos y nube</span>
        </div>
        <button
          type="button"
          className="guia-materia-close-btn"
          onClick={toggleGuia}
          aria-label="Ocultar guía rápida"
        >
          Ocultar guía rápida
        </button>
      </div>

      <div className="guia-materia-grid">
        {/* Paso 01: Detección P2P */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <Icono nombre="sincronizacion" size={22} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Conexión entre equipos</h4>
            <p>Conecta dos computadoras en la misma red local mediante un PIN. No requiere internet.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Red local</span>
              <span className="guia-chip-sample">PIN de conexión</span>
            </div>
          </div>
        </div>

        {/* Paso 02: Paquetes de Respaldo */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <Icono nombre="descargar" size={22} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Paquete de datos cifrado</h4>
            <p>Exporta registros a un archivo .ep-sync.json; puedes filtrar por materia y fecha e incluir PDFs.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date">Archivo .ep-sync.json</span>
              <span className="guia-chip-sample">Cifrado autenticado</span>
            </div>
          </div>
        </div>

        {/* Paso 03: Fusión Sin Conflictos */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <Icono nombre="sincronizacion" size={22} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Sincronización en nube e instantánea completa</h4>
            <p>La nube aplica la última escritura por registro. La instantánea local 1:1 valida el archivo y crea un respaldo antes de reemplazar los datos del equipo.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Última escritura: solo nube</span>
              <span className="guia-chip-sample">Instantánea .ep-snapshot</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
