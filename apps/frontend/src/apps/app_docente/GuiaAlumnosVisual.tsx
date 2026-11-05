/**
 * GuiaAlumnosVisual
 *
 * Responsabilidad: Guía interactiva moderna con Bento Step Cards para gestión de alumnos y matrículas.
 */
import { useState } from 'react';
import { Icono } from '../../ui/iconos';
import { BookOpenText, IdCard, Mail, UserRound, X, IconoLucide } from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaAlumnosVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.alumnos.oculta') === 'false';
    } catch {
      return true;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.alumnos.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-materia-compact anim-fade-in">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          aria-expanded={visible}
          data-tooltip="Ver guía de 3 pasos para matrícula y expedientes de alumnos"
          icono={<Icono nombre="info" />}
        >
          Ver guía rápida de gestión de alumnos
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Guía rápida de gestión de alumnos">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA DE GESTIÓN DE ALUMNOS</span>
        </div>
        <button
          type="button"
          className="guia-materia-close-btn"
          onClick={toggleGuia}
          title="Ocultar guía"
          aria-label="Ocultar guía rápida"
          aria-expanded={visible}
        >
          <IconoLucide icon={X} size={16} /> Ocultar guía
        </button>
      </div>

      <div className="guia-materia-grid">
        {/* Paso 1: Matrícula Oficial */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={IdCard} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Matrícula Institucional</h4>
            <p>Ingresa la matrícula oficial con formato <code>CUH#########</code> (9 dígitos numéricos).</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">CUH512410168</span>
              <span className="guia-chip-sample">CUH512410199</span>
            </div>
          </div>
        </div>

        {/* Paso 2: Nombres y Correo */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={UserRound} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Nombres y Correo</h4>
            <p>Escribe nombres completos. El correo institucional <code>@cuh.mx</code> se sugerirá solo.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date"><IconoLucide icon={Mail} size={14} /> alumno@cuh.mx</span>
            </div>
          </div>
        </div>

        {/* Paso 3: Asignación y Materia */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={BookOpenText} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Materia y Grupo</h4>
            <p>Asigna el grupo correspondiente y la materia activa para habilitar listas y OMR.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">3A</span>
              <span className="guia-chip-sample">3B</span>
              <span className="guia-chip-sample">101</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
