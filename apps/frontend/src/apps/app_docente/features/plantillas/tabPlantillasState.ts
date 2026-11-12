export type TabPlantillas = 'diseno' | 'generacion' | 'historial';

export const PLANTILLAS_TAB_STORAGE_KEY = 'evaluapro.plantillas.tab-activa';

export function leerTabPlantillasInicial(): TabPlantillas {
  if (typeof window === 'undefined') return 'diseno';
  try {
    const tab = window.sessionStorage.getItem(PLANTILLAS_TAB_STORAGE_KEY);
    return tab === 'generacion' || tab === 'historial' || tab === 'diseno' ? tab : 'diseno';
  } catch {
    return 'diseno';
  }
}

export function guardarTabPlantillas(tab: TabPlantillas): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PLANTILLAS_TAB_STORAGE_KEY, tab);
  } catch {
    // La navegación sigue funcionando aunque el almacenamiento de sesión esté deshabilitado.
  }
}
