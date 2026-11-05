import { obtenerModoApp, obtenerVersionTecnicaApp } from './versionInfo';

/** Identifica visualmente los entornos no productivos en todas las vistas. */
export function RuntimeEnvironmentRibbon() {
  const modo = obtenerModoApp();
  if (modo === 'prod') return null;

  const etiqueta = modo === 'test' ? 'PRUEBAS' : 'DESARROLLO';
  return (
    <aside
      className={`runtime-ribbon runtime-ribbon--${modo}`}
      data-testid="runtime-environment-ribbon"
      role="status"
      aria-label={`${etiqueta}, versión ${obtenerVersionTecnicaApp()}, datos aislados`}
    >
      <span className="runtime-ribbon__mark" aria-hidden="true">EP</span>
      <strong className="runtime-ribbon__environment">{etiqueta}</strong>
      <span className="runtime-ribbon__version">v{obtenerVersionTecnicaApp()}</span>
      <span className="runtime-ribbon__note">DATOS AISLADOS</span>
    </aside>
  );
}
