/**
 * GuiaCuentaVisual
 *
 * Responsabilidad: guía breve de las opciones disponibles en Cuenta docente.
 */
import { useState } from 'react';
import { Icono } from '../../ui/iconos';
import { FileText, ShieldCheck, UserRound, IconoLucide, X } from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaCuentaVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.cuenta.oculta') === 'false';
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
          aria-expanded={visible}
        >
          <Icono nombre="info" size={16} />
          Ver guía rápida de cuenta y seguridad
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Cuenta docente">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA · Cuenta docente</span>
        </div>
        <button
          type="button"
          className="guia-materia-close-btn"
          onClick={toggleGuia}
          title="Ocultar guía"
          aria-label="Ocultar guía rápida"
          aria-expanded={visible}
        >
          <IconoLucide icon={X} size={16} aria-hidden="true" />
          Ocultar guía
        </button>
      </div>

      <div className="guia-materia-grid">
        {/* Paso 01: Perfil docente */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={UserRound} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PERFIL</span>
            <h4>Cuenta y foto de perfil</h4>
            <p>Revisa los datos de tu cuenta. La foto se guarda en este equipo y no se envía al servidor.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Datos de cuenta</span>
              <span className="guia-chip-sample">Foto local</span>
            </div>
          </div>
        </div>

        {/* Paso 02: Preferencias de PDF */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={FileText} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">DOCUMENTOS</span>
            <h4>PDF institucional</h4>
            <p>Personaliza el nombre de la institución, el lema, los logotipos y las páginas predeterminadas.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Membrete y logotipos</span>
              <span className="guia-chip-sample">Páginas por documento</span>
            </div>
          </div>
        </div>

        {/* Paso 03: Sincronización y acceso */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={ShieldCheck} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">ACCESO</span>
            <h4>Sincronización y seguridad</h4>
            <p>Elige la carpeta local sincronizada por OneDrive y revisa tus métodos disponibles para iniciar sesión.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Carpeta local</span>
              <span className="guia-chip-sample">Contraseña o Google</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
