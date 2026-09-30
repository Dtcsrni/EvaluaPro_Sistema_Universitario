export type TabPlantillas = 'diseno' | 'generacion' | 'historial';

export const PLANTILLAS_TAB_STORAGE_KEY = 'evaluapro.plantillas.tab-activa';

export function guardarTabPlantillas(tab: TabPlantillas): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PLANTILLAS_TAB_STORAGE_KEY, tab);
  } catch {
    // La navegación sigue funcionando aunque el almacenamiento de sesión esté deshabilitado.
  }
}
