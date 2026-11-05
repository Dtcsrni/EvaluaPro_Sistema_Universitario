/**
 * GuiaMateriaVisual
 *
 * Responsabilidad: Guía interactiva moderna con Bento Step Cards para materias.
 */
import { useState } from 'react';
import { Icono } from '../../ui/iconos';
import { BookOpenText, CalendarDays, Tags, X, IconoLucide } from '../../ui/iconosCatalogo';
import { Boton } from '../../ui/ux/componentes/Boton';

export function GuiaMateriaVisual() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ep.guia.materias.oculta') === 'false';
    } catch {
      return false;
    }
  });

  function toggleGuia() {
    setVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ep.guia.materias.oculta', next ? 'false' : 'true');
      } catch {
        // noop
      }
      return next;
    });
  }

  if (!visible) {
    return (
      <div className="guia-materia-compact anim-fade-in" aria-label="Ayuda rapida de materias">
        <Boton
          variante="secundario"
          type="button"
          onClick={toggleGuia}
          icono={<Icono nombre="info" />}
          aria-label="Ver guía rápida de configuración"
          data-tooltip="Ver explicación visual de los 3 pasos para configurar una materia"
        >
          Ayuda rápida
        </Boton>
      </div>
    );
  }

  return (
    <div className="guia-materia-card anim-fade-in" role="region" aria-label="Ayuda: Para qué sirve y cómo llenarlo">
      <div className="guia-materia-header">
        <div className="guia-materia-badge">
          <span className="guia-pulse-dot" aria-hidden="true" />
          <span>GUÍA RÁPIDA: Para qué sirve y cómo llenarlo</span>
        </div>
        <button
          type="button"
          className="guia-materia-close-btn"
          onClick={toggleGuia}
          title="Ocultar guía"
          aria-label="Ocultar guía rápida"
        >
          <IconoLucide icon={X} size={16} /> Ocultar guía
        </button>
      </div>

      <div className="guia-materia-grid">
        {/* Paso 1: Nombre de la Asignatura */}
        <div className="guia-step-card guia-step-card--blue anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={BookOpenText} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 01</span>
            <h4>Nombre de la Materia</h4>
            <p>Escribe el nombre oficial de la asignatura que impartirás este periodo.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">Álgebra Lineal</span>
              <span className="guia-chip-sample">Física Aplicada</span>
            </div>
          </div>
        </div>

        {/* Paso 2: Rango de Fechas */}
        <div className="guia-step-card guia-step-card--emerald anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={CalendarDays} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 02</span>
            <h4>Rango de Fechas</h4>
            <p>Fija el inicio y fin del curso lectivo para habilitar la entrega de calificaciones.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample guia-chip-sample--date">Inicio → Fin</span>
            </div>
          </div>
        </div>

        {/* Paso 3: Grupos Asignados */}
        <div className="guia-step-card guia-step-card--purple anim-card-hover">
          <div className="guia-step-card__icon-orb" aria-hidden="true">
            <IconoLucide icon={Tags} size={24} />
          </div>
          <div className="guia-step-card__body">
            <span className="guia-step-chip">PASO 03</span>
            <h4>Grupos Asignados</h4>
            <p>Ingresa las aulas o secciones separadas por coma para organizar las listas de alumnos.</p>
            <div className="guia-step-examples">
              <span className="guia-chip-sample">1A</span>
              <span className="guia-chip-sample">1B</span>
              <span className="guia-chip-sample">2C</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
