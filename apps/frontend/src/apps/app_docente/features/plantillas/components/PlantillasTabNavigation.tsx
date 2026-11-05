import { useEffect, useState, type KeyboardEvent, type FocusEvent } from 'react';
import { Icono } from '../../../../../ui/iconos';
import type { TabPlantillas } from '../tabPlantillasState';

const ORDEN_TABS: TabPlantillas[] = ['diseno', 'generacion', 'historial'];

export function PlantillasTabNavigation({
  tabActiva,
  totalPlantillas,
  generandoLote,
  totalExamenes,
  onChange
}: {
  tabActiva: TabPlantillas;
  totalPlantillas: number;
  generandoLote: boolean;
  totalExamenes: number;
  onChange: (tab: TabPlantillas) => void;
}) {
  const [tabConFoco, setTabConFoco] = useState(tabActiva);

  useEffect(() => setTabConFoco(tabActiva), [tabActiva]);

  function manejarTeclado(event: KeyboardEvent<HTMLDivElement>) {
    const indiceActual = ORDEN_TABS.indexOf(tabConFoco);
    let indiceSiguiente: number | null = null;

    if (event.key === 'ArrowRight') indiceSiguiente = (indiceActual + 1) % ORDEN_TABS.length;
    else if (event.key === 'ArrowLeft') indiceSiguiente = (indiceActual + ORDEN_TABS.length - 1) % ORDEN_TABS.length;
    else if (event.key === 'Home') indiceSiguiente = 0;
    else if (event.key === 'End') indiceSiguiente = ORDEN_TABS.length - 1;

    if (indiceSiguiente === null) return;
    event.preventDefault();
    const siguiente = ORDEN_TABS[indiceSiguiente];
    setTabConFoco(siguiente);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab-key="${siguiente}"]`)?.focus();
  }

  function restaurarSeleccionAlSalir(event: FocusEvent<HTMLDivElement>) {
    const destino = event.relatedTarget;
    if (!(destino instanceof Node) || !event.currentTarget.contains(destino)) setTabConFoco(tabActiva);
  }

  return (
    <div
      className="plantillas-tabs-bar anim-fade-in"
      role="tablist"
      tabIndex={-1}
      aria-label="Etapas de diseño, generación e historial de exámenes"
      aria-orientation="horizontal"
      onKeyDown={manejarTeclado}
      onBlur={restaurarSeleccionAlSalir}
    >
      <button
        type="button"
        id="plantillas-tab-diseno"
        role="tab"
        aria-selected={tabActiva === 'diseno'}
        aria-controls="plantillas-panel-diseno"
        tabIndex={tabConFoco === 'diseno' ? 0 : -1}
        data-tab-key="diseno"
        className={`plantillas-tab-btn ${tabActiva === 'diseno' ? 'plantillas-tab-btn--active' : ''}`}
        onFocus={() => setTabConFoco('diseno')}
        onClick={() => onChange('diseno')}
      >
        <span className="plantillas-tab-btn__icon"><Icono nombre="plantillas" size={18} /></span>
        <span className="plantillas-tab-btn__label">Diseñar Exámenes</span>
        <span className="plantillas-tab-btn__count">{totalPlantillas}</span>
      </button>

      <button
        type="button"
        id="plantillas-tab-generacion"
        role="tab"
        aria-selected={tabActiva === 'generacion'}
        aria-controls="plantillas-panel-generacion"
        tabIndex={tabConFoco === 'generacion' ? 0 : -1}
        data-tab-key="generacion"
        className={`plantillas-tab-btn ${tabActiva === 'generacion' ? 'plantillas-tab-btn--active' : ''}`}
        onFocus={() => setTabConFoco('generacion')}
        onClick={() => onChange('generacion')}
      >
        <span className="plantillas-tab-btn__icon"><Icono nombre="publicar" size={18} /></span>
        <span className="plantillas-tab-btn__label">Generar Paquete PDF/OMR</span>
        {generandoLote && <span className="plantillas-tab-btn__badge pulse">En progreso</span>}
      </button>

      <button
        type="button"
        id="plantillas-tab-historial"
        role="tab"
        aria-selected={tabActiva === 'historial'}
        aria-controls="plantillas-panel-historial"
        tabIndex={tabConFoco === 'historial' ? 0 : -1}
        data-tab-key="historial"
        className={`plantillas-tab-btn ${tabActiva === 'historial' ? 'plantillas-tab-btn--active' : ''}`}
        onFocus={() => setTabConFoco('historial')}
        onClick={() => onChange('historial')}
      >
        <span className="plantillas-tab-btn__icon"><Icono nombre="recargar" size={18} /></span>
        <span className="plantillas-tab-btn__label">Historial de Lotes</span>
        <span className="plantillas-tab-btn__count">{totalExamenes}</span>
      </button>
    </div>
  );
}
